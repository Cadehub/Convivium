import React, { useState } from 'react';
import { X, ArrowRight, AlertCircle, Loader2, Utensils, Bed, Truck, Zap, Clock } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService, type CreateOrderResult } from '../../services/orders.service';
import type { OrderMode, RestaurantSettings } from '../../types';
import { formatXAF } from '../../lib/formatters';
import {
  saveCustomerInfo,
  getSavedCustomerInfo,
  saveStoredClientOrder,
} from '../../lib/security';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (result: CreateOrderResult) => void;
  restaurantSettings?: RestaurantSettings | null;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
  restaurantSettings,
}) => {
  const { items, subtotal, totalItems, clearCart } = useCart();
  const { language, t } = useLanguage();

  const savedInfo = getSavedCustomerInfo();

  const [orderMode, setOrderMode] = useState<OrderMode>(
    (savedInfo?.orderMode as OrderMode) || 'dine_in'
  );
  const [customerName, setCustomerName] = useState(savedInfo?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(savedInfo?.customerPhone || '');
  const [locationDetail, setLocationDetail] = useState(savedInfo?.locationDetail || '');
  const [deliveryScheduleType, setDeliveryScheduleType] = useState<'instant' | 'scheduled'>(
    'instant'
  );
  const [scheduledDeliveryTime, setScheduledDeliveryTime] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Active modes configured by management (takeaway excluded per business rule)
  const activeModes = restaurantSettings?.modes_active || {
    dine_in: true,
    room_service: true,
    delivery: false,
  };

  // Strict Rule: Delivery fee only exists if explicitly defined (> 0) by Admin in restaurant_settings
  const configuredDeliveryFee =
    typeof restaurantSettings?.delivery_fee === 'number' && restaurantSettings.delivery_fee > 0
      ? restaurantSettings.delivery_fee
      : 0;

  const appliedDeliveryFee = orderMode === 'delivery' ? configuredDeliveryFee : 0;
  const finalTotal = subtotal + appliedDeliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerName.trim()) {
      setErrorMessage(t.errorRequiredFields);
      return;
    }

    if (orderMode === 'room_service' && !locationDetail.trim()) {
      setErrorMessage(`${t.roomNumber} (${t.required.toLowerCase()})`);
      return;
    }

    if (orderMode === 'delivery' && !locationDetail.trim()) {
      setErrorMessage(`${t.deliveryAddress} (${t.required.toLowerCase()})`);
      return;
    }

    if (
      orderMode === 'delivery' &&
      deliveryScheduleType === 'scheduled' &&
      !scheduledDeliveryTime.trim()
    ) {
      setErrorMessage(
        language === 'fr'
          ? 'Veuillez sélectionner l’heure souhaitée pour votre livraison.'
          : 'Please select your preferred delivery time.'
      );
      return;
    }

    if (items.length === 0) {
      setErrorMessage(t.errorCartEmpty);
      return;
    }

    setIsSubmitting(true);

    try {
      const orderPayload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        orderMode,
        locationDetail: locationDetail.trim(),
        deliveryScheduleType: orderMode === 'delivery' ? deliveryScheduleType : 'instant',
        scheduledDeliveryTime:
          orderMode === 'delivery' && deliveryScheduleType === 'scheduled'
            ? scheduledDeliveryTime.trim()
            : null,
        notes: notes.trim(),
        items: items.map((i) => ({
          item_id: i.item.id,
          variant_id: i.variant?.id || null,
          complements: (i.selectedComplements || []).map((c) => ({
            complement_id: c.complement.id,
            quantity: c.quantity,
          })),
          quantity: i.quantity,
          notes: i.notes,
        })),
      };

      const result = await ordersService.createOrder(orderPayload);

      // Persist customer profile for future visits
      saveCustomerInfo({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        orderMode,
        locationDetail: locationDetail.trim(),
      });

      // Persist client order in browser history so it is never lost on refresh
      saveStoredClientOrder({
        public_reference: result.public_reference,
        raw_token: result.raw_token,
        customer_name: customerName.trim(),
        total_amount: result.total_amount,
        created_at: new Date().toISOString(),
        order_mode: orderMode,
        location_detail: locationDetail.trim(),
      });

      clearCart();
      onOrderCreated(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.errorGeneral;
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-6 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-7 pb-safe z-10 sm:my-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-hotel-border">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#9A721C] font-semibold">
              Convivium Home Hotel
            </p>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-hotel-text mt-0.5">
              {t.checkoutTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-subtle transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Summary Strip — Strictly hides delivery fee unless defined by Admin AND delivery mode is selected */}
        <div className="mt-4 px-4 py-3 rounded-xl bg-hotel-subtle/70 border border-hotel-border space-y-1.5">
          {appliedDeliveryFee > 0 ? (
            <>
              <div className="flex items-center justify-between text-xs text-hotel-secondary">
                <span>
                  {t.cartSubtotal} ({totalItems}{' '}
                  {language === 'fr'
                    ? totalItems > 1
                      ? 'articles'
                      : 'article'
                    : totalItems > 1
                    ? 'items'
                    : 'item'}
                  )
                </span>
                <span className="font-mono font-medium text-hotel-text">
                  {formatXAF(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-hotel-secondary">
                <span>{t.deliveryFee}</span>
                <span className="font-mono font-medium text-[#9A721C]">
                  +{formatXAF(appliedDeliveryFee)}
                </span>
              </div>
              <div className="pt-1.5 border-t border-hotel-border flex items-baseline justify-between">
                <span className="text-xs font-semibold text-hotel-text uppercase tracking-wider">
                  {t.cartTotal}
                </span>
                <span className="font-serif text-lg sm:text-xl font-bold text-hotel-text">
                  {formatXAF(finalTotal)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-hotel-secondary">
                {totalItems}{' '}
                {language === 'fr'
                  ? totalItems > 1
                    ? 'articles sélectionnés'
                    : 'article sélectionné'
                  : totalItems > 1
                  ? 'items selected'
                  : 'item selected'}
              </span>
              <span className="font-serif text-lg font-bold text-hotel-text">
                {formatXAF(subtotal)}
              </span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 sm:mt-5 space-y-4">
          {/* Order Mode Selection */}
          <div>
            <label className="block text-xs font-semibold text-hotel-secondary uppercase tracking-wider mb-2">
              {t.selectOrderMode}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {activeModes.dine_in && (
                <button
                  type="button"
                  onClick={() => setOrderMode('dine_in')}
                  className={`p-3 rounded-xl border text-left text-xs font-medium flex sm:flex-col items-center sm:items-start gap-2 transition-all ${
                    orderMode === 'dine_in'
                      ? 'border-hotel-dark bg-hotel-dark text-white shadow-subtle'
                      : 'border-hotel-border bg-white text-hotel-secondary hover:border-hotel-borderStrong hover:text-hotel-text'
                  }`}
                >
                  <Utensils
                    className={`w-4 h-4 shrink-0 ${
                      orderMode === 'dine_in' ? 'text-[#C59B27]' : 'text-hotel-muted'
                    }`}
                  />
                  <span className="leading-tight">{t.modeDineIn}</span>
                </button>
              )}

              {activeModes.room_service && (
                <button
                  type="button"
                  onClick={() => setOrderMode('room_service')}
                  className={`p-3 rounded-xl border text-left text-xs font-medium flex sm:flex-col items-center sm:items-start gap-2 transition-all ${
                    orderMode === 'room_service'
                      ? 'border-hotel-dark bg-hotel-dark text-white shadow-subtle'
                      : 'border-hotel-border bg-white text-hotel-secondary hover:border-hotel-borderStrong hover:text-hotel-text'
                  }`}
                >
                  <Bed
                    className={`w-4 h-4 shrink-0 ${
                      orderMode === 'room_service' ? 'text-[#C59B27]' : 'text-hotel-muted'
                    }`}
                  />
                  <span className="leading-tight">{t.modeRoomService}</span>
                </button>
              )}

              {activeModes.delivery && (
                <button
                  type="button"
                  onClick={() => setOrderMode('delivery')}
                  className={`p-3 rounded-xl border text-left text-xs font-medium flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-2 transition-all ${
                    orderMode === 'delivery'
                      ? 'border-hotel-dark bg-hotel-dark text-white shadow-subtle'
                      : 'border-hotel-border bg-white text-hotel-secondary hover:border-hotel-borderStrong hover:text-hotel-text'
                  }`}
                >
                  <div className="flex sm:flex-col items-center sm:items-start gap-2">
                    <Truck
                      className={`w-4 h-4 shrink-0 ${
                        orderMode === 'delivery' ? 'text-[#C59B27]' : 'text-hotel-muted'
                      }`}
                    />
                    <span className="leading-tight">{t.modeDelivery}</span>
                  </div>
                  {configuredDeliveryFee > 0 && (
                    <span
                      className={`text-[10px] font-mono font-semibold ${
                        orderMode === 'delivery' ? 'text-[#C59B27]' : 'text-[#9A721C]'
                      }`}
                    >
                      +{formatXAF(configuredDeliveryFee)}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Mode-specific detail */}
          {orderMode === 'room_service' && (
            <div>
              <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                {t.roomNumber} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder={t.roomNumberPlaceholder}
                className="input-hotel"
              />
            </div>
          )}

          {orderMode === 'dine_in' && (
            <div>
              <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                {t.tableNumber}{' '}
                <span className="font-normal text-hotel-muted">({t.optional})</span>
              </label>
              <input
                type="text"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder={t.tableNumberPlaceholder}
                className="input-hotel"
              />
            </div>
          )}

          {orderMode === 'delivery' && (
            <div className="space-y-3.5 p-3.5 rounded-xl bg-[#FAF8F5] border border-hotel-border">
              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.deliveryAddress} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder={t.deliveryAddressPlaceholder}
                  className="input-hotel bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-2">
                  {language === 'fr' ? 'Horaire de livraison souhaité' : 'Preferred delivery timing'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryScheduleType('instant')}
                    className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                      deliveryScheduleType === 'instant'
                        ? 'border-hotel-dark bg-hotel-dark text-white font-semibold shadow-2xs'
                        : 'border-hotel-border bg-white text-hotel-secondary hover:text-hotel-text'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Zap className={`w-3.5 h-3.5 ${deliveryScheduleType === 'instant' ? 'text-amber-400' : 'text-amber-600'}`} />
                      <span>{language === 'fr' ? 'Livraison immédiate' : 'Instant delivery'}</span>
                    </span>
                    <span
                      className={`text-[10px] block mt-0.5 ${
                        deliveryScheduleType === 'instant'
                          ? 'text-stone-300'
                          : 'text-hotel-muted'
                      }`}
                    >
                      {language === 'fr'
                        ? 'Dès que votre commande est prête'
                        : 'As soon as your order is ready'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryScheduleType('scheduled')}
                    className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                      deliveryScheduleType === 'scheduled'
                        ? 'border-hotel-dark bg-hotel-dark text-white font-semibold shadow-2xs'
                        : 'border-hotel-border bg-white text-hotel-secondary hover:text-hotel-text'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Clock className={`w-3.5 h-3.5 ${deliveryScheduleType === 'scheduled' ? 'text-amber-400' : 'text-stone-500'}`} />
                      <span>{language === 'fr' ? 'Choisir une heure' : 'Schedule a time'}</span>
                    </span>
                    <span
                      className={`text-[10px] block mt-0.5 ${
                        deliveryScheduleType === 'scheduled'
                          ? 'text-stone-300'
                          : 'text-hotel-muted'
                      }`}
                    >
                      {language === 'fr'
                        ? 'Sélectionner l’heure exacte'
                        : 'Pick a specific delivery time'}
                    </span>
                  </button>
                </div>

                {deliveryScheduleType === 'scheduled' && (
                  <div className="mt-2.5">
                    <label className="block text-xs font-semibold text-hotel-text mb-1">
                      {language === 'fr'
                        ? 'Heure de livraison souhaitée'
                        : 'Preferred delivery time'}{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={scheduledDeliveryTime}
                      onChange={(e) => setScheduledDeliveryTime(e.target.value)}
                      className="input-hotel bg-white font-mono text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                {t.customerName} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t.customerNamePlaceholder}
                className="input-hotel"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                {t.customerPhone}{' '}
                <span className="font-normal text-hotel-muted">({t.optional})</span>
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t.customerPhonePlaceholder}
                className="input-hotel"
              />
            </div>
          </div>

          {/* Kitchen Notes */}
          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-1.5">
              {t.specialNotes}{' '}
              <span className="font-normal text-hotel-muted">({t.optional})</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.specialNotesPlaceholder}
              className="input-hotel resize-none"
            />
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row-reverse items-center gap-2.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex-1 btn-gold py-3 text-sm font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.submittingOrder}</span>
                </>
              ) : (
                <>
                  <span>{t.confirmOrderButton}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto btn-outline-gold py-2.5 px-5 text-xs"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
