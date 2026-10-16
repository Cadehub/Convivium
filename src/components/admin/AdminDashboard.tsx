import React, { useState, useEffect } from 'react';
import {
  Shield,
  CreditCard,
  Settings,
  Users,
  ClipboardList,
  LogOut,
  RefreshCw,
  Search,
  AlertTriangle,
  Plus,
  Power,
  Sliders,
  DollarSign,
  Package,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService } from '../../services/orders.service';
import { settingsService } from '../../services/settings.service';
import { staffService } from '../../services/staff.service';
import type {
  Order,
  PaymentMethodSetting,
  RestaurantSettings,
  StaffProfile,
  AuditLogEntry,
} from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';

export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { profile } = useAuth();
  const { language, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'orders' | 'menu' | 'payments' | 'modes' | 'staff' | 'audit'
  >('overview');

  // Overview & Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderSearch, setOrderSearch] = useState('');

  // Payment Settings
  const [paymentSettings, setPaymentSettings] = useState<PaymentMethodSetting[]>([]);

  // Restaurant Settings
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings | null>(null);

  // Staff Profiles
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [newCuisineId, setNewCuisineId] = useState('');
  const [newCuisineName, setNewCuisineName] = useState('');

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const loadData = async () => {
    try {
      const [allOrders, paySettings, restSettings, staffList, logs] = await Promise.all([
        ordersService.getStaffOrders(),
        settingsService.getAdminPaymentSettings(),
        settingsService.getRestaurantSettings(),
        staffService.getAllStaffProfiles(),
        settingsService.getAuditLogs(100),
      ]);
      setOrders(allOrders);
      setPaymentSettings(paySettings);
      setRestaurantSettings(restSettings);
      setStaffProfiles(staffList);
      setAuditLogs(logs);
    } catch (e) {
      console.error('Error loading admin data', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update Payment Setting handler
  const handleSavePaymentSetting = async (
    id: 'mtn' | 'orange',
    updates: Partial<PaymentMethodSetting>
  ) => {
    try {
      await settingsService.updatePaymentSetting(id, updates);
      await loadData();
    } catch (e) {
      alert('Erreur lors de la mise à jour des paramètres de paiement.');
    }
  };

  // Toggle Order Mode
  const handleToggleOrderMode = async (modeKey: 'dine_in' | 'room_service' | 'takeaway' | 'delivery') => {
    if (!restaurantSettings) return;
    const current = restaurantSettings.modes_active;
    const updated = {
      ...current,
      [modeKey]: !current[modeKey],
    };

    try {
      await settingsService.updateRestaurantSettings({
        modes_active: updated,
      });
      setRestaurantSettings({
        ...restaurantSettings,
        modes_active: updated,
      });
    } catch (e) {
      alert('Erreur lors de la mise à jour du mode.');
    }
  };

  // Toggle Staff status
  const handleToggleStaff = async (staffId: string, currentActive: boolean) => {
    try {
      await staffService.toggleStaffStatus(staffId, !currentActive);
      await loadData();
    } catch (e) {
      alert('Erreur lors de la mise à jour du compte.');
    }
  };

  // Add Cuisine Profile
  const handleAddCuisineStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCuisineId.trim() || !newCuisineName.trim()) return;

    try {
      await staffService.createCuisineProfile({
        id: newCuisineId.trim(),
        fullName: newCuisineName.trim(),
      });
      setIsInviteModalOpen(false);
      setNewCuisineId('');
      setNewCuisineName('');
      await loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la création');
    }
  };

  // Real Metrics Calculation (strictly zero fake figures)
  const paidOrders = orders.filter((o) => o.payment_status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);

  const filteredOrders = orders.filter((o) => {
    if (!orderSearch.trim()) return true;
    const s = orderSearch.toLowerCase();
    return (
      o.public_reference.toLowerCase().includes(s) ||
      o.customer_name.toLowerCase().includes(s) ||
      o.customer_phone.toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen bg-hotel-black text-hotel-text">
      {/* Top Header */}
      <header className="bg-hotel-surface border-b border-hotel-cardBorder sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-hotel-gold/10 text-hotel-gold border border-hotel-gold/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-sm sm:text-base text-hotel-text">
                  Direction Générale
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-hotel-gold text-hotel-black uppercase">
                  Supervision & Sécurité
                </span>
              </div>
              <p className="text-[11px] text-hotel-muted">
                {profile?.full_name || 'Direction Convivium Home Hotel'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="btn-secondary text-xs p-2 sm:px-3 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.refresh}</span>
            </button>
            <button
              onClick={onLogout}
              className="btn-secondary text-xs p-2 sm:px-3 text-red-400 hover:text-red-300 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.logoutButton}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-hotel-cardBorder no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'overview'
                ? 'bg-hotel-gold text-hotel-black shadow-gold-glow'
                : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Vue d'ensemble</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'orders'
                ? 'bg-hotel-gold text-hotel-black shadow-gold-glow'
                : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Commandes ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'payments'
                ? 'bg-hotel-gold text-hotel-black shadow-gold-glow'
                : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>MoMo & Orange Money</span>
          </button>

          <button
            onClick={() => setActiveTab('modes')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'modes'
                ? 'bg-hotel-gold text-hotel-black shadow-gold-glow'
                : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Modes de Commande</span>
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'staff'
                ? 'bg-hotel-gold text-hotel-black shadow-gold-glow'
                : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Équipe Cuisine ({staffProfiles.filter((s) => s.role === 'cuisine').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'audit'
                ? 'bg-hotel-gold text-hotel-black shadow-gold-glow'
                : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Journal d'Audit ({auditLogs.length})</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW METRICS */}
        {activeTab === 'overview' && (
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="hotel-card p-5">
                <div className="flex items-center justify-between text-xs text-hotel-muted mb-2">
                  <span>Chiffre d’affaires vérifié</span>
                  <DollarSign className="w-4 h-4 text-hotel-gold" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl font-extrabold text-hotel-gold">
                  {formatXAF(totalRevenue)}
                </div>
                <p className="text-[11px] text-hotel-muted mt-1">
                  Issu des {paidOrders.length} commandes confirmées par la Cuisine.
                </p>
              </div>

              <div className="hotel-card p-5">
                <div className="flex items-center justify-between text-xs text-hotel-muted mb-2">
                  <span>Commandes totales enregistrées</span>
                  <Package className="w-4 h-4 text-hotel-gold" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl font-bold text-hotel-text">
                  {orders.length}
                </div>
                <p className="text-[11px] text-hotel-muted mt-1">
                  En attente, payées ou servies.
                </p>
              </div>

              <div className="hotel-card p-5">
                <div className="flex items-center justify-between text-xs text-hotel-muted mb-2">
                  <span>Paiements en attente de vérification</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl font-bold text-amber-300">
                  {orders.filter((o) => o.payment_status === 'payment_declared').length}
                </div>
                <p className="text-[11px] text-hotel-muted mt-1">
                  À vérifier sur le compte marchand par la Cuisine.
                </p>
              </div>
            </div>

            {/* Empty state explanation */}
            {orders.length === 0 && (
              <div className="p-8 rounded-2xl bg-hotel-card border border-hotel-cardBorder text-center">
                <h4 className="font-serif text-base font-bold text-hotel-text mb-1">
                  Base de données opérationnelle prête
                </h4>
                <p className="text-xs text-hotel-muted max-w-md mx-auto">
                  Aucune fausse commande n'est insérée. Dès que les clients passeront commande sur le menu public, les données financières réelles s'afficheront ici.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ORDER HISTORY */}
        {activeTab === 'orders' && (
          <div className="py-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-hotel-gold absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Rechercher par référence, nom, téléphone..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
                />
              </div>
            </div>

            <div className="hotel-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-hotel-surface border-b border-hotel-cardBorder text-hotel-muted uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Référence</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Mode</th>
                      <th className="py-3 px-4">Total</th>
                      <th className="py-3 px-4">Paiement</th>
                      <th className="py-3 px-4">Préparation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hotel-cardBorder">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-hotel-muted">
                          Aucune commande trouvée.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-hotel-surface/50">
                          <td className="py-3 px-4 font-mono font-bold text-hotel-gold">
                            {o.public_reference}
                          </td>
                          <td className="py-3 px-4 text-hotel-muted">
                            {formatDateTime(o.created_at, language)}
                          </td>
                          <td className="py-3 px-4 font-medium text-hotel-text">
                            {o.customer_name} ({o.customer_phone})
                          </td>
                          <td className="py-3 px-4 capitalize text-hotel-muted">
                            {o.order_mode}
                          </td>
                          <td className="py-3 px-4 font-serif font-bold text-hotel-gold">
                            {formatXAF(o.total_amount)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                o.payment_status === 'paid'
                                  ? 'bg-green-950 text-green-300 border border-green-800'
                                  : o.payment_status === 'payment_declared'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-hotel-card text-hotel-muted border border-hotel-cardBorder'
                              }`}
                            >
                              {o.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium capitalize text-hotel-text">
                            {o.preparation_status}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PAYMENT SETTINGS (MoMo & Orange Money) */}
        {activeTab === 'payments' && (
          <div className="py-6 space-y-6">
            <div className="p-4 rounded-xl bg-hotel-card border border-hotel-cardBorder">
              <h3 className="font-serif text-base font-bold text-hotel-text">
                {t.paymentConfigTitle}
              </h3>
              <p className="text-xs text-hotel-muted mt-1 leading-relaxed">
                {t.paymentConfigNotice}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {paymentSettings.map((setting) => {
                const isOrange = setting.id === 'orange';
                return (
                  <div key={setting.id} className="hotel-card p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-hotel-cardBorder">
                      <div className="flex items-center gap-2">
                        <CreditCard
                          className={`w-5 h-5 ${
                            isOrange ? 'text-orange-400' : 'text-yellow-400'
                          }`}
                        />
                        <h4 className="font-serif text-base font-bold text-hotel-text">
                          {isOrange ? 'Orange Money' : 'MTN Mobile Money'}
                        </h4>
                      </div>

                      {/* Active Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer text-xs">
                        <span className="text-hotel-muted">Actif</span>
                        <input
                          type="checkbox"
                          checked={setting.is_active}
                          onChange={(e) =>
                            handleSavePaymentSetting(setting.id, {
                              is_active: e.target.checked,
                            })
                          }
                          className="rounded text-hotel-gold focus:ring-0"
                        />
                      </label>
                    </div>

                    {/* Merchant Code */}
                    <div>
                      <label className="block text-xs font-semibold text-hotel-muted mb-1">
                        Code Marchand Réel
                      </label>
                      <input
                        type="text"
                        defaultValue={setting.merchant_code}
                        onBlur={(e) =>
                          handleSavePaymentSetting(setting.id, {
                            merchant_code: e.target.value.trim(),
                          })
                        }
                        placeholder="Ex: 123456"
                        className="w-full px-3.5 py-2 rounded-xl bg-hotel-surface border border-hotel-cardBorder text-hotel-text text-sm font-mono focus:border-hotel-gold"
                      />
                    </div>

                    {/* Account Name */}
                    <div>
                      <label className="block text-xs font-semibold text-hotel-muted mb-1">
                        Nom du Compte Marchand
                      </label>
                      <input
                        type="text"
                        defaultValue={setting.account_name}
                        onBlur={(e) =>
                          handleSavePaymentSetting(setting.id, {
                            account_name: e.target.value.trim(),
                          })
                        }
                        placeholder="Convivium Home Hotel"
                        className="w-full px-3.5 py-2 rounded-xl bg-hotel-surface border border-hotel-cardBorder text-hotel-text text-sm focus:border-hotel-gold"
                      />
                    </div>

                    {/* Tested on Device Rule */}
                    <div className="p-3.5 rounded-xl bg-hotel-surface border border-hotel-cardBorder space-y-2">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={setting.is_tested_on_device}
                          onChange={(e) =>
                            handleSavePaymentSetting(setting.id, {
                              is_tested_on_device: e.target.checked,
                            })
                          }
                          className="mt-0.5 rounded text-hotel-gold focus:ring-0"
                        />
                        <div>
                          <span className="text-xs font-bold text-hotel-text block">
                            {t.testedOnDeviceLabel}
                          </span>
                          <span className="text-[11px] text-hotel-muted leading-relaxed block mt-0.5">
                            {t.testedOnDeviceHelp}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: ORDER MODES */}
        {activeTab === 'modes' && (
          <div className="py-6 space-y-6">
            <div className="hotel-card p-5">
              <h3 className="font-serif text-base font-bold text-hotel-text">
                {t.orderModesTitle}
              </h3>
              <p className="text-xs text-hotel-muted mt-1 mb-5">
                {t.orderModesDesc}
              </p>

              {restaurantSettings && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(
                    [
                      ['dine_in', 'Consommation sur place (Restaurant)'],
                      ['room_service', 'Service en chambre'],
                      ['takeaway', 'À emporter'],
                      ['delivery', 'Livraison extérieure'],
                    ] as const
                  ).map(([key, label]) => {
                    const isActive = restaurantSettings.modes_active[key];
                    return (
                      <div
                        key={key}
                        className="p-4 rounded-xl bg-hotel-surface border border-hotel-cardBorder flex items-center justify-between"
                      >
                        <div>
                          <h4 className="text-sm font-semibold text-hotel-text">{label}</h4>
                          <span className="text-xs text-hotel-muted">
                            {isActive ? 'Actif pour les clients' : 'Désactivé'}
                          </span>
                        </div>

                        <button
                          onClick={() => handleToggleOrderMode(key)}
                          className={`p-2 rounded-lg text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-hotel-gold text-hotel-black'
                              : 'bg-hotel-card text-hotel-muted border border-hotel-cardBorder'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: KITCHEN STAFF ACCOUNTS */}
        {activeTab === 'staff' && (
          <div className="py-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-bold text-hotel-text">
                  {t.staffTitle}
                </h3>
                <p className="text-xs text-hotel-muted">
                  Gestion des identifiants autorisés pour la Cuisine et le contrôle des paiements.
                </p>
              </div>

              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="btn-gold text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{t.inviteStaffButton}</span>
              </button>
            </div>

            <div className="hotel-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-hotel-surface border-b border-hotel-cardBorder text-hotel-muted uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Nom complet</th>
                    <th className="py-3 px-4">Rôle</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hotel-cardBorder">
                  {staffProfiles.map((s) => (
                    <tr key={s.id} className="hover:bg-hotel-surface/50">
                      <td className="py-3 px-4 font-semibold text-hotel-text">
                        {s.full_name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.role === 'admin'
                              ? 'bg-hotel-gold/20 text-hotel-gold border border-hotel-gold/40'
                              : 'bg-blue-950 text-blue-300 border border-blue-800'
                          }`}
                        >
                          {s.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.is_active
                              ? 'bg-green-950 text-green-300'
                              : 'bg-red-950 text-red-300'
                          }`}
                        >
                          {s.is_active ? t.accountActive : t.accountDisabled}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {s.role !== 'admin' && (
                          <button
                            onClick={() => handleToggleStaff(s.id, s.is_active)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium border ${
                              s.is_active
                                ? 'border-red-800 text-red-300 hover:bg-red-950'
                                : 'border-green-800 text-green-300 hover:bg-green-950'
                            }`}
                          >
                            {s.is_active ? 'Désactiver' : 'Activer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="py-6 space-y-4">
            <h3 className="font-serif text-base font-bold text-hotel-text">
              Journal d'Audit des Actions Sensibles
            </h3>
            <p className="text-xs text-hotel-muted mb-4">
              Traçabilité complète des confirmations de paiements, rejets et modifications de statut.
            </p>

            <div className="hotel-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-hotel-surface border-b border-hotel-cardBorder text-hotel-muted uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date (Douala)</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Cible</th>
                    <th className="py-3 px-4">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hotel-cardBorder font-mono">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-hotel-muted">
                        Aucun journal d'audit disponible.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-hotel-surface/50">
                        <td className="py-2.5 px-4 text-hotel-muted">
                          {formatDateTime(log.created_at, language)}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-hotel-gold">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 text-hotel-text">
                          {log.target_entity} ({log.target_id || '—'})
                        </td>
                        <td className="py-2.5 px-4 text-hotel-muted text-[11px] truncate max-w-xs">
                          {log.details ? JSON.stringify(log.details) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* INVITE CUISINE MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsInviteModalOpen(false)} />
          <div className="relative w-full max-w-md bg-hotel-surface border border-hotel-cardBorder rounded-2xl p-6 z-10">
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              {t.inviteStaffButton}
            </h3>
            <p className="text-xs text-hotel-muted mt-1">
              Associez l’ID utilisateur Supabase Auth au profil Cuisine.
            </p>

            <form onSubmit={handleAddCuisineStaff} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  Identifiant Supabase Auth (UUID)
                </label>
                <input
                  type="text"
                  required
                  value={newCuisineId}
                  onChange={(e) => setNewCuisineId(e.target.value)}
                  placeholder="Ex: 877ab03f-6d45-..."
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs font-mono focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  Nom complet du personnel
                </label>
                <input
                  type="text"
                  required
                  value={newCuisineName}
                  onChange={(e) => setNewCuisineName(e.target.value)}
                  placeholder="Ex: Chef Eric M."
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="submit" className="flex-1 btn-gold py-2.5 text-xs font-bold">
                  {t.save}
                </button>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
