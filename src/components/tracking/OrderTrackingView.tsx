import React, { useState, useEffect } from 'react';
import {
  Search,
  AlertCircle,
  Loader2,
  Receipt,
  CreditCard,
  RefreshCw,
  History,
  Utensils,
  ChevronRight,
  CheckCircle2,
  Clock,
  Ban,
  Trash2,
  QrCode,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService } from '../../services/orders.service';
import { supabase } from '../../lib/supabase';
import { subscribeToLiveSyncEvents } from '../../lib/realtime';
import {
  getStoredClientOrderToken,
  storeClientOrderToken,
  getStoredClientOrders,
  saveActiveTrackingRef,
  clearClientOrderHistory,
  type StoredClientOrderSummary,
} from '../../lib/security';
import type { Order, PaymentStatus, PreparationStatus } from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { ClientNotificationCard } from '../common/NotificationSettings';
import { PUSH_COPY } from '../../lib/push-copy';
import { disableAllClientPush } from '../../services/push.service';

interface OrderTrackingViewProps {
  initialPublicRef?: string | null;
  onOpenPaymentForOrder?: (order: Order) => void;
  onHistoryCleared?: () => void;
}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  initialPublicRef,
  onOpenPaymentForOrder,
  onHistoryCleared,
}) => {
  const { language, t } = useLanguage();

  const [searchRef, setSearchRef] = useState(initialPublicRef || '');
  const [inputToken, setInputToken] = useState('');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<StoredClientOrderSummary[]>([]);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  const loadRecentOrders = () => {
    const list = getStoredClientOrders();
    setRecentOrders(list);
  };

  const handleClearHistory = async () => {
    setIsClearingHistory(true);
    try {
      // Revoke order notifications first (needs the stored access tokens), then wipe the device history.
      await disableAllClientPush(
        getStoredClientOrders().map((o) => ({
          public_reference: o.public_reference,
          raw_token: o.raw_token,
        }))
      ).catch(() => undefined);
      clearClientOrderHistory();
      setRecentOrders([]);
      setCurrentOrder(null);
      setSearchRef('');
      setInputToken('');
      setErrorMessage(null);
      setShowClearHistoryConfirm(false);
      onHistoryCleared?.();
    } finally {
      setIsClearingHistory(false);
    }
  };

  const handleCancelCurrentOrder = async () => {
    if (!currentOrder) return;
    setCancelError(null);
    setIsCancellingOrder(true);
    try {
      const token =
        getStoredClientOrderToken(currentOrder.public_reference) ||
        inputToken.trim() ||
        '';
      await ordersService.cancelOrderClient(
        currentOrder.public_reference,
        token,
        'Annulation demandée par le client'
      );
      setShowCancelConfirm(false);
      // Refresh current order state
      await fetchOrder(currentOrder.public_reference, token, false);
      loadRecentOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de l’annulation de la commande.';
      setCancelError(msg);
    } finally {
      setIsCancellingOrder(false);
    }
  };

  useEffect(() => {
    loadRecentOrders();
  }, []);

  const fetchOrder = async (ref: string, token?: string, silent = false) => {
    if (!ref.trim()) return;
    if (!silent) {
      setErrorMessage(null);
      if (!currentOrder || currentOrder.public_reference !== ref.trim().toUpperCase()) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
    }

    try {
      const cleanRef = ref.trim().toUpperCase();
      const rawToken = token || getStoredClientOrderToken(cleanRef) || inputToken.trim();

      if (!rawToken) {
        if (!silent) {
          throw new Error(
            language === 'fr'
              ? 'Jeton de sécurité manquant sur cet appareil. Veuillez saisir le jeton reçu lors de la création de la commande.'
              : 'Security token missing on this device. Please enter the token received when placing the order.'
          );
        }
        return;
      }

      const order = await ordersService.getClientOrder(cleanRef, rawToken);
      setCurrentOrder((prev) => {
        if (
          prev &&
          prev.id === order.id &&
          prev.payment_status === order.payment_status &&
          prev.preparation_status === order.preparation_status &&
          prev.total_amount === order.total_amount
        ) {
          return prev;
        }
        return order;
      });
      if (!silent) {
        storeClientOrderToken(cleanRef, rawToken);
        saveActiveTrackingRef(cleanRef);
        loadRecentOrders();
      }
    } catch (err: unknown) {
      if (!silent) {
        const msg = err instanceof Error ? err.message : t.orderNotFound;
        setErrorMessage(msg);
        setCurrentOrder(null);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (initialPublicRef) {
      setSearchRef(initialPublicRef);
      fetchOrder(initialPublicRef, undefined, false);
    } else {
      const stored = getStoredClientOrders();
      if (stored.length > 0) {
        setSearchRef(stored[0].public_reference);
        fetchOrder(stored[0].public_reference, stored[0].raw_token, false);
      }
    }
  }, [initialPublicRef]);

  // Real-time listener for live order changes (Broadcast + Postgres Changes + Silent 3s Sync)
  useEffect(() => {
    if (!currentOrder?.id) {
      setIsRealtimeActive(false);
      return;
    }

    const orderId = currentOrder.id;
    const orderRef = currentOrder.public_reference;

    setIsRealtimeActive(true);

    const silentRefresh = () => {
      const rawToken = getStoredClientOrderToken(orderRef);
      if (rawToken) {
        fetchOrder(orderRef, rawToken, true);
      }
    };

    // 1. Supabase Postgres Changes channel
    const trackingChannel = supabase
      .channel(`realtime_client_order_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        silentRefresh
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payment_verifications',
          filter: `order_id=eq.${orderId}`,
        },
        silentRefresh
      )
      .subscribe();

    // 2. Instant cross-tab & Supabase Broadcast live sync (bypasses anon RLS table restrictions)
    const unsubscribeLive = subscribeToLiveSyncEvents((evt) => {
      if (
        evt.type === 'order_updated' ||
        evt.type === 'payment_declared' ||
        evt.orderId === orderId ||
        evt.publicReference === orderRef
      ) {
        silentRefresh();
      }
    });

    // 3. Silent background sync every 3 seconds (updates status in-place with zero flicker/scroll)
    const interval = setInterval(silentRefresh, 3000);

    return () => {
      clearInterval(interval);
      unsubscribeLive();
      setIsRealtimeActive(false);
      supabase.removeChannel(trackingChannel);
    };
  }, [currentOrder?.id, currentOrder?.public_reference]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(searchRef, undefined, false);
  };

  const handleSelectRecentOrder = (o: StoredClientOrderSummary) => {
    setSearchRef(o.public_reference);
    fetchOrder(o.public_reference, o.raw_token, false);
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return {
          label: t.statusPaid,
          desc: t.statusDescPaid,
          classes: 'badge-paid',
        };
      case 'payment_declared':
        return {
          label: t.statusPaymentDeclared,
          desc: t.statusDescDeclared,
          classes: 'badge-pending',
        };
      case 'payment_rejected':
        return {
          label: t.statusPaymentRejected,
          desc: t.statusDescRejected,
          classes: 'badge-rejected',
        };
      case 'payment_review_required':
        return {
          label: t.statusPaymentReview,
          desc: t.statusDescReview,
          classes: 'badge-pending',
        };
      case 'awaiting_payment':
      default:
        return {
          label: t.statusAwaitingPayment,
          desc: t.statusDescAwaiting,
          classes: 'badge-neutral',
        };
    }
  };

  const getPrepStatusBadge = (status: PreparationStatus) => {
    switch (status) {
      case 'ready':
        return {
          label: t.statusReady,
          classes: 'badge-paid',
          stepIndex: 3,
        };
      case 'preparing':
        return {
          label: t.statusPreparing,
          classes: 'badge-info',
          stepIndex: 2,
        };
      case 'accepted':
        return {
          label: t.statusAccepted,
          classes: 'badge-info',
          stepIndex: 1,
        };
      case 'completed':
        return {
          label: t.statusCompleted,
          classes: 'badge-paid',
          stepIndex: 4,
        };
      case 'cancelled':
        return {
          label: t.statusCancelled,
          classes: 'badge-rejected',
          stepIndex: -1,
        };
      case 'new':
      default:
        return {
          label: t.statusNew,
          classes: 'badge-neutral',
          stepIndex: 0,
        };
    }
  };

  const prepSteps = [
    { key: 'new', label: language === 'fr' ? 'Enregistrée' : 'Registered' },
    { key: 'accepted', label: language === 'fr' ? 'Reçue' : 'Accepted' },
    { key: 'preparing', label: language === 'fr' ? 'En préparation' : 'Preparing' },
    { key: 'ready', label: language === 'fr' ? 'Prête' : 'Ready' },
    { key: 'completed', label: language === 'fr' ? 'Servie' : 'Served' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-hotel-border pb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#9A721C] font-semibold mb-1">
            Convivium Home Hotel
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-hotel-text">
            {t.trackingTitle}
          </h1>
        </div>
        {isRealtimeActive && (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>{language === 'fr' ? 'Synchronisation en direct' : 'Live updates active'}</span>
          </span>
        )}
      </div>

      {/* Stored Orders on this Device */}
      {recentOrders.length > 0 && (
        <div className="hotel-card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#9A721C]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-hotel-secondary">
                {language === 'fr'
                  ? `Mes commandes sur cet appareil (${recentOrders.length})`
                  : `My orders on this device (${recentOrders.length})`}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowClearHistoryConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-hotel-secondary hover:text-red-700 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{PUSH_COPY[language].clearHistory}</span>
            </button>
          </div>

          <ConfirmationModal
            isOpen={showClearHistoryConfirm}
            onClose={() => setShowClearHistoryConfirm(false)}
            onConfirm={handleClearHistory}
            title={PUSH_COPY[language].clearHistoryTitle}
            message={PUSH_COPY[language].clearHistoryMessage}
            confirmLabel={PUSH_COPY[language].clearHistoryConfirm}
            cancelLabel={PUSH_COPY[language].cancel}
            variant="warning"
            isLoading={isClearingHistory}
          />


          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {recentOrders.map((ro) => {
              const isSelected = currentOrder?.public_reference === ro.public_reference;
              return (
                <button
                  key={ro.public_reference}
                  type="button"
                  onClick={() => handleSelectRecentOrder(ro)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'border-hotel-dark bg-[#FBF7EE] shadow-subtle'
                      : 'border-hotel-border bg-white hover:border-hotel-borderStrong'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-hotel-text block truncate">
                      {ro.public_reference}
                    </span>
                    <span className="text-[11px] text-hotel-muted block mt-0.5">
                      {formatDateTime(ro.created_at, language)}
                    </span>
                    <span className="text-xs font-semibold text-[#9A721C] block mt-0.5">
                      {formatXAF(ro.total_amount)}
                    </span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-hotel-text' : 'text-hotel-muted'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lookup Bar */}
      <div className="hotel-card p-5">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-hotel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value.toUpperCase())}
                placeholder={t.trackingInputPlaceholder}
                className="input-hotel pl-10 font-mono uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-gold text-xs font-semibold px-6 py-2.5"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{t.trackButton}</span>
            </button>
          </div>

          {errorMessage && (errorMessage.includes('Jeton') || errorMessage.includes('token')) && (
            <div className="pt-1">
              <input
                type="text"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder={
                  language === 'fr'
                    ? "Collez ici le jeton d'accès associé à cette commande"
                    : 'Paste the security token for this order'
                }
                className="input-hotel font-mono text-xs"
              />
            </div>
          )}
        </form>

        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}
      </div>

      {/* Live Order Detail Card */}
      {currentOrder && (
        <div className="hotel-card overflow-hidden shadow-card">
          {/* Order Header Banner */}
          <div className="p-5 sm:p-6 border-b border-hotel-border bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-[#9A721C]" />
                <span className="font-mono text-xl sm:text-2xl font-bold text-hotel-text">
                  {currentOrder.public_reference}
                </span>
              </div>
              <p className="text-xs text-hotel-secondary mt-1 flex flex-wrap items-center gap-1.5">
                <span>
                  {t.orderCreatedDate} {formatDateTime(currentOrder.created_at, language)} •
                </span>
                <strong className="text-hotel-text">
                  {currentOrder.order_mode === 'dine_in' &&
                    `${t.modeDineIn}${currentOrder.table_number ? ` — Table ${currentOrder.table_number}` : ''}`}
                  {currentOrder.order_mode === 'room_service' &&
                    `${t.modeRoomService} — ${currentOrder.room_number || ''}`}
                  {currentOrder.order_mode === 'delivery' &&
                    `${t.modeDelivery} — ${currentOrder.delivery_address || ''}`}
                  {currentOrder.order_mode === 'takeaway' && t.modeTakeaway}
                </strong>
                {(currentOrder.service_location_snapshot || currentOrder.service_location_id) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF6EE] border border-[#D8C79A] text-[#8A6214]">
                    <QrCode className="w-3 h-3 text-[#9A721C]" />
                    <span>QR Code</span>
                  </span>
                )}
                {currentOrder.order_mode === 'delivery' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#FAF6EE] border border-[#D8C79A] text-[11px] font-bold text-[#8A6214]">
                    <Clock className="w-3 h-3 text-[#9A721C]" />
                    <span>
                      {currentOrder.delivery_schedule_type === 'scheduled' &&
                      currentOrder.scheduled_delivery_time
                        ? language === 'fr'
                          ? `Livraison à ${currentOrder.scheduled_delivery_time}`
                          : `Delivery at ${currentOrder.scheduled_delivery_time}`
                        : language === 'fr'
                          ? 'Livraison immédiate'
                          : 'Instant delivery'}
                    </span>
                  </span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchOrder(currentOrder.public_reference, undefined, false)}
              className="btn-outline-gold text-xs py-2 px-3.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{t.refresh}</span>
            </button>
          </div>

          {/* Optional push notifications for this order (opt-in, never required) */}
          <div className="px-5 sm:px-6 pt-4 empty:hidden">
            <ClientNotificationCard
              publicReference={currentOrder.public_reference}
              rawToken={
                getStoredClientOrderToken(currentOrder.public_reference) || inputToken.trim()
              }
              isClosed={
                currentOrder.preparation_status === 'completed' ||
                currentOrder.preparation_status === 'cancelled'
              }
            />
          </div>

          {/* Dual Status Section: Payment vs Kitchen Preparation */}
          <div className="p-5 sm:p-6 border-b border-hotel-border grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Payment Status */}
            {(() => {
              const pInfo = getPaymentStatusBadge(currentOrder.payment_status);
              return (
                <div className="p-4 rounded-xl bg-white border border-hotel-border space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-hotel-secondary uppercase tracking-wider">
                      {t.paymentStatusLabel}
                    </span>
                    <span className={pInfo.classes}>{pInfo.label}</span>
                  </div>

                  <p className="text-xs text-hotel-secondary leading-relaxed">{pInfo.desc}</p>

                  {currentOrder.payment_status === 'awaiting_payment' && (
                    <div className="space-y-2 pt-1">
                      {onOpenPaymentForOrder && (
                        <button
                          type="button"
                          onClick={() => onOpenPaymentForOrder(currentOrder)}
                          className="btn-gold text-xs py-2.5 px-4 w-full"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{t.iHavePaidButton}</span>
                        </button>
                      )}

                      {currentOrder.preparation_status !== 'cancelled' && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowCancelConfirm(true)}
                            className="text-stone-500 hover:text-red-700 text-xs py-1.5 w-full text-center inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5 text-red-600" />
                            <span>{language === 'fr' ? 'Annuler ma commande' : 'Cancel my order'}</span>
                          </button>

                          <ConfirmationModal
                            isOpen={showCancelConfirm}
                            onClose={() => {
                              setShowCancelConfirm(false);
                              setCancelError(null);
                            }}
                            onConfirm={handleCancelCurrentOrder}
                            title={
                              language === 'fr'
                                ? 'Annuler cette commande ?'
                                : 'Cancel this order?'
                            }
                            message={
                              cancelError ||
                              (language === 'fr'
                                ? 'Comme cette commande n’a pas encore été payée, elle sera annulée immédiatement.'
                                : 'Since this order has not been paid yet, it will be cancelled immediately.')
                            }
                            confirmLabel={language === 'fr' ? 'Oui, annuler' : 'Yes, cancel'}
                            cancelLabel={language === 'fr' ? 'Conserver la commande' : 'Keep order'}
                            variant="danger"
                            isLoading={isCancellingOrder}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {currentOrder.payment_status === 'payment_rejected' && (
                    <div className="mt-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-red-900">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{t.paymentRejectedNoticeTitle}</span>
                      </div>
                      <p className="text-xs text-red-800 leading-relaxed">
                        {t.paymentRejectedNoticeBody}
                      </p>
                      {onOpenPaymentForOrder && (
                        <button
                          type="button"
                          onClick={() => onOpenPaymentForOrder(currentOrder)}
                          className="w-full btn-gold text-xs py-2.5 mt-1"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{t.reSubmitPaymentButton}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. Kitchen Preparation Status */}
            {(() => {
              const kInfo = getPrepStatusBadge(currentOrder.preparation_status);
              return (
                <div className="p-4 rounded-xl bg-white border border-hotel-border space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-hotel-secondary uppercase tracking-wider">
                      {t.prepStatusLabel}
                    </span>
                    <span className={kInfo.classes}>{kInfo.label}</span>
                  </div>

                  {/* Stepper Progress */}
                  {kInfo.stepIndex >= 0 && (
                    <div className="pt-1">
                      <div className="grid grid-cols-5 gap-1.5">
                        {prepSteps.map((step, idx) => {
                          const isDone = idx <= kInfo.stepIndex;
                          return (
                            <div key={step.key} className="space-y-1">
                              <div
                                className={`h-1.5 rounded-full transition-colors ${
                                  isDone ? 'bg-[#9A721C]' : 'bg-stone-200'
                                }`}
                              />
                              <span
                                className={`block text-[10px] leading-tight truncate ${
                                  isDone
                                    ? 'font-semibold text-hotel-text'
                                    : 'text-hotel-muted'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-hotel-secondary pt-1">
                    {currentOrder.payment_status === 'paid' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          {language === 'fr'
                            ? 'Paiement confirmé — Prise en charge active en cuisine'
                            : 'Payment confirmed — Handled by kitchen'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          {language === 'fr'
                            ? 'La préparation débutera dès confirmation du paiement par la cuisine.'
                            : 'Preparation begins once payment is confirmed by the kitchen.'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Ordered Items List With Photos */}
          <div className="p-5 sm:p-6 bg-white">
            <h3 className="text-xs font-semibold text-hotel-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Utensils className="w-3.5 h-3.5 text-[#9A721C]" />
              <span>{t.orderItems}</span>
            </h3>

            <div className="divide-y divide-hotel-border">
              {(currentOrder.items || []).map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-hotel-subtle border border-hotel-border flex items-center justify-center shrink-0 overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.item_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Utensils className="w-4 h-4 text-[#9A721C]/50" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-hotel-text truncate">
                          <strong className="text-[#9A721C] mr-1.5">{item.quantity}×</strong>
                          {item.item_name}
                        </span>
                        {item.variant_name && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#9A721C]/10 text-[#9A721C] border border-[#9A721C]/20">
                            {item.variant_name}
                          </span>
                        )}
                        {item.preparation_time_minutes &&
                          item.preparation_time_minutes > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-[#D8C79A] text-[11px] font-semibold text-[#8A6214]">
                              <Clock className="w-3 h-3 text-[#9A721C]" />
                              <span>{item.preparation_time_minutes} min</span>
                            </span>
                          )}
                      </div>
                      {item.selected_complements && item.selected_complements.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.selected_complements.map((c, cIdx) => (
                            <span
                              key={cIdx}
                              className="text-[11px] text-hotel-secondary bg-stone-100 px-1.5 py-0.2 rounded border border-stone-200"
                            >
                              + {c.quantity > 1 ? `${c.quantity}× ` : ''}{c.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.special_notes && (
                        <p className="text-xs text-hotel-secondary italic truncate mt-0.5">
                          {item.special_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="font-semibold text-hotel-text font-mono shrink-0">
                    {formatXAF(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total — Only displays delivery fee line if order has delivery_fee > 0 */}
            <div className="mt-4 pt-4 border-t border-hotel-border space-y-2">
              {currentOrder.order_mode === 'delivery' &&
                typeof currentOrder.delivery_fee === 'number' &&
                currentOrder.delivery_fee > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs text-hotel-secondary">
                      <span>{t.cartSubtotal}</span>
                      <span className="font-mono font-medium text-hotel-text">
                        {formatXAF(
                          Math.max(0, currentOrder.total_amount - currentOrder.delivery_fee)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-hotel-secondary">
                      <span>{t.deliveryFee}</span>
                      <span className="font-mono font-medium text-[#9A721C]">
                        +{formatXAF(currentOrder.delivery_fee)}
                      </span>
                    </div>
                  </>
                )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-hotel-secondary">
                  {t.cartTotal}
                </span>
                <span className="font-serif text-2xl font-bold text-hotel-text">
                  {formatXAF(currentOrder.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
