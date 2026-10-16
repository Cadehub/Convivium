import React, { useState, useEffect } from 'react';
import {
  Search,
  AlertCircle,
  Loader2,
  Receipt,
  CreditCard,
  RefreshCw,
  Radio,
  History,
  Utensils,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService } from '../../services/orders.service';
import { supabase } from '../../lib/supabase';
import {
  getStoredClientOrderToken,
  storeClientOrderToken,
  getStoredClientOrders,
  saveActiveTrackingRef,
  type StoredClientOrderSummary,
} from '../../lib/security';
import type { Order, PaymentStatus, PreparationStatus } from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';

interface OrderTrackingViewProps {
  initialPublicRef?: string | null;
  onOpenPaymentForOrder?: (order: Order) => void;
}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  initialPublicRef,
  onOpenPaymentForOrder,
}) => {
  const { language, t } = useLanguage();

  const [searchRef, setSearchRef] = useState(initialPublicRef || '');
  const [inputToken, setInputToken] = useState('');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<StoredClientOrderSummary[]>([]);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  const loadRecentOrders = () => {
    const list = getStoredClientOrders();
    setRecentOrders(list);
  };

  useEffect(() => {
    loadRecentOrders();
  }, []);

  const fetchOrder = async (ref: string, token?: string) => {
    if (!ref.trim()) return;
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const cleanRef = ref.trim().toUpperCase();
      const rawToken = token || getStoredClientOrderToken(cleanRef) || inputToken.trim();

      if (!rawToken) {
        throw new Error(
          'Jeton de sécurité manquant. Ce navigateur ne contient pas la clé d’autorisation pour cette commande. Veuillez entrer le jeton reçu lors de votre commande.'
        );
      }

      const order = await ordersService.getClientOrder(cleanRef, rawToken);
      setCurrentOrder(order);
      storeClientOrderToken(cleanRef, rawToken);
      saveActiveTrackingRef(cleanRef);
      loadRecentOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.orderNotFound;
      setErrorMessage(msg);
      setCurrentOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialPublicRef) {
      setSearchRef(initialPublicRef);
      fetchOrder(initialPublicRef);
    } else {
      const stored = getStoredClientOrders();
      if (stored.length > 0) {
        setSearchRef(stored[0].public_reference);
        fetchOrder(stored[0].public_reference, stored[0].raw_token);
      }
    }
  }, [initialPublicRef]);

  // Real-time listener for live order changes
  useEffect(() => {
    if (!currentOrder?.id) {
      setIsRealtimeActive(false);
      return;
    }

    const orderId = currentOrder.id;
    const orderRef = currentOrder.public_reference;

    setIsRealtimeActive(true);

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
        () => {
          const rawToken = getStoredClientOrderToken(orderRef);
          if (rawToken) {
            fetchOrder(orderRef, rawToken);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payment_verifications',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          const rawToken = getStoredClientOrderToken(orderRef);
          if (rawToken) {
            fetchOrder(orderRef, rawToken);
          }
        }
      )
      .subscribe();

    return () => {
      setIsRealtimeActive(false);
      supabase.removeChannel(trackingChannel);
    };
  }, [currentOrder?.id, currentOrder?.public_reference]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(searchRef);
  };

  const handleSelectRecentOrder = (o: StoredClientOrderSummary) => {
    setSearchRef(o.public_reference);
    fetchOrder(o.public_reference, o.raw_token);
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return {
          label: t.statusPaid,
          desc: t.statusDescPaid,
          classes: 'bg-green-950/70 text-green-300 border-green-800',
        };
      case 'payment_declared':
        return {
          label: t.statusPaymentDeclared,
          desc: t.statusDescDeclared,
          classes: 'bg-amber-950/70 text-amber-300 border-amber-800 animate-pulse',
        };
      case 'payment_rejected':
        return {
          label: t.statusPaymentRejected,
          desc: t.statusDescRejected,
          classes: 'bg-red-950/70 text-red-300 border-red-800',
        };
      case 'payment_review_required':
        return {
          label: t.statusPaymentReview,
          desc: t.statusDescReview,
          classes: 'bg-yellow-950/70 text-yellow-300 border-yellow-800',
        };
      case 'awaiting_payment':
      default:
        return {
          label: t.statusAwaitingPayment,
          desc: t.statusDescAwaiting,
          classes: 'bg-hotel-card text-hotel-muted border-hotel-cardBorder',
        };
    }
  };

  const getPrepStatusBadge = (status: PreparationStatus) => {
    switch (status) {
      case 'ready':
        return {
          label: t.statusReady,
          classes: 'bg-green-950/70 text-green-300 border-green-800 font-bold',
        };
      case 'preparing':
        return {
          label: t.statusPreparing,
          classes: 'bg-blue-950/70 text-blue-300 border-blue-800 font-bold',
        };
      case 'accepted':
        return {
          label: t.statusAccepted,
          classes: 'bg-cyan-950/70 text-cyan-300 border-cyan-800',
        };
      case 'completed':
        return {
          label: t.statusCompleted,
          classes: 'bg-gray-800 text-gray-300 border-gray-700',
        };
      case 'cancelled':
        return {
          label: t.statusCancelled,
          classes: 'bg-red-950/70 text-red-300 border-red-800',
        };
      case 'new':
      default:
        return {
          label: t.statusNew,
          classes: 'bg-hotel-card text-hotel-muted border-hotel-cardBorder',
        };
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Title & Live Status Indicator */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-hotel-surface border border-hotel-cardBorder text-xs text-hotel-muted mb-3">
          <span className="flex items-center gap-1.5">
            <Radio className={`w-3.5 h-3.5 ${isRealtimeActive ? 'text-green-400 animate-pulse' : 'text-hotel-gold'}`} />
            <span className="font-semibold text-hotel-text">
              {isRealtimeActive ? 'Suivi en direct actif (Temps réel)' : 'Suivi de commande'}
            </span>
          </span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-hotel-text">
          {t.trackingTitle}
        </h1>
        <p className="text-xs sm:text-sm text-hotel-muted mt-1 max-w-lg mx-auto">
          Vos informations sont conservées en mémoire sur votre appareil. L'avancement s'actualise instantanément dès qu'une action est prise en Cuisine.
        </p>
      </div>

      {/* Mes Commandes Récentes (Stored History on this Device) */}
      {recentOrders.length > 0 && (
        <div className="hotel-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-hotel-gold" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-hotel-text">
                Mes Commandes sur cet appareil ({recentOrders.length})
              </h3>
            </div>
            <span className="text-[11px] text-hotel-muted">
              Conservées automatiquement
            </span>
          </div>

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
                      ? 'border-hotel-gold bg-hotel-gold/10 text-hotel-gold shadow-md'
                      : 'border-hotel-cardBorder bg-hotel-surface text-hotel-muted hover:text-hotel-text hover:border-hotel-cardBorder/80'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-hotel-text block truncate">
                      {ro.public_reference}
                    </span>
                    <span className="text-[10px] text-hotel-muted block mt-0.5">
                      {formatDateTime(ro.created_at, 'fr')}
                    </span>
                    <span className="font-serif text-xs font-bold text-hotel-gold block mt-0.5">
                      {formatXAF(ro.total_amount)}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-hotel-gold' : 'text-hotel-muted'}`} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lookup Bar */}
      <div className="hotel-card p-4 sm:p-5">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-hotel-gold absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value.toUpperCase())}
                placeholder={t.trackingInputPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold font-mono uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-gold text-xs font-bold px-6 py-2.5 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{t.trackButton}</span>
            </button>
          </div>

          {errorMessage && errorMessage.includes('Jeton') && (
            <div className="pt-2">
              <input
                type="text"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="Collez ici votre jeton d'accès secret"
                className="w-full px-3.5 py-2 rounded-xl bg-hotel-surface border border-hotel-cardBorder text-hotel-text text-xs font-mono"
              />
            </div>
          )}
        </form>

        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}
      </div>

      {/* Live Order Display */}
      {currentOrder && (
        <div className="hotel-card overflow-hidden shadow-2xl border border-hotel-cardBorder">
          {/* Header Banner */}
          <div className="p-5 sm:p-6 border-b border-hotel-cardBorder bg-hotel-surface/90 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-hotel-gold" />
                <span className="font-serif text-xl sm:text-2xl font-bold text-hotel-text">
                  {currentOrder.public_reference}
                </span>
                {isRealtimeActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-950 text-green-300 border border-green-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                    <span>En direct</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-hotel-muted mt-1">
                {t.orderCreatedDate} : {formatDateTime(currentOrder.created_at, language)}
              </p>
            </div>

            <button
              onClick={() => fetchOrder(currentOrder.public_reference)}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t.refresh}</span>
            </button>
          </div>

          {/* Dual Status Section */}
          <div className="p-5 sm:p-6 border-b border-hotel-cardBorder grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Status */}
            {(() => {
              const pInfo = getPaymentStatusBadge(currentOrder.payment_status);
              return (
                <div className="p-4 rounded-xl bg-hotel-surface border border-hotel-cardBorder space-y-2">
                  <span className="text-[11px] font-bold text-hotel-muted uppercase tracking-wider block">
                    {t.paymentStatusLabel}
                  </span>
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${pInfo.classes}`}
                  >
                    {pInfo.label}
                  </div>
                  <p className="text-xs text-hotel-muted leading-relaxed">{pInfo.desc}</p>

                  {/* If still awaiting payment, provide direct action */}
                  {currentOrder.payment_status === 'awaiting_payment' &&
                    onOpenPaymentForOrder && (
                      <button
                        onClick={() => onOpenPaymentForOrder(currentOrder)}
                        className="mt-3 btn-gold text-xs py-2 px-3 font-semibold w-full flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Payer par Mobile Money</span>
                      </button>
                    )}

                  {/* If payment was rejected by cuisine, provide clear guidance & correction path */}
                  {currentOrder.payment_status === 'payment_rejected' && (
                    <div className="mt-3 p-3 rounded-xl bg-red-950/70 border border-red-800 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-red-300">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span>{t.paymentRejectedNoticeTitle}</span>
                      </div>
                      <p className="text-[11px] text-red-200/90 leading-relaxed">
                        {t.paymentRejectedNoticeBody}
                      </p>
                      {onOpenPaymentForOrder && (
                        <button
                          onClick={() => onOpenPaymentForOrder(currentOrder)}
                          className="w-full btn-gold text-xs py-2 font-bold flex items-center justify-center gap-1.5 shadow-sm mt-1"
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

            {/* Preparation Status */}
            {(() => {
              const kInfo = getPrepStatusBadge(currentOrder.preparation_status);
              return (
                <div className="p-4 rounded-xl bg-hotel-surface border border-hotel-cardBorder space-y-2">
                  <span className="text-[11px] font-bold text-hotel-muted uppercase tracking-wider block">
                    {t.prepStatusLabel}
                  </span>
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${kInfo.classes}`}
                  >
                    {kInfo.label}
                  </div>
                  <p className="text-xs text-hotel-muted leading-relaxed">
                    Emplacement :{' '}
                    <strong className="text-hotel-text">
                      {currentOrder.order_mode === 'dine_in' && `Table ${currentOrder.table_number || 'N/A'}`}
                      {currentOrder.order_mode === 'room_service' && `Chambre ${currentOrder.room_number || 'N/A'}`}
                      {currentOrder.order_mode === 'delivery' && `Livraison : ${currentOrder.delivery_address || 'N/A'}`}
                      {currentOrder.order_mode === 'takeaway' && 'À Emporter'}
                    </strong>
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Ordered Items List With Photos */}
          <div className="p-5 sm:p-6">
            <h3 className="font-serif text-sm font-bold text-hotel-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-hotel-gold" />
              <span>{t.orderItems}</span>
            </h3>

            <div className="divide-y divide-hotel-cardBorder">
              {(currentOrder.items || []).map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-hotel-surface border border-hotel-cardBorder flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.item_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Utensils className="w-5 h-5 text-hotel-gold/40" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-hotel-text block truncate">
                        <strong className="text-hotel-gold mr-1">{item.quantity}x</strong>
                        {item.item_name}
                      </span>
                      {item.special_notes && (
                        <p className="text-xs text-hotel-muted italic truncate">
                          Note : {item.special_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="font-semibold text-hotel-text font-mono flex-shrink-0">
                    {formatXAF(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 pt-4 border-t border-hotel-cardBorder flex items-center justify-between">
              <span className="font-serif text-base font-bold text-hotel-text">
                {t.cartTotal}
              </span>
              <span className="font-serif text-xl sm:text-2xl font-extrabold text-hotel-gold">
                {formatXAF(currentOrder.total_amount)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
