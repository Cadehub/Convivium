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
  Sparkles,
  ChevronDown,
  ChevronUp,
  Smartphone,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService, type CreateOrderResult } from '../../services/orders.service';
import { getStoredClientOrderToken } from '../../lib/security';
import type { PaymentMethodSetting, MobileOperator } from '../../types';
import { formatXAF } from '../../lib/formatters';
import { parseMobileMoneySms } from '../../lib/smsParser';

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

  // Streamlined Declaration State: Primary flow is pasting the confirmation SMS
  const [rawSms, setRawSms] = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualReference, setManualReference] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

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

  // Live parsing of pasted confirmation SMS
  const parsedInfo = useMemo(() => {
    return parseMobileMoneySms(rawSms);
  }, [rawSms]);

  // Automatically update selected operator if detected in SMS
  useEffect(() => {
    if (parsedInfo.detectedOperator && parsedInfo.detectedOperator !== selectedOperator) {
      setSelectedOperator(parsedInfo.detectedOperator);
    }
  }, [parsedInfo.detectedOperator, selectedOperator]);

  // Construct USSD code safely
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
    const encoded = ussdCode.replace(/#/g, '%23');
    window.location.href = `tel:${encoded}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    const hasSms = Boolean(rawSms.trim());
    const hasManualRef = Boolean(manualReference.trim());

    if (!hasSms && !hasManualRef) {
      setSubmissionError('Veuillez coller le SMS de confirmation reçu ou indiquer votre référence de paiement.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token =
        orderResult.raw_token ||
        getStoredClientOrderToken(orderResult.public_reference) ||
        '';

      // Effective reference to record: extracted from SMS if available, else manual input
      const finalRef = (parsedInfo.extractedReference || manualReference || '').trim();
      const finalOperator = parsedInfo.detectedOperator || selectedOperator;

      await ordersService.submitPaymentDeclaration({
        publicReference: orderResult.public_reference,
        rawToken: token,
        operator: finalOperator,
        declaredReference: finalRef,
        rawSms: rawSms.trim(),
        payerPhone: (parsedInfo.extractedPhoneNumber || manualPhone || '').trim(),
        note: customerNote.trim(),
      });

      onPaymentDeclared(orderResult.public_reference);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.errorGeneral;
      setSubmissionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      {/* Main Card */}
      <div className="relative w-full max-w-xl bg-hotel-surface border border-hotel-cardBorder rounded-2xl shadow-2xl p-5 sm:p-7 z-10 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-hotel-cardBorder">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest text-hotel-gold uppercase px-2 py-0.5 rounded bg-hotel-card border border-hotel-cardBorder">
                {orderResult.public_reference}
              </span>
              <span className="text-xs text-hotel-muted font-serif">Convivium Home Hotel</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-hotel-text mt-1">
              Règlement de votre commande
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Due Banner */}
        <div className="mt-4 p-4 rounded-xl bg-hotel-card border border-hotel-cardBorder flex items-center justify-between">
          <div>
            <span className="text-xs text-hotel-muted font-medium block">
              {t.amountDue}
            </span>
            <span className="font-serif text-2xl sm:text-3xl font-extrabold text-hotel-gold">
              {formatXAF(orderResult.total_amount)}
            </span>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 bg-amber-950/60 px-3 py-1 rounded-full border border-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>{t.statusAwaitingPayment}</span>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Section 1: Choose Operator & Merchant Code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-hotel-muted uppercase tracking-wider">
                1. Choisissez votre réseau de paiement
              </label>
              {currentOption?.merchant_code && (
                <span className="text-[11px] text-hotel-gold font-medium">
                  {currentOption.account_name || 'Convivium Home Hotel'}
                </span>
              )}
            </div>

            {isLoadingOptions ? (
              <div className="p-4 text-center text-xs text-hotel-muted">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-hotel-gold mb-1" />
                {t.loading}
              </div>
            ) : paymentOptions.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs">
                Aucun moyen de paiement Mobile Money n’est encore configuré. Rapprochez-vous de la réception.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {paymentOptions.map((opt) => {
                  const isSelected = selectedOperator === opt.id;
                  const isOrange = opt.id === 'orange';

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOperator(opt.id as MobileOperator)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? isOrange
                            ? 'border-orange-500 bg-orange-950/30 text-white shadow-md'
                            : 'border-yellow-500 bg-yellow-950/30 text-white shadow-md'
                          : 'border-hotel-cardBorder bg-hotel-card text-hotel-muted hover:text-hotel-text'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm">
                          {isOrange ? 'Orange Money' : 'MTN MoMo'}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-hotel-gold" />
                        )}
                      </div>
                      <span className="text-[11px] text-hotel-muted block mt-0.5">
                        Code : <strong className="text-hotel-text font-mono">{opt.merchant_code || '—'}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* USSD Dial / Copy Box */}
            {currentOption && currentOption.merchant_code && ussdCode && (
              <div className="mt-3 p-3 rounded-xl bg-hotel-card border border-hotel-cardBorder flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-hotel-muted uppercase font-bold block">
                    Code USSD à composer :
                  </span>
                  <code className="font-mono text-sm sm:text-base font-bold text-hotel-gold select-all truncate block">
                    {ussdCode}
                  </code>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="btn-secondary px-2.5 py-1.5 text-xs flex items-center gap-1"
                    title={t.copy}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400 font-semibold">{t.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-hotel-gold" />
                        <span>{t.copy}</span>
                      </>
                    )}
                  </button>

                  {currentOption.is_tested_on_device && (
                    <button
                      type="button"
                      onClick={handleDial}
                      className="btn-gold px-2.5 py-1.5 text-xs font-bold flex items-center gap-1"
                      title={t.dialButton}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Composer</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: THE PRIMARY FLOW — PASTE THE CONFIRMATION MESSAGE */}
          <div className="p-4 rounded-xl bg-hotel-card/90 border-2 border-hotel-gold/30 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-hotel-gold/20 text-hotel-gold flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <label className="text-xs font-bold text-hotel-text uppercase tracking-wider">
                  2. Collez votre SMS de confirmation
                </label>
              </div>
              <span className="text-[10px] font-semibold text-green-400 bg-green-950/60 px-2 py-0.5 rounded-full border border-green-800">
                Analyse instantanée
              </span>
            </div>

            <p className="text-xs text-hotel-muted leading-relaxed">
              Après avoir validé votre paiement sur votre téléphone, <strong className="text-hotel-gold">collez simplement le SMS reçu ci-dessous</strong>. La Cuisine recevra directement votre confirmation pour lancer la préparation.
            </p>

            <div className="relative">
              <textarea
                rows={3}
                value={rawSms}
                onChange={(e) => setRawSms(e.target.value)}
                placeholder="Exemple : Vous avez transféré 2000 FCFA à CONVIVIUM HOTEL le 16/10/2026 à 23:00. Réf: MP261016.XXXX..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold resize-none font-mono placeholder:text-hotel-muted/50 leading-relaxed"
              />
              {rawSms && (
                <button
                  type="button"
                  onClick={() => setRawSms('')}
                  className="absolute right-2.5 top-2.5 text-hotel-muted hover:text-hotel-text p-1"
                  title="Effacer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live Visual Detection Chips */}
            {rawSms.trim() && (
              <div className="p-3 rounded-lg bg-hotel-surface border border-hotel-cardBorder space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-hotel-gold uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-hotel-gold" />
                  <span>Informations extraites du message :</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Operator chip */}
                  {parsedInfo.detectedOperator ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                      <span>✓ {parsedInfo.detectedOperator === 'orange' ? 'Orange Money' : 'MTN MoMo'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-hotel-card text-hotel-muted border border-hotel-cardBorder">
                      <span>Opérateur : Non identifié</span>
                    </span>
                  )}

                  {/* Reference chip */}
                  {parsedInfo.extractedReference ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-hotel-gold/15 text-hotel-gold border border-hotel-gold/40">
                      <span>Réf : {parsedInfo.extractedReference}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-hotel-card text-hotel-muted border border-hotel-cardBorder">
                      <span>Réf : Non détectée</span>
                    </span>
                  )}

                  {/* Amount match chip */}
                  {parsedInfo.extractedAmount !== null ? (
                    parsedInfo.extractedAmount === orderResult.total_amount ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-950 text-green-300 border border-green-800">
                        <Check className="w-3 h-3" />
                        <span>Montant : {formatXAF(parsedInfo.extractedAmount)} (Conforme ✓)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-950 text-red-300 border border-red-800">
                        <AlertCircle className="w-3 h-3" />
                        <span>Montant : {formatXAF(parsedInfo.extractedAmount)} (Écart : attendu {formatXAF(orderResult.total_amount)})</span>
                      </span>
                    )
                  ) : null}

                  {/* Date chip */}
                  {parsedInfo.extractedDateTime && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono bg-hotel-card text-hotel-text border border-hotel-cardBorder">
                      <span>{parsedInfo.extractedDateTime}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Fallback accordion: If customer didn't receive an SMS */}
          <div className="border border-hotel-cardBorder rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowManualFallback(!showManualFallback)}
              className="w-full p-3 bg-hotel-card/60 hover:bg-hotel-card text-left text-xs font-medium text-hotel-muted hover:text-hotel-text flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-hotel-gold" />
                <span>Vous n'avez pas de SMS ? (Saisie manuelle ou précision facultative)</span>
              </div>
              {showManualFallback ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showManualFallback && (
              <div className="p-3.5 bg-hotel-surface border-t border-hotel-cardBorder space-y-3 text-xs">
                <div>
                  <label className="block text-xs font-medium text-hotel-text mb-1">
                    Référence de transaction (si connue)
                  </label>
                  <input
                    type="text"
                    value={manualReference}
                    onChange={(e) => setManualReference(e.target.value)}
                    placeholder="Ex: MP261016.1234.A0001 ou numéro de transaction"
                    className="w-full px-3 py-2 rounded-lg bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-hotel-text mb-1">
                      Numéro expéditeur (si différent)
                    </label>
                    <input
                      type="tel"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="Ex: 699 00 00 00"
                      className="w-full px-3 py-2 rounded-lg bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-hotel-text mb-1">
                      Note pour la Cuisine
                    </label>
                    <input
                      type="text"
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      placeholder="Précision sur votre paiement..."
                      className="w-full px-3 py-2 rounded-lg bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submission Error Banner */}
          {submissionError && (
            <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{submissionError}</span>
            </div>
          )}

          {/* Trust Notice */}
          <div className="p-3 rounded-xl bg-hotel-card/50 border border-hotel-cardBorder/60 flex items-start gap-2 text-[11px] text-hotel-muted">
            <ShieldCheck className="w-4 h-4 text-hotel-gold flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Dès l'envoi de votre confirmation, notre équipe Cuisine vérifie le versement sur le terminal marchand officiel de Convivium Home Hotel avant de lancer la préparation.
            </p>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 border-t border-hotel-cardBorder flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isSubmitting || (!rawSms.trim() && !manualReference.trim())}
              className="flex-1 btn-gold py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-gold-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Transmission à la Cuisine...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Transmettre ma confirmation à la Cuisine</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary text-xs py-3 px-5"
            >
              {t.close}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
