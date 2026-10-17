import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  PhoneCall,
  Copy,
  Check,
  Send,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  MessageSquareText,
  Ban,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService, type CreateOrderResult } from '../../services/orders.service';
import { getStoredClientOrderToken } from '../../lib/security';
import type { PaymentMethodSetting, MobileOperator } from '../../types';
import { formatXAF } from '../../lib/formatters';
import { parseMobileMoneySms } from '../../lib/smsParser';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface PaymentModalProps {
  orderResult: CreateOrderResult;
  onClose: () => void;
  onPaymentDeclared: (publicRef: string) => void;
  onCancelOrder?: (publicRef: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  orderResult,
  onClose,
  onPaymentDeclared,
  onCancelOrder,
}) => {
  const { language, t } = useLanguage();

  const [paymentOptions, setPaymentOptions] = useState<PaymentMethodSetting[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<MobileOperator>('mtn');
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Copy state
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  // Streamlined Declaration State: Client pastes the confirmation SMS received
  const [rawSms, setRawSms] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Exit & Cancellation confirmation states
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showCancelOrderConfirm, setShowCancelOrderConfirm] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [cancelOrderError, setCancelOrderError] = useState<string | null>(null);

  const handleRequestClose = () => {
    // If client hasn't submitted payment, confirm if they want to exit to menu/tracking
    setShowExitConfirm(true);
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    onClose();
  };

  const handleConfirmCancelOrder = async () => {
    setCancelOrderError(null);
    setIsCancellingOrder(true);
    try {
      const token =
        orderResult.raw_token ||
        getStoredClientOrderToken(orderResult.public_reference) ||
        '';
      await ordersService.cancelOrderClient(
        orderResult.public_reference,
        token,
        'Annulation demandée par le client avant paiement'
      );
      if (onCancelOrder) {
        onCancelOrder(orderResult.public_reference);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible d’annuler la commande.';
      setCancelOrderError(msg);
      setIsCancellingOrder(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    ordersService.getPublicPaymentOptions().then((opts) => {
      if (!mounted) return;
      setPaymentOptions(opts);
      if (opts.length > 0) {
        setSelectedOperator(opts[0].id as MobileOperator);
      }
      setIsLoadingOptions(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const currentOption = paymentOptions.find((o) => o.id === selectedOperator);

  // Live deterministic parsing of pasted confirmation SMS
  const parsedInfo = useMemo(() => {
    return parseMobileMoneySms(rawSms);
  }, [rawSms]);

  // Automatically update selected operator if detected in SMS
  useEffect(() => {
    if (parsedInfo.detectedOperator && parsedInfo.detectedOperator !== selectedOperator) {
      setSelectedOperator(parsedInfo.detectedOperator);
    }
  }, [parsedInfo.detectedOperator, selectedOperator]);

  // Target recipient phone or merchant code
  const mtnRecipientPhone = (currentOption?.phone_number || currentOption?.merchant_code || '').trim();
  const orangeMerchantCode = (currentOption?.merchant_code || '').trim();

  // Construct USSD code safely
  const getUssdCode = (): string => {
    if (!currentOption) return '';
    const amount = orderResult.total_amount;

    if (currentOption.id === 'mtn') {
      if (!mtnRecipientPhone) return '*126#';
      // If tested on real device with full shortcut, can dial *126*1*1*phone*amount#
      // Otherwise safe Cameroon standard: *126#
      return currentOption.ussd_mode === 'full' && currentOption.is_tested_on_device
        ? `*126*1*1*${mtnRecipientPhone}*${amount}#`
        : `*126#`;
    } else {
      if (!orangeMerchantCode) return '#150*47#';
      return currentOption.ussd_mode === 'full'
        ? `#150*47*${orangeMerchantCode}*${amount}#`
        : `#150*47#`;
    }
  };

  const ussdCode = getUssdCode();

  const handleCopyCode = () => {
    if (!ussdCode) return;
    navigator.clipboard.writeText(ussdCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPhone = () => {
    if (!mtnRecipientPhone) return;
    navigator.clipboard.writeText(mtnRecipientPhone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(String(orderResult.total_amount));
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleDial = () => {
    const codeToDial = currentOption?.id === 'mtn' ? (ussdCode || '*126#') : ussdCode;
    if (!codeToDial) return;
    const encoded = codeToDial.replace(/#/g, '%23');
    window.location.href = `tel:${encoded}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    const hasSms = Boolean(rawSms.trim());

    if (!hasSms) {
      setSubmissionError(
        language === 'fr'
          ? 'Veuillez coller le SMS de confirmation de paiement reçu avant de valider.'
          : 'Please paste your payment confirmation SMS before submitting.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const token =
        orderResult.raw_token ||
        getStoredClientOrderToken(orderResult.public_reference) ||
        '';

      const finalRef = (parsedInfo.extractedReference || '').trim();
      const finalOperator = parsedInfo.detectedOperator || selectedOperator;

      await ordersService.submitPaymentDeclaration({
        publicReference: orderResult.public_reference,
        rawToken: token,
        operator: finalOperator,
        declaredReference: finalRef,
        rawSms: rawSms.trim(),
        payerPhone: (parsedInfo.extractedPhoneNumber || '').trim(),
        note: '',
      });

      onPaymentDeclared(orderResult.public_reference);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.errorGeneral;
      setSubmissionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const notDetectedLabel = language === 'fr' ? 'Non détecté' : 'Not detected';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-6 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[2px]" onClick={handleRequestClose} />

      {/* Main Card */}
      <div className="relative w-full max-w-xl max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-7 pb-safe z-10 sm:my-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-hotel-border">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-hotel-text px-2.5 py-0.5 rounded-md bg-hotel-subtle border border-hotel-border">
                {orderResult.public_reference}
              </span>
              <span className="text-xs text-hotel-muted">Convivium Home Hotel</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-hotel-text mt-1.5">
              {t.paymentTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-subtle transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Exit / Return to menu Confirmation Modal */}
        <ConfirmationModal
          isOpen={showExitConfirm}
          onClose={() => setShowExitConfirm(false)}
          onConfirm={handleConfirmExit}
          title={
            language === 'fr'
              ? 'Fermer sans déclarer le paiement ?'
              : 'Close without declaring payment?'
          }
          message={
            language === 'fr'
              ? 'Votre commande reste enregistrée. Vous pouvez rouvrir cette confirmation à tout moment depuis la barre de rappel en haut ou l’onglet Suivi pour coller votre SMS.'
              : 'Your order remains saved. You can reopen this confirmation anytime from the top reminder bar or the Tracking tab to paste your SMS.'
          }
          confirmLabel={language === 'fr' ? 'Fermer temporairement' : 'Close for now'}
          cancelLabel={language === 'fr' ? 'Rester et finaliser' : 'Stay & finalize'}
          variant="warning"
        />

        {/* Cancel Order Confirmation Modal */}
        <ConfirmationModal
          isOpen={showCancelOrderConfirm}
          onClose={() => {
            setShowCancelOrderConfirm(false);
            setCancelOrderError(null);
          }}
          onConfirm={handleConfirmCancelOrder}
          title={
            language === 'fr'
              ? 'Annuler définitivement cette commande ?'
              : 'Cancel this order?'
          }
          message={
            cancelOrderError ||
            (language === 'fr'
              ? 'Comme aucun paiement n’a été validé par la cuisine, cette commande sera annulée et la cuisine ne la préparera pas.'
              : 'Since no payment has been confirmed by the kitchen, this order will be cancelled and the kitchen will not prepare it.')
          }
          confirmLabel={language === 'fr' ? 'Oui, annuler la commande' : 'Yes, cancel order'}
          cancelLabel={language === 'fr' ? 'Conserver la commande' : 'Keep order'}
          variant="danger"
          isLoading={isCancellingOrder}
        />

        {/* Amount Due Banner */}
        <div className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-hotel-border flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs text-hotel-secondary font-medium block">
              {t.amountDue}
            </span>
            <span className="font-serif text-2xl sm:text-3xl font-bold text-hotel-text">
              {formatXAF(orderResult.total_amount)}
            </span>
            {typeof orderResult.delivery_fee === 'number' && orderResult.delivery_fee > 0 && (
              <span className="block text-[11px] text-hotel-secondary mt-0.5">
                {t.deliveryFee} : +{formatXAF(orderResult.delivery_fee)}
              </span>
            )}
          </div>
          <span className="badge-pending">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            <span>{t.statusAwaitingPayment}</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Step 1: Choose Operator & Merchant Code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-hotel-secondary uppercase tracking-wider">
                1. {t.selectOperator}
              </label>
              {currentOption?.account_name && (
                <span className="text-xs text-[#9A721C] font-medium">
                  {currentOption.account_name}
                </span>
              )}
            </div>

            {isLoadingOptions ? (
              <div className="p-4 text-center text-xs text-hotel-muted">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#9A721C] mb-1" />
                {t.loading}
              </div>
            ) : paymentOptions.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                {language === 'fr'
                  ? 'Aucun compte marchand Mobile Money n’est actuellement activé. Veuillez vous adresser à la réception.'
                  : 'No Mobile Money merchant account is currently active. Please contact the front desk.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {paymentOptions.map((opt) => {
                  const isSelected = selectedOperator === opt.id;
                  const isOrange = opt.id === 'orange';
                  const displayIdentifier = isOrange
                    ? opt.merchant_code || '—'
                    : opt.phone_number || opt.merchant_code || '—';

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOperator(opt.id as MobileOperator)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-hotel-dark bg-[#FBF7EE] ring-1 ring-hotel-dark/10 shadow-subtle'
                          : 'border-hotel-border bg-white text-hotel-secondary hover:border-hotel-borderStrong hover:text-hotel-text'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-hotel-text flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isOrange ? 'bg-orange-500' : 'bg-yellow-500'
                            }`}
                          />
                          {isOrange ? 'Orange Money' : 'MTN Mobile Money'}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[#9A721C]" />
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-hotel-secondary">
                        <span>{isOrange ? t.merchantCodeLabel : t.recipientPhoneLabel} :</span>
                        <strong className="text-hotel-text font-mono text-sm">
                          {displayIdentifier}
                        </strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Operator Specific Payment Guides */}
            {currentOption && selectedOperator === 'mtn' && (
              <div className="mt-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-amber-200/60">
                  <div>
                    <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider block">
                      {t.recipientPhoneLabel} (MTN MoMo)
                    </span>
                    <strong className="font-mono text-base font-bold text-hotel-text block select-all">
                      {mtnRecipientPhone || 'Non configuré'}
                    </strong>
                    {currentOption.account_name && (
                      <span className="text-xs text-amber-800 font-medium">
                        Titulaire : {currentOption.account_name}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="btn-outline-gold bg-white px-2.5 py-1.5 text-xs"
                      title={t.copyPhone}
                    >
                      {copiedPhone ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">{t.copiedPhone}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-hotel-secondary" />
                          <span>{t.copyPhone}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyAmount}
                      className="btn-outline-gold bg-white px-2.5 py-1.5 text-xs"
                      title={t.copyAmount}
                    >
                      {copiedAmount ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">{t.copiedAmount}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-hotel-secondary" />
                          <span>{t.copyAmount} ({formatXAF(orderResult.total_amount)})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* MTN Step-by-Step Instructions */}
                <div className="text-xs text-amber-950/90 space-y-1.5">
                  <div className="font-semibold text-amber-900">{t.manualInstructions} :</div>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>{t.mtnTransferStep1}</li>
                    <li>{t.mtnTransferStep2}</li>
                    <li>
                      {t.mtnTransferStep3
                        .replace('{phone}', mtnRecipientPhone || '...')
                        .replace('{amount}', formatXAF(orderResult.total_amount))}
                    </li>
                    <li>
                      {t.mtnTransferStep4.replace('{account}', currentOption.account_name || 'Convivium')}
                    </li>
                  </ol>
                </div>

                {/* Quick Dial Button for *126# */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/60">
                  <div className="text-[11px] text-amber-800">
                    <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
                    <span>{t.mtnPinSafetyNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDial}
                    className="btn-gold px-3 py-1.5 text-xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{t.openMtnMenu}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Orange Money Merchant Box */}
            {currentOption && selectedOperator === 'orange' && orangeMerchantCode && ussdCode && (
              <div className="mt-3 p-3.5 rounded-xl bg-hotel-subtle/70 border border-hotel-border flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] text-hotel-secondary font-medium block">
                    {t.ussdCodeLabel} ({currentOption.is_tested_on_device ? t.dialNoticeTested : t.dialNoticeUntested})
                  </span>
                  <code className="font-mono text-base font-bold text-hotel-text select-all block mt-0.5">
                    {ussdCode}
                  </code>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="btn-outline-gold px-3 py-1.5 text-xs"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">{t.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-hotel-secondary" />
                        <span>{t.copy}</span>
                      </>
                    )}
                  </button>

                  {currentOption.is_tested_on_device && (
                    <button
                      type="button"
                      onClick={handleDial}
                      className="btn-gold px-3 py-1.5 text-xs"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>{t.dialButton}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Paste Confirmation SMS */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-hotel-borderStrong space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareText className="w-4 h-4 text-[#9A721C]" />
                <label className="text-xs font-semibold text-hotel-text uppercase tracking-wider">
                  2. {t.rawSmsLabel}
                </label>
              </div>
            </div>

            <p className="text-xs text-hotel-secondary leading-relaxed">
              {language === 'fr'
                ? 'Une fois le règlement effectué sur votre téléphone, collez le SMS de confirmation reçu ci-dessous pour transmettre votre déclaration à la cuisine.'
                : 'Once you complete the transfer on your phone, paste the confirmation SMS below to submit your declaration to the kitchen.'}
            </p>

            <div className="relative">
              <textarea
                rows={3}
                value={rawSms}
                onChange={(e) => setRawSms(e.target.value)}
                placeholder={t.rawSmsPlaceholder}
                className="input-hotel font-mono text-xs resize-none leading-relaxed"
              />
              {rawSms && (
                <button
                  type="button"
                  onClick={() => setRawSms('')}
                  className="absolute right-2.5 top-2.5 text-hotel-muted hover:text-hotel-text p-1 rounded"
                  title={t.delete}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live Deterministic Extraction Preview */}
            {rawSms.trim() && (
              <div className="p-3.5 rounded-lg bg-white border border-hotel-border space-y-2.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-hotel-text">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#9A721C]" />
                  <span>
                    {language === 'fr'
                      ? 'Aperçu des informations extraites du SMS :'
                      : 'Extracted SMS information preview:'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-hotel-subtle/60 border border-hotel-border">
                    <span className="text-[11px] text-hotel-muted block">
                      {language === 'fr' ? 'Réseau détecté' : 'Detected network'}
                    </span>
                    <strong className="text-hotel-text font-medium">
                      {parsedInfo.detectedOperator === 'orange'
                        ? 'Orange Money'
                        : parsedInfo.detectedOperator === 'mtn'
                        ? 'MTN Mobile Money'
                        : notDetectedLabel}
                    </strong>
                  </div>

                  <div className="p-2 rounded bg-hotel-subtle/60 border border-hotel-border">
                    <span className="text-[11px] text-hotel-muted block">
                      {language === 'fr' ? 'Référence extraite' : 'Extracted reference'}
                    </span>
                    <strong className="text-hotel-text font-mono">
                      {parsedInfo.extractedReference || notDetectedLabel}
                    </strong>
                  </div>

                  <div className="p-2 rounded bg-hotel-subtle/60 border border-hotel-border">
                    <span className="text-[11px] text-hotel-muted block">
                      {language === 'fr' ? 'Montant extrait' : 'Extracted amount'}
                    </span>
                    {parsedInfo.extractedAmount !== null ? (
                      parsedInfo.extractedAmount === orderResult.total_amount ? (
                        <strong className="text-emerald-700 font-semibold">
                          {formatXAF(parsedInfo.extractedAmount)} (Conforme)
                        </strong>
                      ) : (
                        <strong className="text-red-700 font-semibold">
                          {formatXAF(parsedInfo.extractedAmount)} (Attendu : {formatXAF(orderResult.total_amount)})
                        </strong>
                      )
                    ) : (
                      <strong className="text-hotel-muted font-normal">{notDetectedLabel}</strong>
                    )}
                  </div>

                  <div className="p-2 rounded bg-hotel-subtle/60 border border-hotel-border">
                    <span className="text-[11px] text-hotel-muted block">
                      {language === 'fr' ? 'Date et heure' : 'Date & time'}
                    </span>
                    <strong className="text-hotel-text font-mono">
                      {parsedInfo.extractedDateTime || notDetectedLabel}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submission Error Banner */}
          {submissionError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="font-medium">{submissionError}</span>
            </div>
          )}

          {/* Clear Verification Notice */}
          <div className="p-3.5 rounded-xl bg-hotel-subtle/60 border border-hotel-border flex items-start gap-2.5 text-xs text-hotel-secondary">
            <ShieldCheck className="w-4 h-4 text-[#9A721C] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {t.declarationNotice}
            </p>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 border-t border-hotel-border flex flex-col-reverse sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={isSubmitting}
              className="btn-outline-gold text-xs py-2.5 px-5"
            >
              {t.close}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !rawSms.trim()}
              className="flex-1 btn-gold py-3 text-sm font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'fr' ? 'Transmission en cours...' : 'Submitting...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{t.submitDeclarationButton}</span>
                </>
              )}
            </button>
          </div>

          {/* Cancellation Option for unpaid order */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-t border-dashed border-hotel-border text-hotel-muted">
            <span>
              {language === 'fr'
                ? 'Vous ne souhaitez plus cette commande ?'
                : 'Changed your mind?'}
            </span>
            <button
              type="button"
              onClick={() => setShowCancelOrderConfirm(true)}
              disabled={isSubmitting || isCancellingOrder}
              className="text-red-700 hover:text-red-800 font-medium inline-flex items-center gap-1.5 hover:underline py-1"
            >
              <Ban className="w-3.5 h-3.5 text-red-600" />
              <span>{language === 'fr' ? 'Annuler ma commande' : 'Cancel my order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
