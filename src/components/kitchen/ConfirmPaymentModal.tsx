import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import type { Order } from '../../types';
import { formatXAF } from '../../lib/formatters';

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
      const msg = err instanceof Error ? err.message : 'Erreur lors de la confirmation du paiement.';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-hotel-surface border border-hotel-cardBorder rounded-2xl shadow-2xl p-6 z-10 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-hotel-cardBorder">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-hotel-gold" />
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              Confirmation Cuisine du Paiement
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-card"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Details Banner */}
        <div className="mt-4 p-4 rounded-xl bg-hotel-card border border-hotel-cardBorder space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-hotel-muted">Commande :</span>
            <span className="font-mono font-bold text-hotel-gold text-sm">
              {order.public_reference}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-hotel-muted">Client :</span>
            <span className="font-medium text-hotel-text">{order.customer_name}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-hotel-cardBorder/60">
            <span className="text-hotel-muted font-semibold">Montant officiel attendu :</span>
            <span className="font-serif text-lg font-extrabold text-hotel-gold">
              {formatXAF(order.total_amount)}
            </span>
          </div>
        </div>

        {/* Official Merchant Rule Notice */}
        <div className="mt-3 p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-blue-200 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Règle de sécurité : Vérifiez la réception réelle de ce montant sur le relevé de votre compte
            marchand officiel avant de valider. Ni le SMS ni le client ne peuvent valider cette étape à votre place.
          </p>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-1">
              Référence vérifiée sur le relevé marchand (facultative mais recommandée)
            </label>
            <input
              type="text"
              value={verifiedRef}
              onChange={(e) => setVerifiedRef(e.target.value)}
              placeholder="Ex: MP261016.1234.A12345 ou TXN123456"
              className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs font-mono focus:outline-none focus:border-hotel-gold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-1">
              Note interne Cuisine (facultative)
            </label>
            <input
              type="text"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Ex: Confirmé sur terminal MTN #12"
              className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
            />
          </div>

          <div className="pt-3 border-t border-hotel-cardBorder flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary flex-1 text-xs py-2.5"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-gold flex-1 text-xs py-2.5 font-bold flex items-center justify-center gap-1.5 shadow-md"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validation...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmer la réception</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
