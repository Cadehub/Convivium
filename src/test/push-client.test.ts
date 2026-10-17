import { describe, it, expect, beforeEach } from 'vitest';
import { PUSH_COPY } from '../lib/push-copy';
import {
  isBrowserPushCapable,
  parseNotificationDeepLink,
  stripNotificationParams,
  isValidPublicReference,
} from '../lib/push';
import {
  readPushState,
  isStaffPushEnabled,
  isClientPushEnabled,
  isClientPromptDismissed,
  dismissClientPrompt,
  enableStaffPush,
  disableStaffPush,
  enableClientPush,
  disableClientPush,
  disableAllClientPush,
} from '../services/push.service';

describe('PUSH_COPY parity and keys', () => {
  it('strictly matches all keys between French and English', () => {
    const frKeys = Object.keys(PUSH_COPY.fr).sort();
    const enKeys = Object.keys(PUSH_COPY.en).sort();
    expect(frKeys).toEqual(enKeys);
    expect(frKeys.length).toBeGreaterThanOrEqual(18);
  });

  it('provides distinct, non-empty text for every entry', () => {
    for (const key of Object.keys(PUSH_COPY.fr) as Array<keyof typeof PUSH_COPY.fr>) {
      const frVal = PUSH_COPY.fr[key];
      const enVal = PUSH_COPY.en[key];
      expect(frVal.trim().length).toBeGreaterThan(0);
      expect(enVal.trim().length).toBeGreaterThan(0);
      // Titles / bodies / hints should differ in wording
      if (!['notifications', 'close'].includes(key)) {
        expect(frVal).not.toBe(enVal);
      }
    }
  });
});

describe('Browser push helpers & deep link parsing', () => {
  it('detects capability safely depending on Window / navigator presence', () => {
    expect(isBrowserPushCapable(undefined)).toBe(false);
    expect(isBrowserPushCapable({} as Window)).toBe(false);

    const mockCapableWin = {
      navigator: { serviceWorker: {} },
      PushManager: function () {},
      Notification: function () {},
    } as unknown as Window;
    expect(isBrowserPushCapable(mockCapableWin)).toBe(true);
  });

  it('validates public order references strictly', () => {
    expect(isValidPublicReference('CVH-2610-1234')).toBe(true);
    expect(isValidPublicReference('CVH-0001')).toBe(true);
    expect(isValidPublicReference('')).toBe(false);
    expect(isValidPublicReference('CVH <script>')).toBe(false);
    expect(isValidPublicReference('a'.repeat(45))).toBe(false);
  });

  it('parses valid notification deep links and ignores malformed inputs', () => {
    expect(parseNotificationDeepLink('?n=kitchen')).toEqual({
      target: 'kitchen',
      ref: null,
    });
    expect(parseNotificationDeepLink('?n=track&ref=CVH-2610-9876')).toEqual({
      target: 'track',
      ref: 'CVH-2610-9876',
    });
    expect(parseNotificationDeepLink('?n=admin')).toEqual({
      target: 'admin',
      ref: null,
    });
    // Unknown target or malicious ref
    expect(parseNotificationDeepLink('?n=malicious')).toBeNull();
    expect(parseNotificationDeepLink('?other=123')).toBeNull();
    expect(parseNotificationDeepLink('?n=track&ref=bad*ref')).toEqual({
      target: 'track',
      ref: null,
    });
  });

  it('strips notification query parameters while preserving other parameters', () => {
    expect(stripNotificationParams('?n=track&ref=CVH-1234&tab=menu')).toBe('?tab=menu');
    expect(stripNotificationParams('?n=kitchen')).toBe('');
  });
});

describe('Push client service — local device state and graceful fallbacks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads safe empty defaults from localStorage', () => {
    const state = readPushState();
    expect(state.staff).toBe(false);
    expect(state.clientRefs).toEqual([]);
    expect(isStaffPushEnabled()).toBe(false);
    expect(isClientPushEnabled('CVH-2610-0001')).toBe(false);
  });

  it('records client prompt dismissal persistently on device', () => {
    const ref = 'CVH-2610-9999';
    expect(isClientPromptDismissed(ref)).toBe(false);
    dismissClientPrompt(ref);
    expect(isClientPromptDismissed(ref)).toBe(true);
  });

  it('gracefully handles missing Firebase config or unsupported environment without crashing', async () => {
    // In node/vitest, push is unconfigured by default
    const resStaff = await enableStaffPush('fr');
    expect(resStaff.ok).toBe(false);
    if (!resStaff.ok) {
      expect(['unconfigured', 'unsupported', 'denied']).toContain(resStaff.reason);
    }

    const resClient = await enableClientPush('CVH-123', 'tok', 'fr');
    expect(resClient.ok).toBe(false);
    if (!resClient.ok) {
      expect(['unconfigured', 'unsupported', 'denied']).toContain(resClient.reason);
    }

    // Disabling never throws
    await expect(disableStaffPush()).resolves.not.toThrow();
    await expect(disableClientPush('CVH-123', 'tok')).resolves.not.toThrow();
    await expect(
      disableAllClientPush([{ public_reference: 'CVH-123', raw_token: 'tok' }])
    ).resolves.not.toThrow();
  });
});
