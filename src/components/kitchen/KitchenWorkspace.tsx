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
  FolderTree,
  Layers,
  Search,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService } from '../../services/orders.service';
import { menuService } from '../../services/menu.service';
import { uploadImageToImgBB } from '../../lib/imgbb';
import { PaymentVerificationCard } from './PaymentVerificationCard';
import { ConfirmPaymentModal } from './ConfirmPaymentModal';
import { RejectPaymentModal } from './RejectPaymentModal';
import { ReviewPaymentModal } from './ReviewPaymentModal';
import type {
  Order,
  MenuItem,
  MenuCategory,
  PreparationStatus,
} from '../../types';
import { formatXAF } from '../../lib/formatters';
import { supabase } from '../../lib/supabase';
import { playKitchenNotificationChime } from '../../lib/sound';

export const KitchenWorkspace: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { profile } = useAuth();
  const { language, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'categories'>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);

  // Filters for Orders
  const [paymentFilter, setPaymentFilter] = useState<
    'all' | 'payment_declared' | 'paid' | 'payment_rejected' | 'payment_review_required'
  >('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Modals for Payment Verification
  const [confirmModalOrder, setConfirmModalOrder] = useState<Order | null>(null);
  const [prefilledRefInput, setPrefilledRefInput] = useState('');

  const [rejectModalOrder, setRejectModalOrder] = useState<Order | null>(null);
  const [reviewModalOrder, setReviewModalOrder] = useState<Order | null>(null);

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
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryNameFr, setCategoryNameFr] = useState('');
  const [categoryNameEn, setCategoryNameEn] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState<number>(0);
  const [categoryIsActive, setCategoryIsActive] = useState<boolean>(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

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

    // Supabase Realtime subscription for Kitchen Workspace
    const kitchenRealtimeChannel = supabase
      .channel('kitchen_operations_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            playKitchenNotificationChime();
          }
          loadOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_declarations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            playKitchenNotificationChime();
          }
          loadOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_verifications' },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    // Fallback polling interval every 30 seconds
    const interval = setInterval(loadOrders, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(kitchenRealtimeChannel);
    };
  }, []);

  // Cuisine Payment Actions Handlers
  const handleConfirmPaymentSubmit = async (
    orderId: string,
    verifiedRef: string,
    internalNotes: string
  ) => {
    setOrderActionLoading(orderId);
    try {
      await ordersService.confirmPaymentByCuisine(orderId, verifiedRef, internalNotes);
      setConfirmModalOrder(null);
      await loadOrders();
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleRejectPaymentSubmit = async (orderId: string, reasonPayload: string) => {
    setOrderActionLoading(orderId);
    try {
      await ordersService.rejectPaymentByCuisine(orderId, reasonPayload);
      setRejectModalOrder(null);
      await loadOrders();
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleReviewPaymentSubmit = async (orderId: string, notes: string) => {
    setOrderActionLoading(orderId);
    try {
      await ordersService.requestReviewByCuisine(orderId, notes);
      setReviewModalOrder(null);
      await loadOrders();
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

  // Category Handlers
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
      await loadMenu();
    } catch (err: unknown) {
      setCategoryError(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  const handleToggleCategoryActive = async (cat: MenuCategory) => {
    try {
      await menuService.updateCategory(cat.id, { is_active: !cat.is_active });
      await loadMenu();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  const handleDeleteCategory = async (cat: MenuCategory) => {
    const itemsInCat = menuItems.filter((i) => i.category_id === cat.id);
    if (itemsInCat.length > 0) {
      alert(
        `Impossible de supprimer la catégorie "${cat.name_fr}" : ${itemsInCat.length} article(s) y sont rattachés. Veuillez d'abord réassigner ou supprimer ces articles.`
      );
      return;
    }
    if (!confirm(t.deleteCategoryConfirm)) return;

    try {
      await menuService.deleteCategory(cat.id);
      await loadMenu();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t.errorGeneral);
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

          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'categories'
                ? 'bg-hotel-gold text-hotel-black shadow-gold-glow'
                : 'text-hotel-muted hover:text-hotel-text bg-hotel-surface border border-hotel-cardBorder'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Gestion Catégories ({categories.length})</span>
          </button>
        </div>

        {/* Tab 1: Live Kitchen Orders & Verification Fiches */}
        {activeTab === 'orders' && (
          <div className="py-6 space-y-6">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Payment Status Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentFilter('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    paymentFilter === 'all'
                      ? 'bg-hotel-gold text-hotel-black font-bold shadow-md'
                      : 'bg-hotel-surface border border-hotel-cardBorder text-hotel-muted hover:text-hotel-text'
                  }`}
                >
                  Toutes ({orders.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentFilter('payment_declared')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    paymentFilter === 'payment_declared'
                      ? 'bg-amber-500 text-black font-bold shadow-md'
                      : orders.filter((o) => o.payment_status === 'payment_declared').length > 0
                      ? 'bg-amber-950/60 border border-amber-800 text-amber-300 animate-pulse'
                      : 'bg-hotel-surface border border-hotel-cardBorder text-hotel-muted hover:text-hotel-text'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>En attente de vérification</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30">
                    {orders.filter((o) => o.payment_status === 'payment_declared').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentFilter('paid')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    paymentFilter === 'paid'
                      ? 'bg-green-600 text-white font-bold shadow-md'
                      : 'bg-hotel-surface border border-hotel-cardBorder text-hotel-muted hover:text-hotel-text'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <span>Paiements vérifiés</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30">
                    {orders.filter((o) => o.payment_status === 'paid').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentFilter('payment_review_required')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    paymentFilter === 'payment_review_required'
                      ? 'bg-yellow-500 text-black font-bold shadow-md'
                      : 'bg-hotel-surface border border-hotel-cardBorder text-hotel-muted hover:text-hotel-text'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Vérification demandée</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30">
                    {orders.filter((o) => o.payment_status === 'payment_review_required').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentFilter('payment_rejected')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    paymentFilter === 'payment_rejected'
                      ? 'bg-red-600 text-white font-bold shadow-md'
                      : 'bg-hotel-surface border border-hotel-cardBorder text-hotel-muted hover:text-hotel-text'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  <span>Rejets</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30">
                    {orders.filter((o) => o.payment_status === 'payment_rejected').length}
                  </span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-hotel-muted" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Rechercher réf, client, table..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-xs focus:outline-none focus:border-hotel-gold"
                />
              </div>
            </div>

            {isLoadingOrders ? (
              <div className="py-20 text-center text-hotel-muted">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-hotel-gold mb-2" />
                <p className="text-xs">{t.loading}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-20 text-center text-hotel-muted hotel-card">
                <Clock className="w-12 h-12 text-hotel-cardBorder mx-auto mb-3" />
                <h3 className="font-serif text-lg text-hotel-text font-bold mb-1">
                  Aucune commande enregistrée
                </h3>
                <p className="text-xs text-hotel-muted max-w-sm mx-auto">
                  Les nouvelles commandes passées par les clients apparaîtront instantanément ici.
                </p>
              </div>
            ) : (() => {
              const filteredOrders = orders.filter((o) => {
                if (paymentFilter !== 'all' && o.payment_status !== paymentFilter) return false;
                if (orderSearchQuery.trim()) {
                  const q = orderSearchQuery.toLowerCase().trim();
                  const matchesRef = o.public_reference.toLowerCase().includes(q);
                  const matchesName = o.customer_name.toLowerCase().includes(q);
                  const matchesPhone = (o.customer_phone || '').toLowerCase().includes(q);
                  const matchesRoom = (o.room_number || '').toLowerCase().includes(q);
                  const matchesTable = (o.table_number || '').toLowerCase().includes(q);
                  if (!matchesRef && !matchesName && !matchesPhone && !matchesRoom && !matchesTable) {
                    return false;
                  }
                }
                return true;
              });

              if (filteredOrders.length === 0) {
                return (
                  <div className="py-16 text-center text-hotel-muted hotel-card">
                    <Filter className="w-10 h-10 text-hotel-cardBorder mx-auto mb-2.5" />
                    <h4 className="font-semibold text-hotel-text text-sm">
                      Aucune commande ne correspond aux filtres actifs
                    </h4>
                    <p className="text-xs text-hotel-muted mt-1">
                      Essayez de réinitialiser la recherche ou de sélectionner « Toutes ».
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {filteredOrders.map((order) => {
                    const isPaid = order.payment_status === 'paid';
                    const canPrepare = isPaid;

                    return (
                      <div key={order.id} className="space-y-3">
                        {/* 1. Complete Payment Verification Card */}
                        <PaymentVerificationCard
                          order={order}
                          allOrders={orders}
                          onConfirmClick={(ord, prefilled) => {
                            setConfirmModalOrder(ord);
                            setPrefilledRefInput(prefilled);
                          }}
                          onRejectClick={(ord) => setRejectModalOrder(ord)}
                          onReviewClick={(ord) => setReviewModalOrder(ord)}
                          isActionLoading={orderActionLoading === order.id}
                        />

                        {/* 2. Preparation Status Controls */}
                        <div className="p-3.5 rounded-2xl bg-hotel-card/90 border border-hotel-cardBorder flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-hotel-muted text-[11px] font-semibold uppercase">
                              Statut Préparation :
                            </span>
                            <span className="font-bold text-hotel-gold uppercase text-xs px-2.5 py-0.5 rounded-full bg-hotel-surface border border-hotel-cardBorder">
                              {order.preparation_status}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {order.preparation_status === 'new' && (
                              <button
                                onClick={() => handleUpdatePrepStatus(order.id, 'accepted')}
                                disabled={orderActionLoading === order.id}
                                className="btn-secondary py-1.5 px-3 text-xs font-semibold"
                              >
                                Accepter la commande
                              </button>
                            )}

                            {order.preparation_status === 'accepted' && (
                              <>
                                {!canPrepare ? (
                                  <div className="p-1.5 px-3 rounded-lg bg-amber-950/60 border border-amber-900 text-amber-300 text-[11px] font-medium flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Vérification Cuisine obligatoire avant préparation</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleUpdatePrepStatus(order.id, 'preparing')}
                                    disabled={orderActionLoading === order.id}
                                    className="btn-gold py-1.5 px-3 text-xs font-bold shadow-md hover:shadow-gold-glow"
                                  >
                                    Lancer la préparation en cuisine
                                  </button>
                                )}
                              </>
                            )}

                            {order.preparation_status === 'preparing' && (
                              <button
                                onClick={() => handleUpdatePrepStatus(order.id, 'ready')}
                                disabled={orderActionLoading === order.id}
                                className="py-1.5 px-3 rounded-xl text-xs font-bold text-white bg-green-600 hover:bg-green-500 shadow-md"
                              >
                                Marquer comme Prête pour le service
                              </button>
                            )}

                            {order.preparation_status === 'ready' && (
                              <button
                                onClick={() => handleUpdatePrepStatus(order.id, 'completed')}
                                disabled={orderActionLoading === order.id}
                                className="btn-secondary py-1.5 px-3 text-xs font-semibold text-green-400 hover:text-green-300"
                              >
                                Marquer comme Servie / Terminée
                              </button>
                            )}

                            {order.preparation_status !== 'completed' &&
                              order.preparation_status !== 'cancelled' && (
                                <button
                                  onClick={() => {
                                    if (confirm('Voulez-vous vraiment annuler cette commande ?')) {
                                      handleUpdatePrepStatus(order.id, 'cancelled');
                                    }
                                  }}
                                  disabled={orderActionLoading === order.id}
                                  className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1"
                                >
                                  Annuler
                                </button>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 2: Menu Catalog Management (Dishes & Drinks) */}
        {activeTab === 'menu' && (
          <div className="py-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                  onClick={() => setActiveTab('categories')}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <FolderTree className="w-3.5 h-3.5 text-hotel-gold" />
                  <span>Gérer les Catégories</span>
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

            {/* Catalog Items Table / Grid */}
            {menuItems.filter((item) =>
              selectedCategoryFilter === 'all' ? true : item.category_id === selectedCategoryFilter
            ).length === 0 ? (
              <div className="py-16 text-center text-hotel-muted hotel-card">
                <Utensils className="w-12 h-12 text-hotel-cardBorder mx-auto mb-3" />
                <h4 className="font-serif text-base text-hotel-text font-bold mb-1">
                  Aucun article trouvé
                </h4>
                <p className="text-xs text-hotel-muted max-w-sm mx-auto">
                  {selectedCategoryFilter === 'all'
                    ? 'Commencez par ajouter votre premier plat ou boisson au menu.'
                    : 'Aucun article n’est rattaché à cette catégorie.'}
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
            )}
          </div>
        )}

        {/* Tab 3: Category Management */}
        {activeTab === 'categories' && (
          <div className="py-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-hotel-text">
                  Gestion des Catégories du Menu
                </h3>
                <p className="text-xs text-hotel-muted">
                  Organisez vos plats et boissons. Modifiez les noms, l’ordre d’affichage et la visibilité publique.
                </p>
              </div>

              <button
                onClick={handleOpenAddCategory}
                className="btn-gold text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle Catégorie</span>
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="py-16 text-center text-hotel-muted hotel-card">
                <FolderTree className="w-12 h-12 text-hotel-cardBorder mx-auto mb-3" />
                <h4 className="font-serif text-base text-hotel-text font-bold mb-1">
                  Aucune catégorie configurée
                </h4>
                <p className="text-xs text-hotel-muted max-w-sm mx-auto mb-4">
                  Créez des catégories (ex: Boissons, Plats Chauds, Desserts) pour organiser la carte de l’établissement.
                </p>
                <button
                  onClick={handleOpenAddCategory}
                  className="btn-gold text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Créer la première catégorie</span>
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
                          title={cat.is_active ? 'Masquer du menu' : 'Rendre visible sur le menu'}
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
                            title="Modifier cette catégorie"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Modifier</span>
                          </button>

                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="text-hotel-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-red-950/30 transition-colors"
                            title="Supprimer la catégorie"
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

      </div>

      {/* CONFIRM PAYMENT MODAL (CUISINE AUTHORITY) */}
      <ConfirmPaymentModal
        order={confirmModalOrder}
        prefilledReference={prefilledRefInput}
        isOpen={Boolean(confirmModalOrder)}
        onClose={() => setConfirmModalOrder(null)}
        onConfirm={handleConfirmPaymentSubmit}
        isLoading={orderActionLoading === confirmModalOrder?.id}
      />

      {/* REJECT PAYMENT MODAL (TWO-STEP REJECTION WITH MANDATORY REASON) */}
      <RejectPaymentModal
        order={rejectModalOrder}
        isOpen={Boolean(rejectModalOrder)}
        onClose={() => setRejectModalOrder(null)}
        onConfirmReject={handleRejectPaymentSubmit}
        isLoading={orderActionLoading === rejectModalOrder?.id}
      />

      {/* REVIEW REQUIRED MODAL */}
      <ReviewPaymentModal
        order={reviewModalOrder}
        isOpen={Boolean(reviewModalOrder)}
        onClose={() => setReviewModalOrder(null)}
        onConfirmReview={handleReviewPaymentSubmit}
        isLoading={orderActionLoading === reviewModalOrder?.id}
      />

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
                  placeholder="Ex: Boissons Rafraîchissantes"
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
                  placeholder="Ex: Refreshing Beverages"
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
                  Détermine la position d'affichage sur le menu (0 = premier).
                </p>
              </div>

              {editingCategory && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="catActiveCheck"
                    checked={categoryIsActive}
                    onChange={(e) => setCategoryIsActive(e.target.checked)}
                    className="rounded bg-hotel-card border-hotel-cardBorder text-hotel-gold focus:ring-0"
                  />
                  <label
                    htmlFor="catActiveCheck"
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
