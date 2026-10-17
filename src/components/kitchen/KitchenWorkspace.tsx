import React, { useState, useEffect, useRef } from 'react';
import {
  ChefHat,
  CheckCircle2,
  XCircle,
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
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  Sliders,
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
import { ConfirmationModal } from '../common/ConfirmationModal';
import { StaffNotificationButton } from '../common/NotificationSettings';
import { ComplementManager } from '../menu/ComplementManager';
import { ItemVariantManager } from '../menu/ItemVariantManager';
import type {
  Order,
  MenuItem,
  MenuItemVariant,
  MenuCategory,
  PreparationStatus,
} from '../../types';
import { formatXAF } from '../../lib/formatters';
import { supabase } from '../../lib/supabase';
import { subscribeToLiveSyncEvents } from '../../lib/realtime';
import { playKitchenNotificationChime } from '../../lib/sound';

export const KitchenWorkspace: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { profile } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'categories' | 'complements'>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);
  const hasLoadedInitialOrders = useRef(false);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const knownDeclarationIdsRef = useRef<Set<string>>(new Set());
  const lastOrdersSignatureRef = useRef<string>('');
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [previewMenuItem, setPreviewMenuItem] = useState<MenuItem | null>(null);

  // Item Form Modal
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemNameFr, setItemNameFr] = useState('');
  const [itemNameEn, setItemNameEn] = useState('');
  const [itemDescriptionFr, setItemDescriptionFr] = useState('');
  const [itemDescriptionEn, setItemDescriptionEn] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemType, setItemType] = useState<'dish' | 'drink'>('dish');
  const [itemPrice, setItemPrice] = useState<number>(0);
  const [itemHasVariants, setItemHasVariants] = useState<boolean>(false);
  const [itemVariants, setItemVariants] = useState<MenuItemVariant[]>([]);
  const [itemPrepTimeMinutes, setItemPrepTimeMinutes] = useState<string>('');
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
  const [categoryParentId, setCategoryParentId] = useState<string | null>(null);
  const [categorySortOrder, setCategorySortOrder] = useState<number>(0);
  const [categoryIsActive, setCategoryIsActive] = useState<boolean>(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [kitchenMenuPage, setKitchenMenuPage] = useState<number>(1);

  // Custom Deletion Confirmation Modals
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<MenuCategory | null>(null);

  const showToast = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => {
      setStatusFeedback((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const computeOrdersSignature = (list: Order[]) =>
    list
      .map(
        (o) =>
          `${o.id}:${o.payment_status}:${o.preparation_status}:${(o.payment_declarations || []).length}:${(o.payment_verifications || []).length}`
      )
      .join('|');

  const loadOrders = async (silent = true) => {
    if (!hasLoadedInitialOrders.current && !silent) {
      setIsLoadingOrders(true);
    } else if (!silent) {
      setIsRefreshingOrders(true);
    }
    try {
      const data = await ordersService.getStaffOrders();
      // Detect new orders or new declarations during real-time sync to play chime
      if (hasLoadedInitialOrders.current) {
        let shouldChime = false;
        for (const o of data) {
          if (!knownOrderIdsRef.current.has(o.id)) {
            shouldChime = true;
          }
          for (const d of o.payment_declarations || []) {
            if (!knownDeclarationIdsRef.current.has(d.id)) {
              shouldChime = true;
            }
          }
        }
        if (shouldChime) {
          playKitchenNotificationChime();
        }
      }

      knownOrderIdsRef.current = new Set(data.map((o) => o.id));
      const declIds = new Set<string>();
      data.forEach((o) => (o.payment_declarations || []).forEach((d) => declIds.add(d.id)));
      knownDeclarationIdsRef.current = declIds;

      hasLoadedInitialOrders.current = true;

      const nextSig = computeOrdersSignature(data);
      if (nextSig !== lastOrdersSignatureRef.current || !silent) {
        lastOrdersSignatureRef.current = nextSig;
        setOrders(data);
      }
    } catch (e) {
      console.error('Error fetching orders', e);
    } finally {
      setIsLoadingOrders(false);
      setIsRefreshingOrders(false);
    }
  };

  const scheduleOrdersSync = () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      loadOrders(true);
    }, 250);
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
    loadOrders(false);
    loadMenu();

    // 1. Event-driven Supabase Realtime subscription (zero periodic polling)
    const kitchenRealtimeChannel = supabase
      .channel('kitchen_operations_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          scheduleOrdersSync();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_declarations' },
        () => {
          scheduleOrdersSync();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_verifications' },
        () => {
          scheduleOrdersSync();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => {
          loadMenu();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_categories' },
        () => {
          loadMenu();
        }
      )
      .subscribe();

    // 2. Event-driven cross-tab & broadcast live sync subscription
    const unsubscribeLive = subscribeToLiveSyncEvents((evt) => {
      if (evt.type === 'catalog_updated') {
        loadMenu();
      } else {
        scheduleOrdersSync();
      }
    });

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      unsubscribeLive();
      supabase.removeChannel(kitchenRealtimeChannel);
    };
  }, []);

  // Cuisine Payment Actions Handlers (Optimistic In-Place + Silent Sync)
  const handleConfirmPaymentSubmit = async (
    orderId: string,
    verifiedRef: string,
    internalNotes: string
  ) => {
    setOrderActionLoading(orderId);
    try {
      await ordersService.confirmPaymentByCuisine(orderId, verifiedRef, internalNotes);
      // Immediate in-place update without unmounting or scrolling
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                payment_status: 'paid',
                updated_at: new Date().toISOString(),
              }
            : o
        )
      );
      setConfirmModalOrder(null);
      await loadOrders(true);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleRejectPaymentSubmit = async (orderId: string, reasonPayload: string) => {
    setOrderActionLoading(orderId);
    try {
      await ordersService.rejectPaymentByCuisine(orderId, reasonPayload);
      // Immediate in-place update without unmounting or scrolling
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                payment_status: 'payment_rejected',
                updated_at: new Date().toISOString(),
              }
            : o
        )
      );
      setRejectModalOrder(null);
      await loadOrders(true);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleReviewPaymentSubmit = async (orderId: string, notes: string) => {
    setOrderActionLoading(orderId);
    try {
      await ordersService.requestReviewByCuisine(orderId, notes);
      // Immediate in-place update without unmounting or scrolling
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                payment_status: 'payment_review_required',
                updated_at: new Date().toISOString(),
              }
            : o
        )
      );
      setReviewModalOrder(null);
      await loadOrders(true);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleUpdatePrepStatus = async (orderId: string, newStatus: PreparationStatus) => {
    setOrderActionLoading(orderId);
    const previousOrders = orders;
    // Optimistic in-place update: 0ms latency, zero scroll jump
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              preparation_status: newStatus,
              updated_at: new Date().toISOString(),
            }
          : o
      )
    );
    try {
      await ordersService.updatePreparationStatus(orderId, newStatus);
      await loadOrders(true);
    } catch (err: unknown) {
      setOrders(previousOrders);
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

    if (!itemNameFr.trim()) {
      setItemSaveError(t.errorRequiredFields);
      return;
    }

    if (!itemHasVariants && (itemPrice === null || itemPrice === undefined || itemPrice < 0)) {
      setItemSaveError(
        language === 'fr'
          ? 'Le prix de base est obligatoire pour un produit sans variantes.'
          : 'Base price is required for items without variants.'
      );
      return;
    }

    if (itemHasVariants) {
      if (itemVariants.length === 0) {
        setItemSaveError(
          language === 'fr'
            ? 'Veuillez ajouter au moins une variante pour ce produit.'
            : 'Please add at least one variant for this item.'
        );
        return;
      }

      const hasBasePrice = itemPrice !== null && itemPrice > 0;
      const unpricedVariant = itemVariants.find(
        (v) => (v.price === null || v.price === undefined || v.price <= 0) && !hasBasePrice
      );
      if (unpricedVariant) {
        setItemSaveError(
          language === 'fr'
            ? `La variante "${unpricedVariant.name_fr}" n’a pas de prix et aucun prix de base n’est défini.`
            : `Variant "${unpricedVariant.name_fr}" has no price and no base price is set.`
        );
        return;
      }
    }

    const parsedPrepMinutes =
      itemPrepTimeMinutes.trim() !== '' && Number(itemPrepTimeMinutes) > 0
        ? Math.round(Number(itemPrepTimeMinutes))
        : null;

    const finalBasePrice = itemHasVariants
      ? itemPrice > 0
        ? Math.round(Number(itemPrice))
        : null
      : Math.round(Number(itemPrice));

    try {
      if (editingItem) {
        await menuService.updateMenuItem(editingItem.id, {
          name_fr: itemNameFr.trim(),
          name_en: itemNameEn.trim() || null,
          description_fr: itemDescriptionFr.trim() || null,
          description_en: itemDescriptionEn.trim() || null,
          category_id: itemCategoryId,
          item_type: itemType,
          price: finalBasePrice,
          has_variants: itemHasVariants,
          preparation_time_minutes: parsedPrepMinutes,
          image_url: itemImageUrl.trim() || null,
          is_available: itemAvailable,
        });

        // Sync variants
        const originalIds = (editingItem.variants || []).map((v) => v.id);
        const currentIds = itemVariants.filter((v) => !v.id.startsWith('temp_')).map((v) => v.id);
        const toDeleteIds = originalIds.filter((id) => !currentIds.includes(id));

        for (const delId of toDeleteIds) {
          try {
            await menuService.deleteVariant(delId);
          } catch (e) {
            console.warn('Could not delete variant:', e);
          }
        }

        for (let idx = 0; idx < itemVariants.length; idx++) {
          const v = itemVariants[idx];
          if (v.id.startsWith('temp_')) {
            await menuService.createVariant({
              menu_item_id: editingItem.id,
              name_fr: v.name_fr,
              name_en: v.name_en || undefined,
              price: v.price,
              sort_order: idx,
            });
          } else {
            await menuService.updateVariant(v.id, {
              name_fr: v.name_fr,
              name_en: v.name_en || undefined,
              price: v.price,
              is_active: v.is_active,
              sort_order: idx,
            });
          }
        }
      } else {
        const created = await menuService.createMenuItem({
          name_fr: itemNameFr.trim(),
          name_en: itemNameEn.trim() || undefined,
          description_fr: itemDescriptionFr.trim() || undefined,
          description_en: itemDescriptionEn.trim() || undefined,
          category_id: itemCategoryId,
          item_type: itemType,
          price: finalBasePrice,
          has_variants: itemHasVariants,
          preparation_time_minutes: parsedPrepMinutes,
          image_url: itemImageUrl.trim() || null,
          is_available: itemAvailable,
        });

        if (itemHasVariants && itemVariants.length > 0) {
          for (let idx = 0; idx < itemVariants.length; idx++) {
            const v = itemVariants[idx];
            await menuService.createVariant({
              menu_item_id: created.id,
              name_fr: v.name_fr,
              name_en: v.name_en || undefined,
              price: v.price,
              sort_order: idx,
            });
          }
        }
      }
      setIsItemModalOpen(false);
      await loadMenu();
      showToast(language === 'fr' ? 'Article enregistré.' : 'Item saved.');
    } catch (err: unknown) {
      setItemSaveError(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  // Category Handlers
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryNameFr('');
    setCategoryNameEn('');
    setCategoryParentId(null);
    setCategorySortOrder(categories.length);
    setCategoryIsActive(true);
    setCategoryError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat);
    setCategoryNameFr(cat.name_fr);
    setCategoryNameEn(cat.name_en || '');
    setCategoryParentId(cat.parent_id || null);
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
          parent_id: categoryParentId || null,
          sort_order: Number(categorySortOrder) || 0,
          is_active: categoryIsActive,
        });
      } else {
        await menuService.createCategory({
          name_fr: categoryNameFr.trim(),
          name_en: categoryNameEn.trim() || undefined,
          parent_id: categoryParentId || null,
          sort_order: Number(categorySortOrder) || 0,
        });
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      setCategoryNameFr('');
      setCategoryNameEn('');
      setCategoryParentId(null);
      await loadMenu();
      showToast(language === 'fr' ? 'Catégorie enregistrée.' : 'Category saved.');
    } catch (err: unknown) {
      setCategoryError(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  const handleToggleCategoryActive = async (cat: MenuCategory) => {
    const nextActive = !cat.is_active;
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_active: nextActive } : c))
    );
    try {
      await menuService.updateCategory(cat.id, { is_active: nextActive });
      await loadMenu();
    } catch (err: unknown) {
      await loadMenu();
      alert(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  const handleDeleteCategory = async (cat: MenuCategory) => {
    const childCategories = categories.filter((c) => c.parent_id === cat.id);
    if (childCategories.length > 0) {
      alert(
        language === 'fr'
          ? `Impossible de supprimer "${cat.name_fr}" : ${childCategories.length} sous-catégorie(s) y sont rattachées.`
          : `Cannot delete "${cat.name_en || cat.name_fr}": ${childCategories.length} subcategory/ies attached.`
      );
      return;
    }

    const itemsInCat = menuItems.filter((i) => i.category_id === cat.id);
    if (itemsInCat.length > 0) {
      alert(
        language === 'fr'
          ? `Impossible de supprimer la catégorie "${cat.name_fr}" : ${itemsInCat.length} article(s) y sont rattachés. Veuillez d'abord réassigner ou supprimer ces articles.`
          : `Cannot delete category "${cat.name_en || cat.name_fr}": ${itemsInCat.length} item(s) are attached. Please reassign or delete them first.`
      );
      return;
    }
    setCategoryToDelete(cat);
  };

  const executeDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const catId = categoryToDelete.id;
    setCategoryToDelete(null);
    setCategories((prev) => prev.filter((c) => c.id !== catId));
    try {
      await menuService.deleteCategory(catId);
      await loadMenu();
    } catch (err: unknown) {
      await loadMenu();
      alert(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  const executeDeleteMenuItem = async () => {
    if (!itemToDelete) return;
    const itemId = itemToDelete.id;
    setItemToDelete(null);
    setMenuItems((prev) => prev.filter((m) => m.id !== itemId));
    try {
      await menuService.deleteMenuItem(itemId);
      await loadMenu();
    } catch (err: unknown) {
      await loadMenu();
      alert(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  const pendingDeclarationsCount = orders.filter(
    (o) => o.payment_status === 'payment_declared'
  ).length;

  return (
    <div className="min-h-screen bg-hotel-bg text-hotel-text">
      {statusFeedback && (
        <div className="fixed top-4 right-4 z-50 bg-stone-900 text-white text-xs py-2.5 px-4 rounded-xl shadow-elevated border border-stone-700 animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}
      {/* Operational Header */}
      <header className="bg-white border-b border-hotel-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="Convivium Home Hotel"
              className="w-10 h-10 rounded-full object-cover border border-stone-200 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-semibold text-base sm:text-lg text-hotel-text">
                  {t.kitchenTitle}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#FBF7EE] text-[#9A721C] border border-[#E5D099]">
                  <ChefHat className="w-3 h-3" />
                  <span>Cuisine</span>
                </span>
              </div>
              <p className="text-xs text-hotel-secondary">
                {profile?.full_name || 'Cuisine — Convivium Home Hotel'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="inline-flex items-center rounded-lg border border-hotel-border bg-hotel-subtle/60 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setLanguage('fr')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  language === 'fr'
                    ? 'bg-white text-hotel-text shadow-subtle font-semibold'
                    : 'text-hotel-muted hover:text-hotel-text'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  language === 'en'
                    ? 'bg-white text-hotel-text shadow-subtle font-semibold'
                    : 'text-hotel-muted hover:text-hotel-text'
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={() => loadOrders(false)}
              className="btn-outline-gold text-xs py-2 px-3"
              title={t.refresh}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingOrders ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t.refresh}</span>
            </button>

            <StaffNotificationButton />

            <button
              type="button"
              onClick={onLogout}
              className="btn-outline-gold text-xs py-2 px-3 text-red-700 hover:bg-red-50 hover:border-red-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.logoutButton}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <div className="bg-white border-b border-hotel-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-3">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'orders'
                  ? 'bg-hotel-dark text-white shadow-subtle'
                  : 'bg-white text-hotel-secondary border border-hotel-border hover:text-hotel-text'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>
                {t.kitchenTabOrders} ({orders.length})
              </span>
              {pendingDeclarationsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-amber-400 text-stone-950">
                  {pendingDeclarationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'menu'
                  ? 'bg-hotel-dark text-white shadow-subtle'
                  : 'bg-white text-hotel-secondary border border-hotel-border hover:text-hotel-text'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>
                {t.kitchenTabMenu} ({menuItems.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'categories'
                  ? 'bg-hotel-dark text-white shadow-subtle'
                  : 'bg-white text-hotel-secondary border border-hotel-border hover:text-hotel-text'
              }`}
            >
              <FolderTree className="w-4 h-4" />
              <span>
                {t.kitchenTabCategories} ({categories.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('complements')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'complements'
                  ? 'bg-hotel-dark text-white shadow-subtle'
                  : 'bg-white text-hotel-secondary border border-hotel-border hover:text-hotel-text'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>
                {t.complements}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab 1: Live Kitchen Orders & Verification Fiches */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Filter and Search Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 bg-white p-3.5 sm:p-4 rounded-xl border border-hotel-border shadow-subtle">
              {/* Payment Status Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setPaymentFilter('all')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    paymentFilter === 'all'
                      ? 'bg-hotel-dark text-white font-semibold'
                      : 'bg-hotel-subtle/60 border border-hotel-border text-hotel-secondary hover:text-hotel-text'
                  }`}
                >
                  {t.all} ({orders.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentFilter('payment_declared')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    paymentFilter === 'payment_declared'
                      ? 'bg-amber-600 text-white font-semibold'
                      : pendingDeclarationsCount > 0
                      ? 'bg-amber-50 border border-amber-300 text-amber-900 font-semibold'
                      : 'bg-hotel-subtle/60 border border-hotel-border text-hotel-secondary hover:text-hotel-text'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {language === 'fr' ? 'Déclarations en attente' : 'Pending declarations'}
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-black/10">
                    {pendingDeclarationsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentFilter('paid')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    paymentFilter === 'paid'
                      ? 'bg-emerald-700 text-white font-semibold'
                      : 'bg-hotel-subtle/60 border border-hotel-border text-hotel-secondary hover:text-hotel-text'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{language === 'fr' ? 'Confirmés' : 'Confirmed'}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-black/10">
                    {orders.filter((o) => o.payment_status === 'paid').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentFilter('payment_review_required')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    paymentFilter === 'payment_review_required'
                      ? 'bg-amber-700 text-white font-semibold'
                      : 'bg-hotel-subtle/60 border border-hotel-border text-hotel-secondary hover:text-hotel-text'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{language === 'fr' ? 'À vérifier' : 'Under review'}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-black/10">
                    {
                      orders.filter((o) => o.payment_status === 'payment_review_required')
                        .length
                    }
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentFilter('payment_rejected')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    paymentFilter === 'payment_rejected'
                      ? 'bg-red-700 text-white font-semibold'
                      : 'bg-hotel-subtle/60 border border-hotel-border text-hotel-secondary hover:text-hotel-text'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{language === 'fr' ? 'Rejets' : 'Rejected'}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-black/10">
                    {orders.filter((o) => o.payment_status === 'payment_rejected').length}
                  </span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto shrink-0">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-hotel-muted" />
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder={
                      language === 'fr'
                        ? 'Rechercher réf, client, chambre, table...'
                        : 'Search ref, customer, room, table...'
                    }
                    className="input-hotel pl-10 py-2 text-xs"
                  />
                </div>
              </div>
            </div>

            {isLoadingOrders ? (
              <div className="py-20 text-center text-hotel-muted">
                <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#9A721C] mb-2" />
                <p className="text-xs">{t.loading}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-16 text-center hotel-card p-8">
                <Clock className="w-10 h-10 text-hotel-muted mx-auto mb-3" />
                <h3 className="font-serif text-lg text-hotel-text font-semibold mb-1">
                  {language === 'fr' ? 'Aucune commande enregistrée' : 'No orders recorded'}
                </h3>
                <p className="text-xs text-hotel-secondary max-w-sm mx-auto">
                  {language === 'fr'
                    ? 'Les commandes passées par les clients s’afficheront automatiquement ici en temps réel.'
                    : 'Customer orders will appear here automatically in real time.'}
                </p>
              </div>
            ) : (() => {
              const filteredOrders = orders.filter((o) => {
                if (paymentFilter !== 'all' && o.payment_status !== paymentFilter)
                  return false;
                if (orderSearchQuery.trim()) {
                  const q = orderSearchQuery.toLowerCase().trim();
                  const matchesRef = o.public_reference.toLowerCase().includes(q);
                  const matchesName = o.customer_name.toLowerCase().includes(q);
                  const matchesPhone = (o.customer_phone || '').toLowerCase().includes(q);
                  const matchesRoom = (o.room_number || '').toLowerCase().includes(q);
                  const matchesTable = (o.table_number || '').toLowerCase().includes(q);
                  if (
                    !matchesRef &&
                    !matchesName &&
                    !matchesPhone &&
                    !matchesRoom &&
                    !matchesTable
                  ) {
                    return false;
                  }
                }
                return true;
              });

              if (filteredOrders.length === 0) {
                return (
                  <div className="py-16 text-center hotel-card p-8">
                    <Filter className="w-8 h-8 text-hotel-muted mx-auto mb-2.5" />
                    <h4 className="font-semibold text-hotel-text text-sm">
                      {language === 'fr'
                        ? 'Aucune commande ne correspond à ce filtre'
                        : 'No orders match the active filter'}
                    </h4>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {filteredOrders.map((order) => (
                    <PaymentVerificationCard
                      key={order.id}
                      order={order}
                      allOrders={orders}
                      onConfirmClick={(ord, prefilled) => {
                        setConfirmModalOrder(ord);
                        setPrefilledRefInput(prefilled);
                      }}
                      onRejectClick={(ord) => setRejectModalOrder(ord)}
                      onReviewClick={(ord) => setReviewModalOrder(ord)}
                      onUpdatePrepStatus={handleUpdatePrepStatus}
                      isActionLoading={orderActionLoading === order.id}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 2: Menu Catalog Management (Dishes & Drinks) */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-hotel-border shadow-subtle">
              <div>
                <h2 className="font-serif text-xl font-semibold text-hotel-text">
                  {t.kitchenTabMenu}
                </h2>
                <p className="text-xs text-hotel-secondary mt-0.5">
                  {language === 'fr'
                    ? 'Gérez les plats, boissons, temps de préparation, tarifs en XAF, photos et disponibilité immédiate.'
                    : 'Manage dishes, beverages, preparation times, XAF prices, photos, and immediate availability.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('categories')}
                  className="btn-outline-gold text-xs py-2.5 px-3.5"
                >
                  <FolderTree className="w-3.5 h-3.5 text-[#9A721C]" />
                  <span>{t.kitchenTabCategories}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setItemNameFr('');
                    setItemNameEn('');
                    setItemDescriptionFr('');
                    setItemDescriptionEn('');
                    setItemPrice(0);
                    setItemHasVariants(false);
                    setItemVariants([]);
                    setItemPrepTimeMinutes('');
                    setItemImageUrl('');
                    setItemAvailable(true);
                    setItemType('dish');
                    setIsItemModalOpen(true);
                  }}
                  className="btn-gold text-xs py-2.5 px-4 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addItemTitle}</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter('all');
                  setKitchenMenuPage(1);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-hotel-dark text-white font-semibold'
                    : 'bg-white text-hotel-secondary border border-hotel-border hover:text-hotel-text'
                }`}
              >
                {t.allCategories} ({menuItems.length})
              </button>
              {categories.map((c) => {
                const count = menuItems.filter((i) => i.category_id === c.id).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryFilter(c.id);
                      setKitchenMenuPage(1);
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      selectedCategoryFilter === c.id
                        ? 'bg-hotel-dark text-white font-semibold'
                        : 'bg-white text-hotel-secondary border border-hotel-border hover:text-hotel-text'
                    }`}
                  >
                    {language === 'en' && c.name_en ? c.name_en : c.name_fr} ({count})
                  </button>
                );
              })}
            </div>

            {/* Catalog Items Grid (2 x 6 = 12 per page) */}
            {(() => {
              const filteredKitchenMenu = menuItems.filter((item) =>
                selectedCategoryFilter === 'all'
                  ? true
                  : item.category_id === selectedCategoryFilter
              );
              const ITEMS_PER_PAGE = 12;
              const totalPages = Math.max(
                1,
                Math.ceil(filteredKitchenMenu.length / ITEMS_PER_PAGE)
              );
              const safePage = Math.min(kitchenMenuPage, totalPages);
              const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
              const pageItems = filteredKitchenMenu.slice(
                startIdx,
                startIdx + ITEMS_PER_PAGE
              );

              if (filteredKitchenMenu.length === 0) {
                return (
                  <div className="py-16 text-center hotel-card p-8">
                    <Utensils className="w-10 h-10 text-hotel-muted mx-auto mb-3" />
                    <h4 className="font-serif text-lg text-hotel-text font-semibold mb-1">
                      {t.noItemsAvailable}
                    </h4>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3 sm:gap-5">
                    {pageItems.map((item) => {
                      const catObj = categories.find((c) => c.id === item.category_id);
                      return (
                        <div
                          key={item.id}
                          className="hotel-card overflow-hidden flex flex-col justify-between bg-white"
                        >
                          {/* Top Card Image (Clickable to enlarge) */}
                          <div
                            onClick={() => setPreviewMenuItem(item)}
                            className="relative w-full aspect-4/3 sm:aspect-16/10 bg-[#F6F3EC] border-b border-hotel-border overflow-hidden cursor-pointer group/img"
                          >
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name_fr}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#9A721C]/50">
                                <Utensils className="w-7 h-7" />
                              </div>
                            )}

                            {/* Solid Non-Transparent Category Badge */}
                            {catObj && (
                              <span className="absolute top-2 left-2 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-[#FAF6EE] border border-[#D8C79A] shadow-2xs text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#8A6214] truncate max-w-[50%]">
                                {language === 'en' && catObj.name_en
                                  ? catObj.name_en
                                  : catObj.name_fr}
                              </span>
                            )}

                            <span
                              className={`absolute top-2 right-2 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] rounded-full ${
                                item.is_available
                                  ? 'badge-paid shadow-2xs'
                                  : 'badge-neutral shadow-2xs'
                              }`}
                            >
                              {item.is_available ? t.available : t.unavailable}
                            </span>

                            {/* Optional Preparation Time Badge */}
                            {typeof item.preparation_time_minutes === 'number' &&
                              item.preparation_time_minutes > 0 && (
                                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-[#1C1917] text-[#FBF7EE] text-[9px] sm:text-[10px] font-semibold shadow-2xs">
                                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#D4AF37]" />
                                  <span>{item.preparation_time_minutes} min</span>
                                </span>
                              )}

                            <span className="absolute bottom-2 right-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border border-hotel-border shadow-2xs hidden sm:flex items-center justify-center text-hotel-secondary group-hover/img:text-[#9A721C] transition-colors">
                              <ZoomIn className="w-3.5 h-3.5" />
                            </span>
                          </div>

                          {/* Card Body & Structured 3-Button Footer Bar */}
                          <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="font-serif font-semibold text-sm sm:text-base md:text-lg text-hotel-text line-clamp-2">
                                {item.name_fr}
                              </h4>
                              <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                                <span className="text-xs sm:text-sm md:text-base font-bold text-[#9A721C] font-mono">
                                  {item.price !== null && item.price !== undefined
                                    ? formatXAF(item.price)
                                    : item.variants && item.variants.length > 0
                                    ? `${t.startingFrom} ${formatXAF(Math.min(...item.variants.map((v) => v.price ?? 0)))}`
                                    : '—'}
                                </span>
                                {typeof item.preparation_time_minutes === 'number' &&
                                  item.preparation_time_minutes > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-hotel-secondary bg-hotel-subtle px-2 py-0.5 rounded border border-hotel-border">
                                      <Clock className="w-3 h-3 text-[#9A721C]" />
                                      {item.preparation_time_minutes} min
                                    </span>
                                  )}
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-hotel-border grid grid-cols-3 gap-1 sm:gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextAvail = !item.is_available;
                                  setMenuItems((prev) =>
                                    prev.map((m) =>
                                      m.id === item.id
                                        ? { ...m, is_available: nextAvail }
                                        : m
                                    )
                                  );
                                  menuService
                                    .toggleItemAvailability(item.id, nextAvail)
                                    .then(loadMenu)
                                    .catch(loadMenu);
                                }}
                                className="btn-outline-gold py-1.5 px-1 sm:px-2 text-[10px] sm:text-xs justify-center min-w-0"
                              >
                                {item.is_available ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">
                                      {language === 'fr' ? 'Masquer' : 'Hide'}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                    <span className="truncate">
                                      {language === 'fr' ? 'Activer' : 'Enable'}
                                    </span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setItemNameFr(item.name_fr);
                                  setItemNameEn(item.name_en || '');
                                  setItemDescriptionFr(item.description_fr || '');
                                  setItemDescriptionEn(item.description_en || '');
                                  setItemPrice(item.price ?? 0);
                                  setItemHasVariants(
                                    item.has_variants ||
                                      (item.variants && item.variants.length > 0) ||
                                      false
                                  );
                                  setItemVariants(item.variants ? [...item.variants] : []);
                                  setItemPrepTimeMinutes(
                                    typeof item.preparation_time_minutes === 'number' &&
                                      item.preparation_time_minutes > 0
                                      ? String(item.preparation_time_minutes)
                                      : ''
                                  );
                                  setItemImageUrl(item.image_url || '');
                                  setItemAvailable(item.is_available);
                                  setItemCategoryId(
                                    item.category_id || categories[0]?.id || ''
                                  );
                                  setItemType(item.item_type as 'dish' | 'drink');
                                  setIsItemModalOpen(true);
                                }}
                                className="btn-outline-gold py-1.5 px-1 sm:px-2 text-[10px] sm:text-xs justify-center min-w-0"
                              >
                                <Edit className="w-3.5 h-3.5 shrink-0 text-[#9A721C]" />
                                <span className="truncate">{t.edit}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                className="py-1.5 px-1 sm:px-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 text-[10px] sm:text-xs font-medium inline-flex items-center justify-center gap-1 transition-colors min-w-0"
                                title={t.delete}
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{t.delete}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Bar (2 x 6) */}
                  <div className="pt-4 border-t border-hotel-border flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-hotel-secondary">
                      {language === 'fr' ? (
                        <>
                          Affichage de{' '}
                          <strong className="text-hotel-text font-semibold">
                            {startIdx + 1}
                          </strong>{' '}
                          à{' '}
                          <strong className="text-hotel-text font-semibold">
                            {Math.min(startIdx + ITEMS_PER_PAGE, filteredKitchenMenu.length)}
                          </strong>{' '}
                          sur{' '}
                          <strong className="text-hotel-text font-semibold">
                            {filteredKitchenMenu.length}
                          </strong>{' '}
                          articles (2 × 6)
                        </>
                      ) : (
                        <>
                          Showing{' '}
                          <strong className="text-hotel-text font-semibold">
                            {startIdx + 1}
                          </strong>{' '}
                          to{' '}
                          <strong className="text-hotel-text font-semibold">
                            {Math.min(startIdx + ITEMS_PER_PAGE, filteredKitchenMenu.length)}
                          </strong>{' '}
                          of{' '}
                          <strong className="text-hotel-text font-semibold">
                            {filteredKitchenMenu.length}
                          </strong>{' '}
                          items (2 × 6)
                        </>
                      )}
                    </p>

                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setKitchenMenuPage((p) => Math.max(1, p - 1))}
                        className="btn-outline-gold py-2 px-3 text-xs disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>{language === 'fr' ? 'Précédent' : 'Previous'}</span>
                      </button>

                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setKitchenMenuPage(pageNum)}
                            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                              pageNum === safePage
                                ? 'bg-hotel-dark text-white shadow-subtle'
                                : 'bg-white border border-hotel-border text-hotel-secondary hover:text-hotel-text'
                            }`}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setKitchenMenuPage((p) => Math.min(totalPages, p + 1))}
                        className="btn-outline-gold py-2 px-3 text-xs disabled:opacity-40"
                      >
                        <span>{language === 'fr' ? 'Suivant' : 'Next'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 3: Category Management */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-hotel-border shadow-subtle">
              <div>
                <h2 className="font-serif text-xl font-semibold text-hotel-text">
                  {t.kitchenTabCategories}
                </h2>
                <p className="text-xs text-hotel-secondary mt-0.5">
                  {language === 'fr'
                    ? 'Organisez les catégories de la carte, leur ordre d’affichage et leur visibilité.'
                    : 'Organize menu categories, display order, and public visibility.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddCategory}
                className="btn-gold text-xs py-2.5 px-4 font-semibold self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addCategoryTitle}</span>
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="py-16 text-center hotel-card p-8">
                <FolderTree className="w-10 h-10 text-hotel-muted mx-auto mb-3" />
                <h4 className="font-serif text-lg text-hotel-text font-semibold mb-1">
                  {language === 'fr' ? 'Aucune catégorie' : 'No categories'}
                </h4>
                <button
                  type="button"
                  onClick={handleOpenAddCategory}
                  className="mt-4 btn-gold text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addCategoryTitle}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => {
                  const itemsCount = menuItems.filter(
                    (i) => i.category_id === cat.id
                  ).length;
                  const parentCat = cat.parent_id
                    ? categories.find((c) => c.id === cat.parent_id)
                    : null;
                  const childCategories = categories.filter((c) => c.parent_id === cat.id);

                  return (
                    <div
                      key={cat.id}
                      className={`hotel-card p-5 flex flex-col justify-between bg-white ${
                        cat.parent_id ? 'border-l-4 border-l-[#9A721C]' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 pb-3 border-b border-hotel-border">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-mono text-hotel-secondary font-medium px-2 py-0.5 rounded bg-hotel-subtle border border-hotel-border">
                                #{cat.sort_order ?? 0}
                              </span>
                              {parentCat ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-[#9A721C] border border-[#E5D099]">
                                  {language === 'fr' ? 'Sous-catégorie de' : 'Subcategory of'}{' '}
                                  {parentCat.name_fr}
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                                  {t.noParentCategory}
                                  {childCategories.length > 0 &&
                                    ` (${childCategories.length} ${t.subcategories.toLowerCase()})`}
                                </span>
                              )}
                            </div>
                            <h4 className="font-serif font-semibold text-lg text-hotel-text mt-2">
                              {cat.name_fr}
                            </h4>
                            {cat.name_en && (
                              <p className="text-xs text-hotel-secondary">
                                EN : {cat.name_en}
                              </p>
                            )}
                          </div>

                          <span
                            className={
                              cat.is_active ? 'badge-paid' : 'badge-neutral'
                            }
                          >
                            {cat.is_active
                              ? t.categoryStatusActive
                              : t.categoryStatusInactive}
                          </span>
                        </div>

                        <div className="py-3 flex items-center justify-between text-xs text-hotel-secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#9A721C]" />
                            <span>
                              {itemsCount} {t.categoryItemsCount.toLowerCase()}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Structured 3-Button Action Footer */}
                      <div className="pt-3 border-t border-hotel-border grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCategoryActive(cat)}
                          className="btn-outline-gold py-1.5 px-2 text-xs justify-center"
                        >
                          {cat.is_active ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {language === 'fr' ? 'Masquer' : 'Hide'}
                              </span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span className="truncate">
                                {language === 'fr' ? 'Afficher' : 'Show'}
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditCategory(cat)}
                          className="btn-outline-gold py-1.5 px-2 text-xs justify-center"
                        >
                          <Edit className="w-3.5 h-3.5 shrink-0 text-[#9A721C]" />
                          <span className="truncate">{t.edit}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="py-1.5 px-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-medium inline-flex items-center justify-center gap-1 transition-colors"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t.delete}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Complements Management */}
        {activeTab === 'complements' && (
          <ComplementManager
            categories={categories}
            onRefresh={loadMenu}
            showToast={showToast}
          />
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
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-stone-900/45 backdrop-blur-[2px]"
            onClick={() => setIsItemModalOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-6 pb-safe z-10">
            <h3 className="font-serif text-xl font-semibold text-hotel-text pb-3 border-b border-hotel-border">
              {editingItem ? t.editItemTitle : t.addItemTitle}
            </h3>

            {itemSaveError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
                {itemSaveError}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.itemNameFr} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={itemNameFr}
                  onChange={(e) => setItemNameFr(e.target.value)}
                  className="input-hotel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.itemNameEn}
                </label>
                <input
                  type="text"
                  value={itemNameEn}
                  onChange={(e) => setItemNameEn(e.target.value)}
                  className="input-hotel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.itemDescriptionFr}
                </label>
                <textarea
                  rows={2}
                  value={itemDescriptionFr}
                  onChange={(e) => setItemDescriptionFr(e.target.value)}
                  placeholder={t.itemDescriptionPlaceholder}
                  className="input-hotel resize-none leading-relaxed text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.itemDescriptionEn}
                </label>
                <textarea
                  rows={2}
                  value={itemDescriptionEn}
                  onChange={(e) => setItemDescriptionEn(e.target.value)}
                  placeholder="Ingredients, flavors, main sides..."
                  className="input-hotel resize-none leading-relaxed text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                    {t.itemType}
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as 'dish' | 'drink')}
                    className="input-hotel"
                  >
                    <option value="dish">{t.dish}</option>
                    <option value="drink">{t.drink}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                    {t.itemCategory}
                  </label>
                  <select
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                    className="input-hotel"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parent_id ? `↳ ${c.name_fr}` : c.name_fr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                    {t.itemPrice}{' '}
                    {itemHasVariants ? (
                      <span className="font-normal text-hotel-secondary">
                        ({language === 'fr' ? 'facultatif si variantes tarifées' : 'optional if variants priced'})
                      </span>
                    ) : (
                      <span className="text-red-600">*</span>
                    )}
                  </label>
                  <input
                    type="number"
                    required={!itemHasVariants}
                    min={0}
                    step={1}
                    value={itemPrice || ''}
                    onChange={(e) => setItemPrice(Math.round(Number(e.target.value) || 0))}
                    placeholder={itemHasVariants ? (language === 'fr' ? 'Prix de base facultatif' : 'Optional base price') : '0'}
                    className="input-hotel font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                    {language === 'fr'
                      ? 'Temps de préparation (min, facultatif)'
                      : 'Prep time (min, optional)'}
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-[#9A721C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      min={0}
                      max={300}
                      step={1}
                      value={itemPrepTimeMinutes}
                      onChange={(e) => setItemPrepTimeMinutes(e.target.value)}
                      placeholder={language === 'fr' ? 'Ex: 20' : 'e.g. 20'}
                      className="input-hotel pl-9 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Product Variants Configuration */}
              <ItemVariantManager
                hasVariants={itemHasVariants}
                onHasVariantsChange={setItemHasVariants}
                variants={itemVariants}
                onVariantsChange={setItemVariants}
                basePrice={itemPrice}
              />

              {/* ImgBB Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.itemImage}
                </label>

                {imageUploadError && (
                  <p className="text-xs text-red-600 mb-1.5">{imageUploadError}</p>
                )}

                <div className="flex items-center gap-3">
                  <label className="btn-outline-gold text-xs cursor-pointer py-2 px-3.5">
                    {isUploadingImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-[#9A721C]" />
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
                    <span className="text-xs text-emerald-700 font-semibold truncate max-w-xs">
                      {t.imageUploadedSuccess}
                    </span>
                  )}
                </div>

                {itemImageUrl && (
                  <div className="mt-2.5 flex items-center gap-3">
                    <img
                      src={itemImageUrl}
                      alt="Aperçu"
                      className="w-14 h-14 rounded-lg object-cover border border-hotel-border"
                    />
                    <button
                      type="button"
                      onClick={() => setItemImageUrl('')}
                      className="text-xs text-red-600 hover:underline font-medium"
                    >
                      {t.removeImage}
                    </button>
                  </div>
                )}
              </div>

              {/* Immediate Availability Switch */}
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="availCheck"
                  checked={itemAvailable}
                  onChange={(e) => setItemAvailable(e.target.checked)}
                  className="rounded border-hotel-borderStrong text-[#9A721C] focus:ring-[#9A721C]"
                />
                <label
                  htmlFor="availCheck"
                  className="text-xs text-hotel-text font-medium cursor-pointer"
                >
                  {t.itemAvailability}
                </label>
              </div>

              <div className="pt-3 border-t border-hotel-border flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="btn-outline-gold flex-1 text-xs py-2.5"
                >
                  {t.cancel}
                </button>
                <button type="submit" className="flex-1 btn-gold py-2.5 text-xs font-semibold">
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-stone-900/45 backdrop-blur-[2px]"
            onClick={() => {
              setIsCategoryModalOpen(false);
              setEditingCategory(null);
            }}
          />
          <div className="relative w-full max-w-md max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-6 pb-safe z-10">
            <h3 className="font-serif text-xl font-semibold text-hotel-text pb-3 border-b border-hotel-border">
              {editingCategory ? t.editCategoryTitle : t.addCategoryTitle}
            </h3>

            {categoryError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
                {categoryError}
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.categoryNameFr} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={categoryNameFr}
                  onChange={(e) => setCategoryNameFr(e.target.value)}
                  className="input-hotel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.categoryNameEn}
                </label>
                <input
                  type="text"
                  value={categoryNameEn}
                  onChange={(e) => setCategoryNameEn(e.target.value)}
                  className="input-hotel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.parentCategory}
                </label>
                {(() => {
                  const hasChildren = editingCategory
                    ? categories.some((c) => c.parent_id === editingCategory.id)
                    : false;

                  if (hasChildren) {
                    return (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-[#E5D099] text-xs text-amber-900">
                        {language === 'fr'
                          ? 'Cette catégorie possède des sous-catégories et doit rester une catégorie principale.'
                          : 'This category has subcategories and must remain a root category.'}
                      </div>
                    );
                  }

                  const eligibleParents = categories.filter(
                    (c) => !c.parent_id && (!editingCategory || c.id !== editingCategory.id)
                  );

                  return (
                    <select
                      value={categoryParentId || ''}
                      onChange={(e) => setCategoryParentId(e.target.value || null)}
                      className="input-hotel"
                    >
                      <option value="">{t.noParentCategory}</option>
                      {eligibleParents.map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.name_fr} {parent.name_en ? `(${parent.name_en})` : ''}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.categorySortOrder}
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={categorySortOrder}
                  onChange={(e) =>
                    setCategorySortOrder(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="input-hotel font-mono"
                />
              </div>

              {editingCategory && (
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="catActiveCheck"
                    checked={categoryIsActive}
                    onChange={(e) => setCategoryIsActive(e.target.checked)}
                    className="rounded border-hotel-borderStrong text-[#9A721C] focus:ring-[#9A721C]"
                  />
                  <label
                    htmlFor="catActiveCheck"
                    className="text-xs text-hotel-text font-medium cursor-pointer"
                  >
                    {t.categoryActiveLabel}
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-hotel-border flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setEditingCategory(null);
                  }}
                  className="btn-outline-gold flex-1 text-xs py-2.5"
                >
                  {t.cancel}
                </button>
                <button type="submit" className="flex-1 btn-gold py-2.5 text-xs font-semibold">
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISH IMAGE PREVIEW MODAL */}
      {previewMenuItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-stone-950/75"
            onClick={() => setPreviewMenuItem(null)}
          />
          <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl border border-hotel-border shadow-elevated overflow-hidden animate-fade-in">
            <button
              type="button"
              onClick={() => setPreviewMenuItem(null)}
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white text-hotel-text border border-hotel-border shadow-md flex items-center justify-center hover:bg-[#FAF6EE]"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="relative w-full aspect-4/3 sm:aspect-16/10 bg-[#1C1917] flex items-center justify-center overflow-hidden">
              {previewMenuItem.image_url ? (
                <img
                  src={previewMenuItem.image_url}
                  alt={previewMenuItem.name_fr}
                  className="w-full h-full object-contain max-h-[65vh]"
                />
              ) : (
                <Utensils className="w-12 h-12 text-[#D4AF37]" />
              )}
            </div>
            <div className="p-4 sm:p-5 bg-white border-t border-hotel-border flex items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg font-semibold text-hotel-text">
                  {previewMenuItem.name_fr}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono font-bold text-[#9A721C] text-sm">
                    {previewMenuItem.price !== null && previewMenuItem.price !== undefined
                      ? formatXAF(previewMenuItem.price)
                      : previewMenuItem.variants && previewMenuItem.variants.length > 0
                      ? `${t.startingFrom} ${formatXAF(Math.min(...previewMenuItem.variants.map((v) => v.price ?? 0)))}`
                      : '—'}
                  </span>
                  {typeof previewMenuItem.preparation_time_minutes === 'number' &&
                    previewMenuItem.preparation_time_minutes > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FAF6EE] border border-[#D8C79A] text-[#8A6214] text-xs font-semibold">
                        <Clock className="w-3 h-3" />
                        {previewMenuItem.preparation_time_minutes} min
                      </span>
                    )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMenuItem(null)}
                className="btn-outline-gold text-xs py-2 px-4"
              >
                {language === 'fr' ? 'Fermer' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal for category deletion */}
      <ConfirmationModal
        isOpen={categoryToDelete !== null}
        variant="danger"
        title={language === 'fr' ? 'Supprimer la catégorie' : 'Delete Category'}
        message={
          language === 'fr'
            ? `Voulez-vous vraiment supprimer la catégorie "${categoryToDelete?.name_fr}" ? Cette action est irréversible.`
            : `Are you sure you want to delete the category "${categoryToDelete?.name_en || categoryToDelete?.name_fr}"? This action cannot be undone.`
        }
        confirmLabel={language === 'fr' ? 'Supprimer' : 'Delete'}
        cancelLabel={language === 'fr' ? 'Annuler' : 'Cancel'}
        onConfirm={executeDeleteCategory}
        onClose={() => setCategoryToDelete(null)}
      />

      {/* Confirmation modal for menu item deletion */}
      <ConfirmationModal
        isOpen={itemToDelete !== null}
        variant="danger"
        title={language === 'fr' ? 'Supprimer le plat' : 'Delete Menu Item'}
        message={
          language === 'fr'
            ? `Voulez-vous vraiment supprimer définitivement "${itemToDelete?.name_fr}" du menu ? Cette action est irréversible.`
            : `Are you sure you want to permanently delete "${itemToDelete?.name_en || itemToDelete?.name_fr}" from the menu? This action cannot be undone.`
        }
        confirmLabel={language === 'fr' ? 'Supprimer' : 'Delete'}
        cancelLabel={language === 'fr' ? 'Annuler' : 'Cancel'}
        onConfirm={executeDeleteMenuItem}
        onClose={() => setItemToDelete(null)}
      />
    </div>
  );
};


