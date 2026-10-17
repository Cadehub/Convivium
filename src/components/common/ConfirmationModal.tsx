import React from 'react';
import { AlertTriangle, AlertCircle, HelpCircle, X, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export type ConfirmationVariant = 'warning' | 'danger' | 'info';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'warning',
  isLoading = false,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isInfo = variant === 'info';

  const iconClasses = isDanger
    ? 'text-red-600 bg-red-100 border-red-200'
    : isInfo
    ? 'text-blue-600 bg-blue-100 border-blue-200'
    : 'text-amber-600 bg-amber-100 border-amber-200';

  const confirmBtnClasses = isDanger
    ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs focus:ring-red-500'
    : isInfo
    ? 'bg-hotel-dark hover:bg-stone-800 text-white shadow-xs focus:ring-stone-500'
    : 'btn-gold';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/50 backdrop-blur-[2px] transition-opacity"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md bg-white border border-hotel-border rounded-2xl shadow-elevated p-6 z-10 my-auto text-hotel-text">
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${iconClasses}`}
          >
            {isDanger ? (
              <AlertCircle className="w-5 h-5" />
            ) : isInfo ? (
              <HelpCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h3
              id="confirm-modal-title"
              className="font-serif text-lg font-bold text-hotel-text leading-snug"
            >
              {title}
            </h3>
            <p className="mt-2 text-xs text-hotel-secondary leading-relaxed">
              {message}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-subtle transition-colors disabled:opacity-40"
            aria-label={t.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-hotel-border flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto btn-outline-gold py-2.5 px-4 text-xs font-semibold disabled:opacity-50"
          >
            {cancelLabel || t.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={isLoading}
            className={`w-full sm:w-auto py-2.5 px-5 text-xs font-bold rounded-lg transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${confirmBtnClasses}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t.loading}</span>
              </>
            ) : (
              <span>{confirmLabel || t.confirm}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
