import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileText,
  Utensils,
  History,
  AlertCircle,
} from 'lucide-react';
import type { Order } from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';
import { analyzePaymentSms } from '../../lib/smsParser';

interface PaymentVerificationCardProps {
  order: Order;
  allOrders?: Order[];
  onConfirmClick?: (order: Order, prefilledReference: string) => void;
  onRejectClick?: (order: Order) => void;
  onReviewClick?: (order: Order) => void;
  isActionLoading?: boolean;
  readOnly?: boolean; // When true (e.g. Admin view), action buttons are hidden
}

export const PaymentVerificationCard: React.FC<PaymentVerificationCardProps> = ({
  order,
  allOrders = [],
  onConfirmClick,
  onRejectClick,
  onReviewClick,
  isActionLoading = false,
  readOnly = false,
}) => {
  const [isSmsExpanded, setIsSmsExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isItemsExpanded, setIsItemsExpanded] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Latest customer declaration
  const declarations = order.payment_declarations || [];
  const latestDeclaration = declarations.length > 0
    ? [...declarations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
    : null;

  // SMS Parsing & Cross-Check Analysis
  const analysis = analyzePaymentSms({
    rawSms: latestDeclaration?.raw_sms_text,
    expectedAmount: order.total_amount,
    declaredOperator: latestDeclaration?.operator,
    allOrders,
    currentOrderId: order.id,
    declaredReference: latestDeclaration?.declared_reference,
  });

  const handleCopyPublicRef = () => {
    navigator.clipboard.writeText(order.public_reference);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  // Helper for order mode badge
  const getOrderModeBadge = () => {
    switch (order.order_mode) {
      case 'room_service':
        return `Chambre ${order.room_number || 'N/A'}`;
      case 'dine_in':
        return `Table ${order.table_number || 'N/A'}`;
      case 'delivery':
        return `Livraison (${order.delivery_address || 'Adresse'})`;
      default:
        return order.order_mode;
    }
  };

  return (
    <div className="hotel-card border border-hotel-cardBorder rounded-2xl overflow-hidden shadow-lg transition-all hover:border-hotel-cardBorder/90">
      {/* 1. Header Bar: Order identity & Mode */}
      <div className="p-4 sm:p-5 bg-hotel-surface/90 border-b border-hotel-cardBorder flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hotel-card border border-hotel-cardBorder flex items-center justify-center text-hotel-gold font-bold">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-hotel-text">
                {order.public_reference}
              </span>
              <button
                type="button"
                onClick={handleCopyPublicRef}
                title="Copier la référence"
                className="text-hotel-muted hover:text-hotel-text p-1"
              >
                {copiedRef ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-hotel-gold/15 text-hotel-gold border border-hotel-gold/30">
                {getOrderModeBadge()}
              </span>
            </div>
            <div className="text-xs text-hotel-muted flex items-center gap-3 mt-0.5">
              <span>{formatDateTime(order.created_at, 'fr')}</span>
              <span>•</span>
              <span className="text-hotel-text font-medium">{order.customer_name}</span>
              {order.customer_phone && (
                <>
                  <span>•</span>
                  <span>{order.customer_phone}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Amount Banner */}
        <div className="text-right">
          <span className="text-[11px] text-hotel-muted uppercase font-bold tracking-wider block">
            Montant officiel attendu
          </span>
          <span className="font-serif text-xl sm:text-2xl font-extrabold text-hotel-gold">
            {formatXAF(order.total_amount)}
          </span>
        </div>
      </div>

      {/* 2. Tri-State Verification Indicators (Requirement 3) */}
      <div className="px-4 sm:px-5 py-3 bg-hotel-card/60 border-b border-hotel-cardBorder/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Indicator 1: SMS Analysé */}
        <div className="p-2.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              latestDeclaration?.raw_sms_text
                ? 'bg-blue-950 text-blue-400 border border-blue-800'
                : 'bg-hotel-card text-hotel-muted border border-hotel-cardBorder'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-hotel-muted uppercase font-bold block">
              1. Détection SMS
            </span>
            <span className="text-xs font-semibold text-hotel-text truncate block">
              {latestDeclaration?.raw_sms_text
                ? analysis.parsed.detectedOperator
                  ? `SMS ${analysis.parsed.detectedOperator.toUpperCase()} analysé`
                  : 'SMS analysé (Opérateur inconnu)'
                : 'Déclaration sans SMS'}
            </span>
          </div>
        </div>

        {/* Indicator 2: Informations Cohérentes */}
        <div className="p-2.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              analysis.isInformationConsistent
                ? 'bg-green-950 text-green-400 border border-green-800'
                : analysis.amountStatus === 'mismatch' || analysis.isDuplicateRef
                ? 'bg-red-950 text-red-400 border border-red-800'
                : 'bg-yellow-950 text-yellow-400 border border-yellow-800'
            }`}
          >
            {analysis.isInformationConsistent ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-hotel-muted uppercase font-bold block">
              2. Cohérence syntaxique
            </span>
            <span className="text-xs font-semibold truncate block">
              {analysis.isInformationConsistent ? (
                <span className="text-green-400">Informations cohérentes</span>
              ) : analysis.amountStatus === 'mismatch' ? (
                <span className="text-red-400">Écart de montant détecté</span>
              ) : analysis.isDuplicateRef ? (
                <span className="text-red-400">Doublon de référence</span>
              ) : (
                <span className="text-yellow-400">Vérification manuelle requise</span>
              )}
            </span>
          </div>
        </div>

        {/* Indicator 3: Paiement Vérifié */}
        <div className="p-2.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              order.payment_status === 'paid'
                ? 'bg-green-900/60 text-green-300 border border-green-700'
                : order.payment_status === 'payment_rejected'
                ? 'bg-red-950 text-red-400 border border-red-800'
                : order.payment_status === 'payment_review_required'
                ? 'bg-yellow-950 text-yellow-400 border border-yellow-800'
                : 'bg-amber-950 text-amber-400 border border-amber-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-hotel-muted uppercase font-bold block">
              3. Statut officiel
            </span>
            <span className="text-xs font-semibold truncate block">
              {order.payment_status === 'paid' ? (
                <span className="text-green-300 font-bold">Paiement vérifié (Cuisine)</span>
              ) : order.payment_status === 'payment_rejected' ? (
                <span className="text-red-400 font-bold">Paiement rejeté</span>
              ) : order.payment_status === 'payment_review_required' ? (
                <span className="text-yellow-400 font-bold">Vérification demandée</span>
              ) : (
                <span className="text-amber-400 font-bold">En attente de vérification</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Detailed Cross-Check Grid */}
      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Box A: Montant attendu vs Montant extrait */}
          <div className="p-3.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-hotel-muted font-medium">
              <span>Montant attendu :</span>
              <span className="font-bold text-hotel-text">{formatXAF(order.total_amount)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-hotel-cardBorder/40">
              <span className="text-hotel-muted font-medium">Montant extrait du SMS :</span>
              <div className="flex items-center gap-1.5">
                {analysis.parsed.extractedAmount !== null ? (
                  <>
                    <span className="font-mono font-bold text-hotel-text">
                      {formatXAF(analysis.parsed.extractedAmount)}
                    </span>
                    {analysis.amountStatus === 'exact_match' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-950 text-green-400 border border-green-800">
                        Exact ✓
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                        {analysis.amountDifference! > 0 ? `+${analysis.amountDifference}` : analysis.amountDifference} XAF
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-hotel-muted italic">Non détecté</span>
                )}
              </div>
            </div>
          </div>

          {/* Box B: Référence déclarée vs Référence extraite */}
          <div className="p-3.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-hotel-muted font-medium">
              <span>Référence saisie :</span>
              <span className="font-mono font-bold text-hotel-text truncate max-w-[180px]">
                {latestDeclaration?.declared_reference || (
                  <span className="text-hotel-muted italic font-normal">Non renseignée</span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-hotel-cardBorder/40">
              <span className="text-hotel-muted font-medium">Référence extraite du SMS :</span>
              <span className="font-mono font-bold text-hotel-gold truncate max-w-[180px]">
                {analysis.parsed.extractedReference || (
                  <span className="text-hotel-muted italic font-normal">Non détectée</span>
                )}
              </span>
            </div>
          </div>

          {/* Box C: Opérateur & Téléphone */}
          <div className="p-3.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-hotel-muted font-medium">
              <span>Moyen déclaré :</span>
              <span className="font-bold text-hotel-text uppercase">
                {latestDeclaration?.operator || 'Inconnu'}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-hotel-cardBorder/40">
              <span className="text-hotel-muted font-medium">Réseau détecté dans SMS :</span>
              <span className="font-semibold text-hotel-text uppercase">
                {analysis.parsed.detectedOperator || (
                  <span className="text-hotel-muted italic font-normal">Non détecté</span>
                )}
              </span>
            </div>
          </div>

          {/* Box D: Date/Heure SMS & Numéro émetteur */}
          <div className="p-3.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-hotel-muted font-medium">
              <span>Date/Heure dans le SMS :</span>
              <span className="font-mono text-hotel-text">
                {analysis.parsed.extractedDateTime || (
                  <span className="text-hotel-muted italic">Non détectée</span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-hotel-cardBorder/40">
              <span className="text-hotel-muted font-medium">Numéro émetteur :</span>
              <span className="font-mono text-hotel-text">
                {analysis.parsed.extractedPhoneNumber ||
                  latestDeclaration?.payer_phone || (
                    <span className="text-hotel-muted italic">Non détecté</span>
                  )}
              </span>
            </div>
          </div>
        </div>

        {/* Warnings Banner (if any) */}
        {analysis.warnings.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Avertissements de vérification ({analysis.warnings.length})</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-300/90 pl-1">
              {analysis.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Duplicate Reference Critical Banner */}
        {analysis.isDuplicateRef && (
          <div className="p-3.5 rounded-xl bg-red-950 border border-red-800 text-red-200 text-xs flex items-start gap-2.5 animate-pulse">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-red-300 block">
                Alerte Doublon Critique : Référence de transaction déjà existante !
              </span>
              <p className="text-[11px] text-red-200/90 mt-0.5">
                Cette référence a déjà été enregistrée pour :{' '}
                <strong className="underline">{analysis.duplicateOrderRefs.join(', ')}</strong>.
                Risque de tentative de double utilisation d’un même virement Mobile Money.
              </p>
            </div>
          </div>
        )}

        {/* Customer Note if provided */}
        {latestDeclaration?.customer_note && (
          <div className="p-3 rounded-xl bg-hotel-card border border-hotel-cardBorder text-xs">
            <span className="text-hotel-muted font-medium block mb-0.5">
              Remarque laissée par le client lors de la déclaration :
            </span>
            <p className="text-hotel-text italic">« {latestDeclaration.customer_note} »</p>
          </div>
        )}

        {/* Accordion 1: Raw Original SMS received from customer */}
        {latestDeclaration?.raw_sms_text && (
          <div className="border border-hotel-cardBorder rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setIsSmsExpanded(!isSmsExpanded)}
              className="w-full p-3 bg-hotel-card/70 hover:bg-hotel-card text-left text-xs font-semibold text-hotel-text flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-hotel-gold" />
                <span>
                  Consulter le SMS original reçu du client ({latestDeclaration.raw_sms_text.length} caractères)
                </span>
              </div>
              {isSmsExpanded ? (
                <ChevronUp className="w-4 h-4 text-hotel-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-hotel-muted" />
              )}
            </button>
            {isSmsExpanded && (
              <div className="p-3.5 bg-hotel-black border-t border-hotel-cardBorder">
                <pre className="font-mono text-xs text-hotel-text/90 whitespace-pre-wrap break-words leading-relaxed select-all">
                  {latestDeclaration.raw_sms_text}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Accordion 2: Verification Actions History */}
        {order.payment_verifications && order.payment_verifications.length > 0 && (
          <div className="border border-hotel-cardBorder rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="w-full p-3 bg-hotel-card/70 hover:bg-hotel-card text-left text-xs font-semibold text-hotel-text flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-hotel-gold" />
                <span>
                  Historique des actions de vérification Cuisine ({order.payment_verifications.length})
                </span>
              </div>
              {isHistoryExpanded ? (
                <ChevronUp className="w-4 h-4 text-hotel-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-hotel-muted" />
              )}
            </button>
            {isHistoryExpanded && (
              <div className="p-3.5 bg-hotel-surface border-t border-hotel-cardBorder space-y-2 text-xs">
                {order.payment_verifications.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-lg bg-hotel-card border border-hotel-cardBorder/60 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.status === 'confirmed'
                              ? 'bg-green-950 text-green-400 border border-green-800'
                              : v.status === 'rejected'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : 'bg-yellow-950 text-yellow-400 border border-yellow-800'
                          }`}
                        >
                          {v.status === 'confirmed'
                            ? 'Paiement confirmé'
                            : v.status === 'rejected'
                            ? 'Paiement rejeté'
                            : 'Vérification demandée'}
                        </span>
                        {v.verified_reference && (
                          <span className="font-mono text-hotel-gold">
                            Réf: {v.verified_reference}
                          </span>
                        )}
                      </div>
                      {v.internal_notes && (
                        <p className="text-hotel-muted text-[11px] mt-1 italic">
                          Motif / note : « {v.internal_notes} »
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-hotel-muted whitespace-nowrap">
                      {formatDateTime(v.created_at, 'fr')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Accordion 3: Ordered Items list */}
        {order.items && order.items.length > 0 && (
          <div className="border border-hotel-cardBorder rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setIsItemsExpanded(!isItemsExpanded)}
              className="w-full p-2.5 bg-hotel-card/40 hover:bg-hotel-card text-left text-xs font-semibold text-hotel-muted hover:text-hotel-text flex items-center justify-between transition-colors"
            >
              <span>Détail des plats & boissons commandés ({order.items.length})</span>
              {isItemsExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {isItemsExpanded && (
              <div className="p-3 bg-hotel-surface border-t border-hotel-cardBorder divide-y divide-hotel-cardBorder/60 text-xs">
                {order.items.map((it) => (
                  <div key={it.id} className="py-1.5 flex justify-between items-center">
                    <span className="text-hotel-text">
                      <strong className="text-hotel-gold">{it.quantity}x</strong> {it.item_name}
                      {it.special_notes && (
                        <span className="text-hotel-muted italic ml-1">({it.special_notes})</span>
                      )}
                    </span>
                    <span className="font-mono text-hotel-muted">{formatXAF(it.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Action Buttons (Cuisine role only, hidden if readOnly) */}
      {!readOnly && (
        <div className="p-4 sm:p-5 bg-hotel-surface border-t border-hotel-cardBorder flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-hotel-muted">
            <span className="font-medium text-hotel-text">Action Cuisine :</span> Rapprochez avec le
            compte marchand officiel avant toute décision.
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {order.payment_status !== 'paid' ? (
              <>
                {onRejectClick && (
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => onRejectClick(order)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-300 bg-red-950/60 hover:bg-red-900/60 border border-red-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rejeter le paiement</span>
                  </button>
                )}

                {onReviewClick && (
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => onReviewClick(order)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-yellow-300 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Signaler pour vérification</span>
                  </button>
                )}

                {onConfirmClick && (
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() =>
                      onConfirmClick(
                        order,
                        analysis.parsed.extractedReference ||
                          latestDeclaration?.declared_reference ||
                          ''
                      )
                    }
                    className="btn-gold px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-gold-glow transition-all"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirmer le paiement (Cuisine)</span>
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-green-400 bg-green-950/60 px-3.5 py-2 rounded-xl border border-green-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>Paiement déjà confirmé sur compte marchand</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
