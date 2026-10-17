// Convivium Home Hotel — `send-push` Edge Function (Supabase / Deno).
//
// Delivers push notifications queued in `notification_outbox` through the
// Firebase Cloud Messaging HTTP v1 API.
//
// Trust model
//  - Only the database can call it: requests must carry `x-dispatch-secret`, compared
//    server-side with a secret stored in Supabase Vault (verify_push_dispatch_secret).
//  - Recipients are resolved by the database (get_push_recipients): role / order
//    filtering never depends on anything the caller sends.
//  - The Google service-account key lives ONLY in the FIREBASE_SERVICE_ACCOUNT
//    secret of this function. It is never logged, returned or sent to a client.
//
// Deploy with `--no-verify-jwt` (pg_net cannot send a user JWT; the dispatch secret
// is the authentication):  supabase functions deploy send-push --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildFcmData,
  buildPushMessage,
  classifyFcmFailure,
  decideOutboxOutcome,
  type PushAudience,
  type PushEventType,
  type PushLanguage,
} from '../_shared/push-messages.ts';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface OutboxRow {
  id: string;
  event_type: PushEventType;
  audience: PushAudience;
  public_reference: string;
}

interface Recipient {
  subscription_id: string;
  fcm_token: string;
  language: PushLanguage;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function loadServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---- Google OAuth2 (service account JWT bearer) --------------------------------
const base64Url = (input: ArrayBuffer | string): string => {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value;

  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    // Status only: never echo the response body (could contain auth details).
    throw new Error(`Google OAuth refused the service account (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in || 3600) };
  return cachedToken.value;
}

// ---- FCM HTTP v1 -----------------------------------------------------------
type SendResult =
  | { ok: true }
  | { ok: false; kind: 'invalid_token' | 'retry' | 'fatal'; status: number };

async function sendToDevice(
  sa: ServiceAccount,
  accessToken: string,
  token: string,
  data: Record<string, string>
): Promise<SendResult> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          // Data-only: the service worker renders it, so title/body are localised per device.
          data,
          webpush: { headers: { TTL: '3600', Urgency: 'high' } },
        },
      }),
    }
  );
  if (res.ok) return { ok: true };
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // ignore unparsable body
  }
  return { ok: false, kind: classifyFcmFailure(res.status, body), status: res.status };
}

// ---- Main ------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'backend_not_configured' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Authenticate the caller (database only)
  const provided = req.headers.get('x-dispatch-secret') || '';
  const { data: authorised } = await admin.rpc('verify_push_dispatch_secret', {
    p_secret: provided,
  });
  if (authorised !== true) return json({ error: 'unauthorized' }, 401);

  // 2. Firebase must be configured; otherwise leave rows pending (nothing is lost)
  const sa = loadServiceAccount();
  if (!sa) return json({ error: 'fcm_not_configured' }, 503);

  let payload: { outbox_id?: string; drain?: boolean } = {};
  try {
    payload = await req.json();
  } catch {
    payload = { drain: true };
  }
  const outboxId =
    typeof payload.outbox_id === 'string' && UUID_RE.test(payload.outbox_id)
      ? payload.outbox_id
      : null;

  // 3. Atomically claim work (SKIP LOCKED + attempts counter => no double sends)
  const { data: claimed, error: claimError } = await admin.rpc('claim_notification_outbox', {
    p_limit: outboxId ? 1 : 20,
    p_id: outboxId,
  });
  if (claimError) return json({ error: 'claim_failed' }, 500);

  const rows = (claimed || []) as OutboxRow[];
  const summary = { claimed: rows.length, sent: 0, skipped: 0, pending: 0, failed: 0, pruned: 0 };
  if (rows.length === 0) return json(summary);

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth_error';
    for (const row of rows) {
      await admin.rpc('finalize_notification_outbox', {
        p_id: row.id,
        p_status: 'pending',
        p_recipients: 0,
        p_delivered: 0,
        p_error: msg,
      });
      summary.pending++;
    }
    return json(summary, 502);
  }

  for (const row of rows) {
    try {
      const { data: recipientsData, error: recError } = await admin.rpc('get_push_recipients', {
        p_outbox_id: row.id,
      });
      if (recError) throw new Error('recipients_lookup_failed');
      const recipients = (recipientsData || []) as Recipient[];

      const stale: string[] = [];
      let delivered = 0;
      let retryable = 0;
      let lastStatus = 0;

      // Chunks of 10 devices in parallel
      for (let i = 0; i < recipients.length; i += 10) {
        const chunk = recipients.slice(i, i + 10);
        const results = await Promise.all(
          chunk.map(async (r) => {
            const message = buildPushMessage(row.event_type, row.audience, r.language, row.public_reference);
            const data = buildFcmData(message, row.event_type, row.public_reference, r.language);
            try {
              return { r, result: await sendToDevice(sa, accessToken, r.fcm_token, data) };
            } catch {
              return { r, result: { ok: false, kind: 'retry', status: 0 } as SendResult };
            }
          })
        );
        for (const { r, result } of results) {
          if (result.ok) delivered++;
          else {
            lastStatus = result.status;
            if (result.kind === 'invalid_token') stale.push(r.subscription_id);
            else if (result.kind === 'retry') retryable++;
          }
        }
      }

      if (stale.length > 0) {
        await admin.rpc('prune_push_subscriptions', { p_ids: stale });
        summary.pruned += stale.length;
      }

      const outcome = decideOutboxOutcome({ recipients: recipients.length, delivered, retryable });
      await admin.rpc('finalize_notification_outbox', {
        p_id: row.id,
        p_status: outcome,
        p_recipients: recipients.length,
        p_delivered: delivered,
        p_error: outcome === 'sent' || outcome === 'skipped' ? null : `FCM HTTP ${lastStatus}`,
      });
      summary[outcome]++;
    } catch (e) {
      // A failed send never touches the order itself: only the outbox row is retried.
      await admin.rpc('finalize_notification_outbox', {
        p_id: row.id,
        p_status: 'pending',
        p_recipients: 0,
        p_delivered: 0,
        p_error: e instanceof Error ? e.message : 'send_error',
      });
      summary.pending++;
    }
  }

  return json(summary);
});
