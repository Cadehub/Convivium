/**
 * Convivium Home Hotel — push message catalogue & delivery decisions.
 *
 * PURE module: no Deno / browser / Node API, so it is shared by the `send-push`
 * Edge Function and unit-tested with Vitest.
 *
 * Privacy rules enforced here:
 *  - a notification only ever carries the public order reference (CVH-XXXX-XXXX);
 *  - never names, phone numbers, SMS text, merchant codes, amounts or access tokens;
 *  - a payment is only announced as confirmed by the dedicated `payment_confirmed`
 *    event, which the database emits when the server moved the order to `paid`.
 */

export type PushEventType =
  | 'order_created'
  | 'payment_declared'
  | 'payment_review_required'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'order_accepted'
  | 'order_preparing'
  | 'order_ready'
  | 'order_cancelled_by_client'
  | 'order_cancelled_by_staff';

export type PushAudience = 'cuisine' | 'admin' | 'client';
export type PushLanguage = 'fr' | 'en';
export type PushTarget = 'kitchen' | 'admin' | 'track';

export const PUSH_EVENT_TYPES: PushEventType[] = [
  'order_created',
  'payment_declared',
  'payment_review_required',
  'payment_confirmed',
  'payment_rejected',
  'order_accepted',
  'order_preparing',
  'order_ready',
  'order_cancelled_by_client',
  'order_cancelled_by_staff',
];

/** Which audiences each event may be addressed to (mirrors the SQL triggers). */
export const EVENT_AUDIENCES: Record<PushEventType, PushAudience[]> = {
  order_created: ['cuisine'],
  payment_declared: ['cuisine'],
  payment_review_required: ['cuisine', 'admin'],
  payment_confirmed: ['client'],
  payment_rejected: ['client'],
  order_accepted: ['client'],
  order_preparing: ['client'],
  order_ready: ['client'],
  order_cancelled_by_client: ['cuisine', 'admin'],
  order_cancelled_by_staff: ['client'],
};

export interface PushMessage {
  title: string;
  body: string;
  /** Collapses duplicates of the same notification on the device. */
  tag: string;
  target: PushTarget;
}

const PUBLIC_REFERENCE_RE = /^[A-Za-z0-9-]{4,32}$/;

export function isValidPublicReference(ref: unknown): ref is string {
  return typeof ref === 'string' && PUBLIC_REFERENCE_RE.test(ref);
}

type Copy = Record<PushLanguage, { title: string; body: (ref: string) => string }>;

const COPY: Record<PushEventType, Copy> = {
  order_created: {
    fr: { title: 'Nouvelle commande', body: (r) => `La commande ${r} vient d’être créée.` },
    en: { title: 'New order', body: (r) => `Order ${r} has just been created.` },
  },
  payment_declared: {
    fr: { title: 'Paiement déclaré', body: (r) => `Une vérification est attendue pour ${r}.` },
    en: { title: 'Payment declared', body: (r) => `A payment check is waiting for ${r}.` },
  },
  payment_review_required: {
    fr: { title: 'Paiement à vérifier', body: (r) => `La commande ${r} nécessite une action.` },
    en: { title: 'Payment to review', body: (r) => `Order ${r} needs your attention.` },
  },
  payment_confirmed: {
    fr: { title: 'Paiement confirmé', body: (r) => `Notre équipe a validé le paiement de ${r}.` },
    en: { title: 'Payment confirmed', body: (r) => `Our team has validated the payment for ${r}.` },
  },
  payment_rejected: {
    fr: {
      title: 'Paiement non validé',
      body: (r) => `La déclaration de ${r} n’a pas pu être validée. Ouvrez le suivi.`,
    },
    en: {
      title: 'Payment not validated',
      body: (r) => `The declaration for ${r} could not be validated. Open the tracking page.`,
    },
  },
  order_accepted: {
    fr: { title: 'Commande acceptée', body: (r) => `La commande ${r} a été acceptée.` },
    en: { title: 'Order accepted', body: (r) => `Order ${r} has been accepted.` },
  },
  order_preparing: {
    fr: { title: 'Préparation en cours', body: (r) => `La préparation de ${r} a commencé.` },
    en: { title: 'Preparation started', body: (r) => `Preparation of ${r} has started.` },
  },
  order_ready: {
    fr: { title: 'Commande prête', body: (r) => `La commande ${r} est prête.` },
    en: { title: 'Order ready', body: (r) => `Order ${r} is ready.` },
  },
  order_cancelled_by_client: {
    fr: { title: 'Commande annulée', body: (r) => `Le client a annulé la commande ${r}.` },
    en: { title: 'Order cancelled', body: (r) => `The customer cancelled order ${r}.` },
  },
  order_cancelled_by_staff: {
    fr: { title: 'Commande annulée', body: (r) => `La commande ${r} a été annulée.` },
    en: { title: 'Order cancelled', body: (r) => `Order ${r} has been cancelled.` },
  },
};

