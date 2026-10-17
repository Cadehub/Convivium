/**
 * Push notification client service (Firebase Cloud Messaging for the Web).
 *
 * - Supabase stays the backend: tokens are registered / revoked through RPCs that
 *   check the staff role or the order access token on the server.
 * - The browser permission is only ever requested from enable*() calls, i.e. after a
 *   deliberate click. Nothing is requested at page load.
 * - If notifications are unsupported, unconfigured or denied, every function fails
 *   softly: the app and order tracking keep working normally.
 */
import { supabase } from '../lib/supabase';
import {
  buildServiceWorkerUrl,
  getFirebaseConfig,
  getMessagingInstance,
} from '../lib/firebase';
import {
  getPermissionState,
  isBrowserPushCapable,
  PUSH_STATE_EVENT,
  type PushPermissionState,
} from '../lib/push';

export type PushFailureReason = 'unsupported' | 'unconfigured' | 'denied' | 'dismissed' | 'error';
export type PushResult = { ok: true } | { ok: false; reason: PushFailureReason; message?: string };

export type PushLanguage = 'fr' | 'en';

// ---------------------------------------------------------------------
// Local (device) state — never contains order access tokens
// ---------------------------------------------------------------------
const STORAGE_KEY = 'convivium_push_v1';

export interface PushLocalState {
  token?: string;
  staff?: boolean;
  clientRefs?: string[];
  dismissedRefs?: string[];
}

export function readPushState(): PushLocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PushLocalState) : {};
    return {
      token: typeof parsed.token === 'string' ? parsed.token : undefined,
      staff: parsed.staff === true,
      clientRefs: Array.isArray(parsed.clientRefs) ? parsed.clientRefs.filter((r) => typeof r === 'string') : [],
      dismissedRefs: Array.isArray(parsed.dismissedRefs)
        ? parsed.dismissedRefs.filter((r) => typeof r === 'string')
        : [],
    };
  } catch {
    return {};
  }
}

function writePushState(next: PushLocalState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: notifications simply won't persist across reloads
  }
  try {
    window.dispatchEvent(new CustomEvent(PUSH_STATE_EVENT));
  } catch {
    // non-browser environment
  }
}

export function isStaffPushEnabled(): boolean {
  return readPushState().staff === true;
}

export function isClientPushEnabled(publicReference: string): boolean {
  return (readPushState().clientRefs || []).includes(publicReference);
}

export function isClientPromptDismissed(publicReference: string): boolean {
  return (readPushState().dismissedRefs || []).includes(publicReference);
}

export function dismissClientPrompt(publicReference: string): void {
  const state = readPushState();
  const dismissed = new Set(state.dismissedRefs || []);
  dismissed.add(publicReference);
  writePushState({ ...state, dismissedRefs: Array.from(dismissed).slice(-50) });
}

export { getPermissionState };
export type { PushPermissionState };

// ---------------------------------------------------------------------
// Token acquisition
// ---------------------------------------------------------------------
type TokenOutcome = { token: string } | { fail: PushResult & { ok: false } };

