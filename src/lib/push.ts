/**
 * Browser-side push helpers: capability detection, permission state and
 * notification deep links. Pure functions are unit-tested.
 */

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';
export type PushNavTarget = 'kitchen' | 'admin' | 'track';

const NAV_TARGETS: PushNavTarget[] = ['kitchen', 'admin', 'track'];
const REFERENCE_RE = /^[A-Za-z0-9-]{4,32}$/;

export function isValidPublicReference(ref: unknown): ref is string {
  return typeof ref === 'string' && REFERENCE_RE.test(ref);
}

/** True when the browser can do web push at all (service worker + Push API + Notification API). */
export function isBrowserPushCapable(win: Partial<Window> | undefined = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!win) return false;
  const nav = (win as Window).navigator;
  return Boolean(
    nav &&
      'serviceWorker' in nav &&
      'PushManager' in (win as object) &&
      'Notification' in (win as object)
  );
}

export function getPermissionState(): PushPermissionState {
  if (!isBrowserPushCapable()) return 'unsupported';
  return Notification.permission as PushPermissionState;
}

export interface NotificationDeepLink {
  target: PushNavTarget;
  ref: string | null;
}

/** Parses `?n=kitchen|admin|track[&ref=CVH-…]`. Anything else is ignored. */
export function parseNotificationDeepLink(search: string): NotificationDeepLink | null {
  const params = new URLSearchParams(search);
  const target = params.get('n') as PushNavTarget | null;
  if (!target || !NAV_TARGETS.includes(target)) return null;
  const ref = params.get('ref');
  return { target, ref: isValidPublicReference(ref) ? ref : null };
}

/** Removes notification params from a URL search string once handled. */
export function stripNotificationParams(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('n');
  params.delete('ref');
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

export const OPEN_NOTIFICATION_EVENT = 'convivium:notification-open';
export const PUSH_STATE_EVENT = 'convivium:push-state-changed';
export const PUSH_FOREGROUND_EVENT = 'convivium:push-foreground';