export function resolveTarget(eventType: PushEventType, audience: PushAudience): PushTarget {
  if (audience === 'client') return 'track';
  if (audience === 'admin') return 'admin';
  void eventType;
  return 'kitchen';
}

export function buildPushMessage(
  eventType: PushEventType,
  audience: PushAudience,
  language: PushLanguage,
  publicReference: string
): PushMessage {
  const lang: PushLanguage = language === 'en' ? 'en' : 'fr';
  const entry = COPY[eventType][lang];
  // Only a validated public reference may ever be interpolated.
  const ref = isValidPublicReference(publicReference) ? publicReference : '';
  const body = ref ? entry.body(ref) : entry.body('').replace(/\s{2,}/g, ' ').replace(' .', '.');
  return {
    title: entry.title,
    body,
    tag: `${eventType}:${ref}`,
    target: resolveTarget(eventType, audience),
  };
}

/** FCM `data` payload: every value MUST be a string. Contains no secret / personal data. */
export function buildFcmData(
  message: PushMessage,
  eventType: PushEventType,
  publicReference: string,
  language: PushLanguage
): Record<string, string> {
  return {
    title: message.title,
    body: message.body,
    tag: message.tag,
    event: eventType,
    target: message.target,
    ref: isValidPublicReference(publicReference) ? publicReference : '',
    lang: language,
  };
}

// ---------------------------------------------------------------------
// FCM HTTP v1 error handling
// ---------------------------------------------------------------------
export type FcmFailureKind = 'invalid_token' | 'retry' | 'fatal';

export function classifyFcmFailure(status: number, errorBody: unknown): FcmFailureKind {
  const err = (
    errorBody as {
      error?: { status?: string; message?: string; details?: Array<{ errorCode?: string }> };
    }
  )?.error;
  const code = err?.details?.find((d) => d?.errorCode)?.errorCode || err?.status || '';
  const message = (err?.message || '').toLowerCase();

  if (status === 404 || code === 'UNREGISTERED' || code === 'NOT_FOUND') return 'invalid_token';
  if (code === 'SENDER_ID_MISMATCH') return 'invalid_token';
  // INVALID_ARGUMENT can also mean a malformed payload (our bug): only prune when FCM blames the token.
  if (status === 400 && code === 'INVALID_ARGUMENT' && message.includes('registration token')) {
    return 'invalid_token';
  }
  if (status === 429 || status >= 500 || ['UNAVAILABLE', 'INTERNAL', 'QUOTA_EXCEEDED'].includes(code)) {
    return 'retry';
  }
  return 'fatal';
}

export type OutboxOutcome = 'sent' | 'skipped' | 'pending' | 'failed';

/**
 * Decides the final state of an outbox row.
 *  - no recipient                           -> skipped (nothing to do, not an error)
 *  - at least one device reached            -> sent  (never re-send: avoids duplicates)
 *  - nobody reached, transient errors       -> pending (retried by cron, max 5 attempts)
 *  - nobody reached, permanent errors only  -> failed
 */
export function decideOutboxOutcome(stats: {
  recipients: number;
  delivered: number;
  retryable: number;
}): OutboxOutcome {
  if (stats.recipients === 0) return 'skipped';
  if (stats.delivered > 0) return 'sent';
  if (stats.retryable > 0) return 'pending';
  return 'failed';
}
