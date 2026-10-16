import React, { useState, useEffect } from 'react';
import { X, HelpCircle, AlertTriangle, Loader2 } from 'lucide-react';
import type { Order } from '../../types';
import { formatXAF } from '../../lib/formatters';

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
      setErrorMessage('Veuillez indiquer la raison du signalement pour votre équipe.');
      return;
    }

    setErrorMessage(null);
    try {
      await onConfirmReview(order.id, reviewNotes.trim());
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du signalement.';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-hotel-surface border border-yellow-800/60 rounded-2xl shadow-2xl p-6 z-10 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-hotel-cardBorder">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-yellow-500" />
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              Signaler pour Vérification Supplémentaire
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-card"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-hotel-card border border-hotel-cardBorder space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-hotel-muted">Commande :</span>
            <span className="font-mono font-bold text-hotel-gold text-sm">
              {order.public_reference}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-hotel-muted">Montant attendu :</span>
            <span className="font-serif text-base font-bold text-hotel-gold">
              {formatXAF(order.total_amount)}
            </span>
          </div>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-yellow-950/40 border border-yellow-800/60 text-yellow-200 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Utilisez cette action si le relevé marchand affiche un décalage d’horaire, un doute sur le numéro émetteur
            ou une transaction suspecte nécessitant un second avis.
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
              Motif du signalement interne <span className="text-yellow-400">*</span>
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Ex: Le SMS mentionne un montant partiel, en attente de vérification sur le relevé Orange..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-yellow-500 resize-none"
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
              disabled={!reviewNotes.trim() || isLoading}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-black bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Envoi...</span>
                </>
              ) : (
                <>
                  <HelpCircle className="w-4 h-4" />
                  <span>Signaler le dossier</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
