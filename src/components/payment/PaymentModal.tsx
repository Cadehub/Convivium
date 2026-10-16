import React, { useState, useEffect } from 'react';
import {
  X,
  PhoneCall,
  Copy,
  Check,
  AlertTriangle,
  Send,
  Loader2,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService, type CreateOrderResult } from '../../services/orders.service';
import type { PaymentMethodSetting, MobileOperator } from '../../types';
import { formatXAF } from '../../lib/formatters';

interface PaymentModalProps {
  orderResult: CreateOrderResult;
  onClose: () => void;
  onPaymentDeclared: (publicRef: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  orderResult,
  onClose,
  onPaymentDeclared,
}) => {
  const { t } = useLanguage();

  const [paymentOptions, setPaymentOptions] = useState<PaymentMethodSetting[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<MobileOperator>('mtn');
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Copy state
  const [copiedCode, setCopiedCode] = useState(false);

  // Declaration form state
  const [showDeclarationModal, setShowDeclarationModal] = useState(false);
  const [declaredRef, setDeclaredRef] = useState('');
  const [rawSms, setRawSms] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [isSubmittingDeclaration, setIsSubmittingDeclaration] = useState(false);
  const [declarationError, setDeclarationError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    ordersService.getPublicPaymentOptions().then((opts) => {
      if (!mounted) return;
      setPaymentOptions(opts);
      if (opts.length > 0) {
        // default to first active option
        setSelectedOperator(opts[0].id as MobileOperator);
      }
      setIsLoadingOptions(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const currentOption = paymentOptions.find((o) => o.id === selectedOperator);

  // Construct USSD code safely
  // MTN Cameroon merchant code syntax is typically *126*14*MERCHANT*AMOUNT# or guided *126#
  // Orange Money Cameroon syntax is typically #150*47*MERCHANT*AMOUNT# or guided #150#
  const getUssdCode = (): string => {
    if (!currentOption || !currentOption.merchant_code) return '';
    const code = currentOption.merchant_code.trim();
    const amount = orderResult.total_amount;

    if (currentOption.id === 'mtn') {
      return currentOption.ussd_mode === 'full'
        ? `*126*14*${code}*${amount}#`
        : `*126#`;
    } else {
      return currentOption.ussd_mode === 'full'
        ? `#150*47*${code}*${amount}#`
        : `#150*47#`;
    }
  };

  const ussdCode = getUssdCode();

  const handleCopy = () => {
    if (!ussdCode) return;
    navigator.clipboard.writeText(ussdCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDial = () => {
    if (!currentOption?.is_tested_on_device || !ussdCode) return;
    // URL-encode '#' as '%23' for standard tel: URI scheme
    const encoded = ussdCode.replace(/#/g, '%23');
    window.location.href = `tel:${encoded}`;
  };

  const handleDeclarationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeclarationError(null);
    setIsSubmittingDeclaration(true);

    try {
      await ordersService.submitPaymentDeclaration({
        publicReference: orderResult.public_reference,
        rawToken: orderResult.raw_token,
        operator: selectedOperator,
        declaredReference: declaredRef.trim(),
        rawSms: rawSms.trim(),
        payerPhone: payerPhone.trim(),
        note: customerNote.trim(),
      });

      setShowDeclarationModal(false);
      onPaymentDeclared(orderResult.public_reference);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.errorGeneral;
      setDeclarationError(msg);
    } finally {
      setIsSubmittingDeclaration(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-hotel-surface border border-hotel-cardBorder rounded-2xl shadow-2xl p-6 sm:p-8 z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-hotel-cardBorder">
          <div>
            <span className="text-[11px] font-bold tracking-widest text-hotel-gold uppercase">
              {t.orderRefLabel} : {orderResult.public_reference}
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-hotel-text mt-0.5">
              {t.paymentTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-card"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Official Total Banner */}
        <div className="mt-5 p-4 rounded-xl bg-hotel-card border border-hotel-cardBorder flex items-center justify-between">
          <div>
            <span className="text-xs text-hotel-muted font-medium block">
              {t.amountDue}
            </span>
            <span className="font-serif text-2xl sm:text-3xl font-extrabold text-hotel-gold">
              {formatXAF(orderResult.total_amount)}
            </span>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-800">
              {t.statusAwaitingPayment}
            </span>
          </div>
        </div>

        {/* Operator Selector */}
        <div className="mt-6">
          <label className="block text-xs font-semibold text-hotel-muted uppercase tracking-wider mb-2">
            {t.selectOperator}
          </label>

          {isLoadingOptions ? (
            <div className="p-4 text-center text-xs text-hotel-muted">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-hotel-gold mb-1" />
              {t.loading}
            </div>
          ) : paymentOptions.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs">
              <p className="font-medium">
                Aucun moyen de paiement Mobile Money n’est encore activé avec un code marchand par la Direction.
              </p>
              <p className="text-[11px] text-amber-300/80 mt-1">
                Veuillez vous rapprocher de la réception ou régler votre commande directement auprès du personnel de l’hôtel.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {paymentOptions.map((opt) => {
                const isSelected = selectedOperator === opt.id;
                const isOrange = opt.id === 'orange';

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOperator(opt.id as MobileOperator)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? isOrange
                          ? 'border-orange-500 bg-orange-950/30 text-white shadow-md'
                          : 'border-yellow-500 bg-yellow-950/30 text-white shadow-md'
                        : 'border-hotel-cardBorder bg-hotel-card text-hotel-muted hover:text-hotel-text'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">
                        {isOrange ? 'Orange Money' : 'MTN MoMo'}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-hotel-gold" />
                      )}
                    </div>
                    <span className="text-[11px] text-hotel-muted block">
                      Code: {opt.merchant_code || '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Payment Details */}
        {currentOption && currentOption.merchant_code && (
          <div className="mt-5 space-y-4">
            {/* USSD Display Box */}
            <div className="p-4 rounded-xl bg-hotel-card border border-hotel-cardBorder">
              <div className="flex items-center justify-between text-xs text-hotel-muted mb-1.5">
                <span>{t.ussdCodeLabel}</span>
                <span className="text-[11px] text-hotel-gold font-medium">
                  {currentOption.account_name || 'Convivium Home Hotel'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <code className="flex-1 p-2.5 rounded-lg bg-hotel-black border border-hotel-cardBorder font-mono text-base font-bold text-hotel-gold select-all text-center">
                  {ussdCode}
                </code>
                <button
                  onClick={handleCopy}
                  className="btn-secondary px-3 py-2.5 text-xs flex items-center gap-1.5 flex-shrink-0"
                  title={t.copy}
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">{t.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-hotel-gold" />
                      <span>{t.copy}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Dialer Button with Tested Device Verification Rule */}
              <div className="mt-3">
                {currentOption.is_tested_on_device ? (
                  <div>
                    <button
                      onClick={handleDial}
                      className="w-full btn-gold py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>{t.dialButton}</span>
                    </button>
                    <p className="text-[10px] text-hotel-muted mt-1 text-center">
                      {t.dialNoticeTested}
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-hotel-surface border border-hotel-cardBorder text-hotel-muted text-xs flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      {t.dialNoticeUntested}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Step by step manual guidance */}
            <div className="p-3.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder/80 text-xs text-hotel-muted space-y-1.5">
              <div className="font-semibold text-hotel-text flex items-center gap-1.5 text-xs mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-hotel-gold" />
                <span>{t.manualInstructions}</span>
              </div>
              <p>1. {t.paymentStep1}</p>
              <p>2. {t.paymentStep2}</p>
              <p>3. {t.paymentStep3}</p>
              <p className="text-hotel-gold">4. {t.paymentStep4}</p>
            </div>
          </div>
        )}

        {/* Action: I have paid button */}
        <div className="mt-6 pt-4 border-t border-hotel-cardBorder flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowDeclarationModal(true)}
            className="flex-1 btn-gold py-3 text-sm font-bold flex items-center justify-center gap-2"
          >
            <span>{t.iHavePaidButton}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="btn-secondary text-xs py-3">
            {t.close}
          </button>
        </div>
      </div>

      {/* Payment Declaration Modal */}
      {showDeclarationModal && (
        <div className="fixed inset-0 z-60 overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => setShowDeclarationModal(false)}
          />

          <div className="relative w-full max-w-lg bg-hotel-surface border border-hotel-cardBorder rounded-2xl shadow-2xl p-6 z-20">
            <div className="flex items-center justify-between pb-3 border-b border-hotel-cardBorder">
              <h3 className="font-serif text-lg font-bold text-hotel-text">
                {t.declarationModalTitle}
              </h3>
              <button
                onClick={() => setShowDeclarationModal(false)}
                className="p-1 rounded-lg text-hotel-muted hover:text-hotel-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Critical Security Warning */}
            <div className="mt-4 p-3.5 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">{t.declarationNotice}</p>
            </div>

            {declarationError && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs">
                {declarationError}
              </div>
            )}

            <form onSubmit={handleDeclarationSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.declaredRefLabel} ({t.optional})
                </label>
                <input
                  type="text"
                  value={declaredRef}
                  onChange={(e) => setDeclaredRef(e.target.value)}
                  placeholder={t.declaredRefPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.rawSmsLabel}
                </label>
                <textarea
                  rows={2}
                  value={rawSms}
                  onChange={(e) => setRawSms(e.target.value)}
                  placeholder={t.rawSmsPlaceholder}
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-hotel-text mb-1">
                    {t.payerPhoneLabel}
                  </label>
                  <input
                    type="tel"
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                    placeholder={t.payerPhonePlaceholder}
                    className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-hotel-text mb-1">
                    Remarque (facultative)
                  </label>
                  <input
                    type="text"
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="Précision..."
                    className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingDeclaration}
                  className="w-full btn-gold py-3 text-sm font-bold flex items-center justify-center gap-2"
                >
                  {isSubmittingDeclaration ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.saving}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{t.submitDeclarationButton}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
