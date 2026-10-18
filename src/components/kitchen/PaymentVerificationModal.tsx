import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  FileText,
  Smartphone,
} from 'lucide-react';
import type { Order } from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';
import { analyzePaymentSms } from '../../lib/smsParser';
import { useLanguage } from '../../i18n/LanguageContext';

interface PaymentVerificationModalProps {
  order: Order | null;
  allOrders?: Order[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: (
    orderId: string,
    verifiedReference: string,
    internalNotes: string
  ) => Promise<void>;
  onRejectPayment: (order: Order) => void;
  onReviewPayment: (order: Order) => void;
  isLoading: boolean;
}

export const PaymentVerificationModal: React.FC<PaymentVerificationModalProps> = ({
  order,
  allOrders = [],
  isOpen,
  onClose,
  onConfirmPayment,
  onRejectPayment,
  onReviewPayment,
  isLoading,
}) => {
  const { language, t } = useLanguage();

  const [verifiedRef, setVerifiedRef] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSmsExpanded, setIsSmsExpanded] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Latest declaration from customer
  const declarations = order?.payment_declarations || [];
  const latestDeclaration =
    declarations.length > 0
      ? [...declarations].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
      : null;

  // SMS parsing and cross-checking
  const analysis = analyzePaymentSms({
    rawSms: latestDeclaration?.raw_sms_text,
    expectedAmount: order?.total_amount || 0,
    declaredOperator: latestDeclaration?.operator,
    allOrders,
    currentOrderId: order?.id,
    declaredReference: latestDeclaration?.declared_reference,
  });

  useEffect(() => {
    if (order) {
      const bestRef =
        analysis.parsed.extractedReference ||
        latestDeclaration?.declared_reference ||
        '';
      setVerifiedRef(bestRef);
      setInternalNotes('');
      setErrorMessage(null);
      setIsSmsExpanded(false);
    }
  }, [order?.id, latestDeclaration?.id]);

  if (!isOpen || !order) return null;

  const notDetectedText = t.notDetected;

  const detectedOperatorLabel = (() => {
    const op = analysis.parsed.detectedOperator || latestDeclaration?.operator;
    if (op === 'orange') return 'Orange Money';
    if (op === 'mtn') return 'MTN Mobile Money';
    return notDetectedText;
  })();

  const handleCopySms = () => {
    if (!latestDeclaration?.raw_sms_text) return;
    navigator.clipboard.writeText(latestDeclaration.raw_sms_text);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2000);
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Guard: alert if amounts clearly mismatch
    if (
      analysis.parsed.extractedAmount !== null &&
      analysis.amountStatus === 'mismatch'
    ) {
      const confirmMismatch = window.confirm(
        language === 'fr'
          ? `Attention : Le montant extrait du SMS (${formatXAF(
              analysis.parsed.extractedAmount
            )}) diffère du montant attendu (${formatXAF(
              order.total_amount
            )}).\n\nConfirmez-vous avoir vérifié le solde complet sur le compte officiel ?`
          : `Warning: The extracted SMS amount (${formatXAF(
              analysis.parsed.extractedAmount
            )}) differs from expected total (${formatXAF(
              order.total_amount
            )}).\n\nDo you confirm you verified the full funds on the official account?`
      );
      if (!confirmMismatch) return;
    }