async function acquireToken(options: { requestPermission: boolean }): Promise<TokenOutcome> {
  const config = getFirebaseConfig();
  if (!config) return { fail: { ok: false, reason: 'unconfigured' } };
  if (!isBrowserPushCapable()) return { fail: { ok: false, reason: 'unsupported' } };

  let permission = Notification.permission;
  if (permission === 'denied') return { fail: { ok: false, reason: 'denied' } };
  if (permission === 'default') {
    if (!options.requestPermission) return { fail: { ok: false, reason: 'dismissed' } };
    permission = await Notification.requestPermission();
    if (permission === 'denied') return { fail: { ok: false, reason: 'denied' } };
    if (permission !== 'granted') return { fail: { ok: false, reason: 'dismissed' } };
  }

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return { fail: { ok: false, reason: 'unsupported' } };

    const registration = await navigator.serviceWorker.register(buildServiceWorkerUrl(config), {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { fail: { ok: false, reason: 'error', message: 'empty_token' } };
    return { token };
  } catch (e) {
    return {
      fail: { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'token_error' },
    };
  }
}

async function deleteDeviceTokenIfUnused(): Promise<void> {
  const state = readPushState();
  if (state.staff || (state.clientRefs && state.clientRefs.length > 0)) return;
  try {
    const messaging = await getMessagingInstance();
    if (messaging) {
      const { deleteToken } = await import('firebase/messaging');
      await deleteToken(messaging);
    }
  } catch {
    // best effort: the server also prunes tokens FCM reports as invalid
  }
  writePushState({ ...readPushState(), token: undefined });
}

const userAgent = () => (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : '');

// ---------------------------------------------------------------------
// Staff (Admin / Cuisine) — requires an authenticated, authorised session
// ---------------------------------------------------------------------
async function registerStaffToken(token: string, language: PushLanguage): Promise<PushResult> {
  const { error } = await supabase.rpc('register_staff_push_subscription', {
    p_token: token,
    p_language: language,
    p_user_agent: userAgent(),
  });
  if (error) return { ok: false, reason: 'error', message: error.message };
  return { ok: true };
}

export async function enableStaffPush(language: PushLanguage): Promise<PushResult> {
  const outcome = await acquireToken({ requestPermission: true });
  if ('fail' in outcome) return outcome.fail;

  const result = await registerStaffToken(outcome.token, language);
  if (!result.ok) return result;

  writePushState({ ...readPushState(), token: outcome.token, staff: true });
  return { ok: true };
}

export async function disableStaffPush(): Promise<void> {
  const state = readPushState();
  if (state.token) {
    try {
      await supabase.rpc('unregister_staff_push_token', { p_token: state.token });
    } catch {
      // ignore network errors: the token is also pruned server side when invalid
    }
  }
  writePushState({ ...state, staff: false });
  await deleteDeviceTokenIfUnused();
}

/** Renewal: keeps the registration fresh and follows FCM token rotation. */
export async function refreshStaffPush(language: PushLanguage): Promise<void> {
  const state = readPushState();
  if (!state.staff) return;

  if (getPermissionState() !== 'granted') {
    // permission revoked in the browser settings: reflect it, drop the server record
    if (state.token) {
      await supabase.rpc('unregister_staff_push_token', { p_token: state.token });
    }
    writePushState({ ...state, staff: false, token: undefined });
    return;
  }

  const outcome = await acquireToken({ requestPermission: false });
  if ('fail' in outcome) return;

  if (state.token && state.token !== outcome.token) {
    await supabase.rpc('unregister_staff_push_token', { p_token: state.token });
  }
  const result = await registerStaffToken(outcome.token, language);
  if (result.ok) writePushState({ ...readPushState(), token: outcome.token, staff: true });
}

// ---------------------------------------------------------------------
// Client — bound to one order through its secure access token
// ---------------------------------------------------------------------
async function registerClientToken(
  publicReference: string,
  rawToken: string,
  fcmToken: string,
  language: PushLanguage
): Promise<PushResult> {
  const { data, error } = await supabase.rpc('register_client_push_subscription', {
    p_public_reference: publicReference,
    p_raw_token: rawToken,
    p_fcm_token: fcmToken,
    p_language: language,
    p_user_agent: userAgent(),
  });
  if (error) return { ok: false, reason: 'error', message: error.message };
  const res = data as unknown as { success?: boolean; error?: string } | null;
  if (!res?.success) return { ok: false, reason: 'error', message: res?.error };
  return { ok: true };
}

export async function enableClientPush(
  publicReference: string,
  rawToken: string,
  language: PushLanguage
): Promise<PushResult> {
  const outcome = await acquireToken({ requestPermission: true });
  if ('fail' in outcome) return outcome.fail;

  const result = await registerClientToken(publicReference, rawToken, outcome.token, language);
  if (!result.ok) return result;

  const state = readPushState();
  const refs = new Set(state.clientRefs || []);
  refs.add(publicReference);
  writePushState({ ...state, token: outcome.token, clientRefs: Array.from(refs) });
  return { ok: true };
}

export async function disableClientPush(publicReference: string, rawToken: string): Promise<void> {
  const state = readPushState();
  if (state.token) {
    try {
      await supabase.rpc('unregister_client_push_subscription', {
        p_public_reference: publicReference,
        p_raw_token: rawToken,
        p_fcm_token: state.token,
      });
    } catch {
      // ignore: local opt-out below still applies
    }
  }
  writePushState({
    ...state,
    clientRefs: (state.clientRefs || []).filter((r) => r !== publicReference),
  });
  await deleteDeviceTokenIfUnused();
}

export async function refreshClientPush(
  publicReference: string,
  rawToken: string,
  language: PushLanguage
): Promise<void> {
  const state = readPushState();
  if (!(state.clientRefs || []).includes(publicReference)) return;
  if (getPermissionState() !== 'granted') {
    writePushState({
      ...state,
      clientRefs: (state.clientRefs || []).filter((r) => r !== publicReference),
    });
    return;
  }
  const outcome = await acquireToken({ requestPermission: false });
  if ('fail' in outcome) return;
  if (state.token && state.token !== outcome.token) {
    await supabase.rpc('unregister_client_push_subscription', {
      p_public_reference: publicReference,
      p_raw_token: rawToken,
      p_fcm_token: state.token,
    });
  }
  const result = await registerClientToken(publicReference, rawToken, outcome.token, language);
  if (result.ok) writePushState({ ...readPushState(), token: outcome.token });
}

/** Used when the customer clears their tracking history: revoke every order subscription. */
export async function disableAllClientPush(
  orders: Array<{ public_reference: string; raw_token: string }>
): Promise<void> {
  const state = readPushState();
  if (state.token) {
    for (const order of orders) {
      if (!(state.clientRefs || []).includes(order.public_reference)) continue;
      try {
        await supabase.rpc('unregister_client_push_subscription', {
          p_public_reference: order.public_reference,
          p_raw_token: order.raw_token,
          p_fcm_token: state.token,
        });
      } catch {
        // best effort
      }
    }
  }
  writePushState({ ...state, clientRefs: [], dismissedRefs: [] });
  await deleteDeviceTokenIfUnused();
}

// ---------------------------------------------------------------------
// Foreground messages (page open)
// ---------------------------------------------------------------------
export interface ForegroundPushMessage {
  title: string;
  body: string;
  target: string;
  ref: string;
}

export async function subscribeToForegroundMessages(
  listener: (message: ForegroundPushMessage) => void
): Promise<() => void> {
  if (!getFirebaseConfig() || getPermissionState() !== 'granted') return () => undefined;
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return () => undefined;
    const { onMessage } = await import('firebase/messaging');
    return onMessage(messaging, (payload) => {
      const data = payload.data || {};
      if (!data.title) return;
      listener({
        title: data.title,
        body: data.body || '',
        target: data.target || 'track',
        ref: data.ref || '',
      });
    });
  } catch {
    return () => undefined;
  }
}
