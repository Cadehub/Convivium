import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Utensils, Bed, ShoppingBag, Truck } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService, type CreateOrderResult } from '../../services/orders.service';
import type { OrderMode, RestaurantSettings } from '../../types';
import { formatXAF } from '../../lib/formatters';

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
  const { items, subtotal, clearCart } = useCart();
  const { t } = useLanguage();

  const [orderMode, setOrderMode] = useState<OrderMode>('dine_in');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Active modes configured by management
  const activeModes = restaurantSettings?.modes_active || {
    dine_in: true,
    room_service: true,
    takeaway: true,
    delivery: true,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMessage(t.errorRequiredFields);
      return;
    }

    if (orderMode === 'room_service' && !locationDetail.trim()) {
      setErrorMessage(t.roomNumber + ' ' + t.required.toLowerCase());
      return;
    }

    if (orderMode === 'delivery' && !locationDetail.trim()) {
      setErrorMessage(t.deliveryAddress + ' ' + t.required.toLowerCase());
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
        customerPhone: customerPhone.trim(),
        orderMode,
        locationDetail: locationDetail.trim(),
        notes: notes.trim(),
        items: items.map((i) => ({
          item_id: i.item.id,
          quantity: i.quantity,
          notes: i.notes,
        })),
      };

      const result = await ordersService.createOrder(orderPayload);
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
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-hotel-surface border border-hotel-cardBorder rounded-2xl shadow-2xl p-6 sm:p-8 z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-hotel-cardBorder">
          <div>
            <h2 className="font-serif text-xl font-bold text-hotel-text">
              {t.checkoutTitle}
            </h2>
            <p className="text-xs text-hotel-muted mt-0.5">
              Convivium Home Hotel — Total :{' '}
              <span className="text-hotel-gold font-bold">{formatXAF(subtotal)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-card"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Order Mode Selection */}
          <div>
            <label className="block text-xs font-semibold text-hotel-muted uppercase tracking-wider mb-2">
              {t.selectOrderMode}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {activeModes.dine_in && (
                <button
                  type="button"
                  onClick={() => setOrderMode('dine_in')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                    orderMode === 'dine_in'
                      ? 'border-hotel-gold bg-hotel-gold/10 text-hotel-gold shadow-sm'
                      : 'border-hotel-cardBorder bg-hotel-card text-hotel-muted hover:text-hotel-text'
                  }`}
                >
                  <Utensils className="w-4 h-4" />
                  <span>{t.modeDineIn}</span>
                </button>
              )}

              {activeModes.room_service && (
                <button
                  type="button"
                  onClick={() => setOrderMode('room_service')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                    orderMode === 'room_service'
                      ? 'border-hotel-gold bg-hotel-gold/10 text-hotel-gold shadow-sm'
                      : 'border-hotel-cardBorder bg-hotel-card text-hotel-muted hover:text-hotel-text'
                  }`}
                >
                  <Bed className="w-4 h-4" />
                  <span>{t.modeRoomService}</span>
                </button>
              )}

              {activeModes.takeaway && (
                <button
                  type="button"
                  onClick={() => setOrderMode('takeaway')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                    orderMode === 'takeaway'
                      ? 'border-hotel-gold bg-hotel-gold/10 text-hotel-gold shadow-sm'
                      : 'border-hotel-cardBorder bg-hotel-card text-hotel-muted hover:text-hotel-text'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{t.modeTakeaway}</span>
                </button>
              )}

              {activeModes.delivery && (
                <button
                  type="button"
                  onClick={() => setOrderMode('delivery')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                    orderMode === 'delivery'
                      ? 'border-hotel-gold bg-hotel-gold/10 text-hotel-gold shadow-sm'
                      : 'border-hotel-cardBorder bg-hotel-card text-hotel-muted hover:text-hotel-text'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>{t.modeDelivery}</span>
                </button>
              )}
            </div>
          </div>

          {/* Mode-specific detail */}
          {orderMode === 'room_service' && (
            <div>
              <label className="block text-xs font-medium text-hotel-text mb-1">
                {t.roomNumber} <span className="text-hotel-gold">*</span>
              </label>
              <input
                type="text"
                required
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder={t.roomNumberPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
              />
            </div>
          )}

          {orderMode === 'dine_in' && (
            <div>
              <label className="block text-xs font-medium text-hotel-text mb-1">
                {t.tableNumber} ({t.optional})
              </label>
              <input
                type="text"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder={t.tableNumberPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
              />
            </div>
          )}

          {orderMode === 'delivery' && (
            <div>
              <label className="block text-xs font-medium text-hotel-text mb-1">
                {t.deliveryAddress} <span className="text-hotel-gold">*</span>
              </label>
              <input
                type="text"
                required
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder={t.deliveryAddressPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
              />
            </div>
          )}

          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-hotel-text mb-1">
                {t.customerName} <span className="text-hotel-gold">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t.customerNamePlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-hotel-text mb-1">
                {t.customerPhone} <span className="text-hotel-gold">*</span>
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t.customerPhonePlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
              />
            </div>
          </div>

          {/* Kitchen Notes */}
          <div>
            <label className="block text-xs font-medium text-hotel-text mb-1">
              {t.specialNotes} ({t.optional})
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.specialNotesPlaceholder}
              className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-gold py-3 text-sm font-bold flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.submittingOrder}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.confirmOrderButton}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