    try {
      await onConfirmPayment(order.id, verifiedRef.trim(), internalNotes.trim());
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/50 backdrop-blur-[2px] transition-opacity"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl max-h-[92dvh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated z-10 sm:my-auto pb-safe flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-hotel-border bg-[#FAF8F5] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#9A721C]/15 text-[#9A721C] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg sm:text-xl font-semibold text-hotel-text">
                {language === 'fr'
                  ? 'Contrôle & Validation du Paiement'
                  : 'Payment Control & Verification'}
              </h3>
              <p className="text-xs text-hotel-secondary">
                {order.customer_name} • {order.public_reference}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 flex-1">
          {/* SECTION A: Informations essentielles, très visibles */}
          <div className="p-4 sm:p-5 rounded-xl bg-stone-50 border border-stone-200/80 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-hotel-secondary block">
                {language === 'fr' ? 'Référence de commande' : 'Order reference'}
              </span>
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-hotel-text tracking-tight">
                {order.public_reference}
              </span>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="inline-flex items-center gap-1 text-hotel-secondary font-medium">
                  <Smartphone className="w-3.5 h-3.5 text-stone-500" />
                  <span>{detectedOperatorLabel}</span>
                </span>
                {latestDeclaration?.payer_phone && (
                  <>
                    <span className="text-stone-300">•</span>
                    <span className="font-mono text-hotel-secondary">
                      {latestDeclaration.payer_phone}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Expected Amount in VERY LARGE FONT */}
            <div className="text-left sm:text-right pt-3 sm:pt-0 border-t sm:border-t-0 border-stone-200">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#9A721C] block">
                {t.amountDue}
              </span>
              <span className="font-serif text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
                {formatXAF(order.total_amount)}
              </span>
              <div className="mt-1">
                {order.payment_status === 'payment_declared' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                    <Clock className="w-3 h-3 text-amber-700" />
                    <span>{t.statusPaymentDeclared}</span>
                  </span>
                )}
                {order.payment_status === 'payment_review_required' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-950 border border-amber-400">
                    <HelpCircle className="w-3 h-3 text-amber-800" />
                    <span>{t.statusPaymentReview}</span>
                  </span>
                )}
                {order.payment_status === 'payment_rejected' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-900 border border-red-300">
                    <XCircle className="w-3 h-3 text-red-700" />
                    <span>{t.statusPaymentRejected}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SECTION B: Informations extraites du SMS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#9A721C]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-hotel-text">
                {language === 'fr'
                  ? 'Données extraites de la déclaration'
                  : 'Extracted declaration data'}
              </h4>
            </div>

            {latestDeclaration ? (
              <div className="space-y-3">
                {/* Amount Comparison Banner */}
                {analysis.parsed.extractedAmount !== null ? (
                  analysis.amountStatus === 'exact_match' ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-sm block">
                          {t.matchingAmount} ({formatXAF(analysis.parsed.extractedAmount)})
                        </span>
                        <p className="text-xs text-emerald-800 mt-0.5">
                          {t.matchingAmountNotice}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-sm block">
                          {t.mismatchAmount} (
                          {analysis.amountDifference! > 0
                            ? `+${analysis.amountDifference}`
                            : analysis.amountDifference}{' '}
                          XAF)
                        </span>
                        <p className="text-xs text-red-800 mt-0.5">
                          {t.mismatchAmountNotice} Montant extrait :{' '}
                          <strong>{formatXAF(analysis.parsed.extractedAmount)}</strong> |
                          Attendu : <strong>{formatXAF(order.total_amount)}</strong>.
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      {language === 'fr'
                        ? 'Montant non détecté automatiquement dans le message.'
                        : 'Amount not automatically detected in the message.'}
                    </span>
                  </div>
                )}

                {/* Grid of extracted fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-lg bg-[#FAF8F5] border border-hotel-border">
                    <span className="text-[11px] text-hotel-secondary font-medium block">
                      {language === 'fr' ? 'Référence de transaction' : 'Transaction reference'}
                    </span>
                    <strong className="text-xs font-mono font-bold text-hotel-text block mt-1 break-all">
                      {analysis.parsed.extractedReference ||
                        latestDeclaration.declared_reference ||
                        notDetectedText}
                    </strong>
                  </div>

                  <div className="p-3 rounded-lg bg-[#FAF8F5] border border-hotel-border">
                    <span className="text-[11px] text-hotel-secondary font-medium block">
                      {language === 'fr' ? 'Date & Heure constatée' : 'Date & Time'}
                    </span>
                    <strong className="text-xs font-mono font-medium text-hotel-text block mt-1">
                      {analysis.parsed.extractedDateTime || notDetectedText}
                    </strong>
                  </div>

                  <div className="p-3 rounded-lg bg-[#FAF8F5] border border-hotel-border">
                    <span className="text-[11px] text-hotel-secondary font-medium block">
                      {language === 'fr' ? 'Réseau / Opérateur' : 'Network / Operator'}
                    </span>
                    <strong className="text-xs font-semibold text-hotel-text block mt-1">
                      {detectedOperatorLabel}
                    </strong>
                  </div>
                </div>

                {/* Duplicate reference warning if detected */}
                {analysis.isDuplicateRef && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">
                        {language === 'fr'
                          ? 'Alerte sécurité : Référence de transaction déjà enregistrée !'
                          : 'Security Warning: Transaction reference already recorded!'}
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
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-stone-50 border border-dashed border-stone-300 text-center text-xs text-hotel-secondary">
                {language === 'fr'
                  ? 'Aucun SMS ni déclaration soumise par le client pour cette commande.'
                  : 'No SMS or declaration submitted by the guest for this order yet.'}
              </div>
            )}
          </div>

          {/* SECTION C: SMS original (repliable) */}
          {latestDeclaration?.raw_sms_text && (
            <div className="rounded-xl border border-hotel-border bg-[#FAF8F5] overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setIsSmsExpanded(!isSmsExpanded)}
                className="w-full px-4 py-2.5 bg-stone-100 hover:bg-stone-200/60 flex items-center justify-between text-left font-medium text-hotel-text transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t.originalSmsSection}</span>
                  <span className="text-[11px] text-hotel-muted">
                    ({formatDateTime(latestDeclaration.created_at, language)})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[#9A721C] font-semibold text-xs">
                  <span>{isSmsExpanded ? t.originalSmsHide : t.originalSmsShow}</span>
                  {isSmsExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>

              {isSmsExpanded && (
                <div className="p-4 border-t border-hotel-border space-y-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleCopySms}
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
                  <pre className="font-mono text-xs text-stone-800 bg-white p-3 rounded-lg border border-stone-200 whitespace-pre-wrap break-words leading-relaxed select-all">
                    {latestDeclaration.raw_sms_text}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* SECTION D: Rappel de vérification officielle */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-300/80 text-xs text-amber-950 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#9A721C] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>{language === 'fr' ? 'Rappel impératif :' : 'Imperative reminder:'}</strong>{' '}
              {t.officialVerificationReminder}
            </p>
          </div>

          {/* SECTION E: Formulaire de confirmation et actions */}
          <form onSubmit={handleConfirmSubmit} className="space-y-4 pt-2">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-hotel-text mb-1">
                  {t.verifiedRefPrompt}
                </label>
                <input
                  type="text"
                  value={verifiedRef}
                  onChange={(e) => setVerifiedRef(e.target.value)}
                  placeholder={t.verifiedRefPlaceholder}
                  className="input-hotel py-2 text-xs font-mono"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-hotel-text mb-1">
                  {t.internalNotesPrompt}
                </label>
                <input
                  type="text"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder={
                    language === 'fr'
                      ? 'Ex : Vérifié sur terminal caisse n°1'
                      : 'e.g. Verified on till #1'
                  }
                  className="input-hotel py-2 text-xs"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-3 border-t border-hotel-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Secondary actions: Reject & Review */}
              <div className="flex items-center gap-2 order-2 sm:order-1">
                <button
                  type="button"
                  onClick={() => onRejectPayment(order)}
                  disabled={isLoading}
                  className="flex-1 sm:flex-initial py-2.5 px-3.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{t.rejectPaymentSubmit}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onReviewPayment(order)}
                  disabled={isLoading}
                  className="flex-1 sm:flex-initial py-2.5 px-3.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{language === 'fr' ? 'À vérifier' : 'Flag review'}</span>
                </button>
              </div>

              {/* Primary action: Confirm Payment & Close */}
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="btn-outline-gold py-2.5 px-4 text-xs font-semibold"
                >
                  {t.cancel}
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 sm:flex-initial py-2.5 px-5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 shadow-subtle transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>{t.confirmPaymentSubmit}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
