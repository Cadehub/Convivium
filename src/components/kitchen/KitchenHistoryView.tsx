import React, { useState } from 'react';
import {
  History,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Utensils,
  Eye,
  Check,
  Ban,
  Bed,
  Truck,
  DollarSign,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { Order } from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';

interface KitchenHistoryViewProps {
  orders: Order[];
  onViewOrder: (order: Order) => void;
}

export const KitchenHistoryView: React.FC<KitchenHistoryViewProps> = ({
  orders,
  onViewOrder,
}) => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');

  // Filter completed and cancelled orders
  const historyOrders = orders.filter((o) =>
    o.preparation_status === 'completed' || o.preparation_status === 'cancelled'
  );

  const isToday = (dateString: string) => {
    const d = new Date(dateString);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const filteredOrders = historyOrders.filter((order) => {
    if (dateFilter === 'today' && !isToday(order.created_at)) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const hasMatchingPaymentRef =
      order.payment_verifications?.some((pv) =>
        pv.verified_reference?.toLowerCase().includes(q)
      ) ||
      order.payment_declarations?.some((pd) =>
        pd.declared_reference?.toLowerCase().includes(q)
      );

    return (
      order.public_reference.toLowerCase().includes(q) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(q)) ||
      (order.customer_phone && order.customer_phone.toLowerCase().includes(q)) ||
      (order.room_number && order.room_number.toLowerCase().includes(q)) ||
      (order.table_number && order.table_number.toLowerCase().includes(q)) ||
      Boolean(hasMatchingPaymentRef)
    );
  });

  const completedCount = filteredOrders.filter(
    (o) => o.preparation_status === 'completed'
  ).length;

  const totalCompletedRevenue = filteredOrders
    .filter((o) => o.preparation_status === 'completed' && o.payment_status === 'paid')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const getModeInfo = (order: Order) => {
    switch (order.order_mode) {
      case 'room_service':
        return {
          icon: Bed,
          label: order.room_number
            ? `${isFr ? 'Chambre' : 'Room'} ${order.room_number}`
            : isFr ? 'Service en chambre' : 'Room Service',
          badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
        };
      case 'delivery':
        return {
          icon: Truck,
          label: isFr ? 'Livraison' : 'Delivery',
          badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
        };
      case 'dine_in':
      default:
        return {
          icon: Utensils,
          label: order.table_number
            ? `Table ${order.table_number}`
            : isFr ? 'Sur place' : 'Dine In',
          badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and KPI strip */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-hotel-border shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-hotel-text">
                {isFr ? 'Historique des commandes servies' : 'Served Orders History'}
              </h2>
              <p className="text-xs text-hotel-secondary">
                {isFr
                  ? 'Consultez les commandes clôturées et servies aux clients en salle, chambre ou livraison.'
                  : 'Review completed orders served to customers in restaurant, rooms, or delivery.'}
              </p>
            </div>
          </div>

          {/* Quick Date Toggle */}
          <div className="inline-flex items-center rounded-lg border border-hotel-border bg-[#FAF8F5] p-1 text-xs font-medium shrink-0">
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                dateFilter === 'today'
                  ? 'bg-hotel-dark text-white font-semibold shadow-2xs'
                  : 'text-hotel-secondary hover:text-hotel-text'
              }`}
            >
              {isFr ? 'Aujourd’hui' : 'Today'}
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                dateFilter === 'all'
                  ? 'bg-hotel-dark text-white font-semibold shadow-2xs'
                  : 'text-hotel-secondary hover:text-hotel-text'
              }`}
            >
              {isFr ? 'Tout l’historique' : 'All History'}
            </button>
          </div>
        </div>

        {/* Real Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-stone-100">
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-hotel-secondary uppercase tracking-wider block">
                {isFr ? 'Commandes servies' : 'Served Orders'}
              </span>
              <span className="font-serif text-2xl font-bold text-hotel-text mt-0.5 block">
                {completedCount}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-hotel-secondary uppercase tracking-wider block">
                {isFr ? 'Recettes servies' : 'Served Total Value'}
              </span>
              <span className="font-serif text-2xl font-bold text-hotel-text font-mono mt-0.5 block">
                {formatXAF(totalCompletedRevenue)}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#9A721C]/15 text-[#9A721C] flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-hotel-border shadow-subtle flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isFr
                ? 'Rechercher par référence, chambre, table, téléphone...'
                : 'Search by reference, room, table, phone...'
            }
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-hotel-border focus:border-[#9A721C] focus:ring-1 focus:ring-[#9A721C] bg-white outline-hidden"
          />
        </div>
        <span className="text-xs text-hotel-secondary shrink-0 font-medium">
          {filteredOrders.length}{' '}
          {isFr ? 'commande(s) archivée(s)' : 'archived order(s)'}
        </span>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-stone-200 text-center space-y-2 shadow-subtle">
          <History className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-serif text-lg font-semibold text-hotel-text">
            {isFr ? 'Aucune commande dans l’historique' : 'No Orders in History'}
          </h3>
          <p className="text-xs text-hotel-secondary max-w-md mx-auto">
            {isFr
              ? 'Les commandes terminées et marquées comme « Servie » apparaîtront ici automatiquement sans encombrer votre tableau de bord actif.'
              : 'Orders marked as "Served" will automatically appear here without cluttering your active kitchen workspace.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const mode = getModeInfo(order);
            const ModeIcon = mode.icon;
            const isCancelled = order.preparation_status === 'cancelled';

            return (
              <div
                key={order.id}
                className="p-4 sm:p-5 rounded-xl bg-white border border-hotel-border shadow-subtle hover:border-[#D8C79A] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-hotel-text bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                      {order.public_reference}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${mode.badgeClass}`}
                    >
                      <ModeIcon className="w-3 h-3" />
                      <span>{mode.label}</span>
                    </span>

                    {isCancelled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                        <Ban className="w-3 h-3" />
                        <span>{isFr ? 'Annulée' : 'Cancelled'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Check className="w-3 h-3" />
                        <span>{isFr ? 'Servie & Clôturée' : 'Served & Closed'}</span>
                      </span>
                    )}

                    {order.payment_status === 'paid' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isFr ? 'Payé' : 'Paid'}</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-hotel-secondary flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-hotel-muted" />
                      <span>{formatDateTime(order.created_at, language)}</span>
                    </span>

                    {order.customer_phone && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-hotel-muted" />
                          <span>{order.customer_phone}</span>
                        </span>
                      </>
                    )}

                    {order.payment_verifications?.[0]?.verified_reference && (
                      <>
                        <span>•</span>
                        <span className="text-[11px] text-stone-500 font-mono">
                          Ref: {order.payment_verifications[0].verified_reference}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-semibold text-hotel-muted block">
                      {isFr ? 'Montant réglé' : 'Amount paid'}
                    </span>
                    <span className="font-serif text-lg font-bold text-hotel-text font-mono">
                      {formatXAF(order.total_amount)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onViewOrder(order)}
                    className="btn-outline-gold py-2 px-3.5 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#9A721C]" />
                    <span>{isFr ? 'Voir la commande' : 'View order'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
