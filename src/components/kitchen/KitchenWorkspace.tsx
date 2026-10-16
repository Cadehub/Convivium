import React, { useState, useEffect } from 'react';
import {
  ChefHat,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Utensils,
  Clock,
  Plus,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService } from '../../services/orders.service';
import { menuService } from '../../services/menu.service';
import { uploadImageToImgBB } from '../../lib/imgbb';
import type {
  Order,
  MenuItem,
  MenuCategory,
  PreparationStatus,
} from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';

export const KitchenWorkspace: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { profile } = useAuth();
  const { language, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'categories'>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);

  // Modals for Payment Verification
  const [confirmModalOrder, setConfirmModalOrder] = useState<Order | null>(null);
  const [verifiedRefInput, setVerifiedRefInput] = useState('');
  const [internalNotesInput, setInternalNotesInput] = useState('');

  const [rejectModalOrder, setRejectModalOrder] = useState<Order | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  const [reviewModalOrder, setReviewModalOrder] = useState<Order | null>(null);
  const [reviewNotesInput, setReviewNotesInput] = useState('');

  // Menu State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);

  // Item Form Modal
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
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

  // Category Form Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryNameFr, setCategoryNameFr] = useState('');
  const [categoryNameEn, setCategoryNameEn] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const loadOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const data = await ordersService.getStaffOrders();
      setOrders(data);
    } catch (e) {
      console.error('Error fetching orders', e);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const loadMenu = async () => {
    try {
      const [cats, items] = await Promise.all([
        menuService.getAllCategories(),
        menuService.getAllMenuItems(),
      ]);
      setCategories(cats);
      setMenuItems(items);
      if (cats.length > 0 && !itemCategoryId) {
        setItemCategoryId(cats[0].id);
      }
    } catch (e) {
      console.error('Error fetching menu items', e);
    }
  };

  useEffect(() => {
    loadOrders();
    loadMenu();
    // Auto-refresh orders every 30 seconds
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cuisine Payment Actions
  const handleConfirmPayment = async () => {
    if (!confirmModalOrder) return;
    setOrderActionLoading(confirmModalOrder.id);
    try {
      await ordersService.confirmPaymentByCuisine(
        confirmModalOrder.id,
        verifiedRefInput.trim(),
        internalNotesInput.trim()
      );
      setConfirmModalOrder(null);
      setVerifiedRefInput('');
      setInternalNotesInput('');
      await loadOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la confirmation';
      alert(msg);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectModalOrder || !rejectReasonInput.trim()) return;
    setOrderActionLoading(rejectModalOrder.id);
    try {
      await ordersService.rejectPaymentByCuisine(
        rejectModalOrder.id,
        rejectReasonInput.trim()
      );
      setRejectModalOrder(null);
      setRejectReasonInput('');
      await loadOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec du rejet';
      alert(msg);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleRequestReview = async () => {
    if (!reviewModalOrder || !reviewNotesInput.trim()) return;
    setOrderActionLoading(reviewModalOrder.id);
    try {
      await ordersService.requestReviewByCuisine(
        reviewModalOrder.id,
        reviewNotesInput.trim()
      );
      setReviewModalOrder(null);
      setReviewNotesInput('');
      await loadOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec du signalement';
      alert(msg);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleUpdatePrepStatus = async (orderId: string, newStatus: PreparationStatus) => {
    setOrderActionLoading(orderId);
    try {
      await ordersService.updatePreparationStatus(orderId, newStatus);
      await loadOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transition refusée';
      alert(msg);
    } finally {
      setOrderActionLoading(null);
    }
  };

  // Image upload handling
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
        setImageUploadError(res.error || 'Erreur lors du téléversement ImgBB');
      }
    } catch (err: unknown) {
      setImageUploadError(err instanceof Error ? err.message : 'Erreur ImgBB');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save Item
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
      await loadMenu();
    } catch (err: unknown) {
      setItemSaveError(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(null);

    if (!categoryNameFr.trim()) {
      setCategoryError(t.errorRequiredFields);
      return;
    }

    try {
      await menuService.createCategory({
        name_fr: categoryNameFr.trim(),
        name_en: categoryNameEn.trim() || undefined,
      });
      setIsCategoryModalOpen(false);
      setCategoryNameFr('');
      setCategoryNameEn('');
      await loadMenu();
    } catch (err: unknown) {
      setCategoryError(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  return (
    <div className="min-h-screen bg-hotel-black text-hotel-text">
      {/* Top Bar */}
      <header className="bg-hotel-surface border-b border-hotel-cardBorder sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-hotel-gold/10 text-hotel-gold border border-hotel-gold/30">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-sm sm:text-base text-hotel-text">
                  Espace Cuisine
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-hotel-gold text-hotel-black uppercase">
                  Opérations & Contrôle
                </span>
              </div>
              <p className="text-[11px] text-hotel-muted">
                {profile?.full_name || 'Chef de Cuisine'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadOrders}
              className="btn-secondary text-xs p-2 sm:px-3 flex items-center gap-1.5"
              title={t.refresh}
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

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center gap-2 border-b border-hotel-cardBorder pb-3">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'orders'
                ? 'bg-hotel-gold text-hotel-black shadow-gold-glow'
                : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Commandes en direct ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'menu'
                ? 'bg-hotel-gold text-hotel-black shadow-gold-glow'
                : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Gestion Carte ({menuItems.length})</span>
          </button>
        </div>

        {/* Tab 1: Live Kitchen Orders */}
        {activeTab === 'orders' && (
          <div className="py-6">
            {isLoadingOrders ? (
              <div className="py-20 text-center text-hotel-muted">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-hotel-gold mb-2" />
                <p className="text-xs">{t.loading}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-20 text-center text-hotel-muted hotel-card">
                <Clock className="w-12 h-12 text-hotel-cardBorder mx-auto mb-3" />
                <h3 className="font-serif text-lg text-hotel-text font-bold mb-1">
                  Aucune commande en cours
                </h3>
                <p className="text-xs text-hotel-muted max-w-sm mx-auto">
                  Les nouvelles commandes passées par les clients apparaîtront instantanément ici.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map((order) => {
                  const isPaid = order.payment_status === 'paid';
                  const isDeclared = order.payment_status === 'payment_declared';
                  const isReview = order.payment_status === 'payment_review_required';
                  const isRejected = order.payment_status === 'payment_rejected';

                  const canPrepare = isPaid;

                  return (
                    <div
                      key={order.id}
                      className={`hotel-card p-5 flex flex-col justify-between ${
                        isDeclared
                          ? 'border-amber-500/80 shadow-md ring-1 ring-amber-500/30'
                          : isPaid
                          ? 'border-green-600/60'
                          : 'border-hotel-cardBorder'
                      }`}
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 pb-3 border-b border-hotel-cardBorder">
                          <div>
                            <span className="font-mono text-sm font-bold text-hotel-gold">
                              {order.public_reference}
                            </span>
                            <h4 className="text-sm font-semibold text-hotel-text mt-0.5">
                              {order.customer_name}
                            </h4>
                            <span className="text-[11px] text-hotel-muted">
                              {order.customer_phone}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="font-serif text-base font-bold text-hotel-gold block">
                              {formatXAF(order.total_amount)}
                            </span>
                            <span className="text-[10px] text-hotel-muted">
                              {formatDateTime(order.created_at, language)}
                            </span>
                          </div>
                        </div>

                        {/* Order Mode Badge */}
                        <div className="mt-2.5 flex items-center justify-between text-xs">
                          <span className="px-2.5 py-0.5 rounded bg-hotel-surface border border-hotel-cardBorder text-hotel-muted font-medium">
                            {order.order_mode === 'dine_in'
                              ? `Sur place (Table ${order.table_number || '—'})`
                              : order.order_mode === 'room_service'
                              ? `Chambre ${order.room_number || '—'}`
                              : order.order_mode === 'delivery'
                              ? `Livraison (${order.delivery_address || '—'})`
                              : 'À emporter'}
                          </span>
                        </div>

                        {/* Items List */}
                        <div className="mt-3 divide-y divide-hotel-cardBorder/50 text-xs">
                          {(order.items || []).map((it) => (
                            <div key={it.id} className="py-1.5 flex justify-between">
                              <span className="text-hotel-text font-medium">
                                {it.quantity}x {it.item_name}
                              </span>
                              <span className="text-hotel-muted font-serif">
                                {formatXAF(it.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {order.notes && (
                          <div className="mt-2.5 p-2 rounded bg-hotel-surface border border-hotel-cardBorder text-[11px] text-hotel-muted italic">
                            « {order.notes} »
                          </div>
                        )}

                        {/* PAYMENT VERIFICATION CARD (Cuisine Authority) */}
                        <div className="mt-4 p-3 rounded-xl bg-hotel-surface border border-hotel-cardBorder space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-hotel-muted">
                              Contrôle Paiement Cuisine
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isPaid
                                  ? 'bg-green-950 text-green-300 border border-green-800'
                                  : isDeclared
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                                  : isReview
                                  ? 'bg-yellow-950 text-yellow-300 border border-yellow-800'
                                  : isRejected
                                  ? 'bg-red-950 text-red-300 border border-red-800'
                                  : 'bg-hotel-card text-hotel-muted'
                              }`}
                            >
                              {order.payment_status}
                            </span>
                          </div>

                          {/* Payment Actions for Cuisine */}
                          {!isPaid && (
                            <div className="pt-2 flex flex-wrap gap-1.5">
                              <button
                                onClick={() => setConfirmModalOrder(order)}
                                className="flex-1 btn-gold py-1.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Confirmer</span>
                              </button>

                              <button
                                onClick={() => setReviewModalOrder(order)}
                                className="btn-secondary py-1.5 px-2 text-[11px] text-yellow-400"
                                title="Signaler vérification supplémentaire"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setRejectModalOrder(order)}
                                className="btn-secondary py-1.5 px-2 text-[11px] text-red-400"
                                title="Rejeter paiement"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PREPARATION STATUS TRANSITIONS */}
                      <div className="mt-4 pt-3 border-t border-hotel-cardBorder">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-hotel-muted text-[11px]">Préparation</span>
                          <span className="font-bold text-hotel-gold uppercase text-[10px]">
                            {order.preparation_status}
                          </span>
                        </div>

                        {!canPrepare && order.preparation_status === 'new' ? (
                          <div className="p-2 rounded bg-amber-950/40 border border-amber-900/60 text-amber-300 text-[10px]">
                            {t.cannotPrepareUnpaid}
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-1 text-[10px]">
                            {order.preparation_status === 'new' && (
                              <button
                                onClick={() => handleUpdatePrepStatus(order.id, 'accepted')}
                                disabled={orderActionLoading === order.id}
                                className="btn-secondary py-1 text-center font-semibold col-span-3"
                              >
                                Accepter
                              </button>
                            )}

                            {order.preparation_status === 'accepted' && (
                              <button
                                onClick={() => handleUpdatePrepStatus(order.id, 'preparing')}
                                disabled={!canPrepare || orderActionLoading === order.id}
                                className="btn-gold py-1 text-center font-semibold col-span-3"
                              >
                                Lancer la préparation
                              </button>
                            )}

                            {order.preparation_status === 'preparing' && (
                              <button
                                onClick={() => handleUpdatePrepStatus(order.id, 'ready')}
                                disabled={orderActionLoading === order.id}
                                className="btn-gold py-1 text-center font-semibold col-span-3 bg-green-600 hover:bg-green-500 text-white"
                              >
                                Marquer comme Prête
                              </button>
                            )}

                            {order.preparation_status === 'ready' && (
                              <button
                                onClick={() => handleUpdatePrepStatus(order.id, 'completed')}
                                disabled={orderActionLoading === order.id}
                                className="btn-secondary py-1 text-center font-semibold col-span-3"
                              >
                                Marquer comme Servie
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Menu Catalog Management (Dishes & Drinks) */}
        {activeTab === 'menu' && (
          <div className="py-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-hotel-text">
                  Carte des Plats et Boissons
                </h3>
                <p className="text-xs text-hotel-muted">
                  Création, modification des prix en XAF, images et disponibilité immédiate.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="btn-secondary text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
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
                  className="btn-gold text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter un Article</span>
                </button>
              </div>
            </div>

            {/* Catalog Items Table / Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map((item) => (
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
                            .then(loadMenu)
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
                            menuService.deleteMenuItem(item.id).then(loadMenu);
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
          </div>
        )}
      </div>

      {/* CONFIRM PAYMENT MODAL */}
      {confirmModalOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={() => setConfirmModalOrder(null)} />
          <div className="relative w-full max-w-md bg-hotel-surface border border-hotel-cardBorder rounded-2xl p-6 z-10">
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              {t.confirmPaymentTitle}
            </h3>
            <p className="text-xs text-hotel-gold font-mono mt-1">
              Commande : {confirmModalOrder.public_reference} — {formatXAF(confirmModalOrder.total_amount)}
            </p>

            <div className="mt-3 p-3 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs">
              {t.confirmPaymentWarning}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.verifiedRefPrompt}
                </label>
                <input
                  type="text"
                  value={verifiedRefInput}
                  onChange={(e) => setVerifiedRefInput(e.target.value)}
                  placeholder={t.verifiedRefPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.internalNotesPrompt}
                </label>
                <input
                  type="text"
                  value={internalNotesInput}
                  onChange={(e) => setInternalNotesInput(e.target.value)}
                  placeholder="Ex: Vérifié sur compte marchand MoMo..."
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={handleConfirmPayment}
                  className="flex-1 btn-gold py-2.5 text-xs font-bold"
                >
                  {t.confirmPaymentSubmit}
                </button>
                <button
                  onClick={() => setConfirmModalOrder(null)}
                  className="btn-secondary text-xs"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT PAYMENT MODAL */}
      {rejectModalOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={() => setRejectModalOrder(null)} />
          <div className="relative w-full max-w-md bg-hotel-surface border border-hotel-cardBorder rounded-2xl p-6 z-10">
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              {t.rejectPaymentTitle}
            </h3>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.rejectReasonPrompt} <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  placeholder={t.rejectReasonPlaceholder}
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={handleRejectPayment}
                  className="flex-1 btn-danger py-2.5 text-xs font-bold"
                >
                  {t.rejectPaymentSubmit}
                </button>
                <button
                  onClick={() => setRejectModalOrder(null)}
                  className="btn-secondary text-xs"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW REQUIRED MODAL */}
      {reviewModalOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={() => setReviewModalOrder(null)} />
          <div className="relative w-full max-w-md bg-hotel-surface border border-hotel-cardBorder rounded-2xl p-6 z-10">
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              {t.flagReviewTitle}
            </h3>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-hotel-text mb-1">
                  {t.flagReviewPrompt}
                </label>
                <textarea
                  rows={3}
                  required
                  value={reviewNotesInput}
                  onChange={(e) => setReviewNotesInput(e.target.value)}
                  placeholder="Ex: Montant partiel reçu, nom ne correspond pas..."
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={handleRequestReview}
                  className="flex-1 btn-gold py-2.5 text-xs font-bold"
                >
                  {t.flagReviewSubmit}
                </button>
                <button
                  onClick={() => setReviewModalOrder(null)}
                  className="btn-secondary text-xs"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ITEM CREATE / EDIT MODAL */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsItemModalOpen(false)} />
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
                  id="availCheck"
                  checked={itemAvailable}
                  onChange={(e) => setItemAvailable(e.target.checked)}
                  className="rounded bg-hotel-card border-hotel-cardBorder text-hotel-gold focus:ring-0"
                />
                <label htmlFor="availCheck" className="text-xs text-hotel-text font-medium cursor-pointer">
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

      {/* CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsCategoryModalOpen(false)} />
          <div className="relative w-full max-w-md bg-hotel-surface border border-hotel-cardBorder rounded-2xl p-6 z-10">
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              {t.addCategoryTitle}
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
                  className="w-full px-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button type="submit" className="flex-1 btn-gold py-2.5 text-xs font-bold">
                  {t.save}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
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
