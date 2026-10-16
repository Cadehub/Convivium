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
  Utensils,
  FolderTree,
  Layers,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService } from '../../services/orders.service';
import { settingsService } from '../../services/settings.service';
import { staffService } from '../../services/staff.service';
import { menuService } from '../../services/menu.service';
import { uploadImageToImgBB } from '../../lib/imgbb';
import type {
  Order,
  PaymentMethodSetting,
  RestaurantSettings,
  StaffProfile,
  AuditLogEntry,
  MenuCategory,
  MenuItem,
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

  // Menu & Categories State
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [menuSubTab, setMenuSubTab] = useState<'categories' | 'items'>('categories');

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemNameFr, setItemNameFr] = useState('');
  const [itemNameEn, setItemNameEn] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemType, setItemType] = useState<'dish' | 'drink'>('dish');
  const [itemPrice, setItemPrice] = useState<number>(0);
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [itemSaveError, setItemSaveError] = useState<string | null>(null);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryNameFr, setCategoryNameFr] = useState('');
  const [categoryNameEn, setCategoryNameEn] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState<number>(0);
  const [categoryIsActive, setCategoryIsActive] = useState<boolean>(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [allOrders, paySettings, restSettings, staffList, logs, cats, items] =
        await Promise.all([
          ordersService.getStaffOrders(),
          settingsService.getAdminPaymentSettings(),
          settingsService.getRestaurantSettings(),
          staffService.getAllStaffProfiles(),
          settingsService.getAuditLogs(100),
          menuService.getAllCategories(),
          menuService.getAllMenuItems(),
        ]);
      setOrders(allOrders);
      setPaymentSettings(paySettings);
      setRestaurantSettings(restSettings);
      setStaffProfiles(staffList);
      setAuditLogs(logs);
      setCategories(cats);
      setMenuItems(items);
      if (cats.length > 0 && !itemCategoryId) {
        setItemCategoryId(cats[0].id);
      }
    } catch (e) {
      console.error('Error loading admin data', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Category Handlers (Admin)
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryNameFr('');
    setCategoryNameEn('');
    setCategorySortOrder(categories.length);
    setCategoryIsActive(true);
    setCategoryError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat);
    setCategoryNameFr(cat.name_fr);
    setCategoryNameEn(cat.name_en || '');
    setCategorySortOrder(cat.sort_order ?? 0);
    setCategoryIsActive(cat.is_active);
    setCategoryError(null);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(null);

    if (!categoryNameFr.trim()) {
      setCategoryError(t.errorRequiredFields);
      return;
    }

    try {
      if (editingCategory) {
        await menuService.updateCategory(editingCategory.id, {
          name_fr: categoryNameFr.trim(),
          name_en: categoryNameEn.trim() || undefined,
          sort_order: Number(categorySortOrder) || 0,
          is_active: categoryIsActive,
        });
      } else {
        await menuService.createCategory({
          name_fr: categoryNameFr.trim(),
          name_en: categoryNameEn.trim() || undefined,
          sort_order: Number(categorySortOrder) || 0,
        });
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      setCategoryNameFr('');
      setCategoryNameEn('');
      await loadData();
    } catch (err: unknown) {
      setCategoryError(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  const handleToggleCategoryActive = async (cat: MenuCategory) => {
    try {
      await menuService.updateCategory(cat.id, { is_active: !cat.is_active });
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  const handleDeleteCategory = async (cat: MenuCategory) => {
    const itemsInCat = menuItems.filter((i) => i.category_id === cat.id);
    if (itemsInCat.length > 0) {
      alert(
        `Impossible de supprimer "${cat.name_fr}" : ${itemsInCat.length} article(s) y sont rattachés.`
      );
      return;
    }
    if (!confirm(t.deleteCategoryConfirm)) return;

    try {
      await menuService.deleteCategory(cat.id);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  // Menu Item Handlers (Admin)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploadError(null);
    setIsUploadingImage(true);

    try {
      const res = await uploadImageToImgBB(file);
      if (res.success && res.url) {
        setItemImageUrl(res.url);
      } else {
        setImageUploadError(res.error || 'Erreur ImgBB');
      }
    } catch (err: unknown) {
      setImageUploadError(err instanceof Error ? err.message : 'Erreur ImgBB');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemSaveError(null);

    if (!itemNameFr.trim() || itemPrice < 0) {
      setItemSaveError(t.errorRequiredFields);
      return;
    }

    try {
      if (editingItem) {
        await menuService.updateMenuItem(editingItem.id, {
          name_fr: itemNameFr.trim(),
          name_en: itemNameEn.trim() || null,
          category_id: itemCategoryId,
          item_type: itemType,
          price: itemPrice,
          image_url: itemImageUrl.trim() || null,
          is_available: itemAvailable,
        });
      } else {
        await menuService.createMenuItem({
          name_fr: itemNameFr.trim(),
          name_en: itemNameEn.trim() || undefined,
          category_id: itemCategoryId,
          item_type: itemType,
          price: itemPrice,
          image_url: itemImageUrl.trim() || null,
          is_available: itemAvailable,
        });
      }
      setIsItemModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setItemSaveError(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

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
  const handleToggleOrderMode = async (
    modeKey: 'dine_in' | 'room_service' | 'delivery'
  ) => {
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
      (o.customer_phone ? o.customer_phone.toLowerCase().includes(s) : false)
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
            onClick={() => setActiveTab('menu')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'menu'
                ? 'bg-hotel-gold text-hotel-black shadow-gold-glow'
                : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Carte & Catégories ({categories.length})</span>
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
                            {o.customer_name} {o.customer_phone ? `(${o.customer_phone})` : ''}
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

        {/* TAB: MENU & CATEGORIES (ADMIN) */}
        {activeTab === 'menu' && (
          <div className="py-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-hotel-text">
                  Gestion de la Carte & des Catégories
                </h3>
                <p className="text-xs text-hotel-muted">
                  Supervision des plats, boissons, prix en XAF et organisation des catégories.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenAddCategory}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <FolderTree className="w-3.5 h-3.5 text-hotel-gold" />
                  <span>Nouvelle Catégorie</span>
                </button>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setItemNameFr('');
                    setItemNameEn('');
                    setItemPrice(0);
                    setItemImageUrl('');
                    setItemAvailable(true);
                    setItemType('dish');
                    setIsItemModalOpen(true);
                  }}
                  className="btn-gold text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter un Article</span>
                </button>
              </div>
            </div>

            {/* Sub-tabs: Catégories vs Plats & Boissons */}
            <div className="flex items-center gap-2 border-b border-hotel-cardBorder pb-2">
              <button
                onClick={() => setMenuSubTab('categories')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  menuSubTab === 'categories'
                    ? 'bg-hotel-gold text-hotel-black font-bold shadow-gold-glow'
                    : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Catégories ({categories.length})</span>
              </button>
              <button
                onClick={() => setMenuSubTab('items')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  menuSubTab === 'items'
                    ? 'bg-hotel-gold text-hotel-black font-bold shadow-gold-glow'
                    : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Plats & Boissons ({menuItems.length})</span>
              </button>
            </div>

            {/* Subtab 1: Categories View */}
            {menuSubTab === 'categories' && (
              <div className="space-y-4">
                {categories.length === 0 ? (
                  <div className="py-16 text-center text-hotel-muted hotel-card">
                    <FolderTree className="w-12 h-12 text-hotel-cardBorder mx-auto mb-3" />
                    <h4 className="font-serif text-base text-hotel-text font-bold mb-1">
                      Aucune catégorie configurée
                    </h4>
                    <p className="text-xs text-hotel-muted max-w-sm mx-auto mb-4">
                      Créez des catégories pour structurer le menu de l’établissement.
                    </p>
                    <button
                      onClick={handleOpenAddCategory}
                      className="btn-gold text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Créer une catégorie</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((cat) => {
                      const itemsCount = menuItems.filter((i) => i.category_id === cat.id).length;
                      return (
                        <div
                          key={cat.id}
                          className="hotel-card p-4 flex flex-col justify-between border-hotel-cardBorder hover:border-hotel-gold/40 transition-colors"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 pb-2 border-b border-hotel-cardBorder">
                              <div>
                                <span className="text-[10px] font-mono text-hotel-gold font-bold px-1.5 py-0.5 rounded bg-hotel-gold/10 border border-hotel-gold/20">
                                  Ordre #{cat.sort_order ?? 0}
                                </span>
                                <h4 className="font-semibold text-base text-hotel-text mt-1.5">
                                  {cat.name_fr}
                                </h4>
                                {cat.name_en && (
                                  <p className="text-xs text-hotel-muted italic">
                                    EN : {cat.name_en}
                                  </p>
                                )}
                              </div>

                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  cat.is_active
                                    ? 'bg-green-950 text-green-300 border border-green-800'
                                    : 'bg-red-950 text-red-300 border border-red-800'
                                }`}
                              >
                                {cat.is_active ? t.categoryStatusActive : t.categoryStatusInactive}
                              </span>
                            </div>

                            <div className="py-3 flex items-center justify-between text-xs text-hotel-muted">
                              <span className="flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-hotel-gold" />
                                <span>
                                  {itemsCount} {t.categoryItemsCount.toLowerCase()}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-hotel-cardBorder flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleToggleCategoryActive(cat)}
                              className={`btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1.5 ${
                                cat.is_active ? 'text-hotel-muted' : 'text-green-400'
                              }`}
                            >
                              {cat.is_active ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>Désactiver</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Activer</span>
                                </>
                              )}
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditCategory(cat)}
                                className="btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1 hover:text-hotel-gold"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Modifier</span>
                              </button>

                              <button
                                onClick={() => handleDeleteCategory(cat)}
                                className="text-hotel-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-red-950/30 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Subtab 2: Menu Items View */}
            {menuSubTab === 'items' && (
              <div className="space-y-4">
                {/* Category Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    onClick={() => setSelectedCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedCategoryFilter === 'all'
                        ? 'bg-hotel-gold text-hotel-black font-bold shadow-gold-glow'
                        : 'bg-hotel-surface text-hotel-muted border border-hotel-cardBorder hover:text-hotel-text'
                    }`}
                  >
                    {t.allCategories} ({menuItems.length})
                  </button>
                  {categories.map((c) => {
                    const count = menuItems.filter((i) => i.category_id === c.id).length;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCategoryFilter(c.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                          selectedCategoryFilter === c.id
                            ? 'bg-hotel-gold text-hotel-black font-bold shadow-gold-glow'
                            : 'bg-hotel-surface text-hotel-muted border border-hotel-cardBorder hover:text-hotel-text'
                        }`}
                      >
                        {language === 'en' && c.name_en ? c.name_en : c.name_fr} ({count})
                      </button>
                    );
                  })}
                </div>

                {menuItems.filter((item) =>
                  selectedCategoryFilter === 'all' ? true : item.category_id === selectedCategoryFilter
                ).length === 0 ? (
                  <div className="py-16 text-center text-hotel-muted hotel-card">
                    <Utensils className="w-12 h-12 text-hotel-cardBorder mx-auto mb-3" />
                    <h4 className="font-serif text-base text-hotel-text font-bold mb-1">
                      Aucun article
                    </h4>
                    <p className="text-xs text-hotel-muted max-w-sm mx-auto">
                      Ajoutez des plats ou des boissons au catalogue.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {menuItems
                      .filter((item) =>
                        selectedCategoryFilter === 'all' ? true : item.category_id === selectedCategoryFilter
                      )
                      .map((item) => (
                        <div key={item.id} className="hotel-card p-4 flex gap-3.5 items-start">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name_fr}
                              className="w-16 h-16 rounded-lg object-cover border border-hotel-cardBorder flex-shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-hotel-surface border border-hotel-cardBorder flex items-center justify-center text-hotel-gold/40 flex-shrink-0">
                              <Utensils className="w-6 h-6" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="font-semibold text-sm text-hotel-text truncate">
                                {item.name_fr}
                              </h4>
                              <button
                                onClick={() =>
                                  menuService
                                    .toggleItemAvailability(item.id, !item.is_available)
                                    .then(loadData)
                                }
                                title={item.is_available ? 'Rendre indisponible' : 'Rendre disponible'}
                                className="text-hotel-muted hover:text-hotel-gold p-1"
                              >
                                {item.is_available ? (
                                  <Eye className="w-4 h-4 text-green-400" />
                                ) : (
                                  <EyeOff className="w-4 h-4 text-red-400" />
                                )}
                              </button>
                            </div>

                            <span className="font-serif text-sm font-bold text-hotel-gold block mt-0.5">
                              {formatXAF(item.price)}
                            </span>

                            <div className="mt-2 flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setItemNameFr(item.name_fr);
                                  setItemNameEn(item.name_en || '');
                                  setItemPrice(item.price);
                                  setItemImageUrl(item.image_url || '');
                                  setItemAvailable(item.is_available);
                                  setItemCategoryId(item.category_id || categories[0]?.id || '');
                                  setItemType(item.item_type as 'dish' | 'drink');
                                  setIsItemModalOpen(true);
                                }}
                                className="btn-secondary py-1 px-2 text-[10px] flex items-center gap-1"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Modifier</span>
                              </button>

                              <button
                                onClick={() => {
                                  if (confirm(`Supprimer ${item.name_fr} ?`)) {
                                    menuService.deleteMenuItem(item.id).then(loadData);
                                  }
                                }}
                                className="text-hotel-muted hover:text-red-400 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
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

      {/* ITEM CREATE / EDIT MODAL (ADMIN) */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => setIsItemModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-hotel-surface border border-hotel-cardBorder rounded-2xl p-6 z-10">
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              {editingItem ? t.editItemTitle : t.addItemTitle}
            </h3>

            {itemSaveError && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">
                {itemSaveError}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.itemNameFr} <span className="text-hotel-gold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={itemNameFr}
                  onChange={(e) => setItemNameFr(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.itemNameEn}
                </label>
                <input
                  type="text"
                  value={itemNameEn}
                  onChange={(e) => setItemNameEn(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-hotel-text mb-1">
                    {t.itemType}
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as 'dish' | 'drink')}
                    className="w-full px-3 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
                  >
                    <option value="dish">Plat</option>
                    <option value="drink">Boisson</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-hotel-text mb-1">
                    {t.itemCategory}
                  </label>
                  <select
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_fr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.itemPrice}
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step={1}
                  value={itemPrice}
                  onChange={(e) => setItemPrice(Math.round(Number(e.target.value) || 0))}
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold font-mono"
                />
              </div>

              {/* ImgBB Image Upload */}
              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.itemImage}
                </label>

                {imageUploadError && (
                  <p className="text-[11px] text-red-400 mb-1">{imageUploadError}</p>
                )}

                <div className="flex items-center gap-3">
                  <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1.5 py-2">
                    {isUploadingImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-hotel-gold" />
                    )}
                    <span>{t.uploadWithImgBB}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingImage}
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>

                  {itemImageUrl && (
                    <span className="text-[11px] text-green-400 font-semibold truncate max-w-xs">
                      {t.imageUploadedSuccess}
                    </span>
                  )}
                </div>

                {itemImageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={itemImageUrl}
                      alt="Aperçu"
                      className="w-12 h-12 rounded object-cover border border-hotel-cardBorder"
                    />
                    <button
                      type="button"
                      onClick={() => setItemImageUrl('')}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      {t.removeImage}
                    </button>
                  </div>
                )}
              </div>

              {/* Immediate Availability Switch */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="availCheckAdmin"
                  checked={itemAvailable}
                  onChange={(e) => setItemAvailable(e.target.checked)}
                  className="rounded bg-hotel-card border-hotel-cardBorder text-hotel-gold focus:ring-0"
                />
                <label
                  htmlFor="availCheckAdmin"
                  className="text-xs text-hotel-text font-medium cursor-pointer"
                >
                  {t.itemAvailability}
                </label>
              </div>

              <div className="pt-3 flex gap-2">
                <button type="submit" className="flex-1 btn-gold py-2.5 text-xs font-bold">
                  {t.save}
                </button>
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY CREATE / EDIT MODAL (ADMIN) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => {
              setIsCategoryModalOpen(false);
              setEditingCategory(null);
            }}
          />
          <div className="relative w-full max-w-md bg-hotel-surface border border-hotel-cardBorder rounded-2xl p-6 z-10">
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              {editingCategory ? t.editCategoryTitle : t.addCategoryTitle}
            </h3>

            {categoryError && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">
                {categoryError}
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.categoryNameFr} <span className="text-hotel-gold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={categoryNameFr}
                  onChange={(e) => setCategoryNameFr(e.target.value)}
                  placeholder="Ex: Vins & Champagnes"
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.categoryNameEn}
                </label>
                <input
                  type="text"
                  value={categoryNameEn}
                  onChange={(e) => setCategoryNameEn(e.target.value)}
                  placeholder="Ex: Wines & Champagne"
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.categorySortOrder}
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={categorySortOrder}
                  onChange={(e) => setCategorySortOrder(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm font-mono focus:outline-none focus:border-hotel-gold"
                />
                <p className="text-[11px] text-hotel-muted mt-1">
                  Position d’affichage sur le menu client (0 = premier).
                </p>
              </div>

              {editingCategory && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="adminCatActiveCheck"
                    checked={categoryIsActive}
                    onChange={(e) => setCategoryIsActive(e.target.checked)}
                    className="rounded bg-hotel-card border-hotel-cardBorder text-hotel-gold focus:ring-0"
                  />
                  <label
                    htmlFor="adminCatActiveCheck"
                    className="text-xs text-hotel-text font-medium cursor-pointer"
                  >
                    {t.categoryActiveLabel}
                  </label>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                <button type="submit" className="flex-1 btn-gold py-2.5 text-xs font-bold">
                  {t.save}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setEditingCategory(null);
                  }}
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
