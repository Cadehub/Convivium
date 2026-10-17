import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { PUSH_COPY } from '../../lib/push-copy';
import {
  OPEN_NOTIFICATION_EVENT,
  PUSH_STATE_EVENT,
  isValidPublicReference,
  type PushNavTarget,
} from '../../lib/push';
import {
  subscribeToForegroundMessages,
  type ForegroundPushMessage,
} from '../../services/push.service';

const TOAST_DURATION_MS = 7000;

function openNotification(target: string, ref: string) {
  window.dispatchEvent(
    new CustomEvent(OPEN_NOTIFICATION_EVENT, {
      detail: {
        target: target as PushNavTarget,
        ref: isValidPublicReference(ref) ? ref : null,
      },
    })
  );
}

/**
 * Mounted once at the root:
 *  - shows an in-app toast when a push arrives while the page is open;
 *  - relays service-worker notification clicks to the app (focus + navigate).
 * It never requests permission and never touches business data: the app re-reads
 * the real order state from the server when it navigates.
 */
export const PushRuntime: React.FC = () => {
  const { language } = useLanguage();
  const [toast, setToast] = useState<ForegroundPushMessage | null>(null);

  // Foreground messages (re-subscribed whenever notification state changes)
  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    const subscribe = async () => {
      unsubscribe();
      const off = await subscribeToForegroundMessages((message) => setToast(message));
      if (cancelled) off();
      else unsubscribe = off;
    };

    void subscribe();
    window.addEventListener(PUSH_STATE_EVENT, subscribe);
    return () => {
      cancelled = true;
      window.removeEventListener(PUSH_STATE_EVENT, subscribe);
      unsubscribe();
    };
  }, []);

  // Notification click while the app is already open
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; target?: string; ref?: string } | undefined;
      if (data?.type === 'CONVIVIUM_NOTIFICATION_CLICK') {
        openNotification(data.target || 'track', data.ref || '');
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 inset-x-3 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-96 z-[70]"
    >
      <div className="flex items-start gap-3 rounded-xl border border-[#E5D099] bg-white shadow-elevated px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-[#FBF7EE] border border-[#E5D099] flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-[#9A721C]" />
        </div>
        <button
          type="button"
          onClick={() => {
            openNotification(toast.target, toast.ref);
            setToast(null);
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm font-semibold text-hotel-text truncate">{toast.title}</p>
          <p className="text-xs text-hotel-secondary mt-0.5">{toast.body}</p>
        </button>
        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label={PUSH_COPY[language].close}
          className="text-hotel-muted hover:text-hotel-text shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
