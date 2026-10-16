import React, { useState, useEffect } from 'react';
import {
  Search,
  AlertCircle,
  Loader2,
  Receipt,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService } from '../../services/orders.service';
import { getStoredClientOrderToken, storeClientOrderToken } from '../../lib/security';
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
    }
  }, [initialPublicRef]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(searchRef);
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-hotel-text">
          {t.trackingTitle}
        </h1>
        <p className="text-xs sm:text-sm text-hotel-muted mt-1">
          Vérifiez l’avancement en temps réel de votre commande à Convivium Home Hotel.
        </p>
      </div>

      {/* Lookup Bar */}
      <div className="hotel-card p-5 mb-8">
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
        <div className="hotel-card overflow-hidden">
          {/* Header Banner */}
          <div className="p-6 border-b border-hotel-cardBorder bg-hotel-surface/60 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-hotel-gold" />
                <span className="font-serif text-xl font-bold text-hotel-text">
                  {currentOrder.public_reference}
                </span>
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
          <div className="p-6 border-b border-hotel-cardBorder grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Status */}
            {(() => {
              const pInfo = getPaymentStatusBadge(currentOrder.payment_status);
              return (
                <div className="p-4 rounded-xl bg-hotel-surface border border-hotel-cardBorder">
                  <span className="text-[11px] font-bold text-hotel-muted uppercase tracking-wider block mb-2">
                    {t.paymentStatusLabel}
                  </span>
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-2 ${pInfo.classes}`}
                  >
                    {pInfo.label}
                  </div>
                  <p className="text-xs text-hotel-muted leading-relaxed">{pInfo.desc}</p>

                  {/* If still awaiting payment, provide direct action */}
                  {currentOrder.payment_status === 'awaiting_payment' &&
                    onOpenPaymentForOrder && (
                      <button
                        onClick={() => onOpenPaymentForOrder(currentOrder)}
                        className="mt-3 btn-gold text-xs py-2 px-3 font-semibold w-full flex items-center justify-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Payer par Mobile Money</span>
                      </button>
                    )}
                </div>
              );
            })()}

            {/* Preparation Status */}
            {(() => {
              const kInfo = getPrepStatusBadge(currentOrder.preparation_status);
              return (
                <div className="p-4 rounded-xl bg-hotel-surface border border-hotel-cardBorder">
                  <span className="text-[11px] font-bold text-hotel-muted uppercase tracking-wider block mb-2">
                    {t.prepStatusLabel}
                  </span>
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-2 ${kInfo.classes}`}
                  >
                    {kInfo.label}
                  </div>
                  <p className="text-xs text-hotel-muted leading-relaxed">
                    Mode :{' '}
                    <span className="font-semibold text-hotel-text">
                      {currentOrder.order_mode}
                    </span>
                    {currentOrder.room_number && ` — Chambre ${currentOrder.room_number}`}
                    {currentOrder.table_number && ` — Table ${currentOrder.table_number}`}
                    {currentOrder.delivery_address && ` — ${currentOrder.delivery_address}`}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Ordered Items List */}
          <div className="p-6">
            <h3 className="font-serif text-sm font-bold text-hotel-muted uppercase tracking-wider mb-4">
              {t.orderItems}
            </h3>

            <div className="divide-y divide-hotel-cardBorder">
              {(currentOrder.items || []).map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-hotel-text">
                      {item.quantity}x {item.item_name}
                    </span>
                    {item.special_notes && (
                      <p className="text-xs text-hotel-muted italic">
                        Note: {item.special_notes}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-hotel-text font-serif">
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
              <span className="font-serif text-xl font-extrabold text-hotel-gold">
                {formatXAF(currentOrder.total_amount)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
