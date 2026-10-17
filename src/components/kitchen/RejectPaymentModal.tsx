import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, XCircle } from 'lucide-react';
import type { Order } from '../../types';
import { formatXAF } from '../../lib/formatters';
import { useLanguage } from '../../i18n/LanguageContext';

export const REJECTION_REASONS = [
  {
    id: 'transaction_not_found',
    label: 'Transaction introuvable sur le compte marchand',
    labelEn: 'Transaction not found on merchant statement',
    description: 'Aucun virement correspondant n’apparaît sur le relevé officiel de l’hôtel.',
    descriptionEn: 'No matching transfer appears on the official hotel merchant statement.',
  },
  {
    id: 'incorrect_amount',
    label: 'Montant versé non conforme',
    labelEn: 'Incorrect transfer amount',
    description: 'Le montant reçu est inférieur au montant total exigé pour la commande.',
    descriptionEn: 'The received amount is less than the expected order total.',
  },
  {
    id: 'invalid_reference',
    label: 'Référence invalide ou non reconnue',
    labelEn: 'Invalid or unrecognized reference',
    description: 'Le numéro ou ID de transaction fourni ne correspond à aucun format valide.',
    descriptionEn: 'The provided transaction ID does not match a valid operator reference.',
  },
  {
    id: 'duplicate_transaction',
    label: 'Transaction déjà utilisée',
    labelEn: 'Duplicate transaction reference',
    description: 'Cette référence a déjà été confirmée pour une autre commande.',
    descriptionEn: 'This transaction reference was already used for another order.',
  },
  {
    id: 'other',
    label: 'Autre anomalie',
    labelEn: 'Other discrepancy',
    description: 'Précisez le problème constaté ci-dessous.',
    descriptionEn: 'Specify the discrepancy observed below.',
  },
] as const;

export type RejectionReasonId = (typeof REJECTION_REASONS)[number]['id'];

interface RejectPaymentModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmReject: (orderId: string, reasonPayload: string) => Promise<void>;
  isLoading: boolean;
}

export const RejectPaymentModal: React.FC<RejectPaymentModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmReject,
  isLoading,
}) => {
  const { language, t } = useLanguage();
  const [selectedReasonId, setSelectedReasonId] = useState<RejectionReasonId | ''>('');
  const [precisionNotes, setPrecisionNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setSelectedReasonId('');
      setPrecisionNotes('');
      setErrorMessage(null);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReasonId) {
      setErrorMessage(
        language === 'fr'
          ? 'Veuillez sélectionner un motif de rejet obligatoire.'
          : 'Please select a mandatory rejection reason.'
      );
      return;
    }

    const reasonObj = REJECTION_REASONS.find((r) => r.id === selectedReasonId);
    const reasonText = reasonObj ? reasonObj.label : 'Paiement non validé';
    const fullPayload = precisionNotes.trim()
      ? `${reasonText} — ${precisionNotes.trim()}`
      : reasonText;

    setErrorMessage(null);
    try {
      await onConfirmReject(order.id, fullPayload);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.errorGeneral;
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      {/* Backdrop: Clicking closes with NO changes */}
      <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[2px]" onClick={onClose} />

      {/* Two-step Rejection Modal Dialog */}
      <div className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-6 z-10 sm:my-auto pb-safe">
        <div className="flex items-center justify-between pb-3.5 border-b border-hotel-border">
          <div className="flex items-center gap-2.5">
            <XCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-serif text-xl font-semibold text-hotel-text">
              {t.rejectPaymentTitle}
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

        {/* Order Details Confirmation */}
        <div className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-hotel-border space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-hotel-secondary">
              {language === 'fr' ? 'Commande concernée :' : 'Target order:'}
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

        {/* Step 1 Warning */}
        <div className="mt-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {language === 'fr'
              ? 'Sélectionnez le motif exact du rejet avant de confirmer. La commande et le SMS original seront conservés dans l’historique, et le client pourra soumettre une nouvelle déclaration.'
              : 'Select the exact rejection reason before confirming. The order and original SMS will be preserved in the audit log, and the customer will be able to submit a corrected declaration.'}
          </p>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Mandatory Reason Selection */}
          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-2">
              {t.rejectReasonPrompt} <span className="text-red-600">*</span>
            </label>
            <div className="space-y-2">
              {REJECTION_REASONS.map((r) => {
                const isSelected = selectedReasonId === r.id;
                const label = language === 'en' ? r.labelEn : r.label;
                const desc = language === 'en' ? r.descriptionEn : r.description;
                return (
                  <label
                    key={r.id}
                    className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-red-600 bg-red-50/70'
                        : 'border-hotel-border bg-white hover:border-hotel-borderStrong'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="rejection_reason"
                        value={r.id}
                        checked={isSelected}
                        onChange={() => setSelectedReasonId(r.id)}
                        className="mt-0.5 text-red-600 focus:ring-red-600"
                      />
                      <div>
                        <div className="text-xs font-semibold text-hotel-text">{label}</div>
                        <div className="text-[11px] text-hotel-secondary mt-0.5">{desc}</div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Optional Precision Notes */}
          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-1.5">
              {language === 'fr'
                ? 'Précision complémentaire (facultatif)'
                : 'Additional details (optional)'}
            </label>
            <textarea
              rows={2}
              value={precisionNotes}
              onChange={(e) => setPrecisionNotes(e.target.value)}
              placeholder={t.rejectReasonPlaceholder}
              className="input-hotel text-xs resize-none"
            />
          </div>

          {/* Two-step Buttons: Cancel vs Explicit Confirm */}
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
              disabled={!selectedReasonId || isLoading}
              className="flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 shadow-subtle transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.saving}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>{ language === 'fr' ? 'Confirmer le rejet' : 'Confirm rejection' }</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
