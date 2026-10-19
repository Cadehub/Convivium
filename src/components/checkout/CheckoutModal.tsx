import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  AlertCircle,
  Loader2,
  Utensils,
  Bed,
  Truck,
  Zap,
  Clock,
  QrCode,
  CheckCircle2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Edit3,
  Phone,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService, type CreateOrderResult } from '../../services/orders.service';
import type { OrderMode, RestaurantSettings, ResolvedServiceLocation } from '../../types';
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
  activeServiceLocation?: ResolvedServiceLocation | null;
  onClearServiceLocation?: () => void;
  onOpenCart?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
  restaurantSettings,
  activeServiceLocation,
  onClearServiceLocation,
  onOpenCart,
}) => {
  const {
    items,
    subtotal,
    totalItems,
    clearCart,
    getItemLineKey,
    getItemLineTotal,
  } = useCart();
  const { language, t } = useLanguage();

  const savedInfo = getSavedCustomerInfo();

  const [orderMode, setOrderMode] = useState<OrderMode>(() => {
    if (activeServiceLocation) {
      return activeServiceLocation.location_type === 'room' ? 'room_service' : 'dine_in';
    }
    return (savedInfo?.orderMode as OrderMode) || 'dine_in';
  });
  const [customerPhone, setCustomerPhone] = useState(savedInfo?.customerPhone || '');
  const [locationDetail, setLocationDetail] = useState(() => {
    if (activeServiceLocation) return activeServiceLocation.label;
    return savedInfo?.locationDetail || '';
  });
  const [deliveryScheduleType, setDeliveryScheduleType] = useState<'instant' | 'scheduled'>(
    'instant'
  );
  const [scheduledDeliveryTime, setScheduledDeliveryTime] = useState<string>('');
  const [isCartExpanded, setIsCartExpanded] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeServiceLocation) {
      setOrderMode(activeServiceLocation.location_type === 'room' ? 'room_service' : 'dine_in');
      setLocationDetail(activeServiceLocation.label);
    }
  }, [activeServiceLocation]);

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

    if (orderMode === 'room_service' && !locationDetail.trim()) {
      setErrorMessage(`${t.roomNumber} (${t.required.toLowerCase()})`);
      return;
    }

    if (orderMode === 'delivery' && !locationDetail.trim()) {
      setErrorMessage(`${t.deliveryAddress} (${t.required.toLowerCase()})`);
      return;
    }

    if (orderMode === 'delivery') {
      const trimmedPhone = customerPhone.trim();
      if (!trimmedPhone) {
        setErrorMessage(t.errorDeliveryPhoneRequired);
        return;
      }
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (digitsOnly.length < 8) {
        setErrorMessage(t.errorInvalidPhone);
        return;
      }
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
        customerName: 'Client',
        customerPhone: customerPhone.trim() || undefined,
        orderMode,
        locationDetail: locationDetail.trim(),
        serviceLocationId: activeServiceLocation?.id || null,
        deliveryScheduleType: orderMode === 'delivery' ? deliveryScheduleType : 'instant',
        scheduledDeliveryTime:
          orderMode === 'delivery' && deliveryScheduleType === 'scheduled'
            ? scheduledDeliveryTime.trim()
            : null,
        notes: '',
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
        customerPhone: customerPhone.trim() || undefined,
        orderMode,
        locationDetail: locationDetail.trim(),
      });

      // Persist client order in browser history so it is never lost on refresh
      saveStoredClientOrder({
        public_reference: result.public_reference,
        raw_token: result.raw_token,
        customer_name: 'Client',
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

        {/* Active QR Code Service Location Banner */}
        {activeServiceLocation && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#FAF6EE] border border-[#D8C79A] text-xs flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-[#9A721C] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <QrCode className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-[#8A6214]">
                    {t.verifiedByQr}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#9A721C]/15 text-[#8A6214]">
                    {activeServiceLocation.location_type === 'room' ? t.modeRoomService : t.modeDineIn}
                  </span>
                </div>
                <p className="text-hotel-text font-serif text-sm font-semibold truncate mt-0.5">
                  {activeServiceLocation.label}
                </p>
              </div>
            </div>
            {onClearServiceLocation && (
              <button
                type="button"
                onClick={onClearServiceLocation}
                className="text-xs text-[#9A721C] font-semibold hover:underline shrink-0 px-2 py-1 rounded hover:bg-[#FAF6EE]"
              >
                {language === 'fr' ? 'Modifier' : 'Change'}
              </button>
            )}
          </div>
        )}

        {/* Interactive Cart Consultation & Review Section */}
        <div className="mt-4 rounded-xl border border-hotel-border bg-[#FAF8F5]/80 overflow-hidden shadow-2xs">
          {/* Header of the cart review */}
          <div className="px-4 py-3 flex items-center justify-between gap-3 bg-white border-b border-hotel-border">
            <button
              type="button"
              onClick={() => setIsCartExpanded((prev) => !prev)}
              className="flex items-center gap-2 text-left min-w-0 flex-1 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FAF6EE] text-[#9A721C] border border-[#D8C79A] flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs sm:text-sm text-hotel-text">
                    {t.reviewCart}
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-hotel-subtle text-hotel-secondary border border-hotel-border">
                    {totalItems}
                  </span>
                </div>
                <p className="text-[11px] text-hotel-muted truncate">
                  {language === 'fr'
                    ? 'Vérifiez vos plats et instructions avant de commander'
                    : 'Check your dishes and instructions before ordering'}
                </p>
              </div>
              {isCartExpanded ? (
                <ChevronUp className="w-4 h-4 text-stone-400 shrink-0 ml-1" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400 shrink-0 ml-1" />
              )}
            </button>

            {/* Quick Button to return to Cart */}
            <button
              type="button"
              onClick={onOpenCart || onClose}
              className="btn-outline-gold text-xs py-1.5 px-3 shrink-0 inline-flex items-center gap-1.5"
            >
              <Edit3 className="w-3 h-3 text-[#9A721C]" />
              <span>{t.editCart}</span>
            </button>
          </div>

          {/* Itemized Cart List when expanded */}
          {isCartExpanded && (
            <div className="p-3 sm:p-4 space-y-2.5 max-h-56 overflow-y-auto border-b border-hotel-border bg-[#FAF8F5]/50 divide-y divide-hotel-border/60">
              {items.map((cartItem) => {
                const lineKey = getItemLineKey(cartItem);
                const name =
                  language === 'en' && cartItem.item.name_en
                    ? cartItem.item.name_en
                    : cartItem.item.name_fr;
                const variantName = cartItem.variant
                  ? language === 'en' && cartItem.variant.name_en
                    ? cartItem.variant.name_en
                    : cartItem.variant.name_fr
                  : null;
                const lineTotal = getItemLineTotal(cartItem);

                return (
                  <div key={lineKey} className="pt-2.5 first:pt-0 space-y-1 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {cartItem.item.image_url ? (
                          <img
                            src={cartItem.item.image_url}
                            alt={name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0 border border-hotel-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0 text-[#9A721C]">
                            <Utensils className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-hotel-text truncate">
                            <span className="font-bold text-[#9A721C] mr-1">
                              {cartItem.quantity}×
                            </span>
                            {name}
                          </p>
                          {variantName && (
                            <span className="text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.2 rounded border border-stone-200">
                              {variantName}
                            </span>
                          )}
                          {cartItem.selectedComplements && cartItem.selectedComplements.length > 0 && (
                            <p className="text-[10px] text-hotel-secondary truncate mt-0.5">
                              +{' '}
                              {cartItem.selectedComplements
                                .map((c) =>
                                  language === 'en' && c.complement.name_en
                                    ? c.complement.name_en
                                    : c.complement.name_fr
                                )
                                .join(', ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="font-mono text-xs font-bold text-hotel-text shrink-0">
                        {formatXAF(lineTotal)}
                      </span>
                    </div>

                    {/* Per-Dish Special Instruction in Cart Review */}
                    {cartItem.notes && cartItem.notes.trim().length > 0 && (
                      <div className="ml-12 px-2 py-1 rounded-md bg-amber-50 border border-amber-200/80 text-[11px] text-amber-950 flex items-start gap-1.5">
                        <MessageSquare className="w-3 h-3 text-[#9A721C] shrink-0 mt-0.5" />
                        <span className="italic leading-snug">« {cartItem.notes.trim()} »</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pricing Summary Row */}
          <div className="px-4 py-2.5 space-y-1 text-xs">
            {appliedDeliveryFee > 0 && (
              <>
                <div className="flex items-center justify-between text-hotel-secondary">
                  <span>{t.cartSubtotal}</span>
                  <span className="font-mono">{formatXAF(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-hotel-secondary">
                  <span>{t.deliveryFee}</span>
                  <span className="font-mono text-[#9A721C]">+{formatXAF(appliedDeliveryFee)}</span>
                </div>
              </>
            )}
            <div className="flex items-baseline justify-between pt-1 font-semibold text-hotel-text">
              <span className="uppercase text-[11px] tracking-wider">{t.cartTotal}</span>
              <span className="font-serif text-base sm:text-lg font-bold font-mono">
                {formatXAF(finalTotal)}
              </span>
            </div>
          </div>
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
              <div className="relative">
                <input
                  type="text"
                  required
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder={t.roomNumberPlaceholder}
                  className={`input-hotel ${activeServiceLocation?.location_type === 'room' ? 'pr-28 border-[#D8C79A] bg-[#FAF6EE]/30' : ''}`}
                />
                {activeServiceLocation?.location_type === 'room' && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF6EE] border border-[#D8C79A] text-[#8A6214]">
                    <CheckCircle2 className="w-3 h-3 text-[#9A721C]" />
                    QR Code
                  </span>
                )}
              </div>
            </div>
          )}

          {orderMode === 'dine_in' && (
            <div>
              <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                {t.tableNumber}{' '}
                <span className="font-normal text-hotel-muted">({t.optional})</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder={t.tableNumberPlaceholder}
                  className={`input-hotel ${activeServiceLocation?.location_type === 'table' ? 'pr-28 border-[#D8C79A] bg-[#FAF6EE]/30' : ''}`}
                />
                {activeServiceLocation?.location_type === 'table' && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF6EE] border border-[#D8C79A] text-[#8A6214]">
                    <CheckCircle2 className="w-3 h-3 text-[#9A721C]" />
                    QR Code
                  </span>
                )}
              </div>
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

              {/* Delivery Phone Number (Mandatory) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-hotel-text">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#9A721C]" />
                      <span>{t.customerPhone}</span>
                    </span>{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                    {language === 'fr' ? 'Obligatoire' : 'Required'}
                  </span>
                </div>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t.customerPhonePlaceholder}
                  className="input-hotel bg-white font-mono"
                />
                <p className="text-[11px] text-hotel-muted mt-1">
                  {language === 'fr'
                    ? 'Le livreur vous contactera sur ce numéro à son arrivée.'
                    : 'The delivery driver will call you on this number upon arrival.'}
                </p>
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

          {/* Customer Phone (Optional for dine-in / room service) */}
          {orderMode !== 'delivery' && (
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
          )}


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
