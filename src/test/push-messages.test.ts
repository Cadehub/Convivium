import { describe, it, expect } from 'vitest';
import {
  PUSH_EVENT_TYPES,
  EVENT_AUDIENCES,
  buildPushMessage,
  buildFcmData,
  classifyFcmFailure,
  decideOutboxOutcome,
  isValidPublicReference,
  type PushAudience,
  type PushEventType,
} from '../../supabase/functions/_shared/push-messages';

const REF = 'CVH-2610-AB12';

describe('push messages — content & privacy', () => {
  const combos: Array<[PushEventType, PushAudience, 'fr' | 'en']> = [];
  for (const ev of PUSH_EVENT_TYPES) {
    for (const aud of EVENT_AUDIENCES[ev]) {
      for (const lang of ['fr', 'en'] as const) combos.push([ev, aud, lang]);
    }
  }

  it('builds a short, localised message for every event / audience / language', () => {
    for (const [ev, aud, lang] of combos) {
      const m = buildPushMessage(ev, aud, lang, REF);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.title.length).toBeLessThanOrEqual(40);
      expect(m.body.length).toBeGreaterThan(0);
      expect(m.body.length).toBeLessThanOrEqual(100);
    }
  });

  it('is bilingual: FR and EN texts differ for every event', () => {
    for (const ev of PUSH_EVENT_TYPES) {
      const aud = EVENT_AUDIENCES[ev][0];
      const fr = buildPushMessage(ev, aud, 'fr', REF);
      const en = buildPushMessage(ev, aud, 'en', REF);
      expect(fr.title).not.toBe(en.title);
      expect(fr.body).not.toBe(en.body);
    }
  });

  it('never contains personal or sensitive data — only the public reference', () => {
    const forbidden = [
      /\+?\d[\d\s.-]{7,}\d/, // phone-like numbers
      /token/i,
      /sms/i,
      /merchant|marchand/i,
      /XAF|FCFA/i,
      /@/,
      /\b\d{5,}\b/,
    ];
    for (const [ev, aud, lang] of combos) {
      const m = buildPushMessage(ev, aud, lang, REF);
      const text = `${m.title} ${m.body}`;
      for (const re of forbidden) expect(text).not.toMatch(re);
      // the only identifier allowed is the public reference
      expect(m.body.replace(REF, '')).not.toMatch(/CVH/);
    }
  });

  it('only announces a confirmed payment for the server-emitted payment_confirmed event', () => {
    for (const [ev, aud, lang] of combos) {
      const m = buildPushMessage(ev, aud, lang, REF);
      const claimsConfirmed = /confirm|valid(é|ated)/i.test(`${m.title} ${m.body}`);
      if (ev === 'payment_confirmed') expect(claimsConfirmed).toBe(true);
      if (ev === 'payment_declared' || ev === 'payment_review_required') {
        expect(claimsConfirmed).toBe(false);
      }
    }
  });

  it('drops an invalid reference instead of echoing attacker-controlled text', () => {
    const m = buildPushMessage('order_ready', 'client', 'fr', '<script>alert(1)</script>');
    expect(m.body).not.toContain('<script>');
    expect(isValidPublicReference('CVH-2610-AB12')).toBe(true);
    expect(isValidPublicReference('a b')).toBe(false);
    expect(isValidPublicReference('x'.repeat(40))).toBe(false);
  });

  it('routes staff to their workspace and clients to order tracking', () => {
    expect(buildPushMessage('order_created', 'cuisine', 'fr', REF).target).toBe('kitchen');
    expect(buildPushMessage('payment_review_required', 'admin', 'fr', REF).target).toBe('admin');
    expect(buildPushMessage('order_ready', 'client', 'fr', REF).target).toBe('track');
  });

  it('FCM data payload only holds strings and no secret', () => {
    const m = buildPushMessage('order_ready', 'client', 'en', REF);
    const data = buildFcmData(m, 'order_ready', REF, 'en');
    for (const v of Object.values(data)) expect(typeof v).toBe('string');
    expect(Object.keys(data).sort()).toEqual(
      ['body', 'event', 'lang', 'ref', 'tag', 'target', 'title'].sort()
    );
  });
});

describe('push audiences — recipient filtering rules', () => {
  it('client events never target staff and staff events never target clients', () => {
    for (const ev of PUSH_EVENT_TYPES) {
      const audiences = EVENT_AUDIENCES[ev];
      const hasClient = audiences.includes('client');
      const hasStaff = audiences.some((a) => a === 'cuisine' || a === 'admin');
      expect(hasClient && hasStaff).toBe(false);
    }
  });

  it('payment actions are for Cuisine; Admin only gets management-relevant events', () => {
    expect(EVENT_AUDIENCES.order_created).toEqual(['cuisine']);
    expect(EVENT_AUDIENCES.payment_declared).toEqual(['cuisine']);
    const adminEvents = PUSH_EVENT_TYPES.filter((e) => EVENT_AUDIENCES[e].includes('admin'));
    expect(adminEvents.sort()).toEqual(['order_cancelled_by_client', 'payment_review_required']);
  });
});

describe('FCM failure handling', () => {
  it('prunes tokens that FCM reports as unregistered / sender mismatch', () => {
    expect(classifyFcmFailure(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } })).toBe('invalid_token');
    expect(classifyFcmFailure(403, { error: { status: 'PERMISSION_DENIED', details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } })).toBe('invalid_token');
    expect(
      classifyFcmFailure(400, {
        error: { status: 'INVALID_ARGUMENT', message: 'The registration token is not a valid FCM registration token' },
      })
    ).toBe('invalid_token');
  });

  it('does NOT prune tokens when the payload itself is invalid (our bug)', () => {
    expect(
      classifyFcmFailure(400, { error: { status: 'INVALID_ARGUMENT', message: 'Invalid value at message.data' } })
    ).toBe('fatal');
  });

  it('retries transient errors and treats auth / config errors as fatal', () => {
    expect(classifyFcmFailure(503, { error: { status: 'UNAVAILABLE' } })).toBe('retry');
    expect(classifyFcmFailure(429, { error: { status: 'QUOTA_EXCEEDED' } })).toBe('retry');
    expect(classifyFcmFailure(500, null)).toBe('retry');
    expect(classifyFcmFailure(401, { error: { status: 'UNAUTHENTICATED' } })).toBe('fatal');
  });
});

describe('outbox outcome — no loss, no duplicates', () => {
  it('skips when nobody subscribed (not an error)', () => {
    expect(decideOutboxOutcome({ recipients: 0, delivered: 0, retryable: 0 })).toBe('skipped');
  });
  it('marks sent as soon as one device was reached, even if others failed (no resend)', () => {
    expect(decideOutboxOutcome({ recipients: 3, delivered: 1, retryable: 2 })).toBe('sent');
  });
  it('retries when nobody was reached because of transient errors', () => {
    expect(decideOutboxOutcome({ recipients: 2, delivered: 0, retryable: 2 })).toBe('pending');
  });
  it('fails (observable) when only permanent errors occurred', () => {
    expect(decideOutboxOutcome({ recipients: 2, delivered: 0, retryable: 0 })).toBe('failed');
  });
});
