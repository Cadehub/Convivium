import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { PUSH_COPY, type PushCopyKey } from '../../lib/push-copy';
import { isPushConfigured } from '../../lib/firebase';
import { PUSH_STATE_EVENT } from '../../lib/push';
import {
  dismissClientPrompt,
  disableClientPush,
  disableStaffPush,
  enableClientPush,
  enableStaffPush,
  getPermissionState,
  isClientPromptDismissed,
  isClientPushEnabled,
  isStaffPushEnabled,
  refreshClientPush,
  refreshStaffPush,
  type PushFailureReason,
} from '../../services/push.service';

type Copy = Record<PushCopyKey, string>;

function failureMessage(c: Copy, reason: PushFailureReason): string {
  switch (reason) {
    case 'unsupported':
      return c.unsupported;
    case 'unconfigured':
      return c.unconfigured;
    case 'denied':
      return c.denied;
    case 'dismissed':
      return c.dismissed;
    default:
      return c.error;
  }
}

/** Re-reads device state when it changes (enable / disable / other tab). */
function useDeviceState(readEnabled: () => boolean) {
  const [, force] = useState(0);
  useEffect(() => {
    const bump = () => force((n) => n + 1);
    window.addEventListener(PUSH_STATE_EVENT, bump);
    window.addEventListener('focus', bump);
    return () => {
      window.removeEventListener(PUSH_STATE_EVENT, bump);
      window.removeEventListener('focus', bump);
    };
  }, []);
  return { enabled: readEnabled(), permission: getPermissionState(), configured: isPushConfigured() };
}

// ---------------------------------------------------------------------
// Staff: discreet bell in the workspace header with a small status panel
// ---------------------------------------------------------------------
export const StaffNotificationButton: React.FC<{ placement?: 'down' | 'up' }> = ({
  placement = 'down',
}) => {
  const { language } = useLanguage();
  const c = PUSH_COPY[language];
  const { enabled, permission, configured } = useDeviceState(isStaffPushEnabled);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Renewal: keep the registration fresh and follow FCM token rotation on each session
  useEffect(() => {
    void refreshStaffPush(language).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unavailable = permission === 'unsupported' || !configured;

  const handleEnable = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const result = await enableStaffPush(language);
    if (!result.ok) setMessage(failureMessage(c, result.reason));
    setBusy(false);
  }, [language, c]);

  const handleDisable = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    await disableStaffPush();
    setBusy(false);
  }, []);

  const statusText = !configured
    ? c.unconfigured
    : permission === 'unsupported'
      ? c.unsupported
      : permission === 'denied'
        ? c.denied
        : enabled
          ? c.active
          : c.inactive;

  const Icon = enabled ? BellRing : unavailable || permission === 'denied' ? BellOff : Bell;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={c.notifications}
        title={c.notifications}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-hotel-border bg-white text-hotel-secondary hover:text-hotel-text hover:border-hotel-borderStrong transition-colors"
      >
        <Icon className={`w-4 h-4 ${enabled ? 'text-[#9A721C]' : ''}`} />
        {enabled && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label={c.notifications}
            className={`absolute w-72 z-50 rounded-xl border border-hotel-border bg-white shadow-elevated p-4 ${
              placement === 'up' ? 'left-0 bottom-full mb-2' : 'right-0 mt-2'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-hotel-text">{c.notifications}</p>
                <p className="text-xs text-hotel-secondary mt-0.5">{c.staffHint}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={c.close}
                className="text-hotel-muted hover:text-hotel-text shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p
              className={`mt-3 text-xs rounded-lg px-3 py-2 border ${
                enabled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-hotel-subtle border-hotel-border text-hotel-secondary'
              }`}
            >
              {statusText}
            </p>

            {message && <p className="mt-2 text-xs text-red-700">{message}</p>}

            {!unavailable && permission !== 'denied' && (
              <div className="mt-3">
                {enabled ? (
                  <button
                    type="button"
                    onClick={handleDisable}
                    disabled={busy}
                    className="btn-outline-gold w-full justify-center text-xs py-2 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />}
                    <span>{c.disable}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnable}
                    disabled={busy}
                    className="btn-gold w-full justify-center text-xs py-2 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                    <span>{busy ? c.enabling : c.enable}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Client: optional card inside order tracking (no account, bound to the order)
// ---------------------------------------------------------------------
interface ClientNotificationCardProps {
  publicReference: string;
  rawToken: string;
  /** Completed / cancelled orders have nothing left to announce. */
  isClosed?: boolean;
}

export const ClientNotificationCard: React.FC<ClientNotificationCardProps> = ({
  publicReference,
  rawToken,
  isClosed,
}) => {
  const { language } = useLanguage();
  const c = PUSH_COPY[language];
  const { enabled, permission, configured } = useDeviceState(() =>
    isClientPushEnabled(publicReference)
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => isClientPromptDismissed(publicReference));

  useEffect(() => {
    setDismissed(isClientPromptDismissed(publicReference));
    setMessage(null);
  }, [publicReference]);

  // Renewal for this order (token rotation / re-registration)
  useEffect(() => {
    if (rawToken && isClientPushEnabled(publicReference)) {
      void refreshClientPush(publicReference, rawToken, language).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicReference, rawToken]);

  // Tracking keeps working untouched when push is impossible: render nothing.
  if (!configured || permission === 'unsupported' || isClosed || !rawToken) return null;

  const handleEnable = async () => {
    setBusy(true);
    setMessage(null);
    const result = await enableClientPush(publicReference, rawToken, language);
    if (!result.ok) setMessage(failureMessage(c, result.reason));
    setBusy(false);
  };

  const handleDisable = async () => {
    setBusy(true);
    setMessage(null);
    await disableClientPush(publicReference, rawToken);
    setBusy(false);
  };

  if (enabled) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-xs text-emerald-900">
          <BellRing className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{c.clientActive}</span>
        </p>
        <button
          type="button"
          onClick={handleDisable}
          disabled={busy}
          className="text-xs font-semibold text-emerald-900 underline underline-offset-2 hover:text-emerald-700 disabled:opacity-50"
        >
          {c.disable}
        </button>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <p className="inline-flex items-start gap-2 text-xs text-hotel-secondary rounded-xl border border-hotel-border bg-hotel-subtle px-4 py-3">
        <BellOff className="w-4 h-4 shrink-0 mt-px" />
        <span>{c.denied}</span>
      </p>
    );
  }

  if (dismissed) {
    return (
      <div>
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8A6214] hover:text-hotel-text disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
          <span>{c.clientTurnOn}</span>
        </button>
        {message && <p className="mt-1 text-xs text-red-700">{message}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E5D099] bg-[#FBF7EE] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white border border-[#E5D099] flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-[#9A721C]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-hotel-text">{c.clientTitle}</p>
          <p className="text-xs text-hotel-secondary mt-0.5">{c.clientHint}</p>
          {message && <p className="mt-2 text-xs text-red-700">{message}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy}
              className="btn-gold text-xs py-2 px-3.5 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              <span>{busy ? c.enabling : c.enable}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                dismissClientPrompt(publicReference);
                setDismissed(true);
              }}
              className="text-xs font-medium text-hotel-secondary hover:text-hotel-text px-2 py-2"
            >
              {c.later}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
