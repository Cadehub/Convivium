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
  ChefHat,
  ArrowRight,
  Ban,
  BedDouble,
  Truck,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Order, PreparationStatus } from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';
import { analyzePaymentSms } from '../../lib/smsParser';
import { useLanguage } from '../../i18n/LanguageContext';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface PaymentVerificationCardProps {
  order: Order;
  allOrders?: Order[];
  onConfirmClick?: (order: Order, prefilledReference: string) => void;
  onRejectClick?: (order: Order) => void;
  onReviewClick?: (order: Order) => void;
  onUpdatePrepStatus?: (orderId: string, newStatus: PreparationStatus) => void;
  isActionLoading?: boolean;
  readOnly?: boolean;
}

export const PaymentVerificationCard: React.FC<PaymentVerificationCardProps> = ({
  order,
  allOrders = [],
  onConfirmClick,
  onRejectClick,
  onReviewClick,
  onUpdatePrepStatus,
  isActionLoading = false,
  readOnly = false,
}) => {
  const { language, t } = useLanguage();
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isPaymentDetailsExpanded, setIsPaymentDetailsExpanded] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Latest customer declaration
  const declarations = order.payment_declarations || [];
  const latestDeclaration =
    declarations.length > 0
      ? [...declarations].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
      : null;

  // Deterministic SMS Parsing & Cross-Check Analysis
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

  const getOrderDestinationInfo = () => {
    switch (order.order_mode) {
      case 'room_service':
        return {
          modeLabel: language === 'fr' ? 'Service en chambre' : 'Room Service',
          locationTitle: language === 'fr' ? 'Numéro de chambre' : 'Room Number',
          locationValue: `${language === 'fr' ? 'Chambre' : 'Room'} ${order.room_number || 'N/A'}`,
          label: `${language === 'fr' ? 'Chambre' : 'Room'} ${order.room_number || 'N/A'}`,
          badgeClass: 'badge-pending',
          bannerClass: 'bg-[#FBF7EE] border-[#E5D099] text-stone-900',
          iconBoxClass: 'bg-[#9A721C] text-white',
          Icon: BedDouble,
        };
      case 'dine_in':
        return {
          modeLabel: language === 'fr' ? 'Sur place — Restaurant' : 'Dine-in — Restaurant',
          locationTitle: language === 'fr' ? 'Numéro de table' : 'Table Number',
          locationValue: `Table ${order.table_number || 'N/A'}`,
          label: `Table ${order.table_number || 'N/A'}`,
          badgeClass: 'badge-neutral',
          bannerClass: 'bg-emerald-50/70 border-emerald-200 text-stone-900',
          iconBoxClass: 'bg-emerald-700 text-white',
          Icon: Utensils,
        };
      case 'delivery':
        return {
          modeLabel: language === 'fr' ? 'Livraison extérieure' : 'External Delivery',
          locationTitle: language === 'fr' ? 'Adresse de livraison' : 'Delivery Address',
          locationValue: order.delivery_address || 'N/A',
          label: `${language === 'fr' ? 'Livraison' : 'Delivery'} : ${
            order.delivery_address || 'N/A'
          }`,
          badgeClass: 'badge-info',
          bannerClass: 'bg-sky-50/80 border-sky-200 text-stone-900',
          iconBoxClass: 'bg-sky-700 text-white',
          Icon: Truck,
        };
      case 'takeaway':
        return {
          modeLabel: t.modeTakeaway,
          locationTitle: language === 'fr' ? 'Point de retrait' : 'Pickup Point',
          locationValue: language === 'fr' ? 'Comptoir Restaurant' : 'Restaurant Counter',
          label: t.modeTakeaway,
          badgeClass: 'badge-neutral',
          bannerClass: 'bg-stone-100 border-stone-300 text-stone-900',
          iconBoxClass: 'bg-stone-800 text-white',
          Icon: MapPin,
        };
      default:
        return {
          modeLabel: order.order_mode,
          locationTitle: language === 'fr' ? 'Destination' : 'Destination',
          locationValue: order.order_mode,
          label: order.order_mode,
          badgeClass: 'badge-neutral',
          bannerClass: 'bg-stone-100 border-stone-300 text-stone-900',
          iconBoxClass: 'bg-stone-800 text-white',
          Icon: MapPin,
        };
    }
  };

  const destInfo = getOrderDestinationInfo();
  const DestIcon = destInfo.Icon;
  const isPaid = order.payment_status === 'paid';
  const isPendingVerification = order.payment_status === 'payment_declared';
  const notDetectedText = language === 'fr' ? 'Non détecté' : 'Not detected';

  const detectedOperatorLabel = (() => {
    const op = analysis.parsed.detectedOperator || latestDeclaration?.operator;
    if (op === 'orange') return 'Orange Money';
    if (op === 'mtn') return 'MTN Mobile Money';
    return notDetectedText;
  })();

  const extractedReferenceValue =
    analysis.parsed.extractedReference ||
    latestDeclaration?.declared_reference ||
    null;

  return (
    <div
      className={`bg-white rounded-xl overflow-hidden border transition-all ${
        isPendingVerification
          ? 'border-amber-400 shadow-card ring-1 ring-amber-400/30'
          : isPaid
          ? 'border-emerald-300 shadow-subtle'
          : 'border-hotel-border shadow-subtle'
      }`}
    >
      {/* 1. ORDER REFERENCE & EXPECTED AMOUNT */}
      <div className="p-4 sm:p-5 bg-[#FAF8F5] border-b border-hotel-border flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-bold text-hotel-text tracking-tight">
              {order.public_reference}
            </span>
            <button
              type="button"
              onClick={handleCopyPublicRef}
              title={t.copy}
              className="text-hotel-muted hover:text-hotel-text p-1 rounded hover:bg-hotel-subtle transition-colors"
            >
              {copiedRef ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {isPendingVerification && (
              <span className="badge-pending font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                <span>
                  {language === 'fr' ? 'Déclaration à vérifier' : 'Declaration to verify'}
                </span>
              </span>
            )}
          </div>

          <div className="text-xs text-hotel-secondary flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-hotel-muted" />
              <span>{formatDateTime(order.created_at, language)}</span>
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-hotel-text font-semibold">
              <User className="w-3.5 h-3.5 text-hotel-muted" />
              <span>{order.customer_name}</span>
            </span>
            {order.customer_phone && (
              <>
                <span>•</span>
                <a
                  href={`tel:${order.customer_phone}`}
                  className="inline-flex items-center gap-1 text-[#9A721C] hover:underline font-mono font-medium"
                >
                  <Phone className="w-3 h-3" />
                  <span>{order.customer_phone}</span>
                </a>
              </>
            )}
          </div>
        </div>

        {/* Expected Official Amount */}
        <div className="text-left sm:text-right w-full sm:w-auto sm:ml-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-hotel-border">
          <span className="text-[11px] text-hotel-secondary uppercase font-semibold tracking-wider block">
            {language === 'fr' ? 'Montant attendu' : 'Expected amount'}
          </span>
          <span className="font-serif text-2xl sm:text-3xl font-bold text-hotel-text">
            {formatXAF(order.total_amount)}
          </span>
          {order.order_mode === 'delivery' &&
            typeof order.delivery_fee === 'number' &&
            order.delivery_fee > 0 && (
              <span className="block text-[11px] text-[#9A721C] font-medium mt-0.5">
                {t.deliveryFee} : +{formatXAF(order.delivery_fee)}
              </span>
            )}
        </div>
      </div>

      {/* PROMINENT SERVICE MODE & EXACT LOCATION BANNER */}
      <div className={`px-4 sm:px-5 py-3.5 border-b ${destInfo.bannerClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-subtle ${destInfo.iconBoxClass}`}
            >
              <DestIcon className="w-5 h-5" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-6 flex-1">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-hotel-secondary">
                  {language === 'fr' ? 'Mode de service' : 'Service Mode'}
                </span>
                <span className="font-serif text-base sm:text-lg font-bold text-hotel-text">
                  {destInfo.modeLabel}
                </span>
                {order.order_mode === 'delivery' && (
                  <span
                    className={`mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                      order.delivery_schedule_type === 'scheduled' &&
                      order.scheduled_delivery_time
                        ? 'bg-[#1C1613] text-[#F5E6B8] border-[#C59B27]'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}
                  >
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>
                      {order.delivery_schedule_type === 'scheduled' &&
                      order.scheduled_delivery_time
                        ? language === 'fr'
                          ? `Heure choisie : ${order.scheduled_delivery_time}`
                          : `Scheduled at: ${order.scheduled_delivery_time}`
                        : language === 'fr'
                          ? 'Livraison immédiate'
                          : 'Instant delivery'}
                    </span>
                  </span>
                )}
              </div>
              <div className="sm:border-l sm:border-stone-300/80 sm:pl-5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-hotel-secondary flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#9A721C]" />
                  <span>{destInfo.locationTitle}</span>
                </span>
                <span className="text-base sm:text-lg font-extrabold text-stone-950 tracking-tight break-words">
                  {destInfo.locationValue}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-200/80">
            <div className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 shadow-subtle">
              <span className="text-hotel-secondary font-medium mr-1.5">
                {language === 'fr' ? 'Client :' : 'Guest:'}
              </span>
              <span className="font-bold text-hotel-text">{order.customer_name}</span>
              {order.customer_phone && (
                <a
                  href={`tel:${order.customer_phone}`}
                  className="ml-2 font-mono font-semibold text-[#9A721C] hover:underline"
                >
                  ({order.customer_phone})
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Kitchen Note (if any) */}
      {order.notes && (
        <div className="px-5 py-2.5 bg-amber-50/80 border-b border-amber-200 text-xs text-amber-900 flex items-center gap-2">
          <span className="font-semibold">
            {language === 'fr' ? 'Instruction client :' : 'Customer note:'}
          </span>
          <span className="italic">« {order.notes} »</span>
        </div>
      )}

      {/* ORDERED ITEMS WITH PHOTOS FOR KITCHEN */}
      <div className="p-4 sm:p-5 border-b border-hotel-border bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-[#9A721C]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-hotel-secondary">
              {t.orderItems} ({order.items?.length || 0})
            </h4>
          </div>
        </div>

        {order.items && order.items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-[#FAF8F5] border border-hotel-border flex items-center gap-3"
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-white border border-hotel-border shrink-0 flex items-center justify-center relative">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.item_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Utensils className="w-5 h-5 text-[#9A721C]/40" />
                  )}
                  <span className="absolute top-0.5 right-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-stone-900 text-white">
                    ×{item.quantity}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <h5 className="font-semibold text-xs text-hotel-text truncate">
                        {item.item_name}
                      </h5>
                      {item.variant_name && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#9A721C]/15 text-[#9A721C] shrink-0">
                          {item.variant_name}
                        </span>
                      )}
                    </div>
                    {item.preparation_time_minutes &&
                      item.preparation_time_minutes > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#FAF6EE] border border-[#D8C79A] text-[10px] font-semibold text-[#8A6214] shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{item.preparation_time_minutes}m</span>
                        </span>
                      )}
                  </div>

                  {item.selected_complements && item.selected_complements.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.selected_complements.map((c, cIdx) => (
                        <span
                          key={cIdx}
                          className="text-[10px] text-hotel-secondary bg-stone-100 px-1.5 py-0.2 rounded border border-stone-200"
                        >
                          + {c.quantity > 1 ? `${c.quantity}× ` : ''}{c.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-hotel-secondary mt-0.5 flex items-center justify-between">
                    <span>{formatXAF(item.unit_price)}</span>
                    <strong className="text-hotel-text font-mono">
                      {formatXAF(item.subtotal)}
                    </strong>
                  </div>
                  {item.special_notes && (
                    <div className="mt-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-900 italic truncate">
                      {item.special_notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 text-center text-xs text-hotel-muted bg-hotel-subtle/50 rounded-lg border border-hotel-border">
            {language === 'fr' ? 'Aucun article détaillé.' : 'No item details.'}
          </div>
        )}
      </div>

      {/* PAYMENT VERIFICATION FICHE (AUTO-COLLAPSES ONCE CONFIRMED FOR AN AIRY UX) */}
      <div className="p-4 sm:p-5 bg-white space-y-4">
        {/* Verification Header Bar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 ${
            !isPaid || isPaymentDetailsExpanded || readOnly
              ? 'pb-3 border-b border-hotel-border'
              : ''
          }`}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <FileText className="w-4 h-4 text-[#9A721C]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-hotel-text">
              {language === 'fr'
                ? 'Contrôle du paiement'
                : 'Payment Verification'}
            </h4>

            {isPaid && !isPaymentDetailsExpanded && !readOnly && (
              <span className="text-xs text-hotel-secondary font-medium">
                • {detectedOperatorLabel}
                {extractedReferenceValue ? ` (${extractedReferenceValue})` : ''}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(!isPaid || isPaymentDetailsExpanded || readOnly) && (
              <>
                {/* Step A: SMS Analysé */}
                <span
                  className={
                    latestDeclaration?.raw_sms_text ? 'badge-info' : 'badge-neutral'
                  }
                >
                  <span>
                    {latestDeclaration?.raw_sms_text
                      ? language === 'fr'
                        ? '1. SMS analysé'
                        : '1. SMS parsed'
                      : language === 'fr'
                      ? '1. Aucun SMS collé'
                      : '1. No SMS pasted'}
                  </span>
                </span>

                {/* Step B: Informations cohérentes */}
                <span
                  className={
                    analysis.isInformationConsistent
                      ? 'badge-info'
                      : latestDeclaration
                      ? 'badge-pending'
                      : 'badge-neutral'
                  }
                >
                  <span>
                    {analysis.isInformationConsistent
                      ? language === 'fr'
                        ? '2. Informations cohérentes'
                        : '2. Consistent info'
                      : latestDeclaration
                      ? language === 'fr'
                        ? '2. Écart ou donnée manquante'
                        : '2. Discrepancy / missing info'
                      : language === 'fr'
                      ? '2. En attente'
                      : '2. Pending'}
                  </span>
                </span>
              </>
            )}

            {/* Step C: Paiement vérifié (only true when Kitchen confirms!) */}
            {isPaid ? (
              <span className="badge-paid font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {language === 'fr' ? 'Paiement vérifié' : 'Payment verified'}
                </span>
              </span>
            ) : order.payment_status === 'payment_rejected' ? (
              <span className="badge-rejected font-semibold">
                <XCircle className="w-3.5 h-3.5" />
                <span>
                  {language === 'fr' ? '3. Paiement rejeté' : '3. Payment rejected'}
                </span>
              </span>
            ) : order.payment_status === 'payment_review_required' ? (
              <span className="badge-pending font-semibold">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>
                  {language === 'fr'
                    ? '3. Vérification supplémentaire'
                    : '3. Under review'}
                </span>
              </span>
            ) : (
              <span className="badge-pending">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {language === 'fr'
                    ? '3. Non vérifié sur compte marchand'
                    : '3. Unverified on merchant account'}
                </span>
              </span>
            )}

            {/* Toggle button when already paid to keep the card airy */}
            {isPaid && !readOnly && (
              <button
                type="button"
                onClick={() => setIsPaymentDetailsExpanded(!isPaymentDetailsExpanded)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#9A721C] hover:underline px-2 py-1 rounded-md hover:bg-[#FAF8F5] transition-colors"
              >
                <span>
                  {isPaymentDetailsExpanded
                    ? language === 'fr'
                      ? 'Masquer les détails'
                      : 'Hide details'
                    : language === 'fr'
                    ? 'Détails & SMS'
                    : 'Details & SMS'}
                </span>
                {isPaymentDetailsExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Detailed SMS & Extraction Block (Always visible before confirmation; toggleable once paid) */}
        {(!isPaid || isPaymentDetailsExpanded || readOnly) && (
          <>
            {latestDeclaration ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Moyen de paiement */}
                  <div className="p-3 rounded-lg bg-[#FAF8F5] border border-hotel-border">
                    <span className="text-[11px] text-hotel-secondary font-medium block">
                      {language === 'fr' ? 'Moyen de paiement' : 'Payment method'}
                    </span>
                    <strong className="text-sm font-semibold text-hotel-text block mt-1">
                      {detectedOperatorLabel}
                    </strong>
                    {latestDeclaration.payer_phone && (
                      <span className="text-[11px] text-hotel-muted font-mono block mt-0.5">
                        {latestDeclaration.payer_phone}
                      </span>
                    )}
                  </div>

                  {/* Montant extrait & état de correspondance */}
                  <div className="p-3 rounded-lg bg-[#FAF8F5] border border-hotel-border">
                    <span className="text-[11px] text-hotel-secondary font-medium block">
                      {language === 'fr' ? 'Montant extrait du SMS' : 'Extracted SMS amount'}
                    </span>
                    {analysis.parsed.extractedAmount !== null ? (
                      <div className="mt-1 space-y-1">
                        <strong className="text-sm font-bold text-hotel-text font-mono block">
                          {formatXAF(analysis.parsed.extractedAmount)}
                        </strong>
                        {analysis.amountStatus === 'exact_match' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <Check className="w-3 h-3" />
                            <span>
                              {language === 'fr'
                                ? 'Correspond au montant attendu'
                                : 'Matches expected amount'}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                            <AlertCircle className="w-3 h-3" />
                            <span>
                              {language === 'fr' ? 'Écart :' : 'Diff:'}{' '}
                              {analysis.amountDifference! > 0
                                ? `+${analysis.amountDifference}`
                                : analysis.amountDifference}{' '}
                              XAF
                            </span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-hotel-muted block mt-1">
                        {notDetectedText}
                      </span>
                    )}
                  </div>

                  {/* Référence extraite */}
                  <div className="p-3 rounded-lg bg-[#FAF8F5] border border-hotel-border">
                    <span className="text-[11px] text-hotel-secondary font-medium block">
                      {language === 'fr' ? 'Référence extraite' : 'Extracted reference'}
                    </span>
                    <strong
                      className={`text-sm font-mono block mt-1 break-all ${
                        extractedReferenceValue
                          ? 'font-bold text-hotel-text'
                          : 'font-medium text-hotel-muted'
                      }`}
                    >
                      {extractedReferenceValue || notDetectedText}
                    </strong>
                  </div>

                  {/* Date et heure extraites */}
                  <div className="p-3 rounded-lg bg-[#FAF8F5] border border-hotel-border">
                    <span className="text-[11px] text-hotel-secondary font-medium block">
                      {language === 'fr' ? 'Date et heure extraites' : 'Extracted date & time'}
                    </span>
                    <strong
                      className={`text-sm font-mono block mt-1 ${
                        analysis.parsed.extractedDateTime
                          ? 'font-semibold text-hotel-text'
                          : 'font-medium text-hotel-muted'
                      }`}
                    >
                      {analysis.parsed.extractedDateTime || notDetectedText}
                    </strong>
                  </div>
                </div>

                {/* 4. CONSISTENCY INDICATOR OR WARNINGS */}
                {analysis.isDuplicateRef && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">
                        {language === 'fr'
                          ? 'Alerte : Référence de transaction déjà utilisée sur une autre commande'
                          : 'Warning: Transaction reference already used on another order'}
                      </span>
                      <p className="text-red-800 mt-0.5">
                        {language === 'fr' ? 'Commandes associées :' : 'Linked orders:'}{' '}
                        <strong className="font-mono underline">
                          {analysis.duplicateOrderRefs.join(', ')}
                        </strong>
                      </p>
                    </div>
                  </div>
                )}

                {analysis.warnings.length > 0 && !analysis.isDuplicateRef && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>
                        {language === 'fr'
                          ? 'Points d’attention à contrôler sur le relevé marchand :'
                          : 'Items to check on the merchant statement:'}
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-amber-800 pl-1 space-y-0.5">
                      {analysis.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 5. RAW ORIGINAL SMS */}
                {latestDeclaration.raw_sms_text ? (
                  <div className="rounded-xl border border-hotel-border bg-[#FAF8F5] overflow-hidden">
                    <div className="px-4 py-2 bg-hotel-subtle/80 border-b border-hotel-border flex items-center justify-between">
                      <span className="text-xs font-semibold text-hotel-secondary">
                        {language === 'fr'
                          ? `SMS original transmis (${formatDateTime(latestDeclaration.created_at, language)})`
                          : `Original submitted SMS (${formatDateTime(latestDeclaration.created_at, language)})`}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopySmsText}
                        className="btn-outline-gold px-2.5 py-1 text-[11px]"
                      >
                        {copiedSms ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">{t.copied}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{t.copy}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3.5">
                      <pre className="font-mono text-xs text-hotel-text whitespace-pre-wrap break-words leading-relaxed select-all">
                        {latestDeclaration.raw_sms_text}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-hotel-subtle/50 border border-hotel-border text-xs text-hotel-secondary">
                    {language === 'fr'
                      ? 'Déclaration soumise sans texte SMS complet.'
                      : 'Declaration submitted without full SMS text.'}
                    {latestDeclaration.customer_note && (
                      <span className="block italic mt-1 text-hotel-text">
                        « {latestDeclaration.customer_note} »
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-dashed border-hotel-borderStrong text-center text-xs text-hotel-secondary">
                {language === 'fr'
                  ? 'Aucune déclaration de paiement n’a encore été soumise pour cette commande.'
                  : 'No payment declaration has been submitted for this order yet.'}
              </div>
            )}

            {/* Verification Audit History */}
            {order.payment_verifications && order.payment_verifications.length > 0 && (
              <div className="border border-hotel-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                  className="w-full px-4 py-2.5 bg-hotel-subtle/50 hover:bg-hotel-subtle text-left text-xs font-semibold text-hotel-secondary hover:text-hotel-text flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#9A721C]" />
                    <span>
                      {language === 'fr'
                        ? `Historique des actions de vérification (${order.payment_verifications.length})`
                        : `Verification action history (${order.payment_verifications.length})`}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#9A721C]">
                    {isHistoryExpanded
                      ? language === 'fr'
                        ? 'Masquer'
                        : 'Hide'
                      : language === 'fr'
                      ? 'Afficher'
                      : 'Show'}
                  </span>
                </button>

                {isHistoryExpanded && (
                  <div className="p-3 bg-white border-t border-hotel-border space-y-2 text-xs">
                    {order.payment_verifications.map((v) => (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-lg bg-[#FAF8F5] border border-hotel-border flex items-center justify-between gap-2"
                      >
                        <div>
                          <span
                            className={
                              v.status === 'confirmed'
                                ? 'badge-paid'
                                : v.status === 'rejected'
                                ? 'badge-rejected'
                                : 'badge-pending'
                            }
                          >
                            {v.status === 'confirmed'
                              ? language === 'fr'
                                ? 'Confirmé'
                                : 'Confirmed'
                              : v.status === 'rejected'
                              ? language === 'fr'
                                ? 'Rejeté'
                                : 'Rejected'
                              : language === 'fr'
                              ? 'À vérifier'
                              : 'Flagged for review'}
                          </span>
                          {v.verified_reference && (
                            <span className="ml-2 font-mono text-hotel-text font-semibold">
                              Réf : {v.verified_reference}
                            </span>
                          )}
                          {v.internal_notes && (
                            <p className="text-xs text-hotel-secondary mt-1 italic">
                              « {v.internal_notes} »
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] text-hotel-muted whitespace-nowrap">
                          {formatDateTime(v.created_at, language)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 6. PROGRESSIVE SINGLE-FOCUS KITCHEN ACTION BAR */}
      {!readOnly && (
        <div className="p-4 sm:p-5 bg-[#FAF8F5] border-t border-hotel-border">
          {!isPaid && order.preparation_status !== 'cancelled' ? (
            /* PHASE 1: PAYMENT VERIFICATION ONLY (DISAPPEARS ONCE PAID) */
            <div className="p-4 rounded-xl bg-white border border-hotel-border shadow-subtle flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-hotel-text">
                    <ShieldCheck className="w-4 h-4 text-[#9A721C]" />
                    <span>
                      {language === 'fr'
                        ? 'Validation du paiement requise'
                        : 'Payment verification required'}
                    </span>
                  </span>

                  {order.payment_status === 'payment_rejected' ? (
                    <span className="badge-rejected">
                      <XCircle className="w-3 h-3" />
                      <span>{language === 'fr' ? 'Rejeté' : 'Rejected'}</span>
                    </span>
                  ) : (
                    <span className="badge-pending">
                      <Clock className="w-3 h-3" />
                      <span>{language === 'fr' ? 'En attente de confirmation' : 'Awaiting confirmation'}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-hotel-secondary">
                  {language === 'fr'
                    ? 'Vérifiez la réception sur le téléphone marchand officiel pour débloquer la préparation en cuisine.'
                    : 'Verify receipt on the official merchant phone to unlock kitchen preparation.'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                {/* Main CTA: Confirm Payment */}
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
                    className="py-2.5 px-5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 shadow-subtle transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>
                      {language === 'fr'
                        ? 'Confirmer le paiement reçu'
                        : 'Confirm payment received'}
                    </span>
                  </button>
                )}

                <div className="flex items-center gap-2">
                  {onReviewClick && (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => onReviewClick(order)}
                      className="flex-1 sm:flex-initial justify-center py-2.5 px-3.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
                    >
                      <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{language === 'fr' ? 'À vérifier' : 'Flag review'}</span>
                    </button>
                  )}

                  {onRejectClick && (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => onRejectClick(order)}
                      className="flex-1 sm:flex-initial justify-center py-2.5 px-3.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{language === 'fr' ? 'Rejeter' : 'Reject'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* PHASE 2: KITCHEN PREPARATION WORKFLOW (TAKES OVER ONCE PAID) */
            onUpdatePrepStatus && (
              <div className="p-4 rounded-xl bg-white border border-hotel-border shadow-subtle space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-[#9A721C]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-hotel-text">
                      {language === 'fr'
                        ? 'Suivi & Actions de Préparation'
                        : 'Preparation Tracking & Actions'}
                    </span>
                  </div>

                  <span
                    className={
                      order.preparation_status === 'ready' ||
                      order.preparation_status === 'completed'
                        ? 'badge-paid'
                        : order.preparation_status === 'preparing' ||
                          order.preparation_status === 'accepted'
                        ? 'badge-info'
                        : order.preparation_status === 'cancelled'
                        ? 'badge-rejected'
                        : 'badge-neutral'
                    }
                  >
                    {order.preparation_status === 'new' && t.statusNew}
                    {order.preparation_status === 'accepted' && t.statusAccepted}
                    {order.preparation_status === 'preparing' && t.statusPreparing}
                    {order.preparation_status === 'ready' && t.statusReady}
                    {order.preparation_status === 'completed' && t.statusCompleted}
                    {order.preparation_status === 'cancelled' && t.statusCancelled}
                  </span>
                </div>

                {/* Visual 4-Step Progression Bar */}
                {order.preparation_status !== 'cancelled' && (
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        ['accepted', language === 'fr' ? '1. Reçue' : '1. Accepted'],
                        ['preparing', language === 'fr' ? '2. Cuisine' : '2. Cooking'],
                        ['ready', language === 'fr' ? '3. Prête' : '3. Ready'],
                        ['completed', language === 'fr' ? '4. Servie' : '4. Served'],
                      ] as const
                    ).map(([stepKey, stepLabel], idx) => {
                      const orderRank: Record<PreparationStatus, number> = {
                        new: -1,
                        accepted: 0,
                        preparing: 1,
                        ready: 2,
                        completed: 3,
                        cancelled: -2,
                      };
                      const isDone = idx <= orderRank[order.preparation_status];
                      return (
                        <div key={stepKey} className="space-y-1">
                          <div
                            className={`h-1.5 rounded-full transition-colors ${
                              isDone ? 'bg-[#9A721C]' : 'bg-stone-200'
                            }`}
                          />
                          <span
                            className={`block text-[11px] truncate ${
                              isDone
                                ? 'font-semibold text-hotel-text'
                                : 'text-hotel-muted'
                            }`}
                          >
                            {stepLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Single Primary Preparation Action + Discreet Cancel */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  {order.preparation_status === 'new' && (
                    <button
                      type="button"
                      onClick={() => onUpdatePrepStatus(order.id, 'accepted')}
                      disabled={isActionLoading}
                      className="flex-1 btn-gold py-2.5 px-5 text-xs sm:text-sm font-semibold justify-center"
                    >
                      <span>
                        {language === 'fr'
                          ? 'Accepter la commande en cuisine'
                          : 'Accept order in kitchen'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  {order.preparation_status === 'accepted' && (
                    <button
                      type="button"
                      onClick={() => onUpdatePrepStatus(order.id, 'preparing')}
                      disabled={isActionLoading}
                      className="flex-1 btn-gold py-2.5 px-5 text-xs sm:text-sm font-semibold justify-center"
                    >
                      <Utensils className="w-4 h-4" />
                      <span>
                        {language === 'fr'
                          ? 'Lancer la préparation'
                          : 'Start preparation'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  {order.preparation_status === 'preparing' && (
                    <button
                      type="button"
                      onClick={() => onUpdatePrepStatus(order.id, 'ready')}
                      disabled={isActionLoading}
                      className="flex-1 py-2.5 px-5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 shadow-subtle transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {language === 'fr'
                          ? 'Marquer prête pour le service'
                          : 'Mark ready for service'}
                      </span>
                    </button>
                  )}

                  {order.preparation_status === 'ready' && (
                    <button
                      type="button"
                      onClick={() => onUpdatePrepStatus(order.id, 'completed')}
                      disabled={isActionLoading}
                      className="flex-1 btn-gold py-2.5 px-5 text-xs sm:text-sm font-semibold justify-center"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {language === 'fr'
                          ? 'Marquer servie / Clôturer la commande'
                          : 'Mark served / Complete order'}
                      </span>
                    </button>
                  )}

                  {order.preparation_status === 'completed' && (
                    <div className="flex-1 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        {language === 'fr'
                          ? 'Commande servie et clôturée'
                          : 'Order served and completed'}
                      </span>
                    </div>
                  )}

                  {order.preparation_status === 'cancelled' && (
                    <div className="flex-1 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs font-semibold flex items-center justify-center gap-2">
                      <Ban className="w-4 h-4 text-red-600 shrink-0" />
                      <span>
                        {language === 'fr' ? 'Commande annulée' : 'Order cancelled'}
                      </span>
                    </div>
                  )}

                  {order.preparation_status !== 'completed' &&
                    order.preparation_status !== 'cancelled' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowCancelConfirm(true)}
                          disabled={isActionLoading}
                          className="py-2.5 px-3.5 rounded-lg text-xs font-medium text-red-700 bg-white hover:bg-red-50 border border-red-200 inline-flex items-center justify-center gap-1.5 transition-colors shrink-0"
                          title={t.cancel}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{t.cancel}</span>
                        </button>

                        <ConfirmationModal
                          isOpen={showCancelConfirm}
                          onClose={() => setShowCancelConfirm(false)}
                          onConfirm={() => {
                            setShowCancelConfirm(false);
                            if (onUpdatePrepStatus) {
                              onUpdatePrepStatus(order.id, 'cancelled');
                            }
                          }}
                          title={
                            language === 'fr'
                              ? 'Annuler cette commande ?'
                              : 'Cancel this order?'
                          }
                          message={
                            language === 'fr'
                              ? `Voulez-vous vraiment annuler la commande ${order.public_reference} ? Cette action interrompra la préparation.`
                              : `Are you sure you want to cancel order ${order.public_reference}? This will stop preparation.`
                          }
                          confirmLabel={language === 'fr' ? 'Oui, annuler la commande' : 'Yes, cancel order'}
                          cancelLabel={language === 'fr' ? 'Conserver la commande' : 'Keep order'}
                          variant="danger"
                        />
                      </>
                    )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
