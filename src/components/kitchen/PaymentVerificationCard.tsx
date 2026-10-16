import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Copy,
  Check,
  FileText,
  Utensils,
  History,
  AlertCircle,
  Phone,
  User,
  Clock,
  Sparkles,
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
  readOnly?: boolean; // When true (e.g. Admin inspection view), action buttons are hidden
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
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

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

  const handleCopySmsText = () => {
    if (!latestDeclaration?.raw_sms_text) return;
    navigator.clipboard.writeText(latestDeclaration.raw_sms_text);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2000);
  };

  // Helper for order mode and destination badge
  const getOrderDestinationInfo = () => {
    switch (order.order_mode) {
      case 'room_service':
        return {
          label: `Chambre ${order.room_number || 'N/A'}`,
          badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-800',
        };
      case 'dine_in':
        return {
          label: `Table ${order.table_number || 'N/A'}`,
          badgeClass: 'bg-hotel-gold/15 text-hotel-gold border-hotel-gold/40',
        };
      case 'delivery':
        return {
          label: `Livraison : ${order.delivery_address || 'Adresse non spécifiée'}`,
          badgeClass: 'bg-blue-950/60 text-blue-300 border-blue-800',
        };
      case 'takeaway':
        return {
          label: 'À Emporter',
          badgeClass: 'bg-purple-950/60 text-purple-300 border-purple-800',
        };
      default:
        return {
          label: order.order_mode,
          badgeClass: 'bg-hotel-card text-hotel-text border-hotel-cardBorder',
        };
    }
  };

  const destInfo = getOrderDestinationInfo();
  const isPaid = order.payment_status === 'paid';
  const isPendingVerification = order.payment_status === 'payment_declared';

  return (
    <div className={`hotel-card rounded-2xl overflow-hidden shadow-xl border transition-all ${
      isPendingVerification
        ? 'border-amber-600/60 ring-1 ring-amber-500/30'
        : isPaid
        ? 'border-green-800/60'
        : 'border-hotel-cardBorder'
    }`}>
      {/* 1. TOP HEADER: ORDER REFERENCE, DESTINATION & TOTAL AMOUNT */}
      <div className="p-4 sm:p-5 bg-hotel-surface/90 border-b border-hotel-cardBorder flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-hotel-card border border-hotel-cardBorder flex items-center justify-center text-hotel-gold font-bold flex-shrink-0 shadow-inner">
            <Utensils className="w-6 h-6" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base sm:text-lg font-bold text-hotel-text tracking-wide">
                {order.public_reference}
              </span>
              <button
                type="button"
                onClick={handleCopyPublicRef}
                title="Copier la référence de la commande"
                className="text-hotel-muted hover:text-hotel-text p-1 transition-colors"
              >
                {copiedRef ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              {/* Large, high-visibility destination badge */}
              <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${destInfo.badgeClass}`}>
                {destInfo.label}
              </span>

              {/* Status pulse */}
              {isPendingVerification && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black uppercase animate-pulse">
                  Nouveau paiement à vérifier
                </span>
              )}
            </div>

            {/* Customer & Timestamp row */}
            <div className="text-xs text-hotel-muted flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-hotel-gold/80" />
                <span>{formatDateTime(order.created_at, 'fr')}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-hotel-text font-semibold">
                <User className="w-3.5 h-3.5 text-hotel-gold/80" />
                <span>{order.customer_name}</span>
              </span>
              {order.customer_phone && (
                <>
                  <span>•</span>
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="flex items-center gap-1 text-hotel-gold hover:underline font-mono"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{order.customer_phone}</span>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Server Official Amount Banner */}
        <div className="text-right ml-auto">
          <span className="text-[10px] sm:text-[11px] text-hotel-muted uppercase font-bold tracking-wider block">
            Montant total de la commande
          </span>
          <span className="font-serif text-2xl sm:text-3xl font-extrabold text-hotel-gold">
            {formatXAF(order.total_amount)}
          </span>
        </div>
      </div>

      {/* Customer Note (if any) */}
      {order.notes && (
        <div className="px-5 py-2.5 bg-amber-950/30 border-b border-amber-900/40 text-xs text-amber-200 flex items-center gap-2">
          <span className="font-bold text-amber-400">Note du client :</span>
          <span className="italic">« {order.notes} »</span>
        </div>
      )}

      {/* 2. ORDERED ITEMS WITH IMAGES & NOTES (ALWAYS PROMINENTLY VISIBLE) */}
      <div className="p-4 sm:p-5 border-b border-hotel-cardBorder bg-hotel-card/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-hotel-gold" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-hotel-text">
              Articles commandés ({order.items?.length || 0})
            </h4>
          </div>
          <span className="text-xs text-hotel-muted">
            Photos et détails pour préparation Cuisine
          </span>
        </div>

        {order.items && order.items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-hotel-surface border border-hotel-cardBorder flex items-center gap-3.5 hover:border-hotel-gold/40 transition-all shadow-sm"
              >
                {/* Product Image Thumbnail */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-hotel-card border border-hotel-cardBorder flex-shrink-0 flex items-center justify-center relative">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.item_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-hotel-gold/40 flex flex-col items-center justify-center">
                      <Utensils className="w-6 h-6" />
                      <span className="text-[9px] text-hotel-muted mt-0.5">Photo</span>
                    </div>
                  )}
                  {/* Quantity Badge on Thumbnail */}
                  <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-hotel-black/90 text-hotel-gold border border-hotel-gold/30">
                    x{item.quantity}
                  </span>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <h5 className="font-bold text-xs text-hotel-text truncate">
                    {item.item_name}
                  </h5>

                  <div className="text-[11px] text-hotel-muted mt-0.5 flex items-center justify-between">
                    <span>{formatXAF(item.unit_price)} / u</span>
                    <strong className="text-hotel-gold font-mono">{formatXAF(item.subtotal)}</strong>
                  </div>

                  {item.special_notes && (
                    <div className="mt-1 p-1 px-2 rounded bg-amber-950/50 border border-amber-900/60 text-[10px] text-amber-200 italic truncate">
                      {item.special_notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-hotel-muted bg-hotel-surface rounded-xl border border-hotel-cardBorder">
            Aucun article détaillé disponible pour cette commande.
          </div>
        )}
      </div>

      {/* 3. PAYMENT CONFIRMATION MESSAGE (FRONT & CENTER BEFORE PROCEEDING) */}
      <div className="p-4 sm:p-5 bg-hotel-surface space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-hotel-gold/20 text-hotel-gold flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-hotel-text">
                Message de confirmation de paiement transmis par le client
              </h4>
              <p className="text-[11px] text-hotel-muted">
                À comparer avec votre téléphone marchand Convivium Home Hotel avant de lancer la préparation.
              </p>
            </div>
          </div>

          {/* Tri-state overview indicator */}
          <div className="flex items-center gap-2">
            {isPaid ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-950 text-green-300 border border-green-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                <span>Paiement vérifié sur compte marchand</span>
              </span>
            ) : order.payment_status === 'payment_rejected' ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-800 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <span>Paiement rejeté</span>
              </span>
            ) : order.payment_status === 'payment_review_required' ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-950 text-yellow-300 border border-yellow-800 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-yellow-400" />
                <span>Vérification approfondie demandée</span>
              </span>
            ) : latestDeclaration ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Confirmation reçue — À valider</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-hotel-card text-hotel-muted border border-hotel-cardBorder">
                En attente du client
              </span>
            )}
          </div>
        </div>

        {/* Display received SMS or manual note */}
        {latestDeclaration?.raw_sms_text ? (
          <div className="rounded-xl border border-hotel-cardBorder bg-hotel-card/90 overflow-hidden shadow-inner">
            {/* SMS Header bar */}
            <div className="px-4 py-2.5 bg-hotel-black/70 border-b border-hotel-cardBorder flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <FileText className="w-4 h-4 text-hotel-gold" />
                <span className="font-semibold text-hotel-text">
                  SMS Original reçu ({latestDeclaration.operator === 'orange' ? 'Orange Money' : 'MTN MoMo'})
                </span>
                <span className="text-[10px] text-hotel-muted">
                  Reçu {formatDateTime(latestDeclaration.created_at, 'fr')}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopySmsText}
                className="btn-secondary px-2 py-1 text-[11px] flex items-center gap-1"
                title="Copier le SMS intégral"
              >
                {copiedSms ? (
                  <>
                    <Check className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-hotel-gold" />
                    <span>Copier le texte</span>
                  </>
                )}
              </button>
            </div>

            {/* Raw SMS Text Display */}
            <div className="p-4 bg-hotel-black/40">
              <pre className="font-mono text-xs sm:text-sm text-hotel-gold/90 whitespace-pre-wrap break-words leading-relaxed select-all">
                {latestDeclaration.raw_sms_text}
              </pre>
            </div>

            {/* Structured Insights Grid from Parser */}
            <div className="p-3.5 bg-hotel-surface border-t border-hotel-cardBorder grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {/* Insight 1: Extracted Reference */}
              <div className="p-2 rounded-lg bg-hotel-card border border-hotel-cardBorder">
                <span className="text-[10px] text-hotel-muted uppercase font-bold block">
                  Réf. Transaction
                </span>
                <span className="font-mono font-bold text-hotel-gold truncate block mt-0.5">
                  {analysis.parsed.extractedReference ||
                    latestDeclaration.declared_reference ||
                    'Non détectée'}
                </span>
              </div>

              {/* Insight 2: Extracted Amount vs Expected */}
              <div className="p-2 rounded-lg bg-hotel-card border border-hotel-cardBorder">
                <span className="text-[10px] text-hotel-muted uppercase font-bold block">
                  Montant extrait
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {analysis.parsed.extractedAmount !== null ? (
                    <>
                      <span className="font-mono font-bold text-hotel-text">
                        {formatXAF(analysis.parsed.extractedAmount)}
                      </span>
                      {analysis.amountStatus === 'exact_match' ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-green-950 text-green-400 border border-green-800">
                          Exact ✓
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-950 text-red-400 border border-red-800">
                          {analysis.amountDifference! > 0
                            ? `+${analysis.amountDifference}`
                            : analysis.amountDifference}{' '}
                          XAF
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-hotel-muted italic">Non détecté</span>
                  )}
                </div>
              </div>

              {/* Insight 3: Detected Operator */}
              <div className="p-2 rounded-lg bg-hotel-card border border-hotel-cardBorder">
                <span className="text-[10px] text-hotel-muted uppercase font-bold block">
                  Réseau SMS
                </span>
                <span className="font-bold text-hotel-text uppercase block mt-0.5">
                  {analysis.parsed.detectedOperator || latestDeclaration.operator}
                </span>
              </div>

              {/* Insight 4: Date/Time SMS */}
              <div className="p-2 rounded-lg bg-hotel-card border border-hotel-cardBorder">
                <span className="text-[10px] text-hotel-muted uppercase font-bold block">
                  Horodatage SMS
                </span>
                <span className="font-mono text-hotel-text truncate block mt-0.5">
                  {analysis.parsed.extractedDateTime || 'Non détecté'}
                </span>
              </div>
            </div>
          </div>
        ) : latestDeclaration ? (
          /* Manual declaration without raw SMS */
          <div className="p-4 rounded-xl bg-hotel-card border border-hotel-cardBorder space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-hotel-text">
                Déclaration manuelle (sans SMS collé)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800 uppercase">
                {latestDeclaration.operator}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-hotel-muted text-[11px] block">Référence saisie par le client :</span>
                <span className="font-mono font-bold text-hotel-gold text-sm">
                  {latestDeclaration.declared_reference || 'Non renseignée'}
                </span>
              </div>
              {latestDeclaration.payer_phone && (
                <div>
                  <span className="text-hotel-muted text-[11px] block">Téléphone payeur :</span>
                  <span className="font-mono text-hotel-text">
                    {latestDeclaration.payer_phone}
                  </span>
                </div>
              )}
            </div>
            {latestDeclaration.customer_note && (
              <p className="text-hotel-muted italic pt-1 border-t border-hotel-cardBorder/60">
                Remarque client : « {latestDeclaration.customer_note} »
              </p>
            )}
          </div>
        ) : (
          /* No declaration yet */
          <div className="p-5 rounded-xl bg-hotel-card/60 border border-dashed border-hotel-cardBorder text-center text-xs text-hotel-muted">
            <Clock className="w-6 h-6 text-hotel-cardBorder mx-auto mb-2" />
            <p className="font-medium text-hotel-text">Le client n’a pas encore soumis de confirmation de paiement.</p>
            <p className="text-[11px] text-hotel-muted mt-0.5">
              Dès que le client colle son SMS ou confirme son transfert, le message s’affichera automatiquement ici.
            </p>
          </div>
        )}

        {/* Duplicate Reference Warning */}
        {analysis.isDuplicateRef && (
          <div className="p-3.5 rounded-xl bg-red-950 border border-red-800 text-red-200 text-xs flex items-start gap-2.5 animate-pulse">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-red-300 block">
                Alerte Doublon : Référence de transaction déjà utilisée !
              </span>
              <p className="text-[11px] text-red-200/90 mt-0.5">
                Cette même référence a déjà été enregistrée pour la commande :{' '}
                <strong className="underline font-mono">{analysis.duplicateOrderRefs.join(', ')}</strong>.
                Contrôlez attentivement votre compte marchand avant toute confirmation.
              </p>
            </div>
          </div>
        )}

        {/* Verification Warnings (if any) */}
        {analysis.warnings.length > 0 && !analysis.isDuplicateRef && (
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Remarques de vérification syntaxique :</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-amber-300/90 pl-1 space-y-0.5">
              {analysis.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Accordion: Verification Audit History */}
        {order.payment_verifications && order.payment_verifications.length > 0 && (
          <div className="border border-hotel-cardBorder rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="w-full p-2.5 bg-hotel-card/60 hover:bg-hotel-card text-left text-xs font-semibold text-hotel-muted hover:text-hotel-text flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-hotel-gold" />
                <span>Historique des décisions Cuisine ({order.payment_verifications.length})</span>
              </div>
              <span className="text-[10px] text-hotel-gold">
                {isHistoryExpanded ? 'Masquer' : 'Afficher'}
              </span>
            </button>

            {isHistoryExpanded && (
              <div className="p-3 bg-hotel-surface border-t border-hotel-cardBorder space-y-2 text-xs">
                {order.payment_verifications.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-lg bg-hotel-card border border-hotel-cardBorder flex items-center justify-between gap-2"
                  >
                    <div>
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
                          ? 'Confirmé'
                          : v.status === 'rejected'
                          ? 'Rejeté'
                          : 'Vérification demandée'}
                      </span>
                      {v.verified_reference && (
                        <span className="ml-2 font-mono text-hotel-gold">
                          Réf : {v.verified_reference}
                        </span>
                      )}
                      {v.internal_notes && (
                        <p className="text-[11px] text-hotel-muted mt-1 italic">
                          « {v.internal_notes} »
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
      </div>

      {/* 4. ACTIONS BAR: RESERVED FOR CUISINE (HIDDEN IF READONLY E.G. ADMIN VIEW) */}
      {!readOnly && (
        <div className="p-4 sm:p-5 bg-hotel-surface border-t border-hotel-cardBorder flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-hotel-muted">
            <span className="font-semibold text-hotel-text">Vérification Cuisine obligatoire :</span> Rapprochez avec le compte marchand officiel avant validation.
          </div>

          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            {!isPaid ? (
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
              <div className="flex items-center gap-2 text-xs font-bold text-green-300 bg-green-950/60 px-3.5 py-2 rounded-xl border border-green-800 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>Paiement validé par la Cuisine — Préparation autorisée</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
