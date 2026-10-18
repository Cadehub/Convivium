import React from 'react';
import {
  BedDouble,
  Utensils,
  Truck,
  MapPin,
  Clock,
  Eye,
  CheckCircle2,
  ChefHat,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react';
import type { Order, PreparationStatus } from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';
import { useLanguage } from '../../i18n/LanguageContext';

interface KitchenOperationalOrderCardProps {
  order: Order;
  onViewOrder: (order: Order) => void;
  onUpdatePrepStatus?: (orderId: string, newStatus: PreparationStatus) => void;
  isActionLoading?: boolean;
}

export const KitchenOperationalOrderCard: React.FC<KitchenOperationalOrderCardProps> = ({
  order,
  onViewOrder,
  onUpdatePrepStatus,
  isActionLoading = false,
}) => {
  const { language, t } = useLanguage();

  // Destination & Service Mode Presentation
  const getDestinationDisplay = () => {
    switch (order.order_mode) {
      case 'room_service':
        return {
          modeLabel: language === 'fr' ? 'Chambre' : 'Room',
          highlight: order.room_number || 'N/A',
          badgeClass: 'bg-[#FBF7EE] text-[#9A721C] border-[#E5D099]',
          Icon: BedDouble,
        };
      case 'dine_in':
        return {
          modeLabel: language === 'fr' ? 'Table' : 'Table',
          highlight: order.table_number || 'N/A',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          Icon: Utensils,
        };
      case 'delivery':
        return {
          modeLabel: language === 'fr' ? 'Livraison' : 'Delivery',
          highlight:
            order.delivery_schedule_type === 'scheduled' && order.scheduled_delivery_time
              ? `${order.scheduled_delivery_time}`
              : language === 'fr'
              ? 'Immédiate'
              : 'Instant',
          badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
          Icon: Truck,
        };
      case 'takeaway':
      default:
        return {
          modeLabel: language === 'fr' ? 'À emporter' : 'Takeaway',
          highlight: language === 'fr' ? 'Comptoir' : 'Counter',
          badgeClass: 'bg-stone-100 text-stone-800 border-stone-200',
          Icon: MapPin,
        };
    }
  };

  const dest = getDestinationDisplay();
  const DestIcon = dest.Icon;

  // Preparation status badge styling
  const getStatusBadge = () => {
    switch (order.preparation_status) {
      case 'new':
        return {
          label: t.statusNew,
          className: 'bg-stone-100 text-stone-800 border-stone-300',
          dotColor: 'bg-stone-500',
        };
      case 'accepted':
        return {
          label: t.statusAccepted,
          className: 'bg-amber-50 text-amber-900 border-amber-300',
          dotColor: 'bg-amber-600',
        };
      case 'preparing':
        return {
          label: t.statusPreparing,
          className: 'bg-sky-50 text-sky-900 border-sky-300 font-semibold',
          dotColor: 'bg-sky-600 animate-pulse',
        };
      case 'ready':
        return {
          label: t.statusReady,
          className: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold',
          dotColor: 'bg-emerald-600',
        };
      case 'completed':
        return {
          label: t.statusCompleted,
          className: 'bg-stone-100 text-stone-600 border-stone-200',
          dotColor: 'bg-stone-400',
        };
      case 'cancelled':
      default:
        return {
          label: t.statusCancelled,
          className: 'bg-red-50 text-red-800 border-red-200',
          dotColor: 'bg-red-500',
        };
    }
  };

  const statusBadge = getStatusBadge();
  const itemsCount = order.items?.length || 0;

  // Contextual quick single action
  const renderQuickAction = () => {
    if (!onUpdatePrepStatus) return null;

    if (order.preparation_status === 'new') {
      return (
        <button
          type="button"
          onClick={() => onUpdatePrepStatus(order.id, 'accepted')}
          disabled={isActionLoading}
          className="btn-outline-gold text-xs py-2 px-3 inline-flex items-center gap-1.5"
          title={language === 'fr' ? 'Accepter en cuisine' : 'Accept order'}
        >
          <ChefHat className="w-3.5 h-3.5 text-[#9A721C]" />
          <span>{language === 'fr' ? 'Accepter' : 'Accept'}</span>
        </button>
      );
    }

    if (order.preparation_status === 'accepted') {
      return (
        <button
          type="button"
          onClick={() => onUpdatePrepStatus(order.id, 'preparing')}
          disabled={isActionLoading}
          className="btn-gold text-xs py-2 px-3 inline-flex items-center gap-1.5"
          title={t.startPreparation}
        >
          <Utensils className="w-3.5 h-3.5 text-[#C59B27]" />
          <span>{language === 'fr' ? 'Préparer' : 'Cook'}</span>
        </button>
      );
    }

    if (order.preparation_status === 'preparing') {
      return (
        <button
          type="button"
          onClick={() => onUpdatePrepStatus(order.id, 'ready')}
          disabled={isActionLoading}
          className="py-2 px-3 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors inline-flex items-center gap-1.5 shadow-subtle"
          title={t.markReadyForService}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{language === 'fr' ? 'Prête' : 'Ready'}</span>
        </button>
      );
    }

    if (order.preparation_status === 'ready') {
      return (
        <button
          type="button"
          onClick={() => onUpdatePrepStatus(order.id, 'completed')}
          disabled={isActionLoading}
          className="btn-outline-gold text-xs py-2 px-3 inline-flex items-center gap-1.5"
          title={t.markCompletedAndServed}
        >
          <PackageCheck className="w-3.5 h-3.5 text-stone-700" />
          <span>{language === 'fr' ? 'Servie' : 'Served'}</span>
        </button>
      );
    }

    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-hotel-border hover:border-hotel-borderStrong shadow-subtle hover:shadow-card transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Left side: Reference, Status, Mode/Location, Time, Items count */}
      <div className="space-y-2.5 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-base sm:text-lg font-bold text-hotel-text tracking-tight">
            {order.public_reference}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border ${statusBadge.className}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotColor}`} />
            <span>{statusBadge.label}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
          {/* Service Mode & Highlighted Location */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium ${dest.badgeClass}`}
          >
            <DestIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">{dest.modeLabel}</span>
            <span className="text-stone-400 font-normal">•</span>
            <span className="font-bold tracking-tight">{dest.highlight}</span>
          </div>

          {/* Time */}
          <div className="inline-flex items-center gap-1 text-hotel-secondary">
            <Clock className="w-3.5 h-3.5 text-hotel-muted shrink-0" />
            <span>{formatDateTime(order.created_at, language)}</span>
          </div>

          {/* Items Count */}
          <div className="inline-flex items-center gap-1 text-stone-700 font-semibold bg-stone-100 px-2 py-0.5 rounded">
            <span>
              {itemsCount} {itemsCount === 1 ? 'article' : 'articles'}
            </span>
          </div>

          {/* Special Instructions Badge */}
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

      {/* Right side: Total Amount, Quick Action, and "Voir la commande" button */}
      <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-stone-100 shrink-0">
        <div className="text-left md:text-right">
          <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold text-hotel-secondary">
            {language === 'fr' ? 'Total' : 'Total'}
          </span>
          <span className="font-serif text-lg sm:text-xl font-bold text-hotel-text">
            {formatXAF(order.total_amount)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {renderQuickAction()}

          <button
            type="button"
            onClick={() => onViewOrder(order)}
            className="btn-gold text-xs sm:text-sm py-2 px-3.5 sm:px-4 shadow-subtle hover:bg-stone-800 shrink-0"
          >
            <Eye className="w-3.5 h-3.5 text-[#C59B27]" />
            <span>{t.viewOrderAction}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
