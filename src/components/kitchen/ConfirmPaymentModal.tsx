import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import type { Order } from '../../types';
import { formatXAF } from '../../lib/formatters';
import { useLanguage } from '../../i18n/LanguageContext';

interface ConfirmPaymentModalProps {
  order: Order | null;
  prefilledReference?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orderId: string, verifiedReference: string, internalNotes: string) => Promise<void>;
  isLoading: boolean;
}

export const ConfirmPaymentModal: React.FC<ConfirmPaymentModalProps> = ({
  order,
  prefilledReference = '',
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}) => {
  const { language, t } = useLanguage();
  const [verifiedRef, setVerifiedRef] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setVerifiedRef(prefilledReference.trim());
      setInternalNotes('');
      setErrorMessage(null);
    }
  }, [order, prefilledReference]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      await onConfirm(order.id, verifiedRef.trim(), internalNotes.trim());
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.errorGeneral;
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-6 z-10 sm:my-auto pb-safe">
        <div className="flex items-center justify-between pb-3.5 border-b border-hotel-border">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <h3 className="font-serif text-xl font-semibold text-hotel-text">
              {t.confirmPaymentTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-subtle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Details Banner */}
        <div className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-hotel-border space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-hotel-secondary">
              {language === 'fr' ? 'Référence de commande :' : 'Order reference:'}
            </span>
            <span className="font-mono font-bold text-hotel-text text-sm">
              {order.public_reference}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-hotel-secondary">
              {language === 'fr' ? 'Client :' : 'Customer:'}
            </span>
            <span className="font-medium text-hotel-text">{order.customer_name}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-hotel-border">
            <span className="text-hotel-secondary font-semibold">
              {language === 'fr' ? 'Montant attendu :' : 'Expected amount:'}
            </span>
            <span className="font-serif text-xl font-bold text-hotel-text">
              {formatXAF(order.total_amount)}
            </span>
          </div>
        </div>

        {/* Official Merchant Rule Notice */}
        <div className="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {t.confirmPaymentWarning}
          </p>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-1.5">
              {t.verifiedRefPrompt}
            </label>
            <input
              type="text"
              value={verifiedRef}
              onChange={(e) => setVerifiedRef(e.target.value)}
              placeholder={t.verifiedRefPlaceholder}
              className="input-hotel font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-1.5">
              {t.internalNotesPrompt}
            </label>
            <input
              type="text"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder={
                language === 'fr'
                  ? 'Ex : Vérifié sur le téléphone marchand Orange'
                  : 'e.g. Checked on merchant handset'
              }
              className="input-hotel text-xs"
            />
          </div>

          <div className="pt-3 border-t border-hotel-border flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-outline-gold flex-1 text-xs py-2.5"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-subtle transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.saving}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.confirmPaymentSubmit}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
