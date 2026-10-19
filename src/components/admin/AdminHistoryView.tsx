import React, { useState } from 'react';
import {
  Archive,
  Search,
  Eye,
  Download,
  Printer,
  Utensils,
  Bed,
  Truck,
  Ban,
  Check,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { Order } from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';

interface AdminHistoryViewProps {
  orders: Order[];
  onInspectOrder: (order: Order) => void;
  onExportCsv?: () => void;
  onPrintReport?: () => void;
}

export const AdminHistoryView: React.FC<AdminHistoryViewProps> = ({
  orders,
  onInspectOrder,
  onExportCsv,
  onPrintReport,
}) => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today'>('all');

  // Completed or cancelled orders
  const historyOrders = orders.filter(
    (o) => o.preparation_status === 'completed' || o.preparation_status === 'cancelled'
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
      {/* Header and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-hotel-border shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-hotel-text">
              {isFr ? 'Historique des commandes servies' : 'Served Orders History'}
            </h2>
            <p className="text-xs text-hotel-secondary">
              {isFr
                ? 'Archives des commandes terminées, livrées et encaissées.'
                : 'Archives of completed, served, and collected orders.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              disabled={filteredOrders.length === 0}
              className="btn-outline-gold bg-white text-xs py-2 px-3 disabled:opacity-40"
              title={isFr ? 'Exporter en CSV' : 'Export to CSV'}
            >
              <Download className="w-3.5 h-3.5 text-[#9A721C]" />
              <span>{isFr ? 'Exporter CSV' : 'Export CSV'}</span>
            </button>
          )}

          {onPrintReport && (
            <button
              type="button"
              onClick={onPrintReport}
              disabled={filteredOrders.length === 0}
              className="btn-outline-gold bg-white text-xs py-2 px-3 disabled:opacity-40"
              title={isFr ? 'Imprimer le rapport' : 'Print report'}
            >
              <Printer className="w-3.5 h-3.5 text-[#9A721C]" />
              <span>{isFr ? 'Imprimer' : 'Print'}</span>
            </button>
          )}

          {/* Quick Date Toggle */}
          <div className="inline-flex items-center rounded-lg border border-hotel-border bg-[#FAF8F5] p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-2.5 py-1 rounded transition-colors ${
                dateFilter === 'today'
                  ? 'bg-hotel-dark text-white font-semibold'
                  : 'text-hotel-secondary'
              }`}
            >
              {isFr ? 'Aujourd’hui' : 'Today'}
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                dateFilter === 'all'
                  ? 'bg-hotel-dark text-white font-semibold'
                  : 'text-hotel-secondary'
              }`}
            >
              {isFr ? 'Tout' : 'All'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="hotel-card p-5 bg-white">
          <span className="text-xs font-medium text-hotel-secondary block">
            {isFr ? 'Total des commandes servies' : 'Total Served Orders'}
          </span>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-hotel-text mt-1">
            {completedCount}
          </div>
          <p className="text-[11px] text-hotel-muted mt-1">
            {isFr ? 'Commandes clôturées avec succès' : 'Successfully fulfilled orders'}
          </p>
        </div>

        <div className="hotel-card p-5 bg-white">
          <span className="text-xs font-medium text-hotel-secondary block">
            {isFr ? 'Recettes totales servies' : 'Total Served Revenue'}
          </span>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-hotel-text font-mono mt-1">
            {formatXAF(totalCompletedRevenue)}
          </div>
          <p className="text-[11px] text-hotel-muted mt-1">
            {isFr ? 'Chiffre d’affaires encaissé' : 'Collected revenue'}
          </p>
        </div>
      </div>

      {/* Search Bar */}
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

      {/* Table of Orders */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-stone-200 text-center space-y-2 shadow-subtle">
          <Archive className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-serif text-lg font-semibold text-hotel-text">
            {isFr ? 'Aucune commande dans l’historique' : 'No Orders in History'}
          </h3>
          <p className="text-xs text-hotel-secondary max-w-md mx-auto">
            {isFr
              ? 'Toutes les commandes marquées comme servies par la cuisine apparaîtront dans cette archive.'
              : 'All orders marked as served by kitchen staff will appear in this archive.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-hotel-border overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-hotel-border bg-[#FAF8F5] text-hotel-secondary font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Ref</th>
                  <th className="py-3 px-4">{isFr ? 'Date & Heure' : 'Date & Time'}</th>
                  <th className="py-3 px-4">{isFr ? 'Mode de service' : 'Service Mode'}</th>
                  <th className="py-3 px-4">{isFr ? 'Montant' : 'Amount'}</th>
                  <th className="py-3 px-4">{isFr ? 'Paiement' : 'Payment'}</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hotel-border">
                {filteredOrders.map((order) => {
                  const mode = getModeInfo(order);
                  const ModeIcon = mode.icon;
                  const isCancelled = order.preparation_status === 'cancelled';

                  return (
                    <tr key={order.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-hotel-text whitespace-nowrap">
                        {order.public_reference}
                      </td>
                      <td className="py-3 px-4 text-hotel-secondary whitespace-nowrap">
                        {formatDateTime(order.created_at, language)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${mode.badgeClass}`}
                        >
                          <ModeIcon className="w-3 h-3" />
                          <span>{mode.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-hotel-text whitespace-nowrap">
                        {formatXAF(order.total_amount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                            <Ban className="w-3 h-3" />
                            <span>{isFr ? 'Annulée' : 'Cancelled'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Check className="w-3 h-3" />
                            <span>{isFr ? 'Payé & Servi' : 'Paid & Served'}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onInspectOrder(order)}
                          className="btn-outline-gold py-1.5 px-3 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#9A721C]" />
                          <span>{isFr ? 'Détails' : 'Details'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
