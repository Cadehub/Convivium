import React, { useState, useEffect } from 'react';
import { X, HelpCircle, AlertTriangle, Loader2 } from 'lucide-react';
import type { Order } from '../../types';
import { formatXAF } from '../../lib/formatters';
import { useLanguage } from '../../i18n/LanguageContext';

interface ReviewPaymentModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmReview: (orderId: string, notes: string) => Promise<void>;
  isLoading: boolean;
}

export const ReviewPaymentModal: React.FC<ReviewPaymentModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmReview,
  isLoading,
}) => {
  const { language, t } = useLanguage();
  const [reviewNotes, setReviewNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setReviewNotes('');
      setErrorMessage(null);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewNotes.trim()) {
      setErrorMessage(
        language === 'fr'
          ? 'Veuillez préciser la raison de la vérification complémentaire.'
          : 'Please specify the reason for additional verification.'
      );
      return;
    }

    setErrorMessage(null);
    try {
      await onConfirmReview(order.id, reviewNotes.trim());
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
            <HelpCircle className="w-5 h-5 text-amber-600" />
            <h3 className="font-serif text-xl font-semibold text-hotel-text">
              {t.flagReviewTitle}
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

        <div className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-hotel-border space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-hotel-secondary">
              {language === 'fr' ? 'Commande :' : 'Order:'}
            </span>
            <span className="font-mono font-bold text-hotel-text text-sm">
              {order.public_reference}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-hotel-secondary">
              {language === 'fr' ? 'Montant attendu :' : 'Expected amount:'}
            </span>
            <span className="font-serif text-lg font-bold text-hotel-text">
              {formatXAF(order.total_amount)}
            </span>
          </div>
        </div>

        <div className="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {language === 'fr'
              ? 'Utilisez ce statut si la transaction nécessite une vérification supplémentaire sur le compte marchand avant confirmation ou rejet.'
              : 'Use this status if the transaction requires additional verification on the merchant account before confirmation or rejection.'}
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
              {t.flagReviewPrompt} <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={
                language === 'fr'
                  ? 'Ex : En attente de consultation du téléphone marchand principal...'
                  : 'e.g. Awaiting check on main merchant handset...'
              }
              className="input-hotel text-xs resize-none"
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
              disabled={!reviewNotes.trim() || isLoading}
              className="flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 shadow-subtle transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.saving}</span>
                </>
              ) : (
                <>
                  <HelpCircle className="w-4 h-4" />
                  <span>{t.flagReviewSubmit}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
