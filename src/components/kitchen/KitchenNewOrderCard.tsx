import React from 'react';
import {
  BedDouble,
  Utensils,
  Truck,
  MapPin,
  Clock,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import type { Order } from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';
import { useLanguage } from '../../i18n/LanguageContext';

interface KitchenNewOrderCardProps {
  order: Order;
  onVerifyClick: (order: Order) => void;
  isActionLoading?: boolean;
}

export const KitchenNewOrderCard: React.FC<KitchenNewOrderCardProps> = ({
  order,
  onVerifyClick,
  isActionLoading = false,
}) => {
  const { language, t } = useLanguage();

  // Destination and service mode presentation
  const getDestinationDisplay = () => {
    switch (order.order_mode) {
      case 'room_service':
        return {
          modeLabel: language === 'fr' ? 'En chambre' : 'Room Service',
          highlight: `${language === 'fr' ? 'Chambre' : 'Room'} ${order.room_number || 'N/A'}`,
          isPriorityLocation: true,
          badgeClass: 'bg-[#FBF7EE] text-[#9A721C] border-[#E5D099]',
          Icon: BedDouble,
        };
      case 'dine_in':
        return {
          modeLabel: language === 'fr' ? 'Sur place' : 'Dine-in',
          highlight: `Table ${order.table_number || 'N/A'}`,
          isPriorityLocation: true,
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          Icon: Utensils,
        };
      case 'delivery':
        return {
          modeLabel: language === 'fr' ? 'Livraison' : 'Delivery',
          highlight:
            order.delivery_schedule_type === 'scheduled' && order.scheduled_delivery_time
              ? `${language === 'fr' ? 'Prévue à' : 'At'} ${order.scheduled_delivery_time}`
              : language === 'fr'
              ? 'Immédiate'
              : 'Instant',
          isPriorityLocation: false,
          badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
          Icon: Truck,
        };
      case 'takeaway':
      default:
        return {
          modeLabel: language === 'fr' ? 'À emporter' : 'Takeaway',
          highlight: language === 'fr' ? 'Comptoir' : 'Counter',
          isPriorityLocation: false,
          badgeClass: 'bg-stone-100 text-stone-800 border-stone-200',
          Icon: MapPin,
        };
    }
  };

  const dest = getDestinationDisplay();
  const DestIcon = dest.Icon;

  // Status badge
  const renderStatusBadge = () => {
    if (order.payment_status === 'payment_declared') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
          <span>{t.paymentToVerify}</span>
        </span>
      );
    }
    if (order.payment_status === 'payment_review_required') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-950 border border-amber-400">
          <HelpCircle className="w-3 h-3 text-amber-800" />
          <span>{language === 'fr' ? 'Vérification requise' : 'Review required'}</span>
        </span>
      );
    }
    if (order.payment_status === 'payment_rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-800 border border-red-200">
          <AlertCircle className="w-3 h-3 text-red-600" />
          <span>{language === 'fr' ? 'Déclaration rejetée' : 'Declaration rejected'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
        <Clock className="w-3 h-3 text-stone-500" />
        <span>{t.statusAwaitingPayment}</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-amber-300/80 hover:border-amber-400 shadow-subtle hover:shadow-card transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Left side: Order reference, Service mode, Location highlight, Time */}
      <div className="space-y-2.5 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-base sm:text-lg font-bold text-hotel-text tracking-tight">
            {order.public_reference}
          </span>
          {renderStatusBadge()}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
          {/* Service Mode & Highlighted Table/Room */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium ${dest.badgeClass}`}
          >
            <DestIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">{dest.modeLabel}</span>
            <span className="text-stone-400 font-normal">•</span>
            <span className="font-bold tracking-tight">{dest.highlight}</span>
          </div>

          {/* Reception Time */}
          <div className="inline-flex items-center gap-1 text-hotel-secondary">
            <Clock className="w-3.5 h-3.5 text-hotel-muted shrink-0" />
            <span>{formatDateTime(order.created_at, language)}</span>
          </div>

          {/* Special Instructions Alert Badge */}
          {Boolean(
            order.items?.some((i) => i.special_notes && i.special_notes.trim().length > 0) ||
            (order.notes && order.notes.trim().length > 0)
          ) && (
            <div className="inline-flex items-center gap-1.5 text-amber-900 font-bold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-xs shadow-2xs">
              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
              <span>{t.hasSpecialInstructionsBadge}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Expected Amount & Action Button */}
      <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-stone-100 shrink-0">
        <div className="text-left md:text-right">
          <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold text-hotel-secondary">
            {language === 'fr' ? 'Montant attendu' : 'Expected amount'}
          </span>
          <span className="font-serif text-xl sm:text-2xl font-bold text-hotel-text">
            {formatXAF(order.total_amount)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onVerifyClick(order)}
          disabled={isActionLoading}
          className="btn-gold text-xs sm:text-sm py-2.5 px-4 sm:px-5 shrink-0 shadow-subtle hover:bg-stone-800"
        >
          <ShieldCheck className="w-4 h-4 text-[#C59B27]" />
          <span>{t.verifyPaymentAction}</span>
        </button>
      </div>
    </div>
  );
};
