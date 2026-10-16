import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, XCircle } from 'lucide-react';
import type { Order } from '../../types';
import { formatXAF } from '../../lib/formatters';

export const REJECTION_REASONS = [
  {
    id: 'transaction_not_found',
    label: 'Transaction introuvable sur le compte marchand',
    description: 'Aucun virement correspondant n’apparaît sur le relevé officiel de l’hôtel.',
  },
  {
    id: 'incorrect_amount',
    label: 'Montant versé non conforme',
    description: 'Le montant reçu est inférieur au montant total exigé pour la commande.',
  },
  {
    id: 'invalid_reference',
    label: 'Référence invalide ou non reconnue',
    description: 'Le numéro ou ID de transaction fourni ne correspond à aucun format valide.',
  },
  {
    id: 'duplicate_transaction',
    label: 'Transaction déjà utilisée',
    description: 'Cette référence a déjà été confirmée pour une autre commande.',
  },
  {
    id: 'other',
    label: 'Autre anomalie',
    description: 'Précisez le problème constaté ci-dessous.',
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
      setErrorMessage('Veuillez sélectionner un motif de rejet obligatoire.');
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
      const msg = err instanceof Error ? err.message : 'Erreur lors du rejet du paiement.';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
      {/* Backdrop: Clicking closes with NO changes */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      {/* Rejection Modal Dialog */}
      <div className="relative w-full max-w-lg bg-hotel-surface border border-red-900/60 rounded-2xl shadow-2xl p-6 z-10 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-hotel-cardBorder">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              Rejet de la Déclaration de Paiement
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-card"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Details Confirmation */}
        <div className="mt-4 p-4 rounded-xl bg-hotel-card border border-hotel-cardBorder space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-hotel-muted">Commande ciblée :</span>
            <span className="font-mono font-bold text-hotel-gold text-sm">
              {order.public_reference}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-hotel-muted">Client :</span>
            <span className="font-medium text-hotel-text">{order.customer_name}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-hotel-cardBorder/60">
            <span className="text-hotel-muted font-semibold">Montant attendu :</span>
            <span className="font-serif text-lg font-extrabold text-hotel-gold">
              {formatXAF(order.total_amount)}
            </span>
          </div>
        </div>

        {/* Step 1 Warning */}
        <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Étape 1/2 : Vous devez justifier ce rejet avec un motif précis. Le client sera informé que sa déclaration
            a été rejetée et pourra soumettre une nouvelle déclaration ou régler à la réception.
          </p>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Mandatory Reason Selection */}
          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-2">
              Motif obligatoire du rejet <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {REJECTION_REASONS.map((r) => {
                const isSelected = selectedReasonId === r.id;
                return (
                  <label
                    key={r.id}
                    className={`block p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-950/30 text-white'
                        : 'border-hotel-cardBorder bg-hotel-card text-hotel-muted hover:border-hotel-muted'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="rejection_reason"
                        value={r.id}
                        checked={isSelected}
                        onChange={() => setSelectedReasonId(r.id)}
                        className="mt-0.5 text-red-500 focus:ring-red-500"
                      />
                      <div>
                        <div className="text-xs font-semibold text-hotel-text">{r.label}</div>
                        <div className="text-[11px] text-hotel-muted mt-0.5">{r.description}</div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Optional Precision Notes */}
          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-1">
              Précision ou observation complémentaire (facultative)
            </label>
            <textarea
              rows={2}
              value={precisionNotes}
              onChange={(e) => setPrecisionNotes(e.target.value)}
              placeholder="Ex: Montant manquant de 2 500 XAF ou SMS non cohérent avec le relevé..."
              className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-red-500 resize-none"
            />
          </div>

          {/* Two-step Buttons: Cancel vs Explicit Confirm */}
          <div className="pt-3 border-t border-hotel-cardBorder flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary flex-1 text-xs py-2.5"
            >
              Annuler (aucun changement)
            </button>
            <button
              type="submit"
              disabled={!selectedReasonId || isLoading}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>Confirmer le rejet</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
