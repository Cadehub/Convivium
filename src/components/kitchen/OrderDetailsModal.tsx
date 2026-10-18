import React, { useState } from 'react';
import {
  X,
  Utensils,
  BedDouble,
  Truck,
  MapPin,
  Clock,
  Phone,
  User,
  ChefHat,
  CheckCircle2,
  PackageCheck,
  AlertCircle,
  AlertTriangle,
  Ban,
  ArrowRight,
  Loader2,
  QrCode,
  FileText,
} from 'lucide-react';
import type { Order, PreparationStatus } from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePrepStatus: (orderId: string, newStatus: PreparationStatus) => Promise<void>;
  isLoading: boolean;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdatePrepStatus,
  isLoading,
}) => {
  const { language, t } = useLanguage();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  // Destination info helper
  const getDestinationInfo = () => {
    switch (order.order_mode) {
      case 'room_service':
        return {
          title: language === 'fr' ? 'Service en chambre' : 'Room Service',
          locationLabel: language === 'fr' ? 'Chambre' : 'Room',
          locationValue: order.room_number || 'N/A',
          bannerClass: 'bg-[#FBF7EE] border-[#E5D099] text-stone-900',
          iconBoxClass: 'bg-[#9A721C] text-white',
          Icon: BedDouble,
        };
      case 'dine_in':
        return {
          title: language === 'fr' ? 'Sur place — Restaurant' : 'Dine-in — Restaurant',
          locationLabel: language === 'fr' ? 'Table' : 'Table',
          locationValue: order.table_number || 'N/A',
          bannerClass: 'bg-emerald-50/70 border-emerald-200 text-stone-900',
          iconBoxClass: 'bg-emerald-700 text-white',
          Icon: Utensils,
        };
      case 'delivery':
        return {
          title: language === 'fr' ? 'Livraison extérieure' : 'External Delivery',
          locationLabel: language === 'fr' ? 'Adresse' : 'Address',
          locationValue: order.delivery_address || 'N/A',
          bannerClass: 'bg-sky-50/80 border-sky-200 text-stone-900',
          iconBoxClass: 'bg-sky-700 text-white',
          Icon: Truck,
        };
      case 'takeaway':
      default:
        return {
          title: language === 'fr' ? 'À emporter' : 'Takeaway',
          locationLabel: language === 'fr' ? 'Retrait' : 'Pickup',
          locationValue: language === 'fr' ? 'Comptoir Restaurant' : 'Restaurant Counter',
          bannerClass: 'bg-stone-100 border-stone-300 text-stone-900',
          iconBoxClass: 'bg-stone-800 text-white',
          Icon: MapPin,
        };
    }
  };

  const dest = getDestinationInfo();
  const DestIcon = dest.Icon;

  // Financial calculations
  const itemsSubtotal = (order.items || []).reduce((sum, it) => {
    // Base item cost without complements
    const baseItemCost = (it.unit_price || 0) * (it.quantity || 1);
    return sum + baseItemCost;
  }, 0);

  const complementsSubtotal = (order.items || []).reduce((sum, it) => {
    const compCost = (it.selected_complements || []).reduce(
      (cSum, c) => cSum + (c.unit_price || 0) * (c.quantity || 1) * (it.quantity || 1),
      0
    );
    return sum + compCost;
  }, 0);

  const deliveryFee =
    order.order_mode === 'delivery' && typeof order.delivery_fee === 'number'
      ? order.delivery_fee
      : 0;

  const handleAction = async (newStatus: PreparationStatus) => {
    setActionError(null);
    try {
      await onUpdatePrepStatus(order.id, newStatus);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  // Preparation status badge
  const renderPrepStatusBadge = () => {
    switch (order.preparation_status) {
      case 'new':
        return (
          <span className="badge-neutral text-xs py-1 px-3">
            <span>{t.statusNew}</span>
          </span>
        );
      case 'accepted':
        return (
          <span className="badge-info text-xs py-1 px-3">
            <span>{t.statusAccepted}</span>
          </span>
        );
      case 'preparing':
        return (
          <span className="badge-info text-xs py-1 px-3 font-semibold bg-sky-100 text-sky-900 border-sky-300">
            <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse mr-1" />
            <span>{t.statusPreparing}</span>
          </span>
        );
      case 'ready':
        return (
          <span className="badge-paid text-xs py-1 px-3 font-bold bg-emerald-100 text-emerald-950 border-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 mr-1" />
            <span>{t.statusReady}</span>
          </span>
        );
      case 'completed':
        return (
          <span className="badge-paid text-xs py-1 px-3">
            <PackageCheck className="w-3.5 h-3.5 text-emerald-700 mr-1" />
            <span>{t.statusCompleted}</span>
          </span>
        );
      case 'cancelled':
      default:
        return (
          <span className="badge-rejected text-xs py-1 px-3">
            <Ban className="w-3.5 h-3.5 mr-1" />
            <span>{t.statusCancelled}</span>
          </span>
        );
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
      <div className="relative w-full max-w-3xl max-h-[92dvh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated z-10 sm:my-auto pb-safe flex flex-col">
        {/* Header with Priority Info */}
        <div className="p-4 sm:p-6 border-b border-hotel-border bg-[#FAF8F5] sticky top-0 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xl sm:text-2xl font-extrabold text-hotel-text tracking-tight">
                  {order.public_reference}
                </span>
                {renderPrepStatusBadge()}
                {order.payment_status === 'paid' && (
                  <span className="badge-paid text-xs py-0.5 px-2.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{language === 'fr' ? 'Payé' : 'Paid'}</span>
                  </span>
                )}
              </div>

              <div className="text-xs text-hotel-secondary flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-hotel-muted" />
                  <span>{formatDateTime(order.created_at, language)}</span>
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-hotel-text">
                  <User className="w-3.5 h-3.5 text-hotel-muted" />
                  <span>{order.customer_name}</span>
                </span>
                {order.customer_phone && (
                  <>
                    <span>•</span>
                    <a
                      href={`tel:${order.customer_phone}`}
                      className="inline-flex items-center gap-1 text-[#9A721C] hover:underline font-mono font-medium"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{order.customer_phone}</span>
                    </a>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-stone-200/60 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {actionError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Service Banner (Mode & Destination Highlight) */}
          <div className={`p-4 rounded-xl border ${dest.bannerClass}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-subtle ${dest.iconBoxClass}`}
                >
                  <DestIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-hotel-secondary">
                    {language === 'fr' ? 'Destination de service' : 'Service destination'}
                  </span>
                  <span className="font-serif text-lg sm:text-xl font-bold text-hotel-text">
                    {dest.title}
                  </span>
                </div>
              </div>

              <div className="sm:border-l sm:border-stone-300 sm:pl-4">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-hotel-secondary">
                  {dest.locationLabel}
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-stone-950 tracking-tight flex items-center gap-2">
                  <span>{order.service_location_snapshot || dest.locationValue}</span>
                  {(order.service_location_id || order.service_location_snapshot) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF6EE] border border-[#D8C79A] text-[#8A6214]">
                      <QrCode className="w-3 h-3 text-[#9A721C]" />
                      <span>QR Code</span>
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Delivery scheduling details if applicable */}
            {order.order_mode === 'delivery' && (
              <div className="mt-3 pt-2.5 border-t border-sky-200 text-xs flex flex-wrap items-center gap-3 text-sky-950 font-medium">
                <span>
                  <strong>{language === 'fr' ? 'Horaire :' : 'Time:'}</strong>{' '}
                  {order.delivery_schedule_type === 'scheduled' && order.scheduled_delivery_time
                    ? `${language === 'fr' ? 'Prévue à' : 'Scheduled at'} ${order.scheduled_delivery_time}`
                    : language === 'fr'
                    ? 'Livraison immédiate'
                    : 'Instant delivery'}
                </span>
                {order.delivery_address && (
                  <span>
                    <strong>{language === 'fr' ? 'Adresse :' : 'Address:'}</strong>{' '}
                    {order.delivery_address}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Customer Global Instruction Notes */}
          {order.notes && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-[#9A721C] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  {language === 'fr'
                    ? 'Consigne particulière du client :'
                    : 'Special customer instruction:'}
                </span>
                <p className="italic mt-0.5 font-medium text-stone-800">« {order.notes} »</p>
              </div>
            </div>
          )}

          {/* Ordered Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#9A721C]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-hotel-text">
                  {t.orderItems} ({order.items?.length || 0})
                </h4>
              </div>
            </div>

            <div className="divide-y divide-hotel-border border border-hotel-border rounded-xl bg-white overflow-hidden shadow-subtle">
              {order.items && order.items.length > 0 ? (
                order.items.map((item) => (
                  <div key={item.id} className="p-3.5 sm:p-4 flex items-start gap-3.5">
                    {/* Item Image / Placeholder */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 shrink-0 flex items-center justify-center relative">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.item_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Utensils className="w-5 h-5 text-[#9A721C]/50" />
                      )}
                      <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-stone-900 text-white shadow-2xs">
                        ×{item.quantity}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-semibold text-sm text-hotel-text">
                            {item.item_name}
                          </h5>
                          {item.variant_name && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#9A721C]/15 text-[#9A721C]">
                              {item.variant_name}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-hotel-text block">
                            {formatXAF(item.subtotal)}
                          </span>
                          <span className="text-[10px] text-hotel-muted font-mono block">
                            {item.quantity} × {formatXAF(item.unit_price)}
                          </span>
                        </div>
                      </div>

                      {/* Selected Complements */}
                      {item.selected_complements && item.selected_complements.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {item.selected_complements.map((c, cIdx) => (
                            <span
                              key={cIdx}
                              className="inline-flex items-center text-[10px] text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200"
                            >
                              + {c.quantity > 1 ? `${c.quantity}× ` : ''}
                              {c.name}
                              {(c.unit_price || 0) > 0 && ` (${formatXAF(c.unit_price)})`}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Dish Special Note - High Visibility for Kitchen */}
                      {item.special_notes && item.special_notes.trim().length > 0 && (
                        <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 flex items-start gap-2.5 shadow-xs">
                          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold uppercase tracking-wider text-[11px] text-amber-900 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>{t.kitchenSpecialInstructionForDish}</span>
                            </span>
                            <p className="font-bold text-stone-900 text-xs sm:text-sm mt-1 leading-relaxed bg-white/90 p-2 rounded-lg border border-amber-200">
                              « {item.special_notes.trim()} »
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-hotel-muted">
                  {language === 'fr' ? 'Aucun article répertorié.' : 'No items listed.'}
                </div>
              )}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-hotel-border space-y-2 text-xs">
            <h5 className="font-bold uppercase tracking-wider text-[11px] text-hotel-secondary pb-1 border-b border-hotel-border">
              {t.financialBreakdown}
            </h5>

            <div className="flex justify-between items-center text-stone-700">
              <span>{t.itemsSubtotal}</span>
              <span className="font-mono font-medium">{formatXAF(itemsSubtotal)}</span>
            </div>

            {complementsSubtotal > 0 && (
              <div className="flex justify-between items-center text-stone-700">
                <span>{t.complementsSubtotal}</span>
                <span className="font-mono font-medium">+{formatXAF(complementsSubtotal)}</span>
              </div>
            )}

            {deliveryFee > 0 && (
              <div className="flex justify-between items-center text-stone-700">
                <span>{t.deliveryFee}</span>
                <span className="font-mono font-medium">+{formatXAF(deliveryFee)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-hotel-border flex justify-between items-center text-sm font-bold text-hotel-text">
              <span>{language === 'fr' ? 'Total réglé' : 'Total paid'}</span>
              <span className="font-serif text-xl sm:text-2xl text-stone-900 font-extrabold">
                {formatXAF(order.total_amount)}
              </span>
            </div>
          </div>

          {/* Preparation Actions Bar */}
          <div className="pt-4 border-t border-hotel-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {order.preparation_status !== 'completed' &&
              order.preparation_status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isLoading}
                  className="py-2.5 px-3.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50 order-2 sm:order-1"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{t.cancel}</span>
                </button>
              )}

            <div className="flex items-center gap-2.5 order-1 sm:order-2 ml-auto w-full sm:w-auto">
              {/* Contextual authorized progression action */}
              {order.preparation_status === 'new' && (
                <button
                  type="button"
                  onClick={() => handleAction('accepted')}
                  disabled={isLoading}
                  className="flex-1 sm:flex-initial btn-gold py-2.5 px-5 text-xs sm:text-sm font-semibold justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChefHat className="w-4 h-4 text-[#C59B27]" />
                  )}
                  <span>
                    {language === 'fr'
                      ? 'Accepter la commande'
                      : 'Accept order'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {order.preparation_status === 'accepted' && (
                <button
                  type="button"
                  onClick={() => handleAction('preparing')}
                  disabled={isLoading}
                  className="flex-1 sm:flex-initial btn-gold py-2.5 px-5 text-xs sm:text-sm font-semibold justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Utensils className="w-4 h-4 text-[#C59B27]" />
                  )}
                  <span>{t.startPreparation}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {order.preparation_status === 'preparing' && (
                <button
                  type="button"
                  onClick={() => handleAction('ready')}
                  disabled={isLoading}
                  className="flex-1 sm:flex-initial py-2.5 px-5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors inline-flex items-center justify-center gap-2 shadow-subtle disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{t.markReadyForService}</span>
                </button>
              )}

              {order.preparation_status === 'ready' && (
                <button
                  type="button"
                  onClick={() => handleAction('completed')}
                  disabled={isLoading}
                  className="flex-1 sm:flex-initial btn-gold py-2.5 px-5 text-xs sm:text-sm font-semibold justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PackageCheck className="w-4 h-4 text-[#C59B27]" />
                  )}
                  <span>{t.markCompletedAndServed}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="btn-outline-gold py-2.5 px-4 text-xs font-semibold"
              >
                {language === 'fr' ? 'Fermer' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Order Safety Modal */}
      <ConfirmationModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={async () => {
          setShowCancelConfirm(false);
          await handleAction('cancelled');
        }}
        title={language === 'fr' ? 'Annuler cette commande ?' : 'Cancel this order?'}
        message={
          language === 'fr'
            ? `Voulez-vous vraiment annuler la commande ${order.public_reference} ? Cette action interrompra la préparation en cuisine.`
            : `Are you sure you want to cancel order ${order.public_reference}? This will stop kitchen preparation.`
        }
        confirmLabel={language === 'fr' ? 'Oui, annuler la commande' : 'Yes, cancel order'}
        cancelLabel={language === 'fr' ? 'Conserver la commande' : 'Keep order'}
        variant="danger"
      />
    </div>
  );
};
