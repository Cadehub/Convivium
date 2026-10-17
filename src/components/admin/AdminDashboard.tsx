import React, { useState, useEffect } from 'react';
import {
  Shield,
  CreditCard,
  Users,
  ClipboardList,
  LogOut,
  RefreshCw,
  Search,
  Plus,
  Sliders,
  Utensils,
  FolderTree,
  Layers,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  Loader2,
  X,
  CheckCircle2,
  FileText,
  History,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  XCircle,
  ChefHat,
  ArrowRight,
  Activity,
  Download,
  Printer,
  AlertTriangle,
  Clock,
  ZoomIn,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ordersService } from '../../services/orders.service';
import { settingsService } from '../../services/settings.service';
import { staffService } from '../../services/staff.service';
import { menuService } from '../../services/menu.service';
import { uploadImageToImgBB } from '../../lib/imgbb';
import { PaymentVerificationCard } from '../kitchen/PaymentVerificationCard';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { StaffNotificationButton } from '../common/NotificationSettings';
import { ComplementManager } from '../menu/ComplementManager';
import { ItemVariantManager } from '../menu/ItemVariantManager';
import { supabase } from '../../lib/supabase';
import { subscribeToLiveSyncEvents } from '../../lib/realtime';
import type {
  Order,
  PaymentMethodSetting,
  RestaurantSettings,
  StaffProfile,
  AuditLogEntry,
  MenuCategory,
  MenuItem,
  MenuItemVariant,
  PaymentStatus,
  PreparationStatus,
} from '../../types';
import { formatXAF, formatDateTime } from '../../lib/formatters';

type AdminSection = 'orders' | 'menu' | 'payments' | 'staff' | 'modes' | 'audit';

export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { profile } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<AdminSection>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<
    'all' | 'payment_declared' | 'paid' | 'payment_rejected'
  >('all');
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);

  // Admin Orders Report & Clear History State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [clearHistoryScope, setClearHistoryScope] = useState<'completed' | 'all'>('completed');
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [clearHistoryError, setClearHistoryError] = useState<string | null>(null);

  // Payment Settings
  const [paymentSettings, setPaymentSettings] = useState<PaymentMethodSetting[]>([]);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Restaurant Settings
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings | null>(
    null
  );
  const [deliveryFeeInput, setDeliveryFeeInput] = useState<string>('');
  const [isSavingDeliveryFee, setIsSavingDeliveryFee] = useState<boolean>(false);

  // Staff Profiles
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [newCuisineId, setNewCuisineId] = useState('');
  const [newCuisineName, setNewCuisineName] = useState('');

  // Audit Logs & Filtering/Pagination State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<
    'all' | 'payments' | 'orders' | 'catalog' | 'settings'
  >('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditPage, setAuditPage] = useState<number>(1);

  // Menu & Categories State
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [adminMenuPage, setAdminMenuPage] = useState<number>(1);
  const [menuSubTab, setMenuSubTab] = useState<'items' | 'categories' | 'complements'>('items');
  const [previewMenuItem, setPreviewMenuItem] = useState<MenuItem | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<MenuCategory | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
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

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryNameFr, setCategoryNameFr] = useState('');
  const [categoryNameEn, setCategoryNameEn] = useState('');
  const [categoryParentId, setCategoryParentId] = useState<string | null>(null);
  const [categorySortOrder, setCategorySortOrder] = useState<number>(0);
  const [categoryIsActive, setCategoryIsActive] = useState<boolean>(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => {
      setStatusFeedback((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const refreshAuditLogsSilent = async () => {
    try {
      const logs = await settingsService.getAuditLogs(150);
      setAuditLogs(logs);
    } catch (e) {
      console.error('Error refreshing audit logs', e);
    }
  };

  const refreshOrdersSilent = async () => {
    try {
      const [allOrders, logs] = await Promise.all([
        ordersService.getStaffOrders(),
        settingsService.getAuditLogs(150),
      ]);
      setOrders(allOrders);
      setAuditLogs(logs);
      setInspectingOrder((prev) =>
        prev ? allOrders.find((o) => o.id === prev.id) || prev : null
      );
    } catch (e) {
      console.error('Error refreshing admin orders', e);
    }
  };

  const refreshMenuSilent = async () => {
    try {
      const [cats, items, logs] = await Promise.all([
        menuService.getAllCategories(),
        menuService.getAllMenuItems(),
        settingsService.getAuditLogs(150),
      ]);
      setCategories(cats);
      setMenuItems(items);
      setAuditLogs(logs);
      if (cats.length > 0 && !itemCategoryId) {
        setItemCategoryId(cats[0].id);
      }
    } catch (e) {
      console.error('Error refreshing admin menu', e);
    }
  };

  const loadData = async (preserveInputs = false) => {
    try {
      const [allOrders, paySettings, restSettings, staffList, logs, cats, items] =
        await Promise.all([
          ordersService.getStaffOrders(),
          settingsService.getAdminPaymentSettings(),
          settingsService.getRestaurantSettings(),
          staffService.getAllStaffProfiles(),
          settingsService.getAuditLogs(150),
          menuService.getAllCategories(),
          menuService.getAllMenuItems(),
        ]);
      setOrders(allOrders);
      setInspectingOrder((prev) =>
        prev ? allOrders.find((o) => o.id === prev.id) || prev : null
      );
      setPaymentSettings(paySettings);
      setRestaurantSettings(restSettings);
      if (!preserveInputs) {
        setDeliveryFeeInput(
          restSettings?.delivery_fee && restSettings.delivery_fee > 0
            ? String(restSettings.delivery_fee)
            : ''
        );
      }
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
    loadData(false);

    const adminRealtimeChannel = supabase
      .channel('admin_dashboard_orders_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          refreshOrdersSilent();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_declarations' },
        () => {
          refreshOrdersSilent();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_verifications' },
        () => {
          refreshOrdersSilent();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_logs' },
        () => {
          refreshAuditLogsSilent();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => {
          refreshMenuSilent();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_categories' },
        () => {
          refreshMenuSilent();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_settings' },
        () => {
          refreshAuditLogsSilent();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_settings' },
        () => {
          refreshAuditLogsSilent();
        }
      )
      .subscribe();

    const unsubscribeLive = subscribeToLiveSyncEvents((evt) => {
      if (evt.type === 'catalog_updated') {
        refreshMenuSilent();
      } else {
        refreshOrdersSilent();
      }
    });

    return () => {
      unsubscribeLive();
      supabase.removeChannel(adminRealtimeChannel);
    };
  }, []);

  // Category Handlers (Admin)
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
      await refreshMenuSilent();
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
      await refreshMenuSilent();
    } catch (err: unknown) {
      await refreshMenuSilent();
      showToast(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  const handleDeleteCategory = (cat: MenuCategory) => {
    const childCategories = categories.filter((c) => c.parent_id === cat.id);
    if (childCategories.length > 0) {
      showToast(
        language === 'fr'
          ? `Impossible de supprimer "${cat.name_fr}" : ${childCategories.length} sous-catégorie(s) y sont rattachées.`
          : `Cannot delete "${cat.name_en || cat.name_fr}": ${childCategories.length} subcategory/ies attached.`
      );
      return;
    }

    const itemsInCat = menuItems.filter((i) => i.category_id === cat.id);
    if (itemsInCat.length > 0) {
      showToast(
        language === 'fr'
          ? `Impossible de supprimer "${cat.name_fr}" : ${itemsInCat.length} article(s) y sont rattachés.`
          : `Cannot delete "${cat.name_en || cat.name_fr}": ${itemsInCat.length} item(s) are attached.`
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
      await refreshMenuSilent();
      showToast(language === 'fr' ? 'Catégorie supprimée.' : 'Category deleted.');
    } catch (err: unknown) {
      await refreshMenuSilent();
      showToast(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  const executeDeleteMenuItem = async () => {
    if (!itemToDelete) return;
    const itemId = itemToDelete.id;
    setItemToDelete(null);
    setMenuItems((prev) => prev.filter((m) => m.id !== itemId));
    try {
      await menuService.deleteMenuItem(itemId);
      await refreshMenuSilent();
    } catch (err: unknown) {
      await refreshMenuSilent();
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

    const parsedPrepTime =
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
          preparation_time_minutes: parsedPrepTime,
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
          preparation_time_minutes: parsedPrepTime,
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
      await refreshMenuSilent();
      showToast(language === 'fr' ? 'Article enregistré.' : 'Item saved.');
    } catch (err: unknown) {
      setItemSaveError(err instanceof Error ? err.message : t.errorGeneral);
    }
  };

  // Admin Only: Export Orders Report CSV, Print PDF Report, Clear History
  const getOrderDestinationText = (o: Order) => {
    if (o.order_mode === 'room_service') {
      return `${language === 'fr' ? 'Service en chambre' : 'Room Service'} - ${
        language === 'fr' ? 'Chambre' : 'Room'
      } ${o.room_number || '-'}`;
    }
    if (o.order_mode === 'dine_in') {
      return `${language === 'fr' ? 'Sur place' : 'Dine-in'} - Table ${
        o.table_number || '-'
      }`;
    }
    const schedText =
      o.delivery_schedule_type === 'scheduled' && o.scheduled_delivery_time
        ? ` (${language === 'fr' ? 'Heure' : 'Time'}: ${o.scheduled_delivery_time})`
        : ` (${language === 'fr' ? 'Immédiate' : 'Instant'})`;
    return `${language === 'fr' ? 'Livraison' : 'Delivery'} - ${
      o.delivery_address || '-'
    }${schedText}`;
  };

  const handleExportOrdersCsv = () => {
    if (orders.length === 0) return;

    const headers = [
      'Reference',
      'Date',
      'Client',
      'Telephone',
      'Mode et Lieu de service',
      'Horaire Livraison',
      'Articles',
      'Montant Total (XAF)',
      'Reseau Mobile Money',
      'Statut Paiement',
      'Statut Preparation',
      'Reference Transaction Declaree',
    ];

    const escapeCsv = (val: string | number | null | undefined) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = orders.map((o) => {
      const itemsSummary = (o.order_items || o.items || [])
        .map((i) => `${i.quantity}x ${i.item_name} (${i.unit_price} XAF)`)
        .join(' | ');
      const latestDecl =
        o.payment_declarations && o.payment_declarations.length > 0
          ? o.payment_declarations[o.payment_declarations.length - 1]
          : null;

      const scheduleLabel =
        o.order_mode === 'delivery'
          ? o.delivery_schedule_type === 'scheduled' && o.scheduled_delivery_time
            ? `Heure choisie : ${o.scheduled_delivery_time}`
            : 'Livraison immédiate'
          : 'Standard';

      return [
        escapeCsv(o.public_reference),
        escapeCsv(formatDateTime(o.created_at, language)),
        escapeCsv(o.customer_name),
        escapeCsv(o.customer_phone || ''),
        escapeCsv(getOrderDestinationText(o)),
        escapeCsv(scheduleLabel),
        escapeCsv(itemsSummary),
        escapeCsv(o.total_amount),
        escapeCsv(
          latestDecl?.operator === 'orange'
            ? 'Orange Money'
            : latestDecl?.operator === 'mtn'
              ? 'MTN MoMo'
              : 'Mobile Money'
        ),
        escapeCsv(o.payment_status),
        escapeCsv(o.preparation_status),
        escapeCsv(latestDecl?.declared_reference || ''),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `convivium-rapport-commandes-${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintOrdersReport = () => {
    if (orders.length === 0) return;

    const paidList = orders.filter((o) => o.payment_status === 'paid');
    const paidRev = paidList.reduce((acc, o) => acc + o.total_amount, 0);

    const rowsHtml = orders
      .map((o) => {
        const itemsText = (o.order_items || o.items || [])
          .map((i) => `${i.quantity}× ${i.item_name}`)
          .join(', ');
        return `
          <tr>
            <td style="font-family:monospace;font-weight:700;">${o.public_reference}</td>
            <td>${formatDateTime(o.created_at, language)}</td>
            <td><strong>${o.customer_name}</strong><br/><span style="color:#57534e;font-size:11px;">${o.customer_phone || ''}</span></td>
            <td><strong>${getOrderDestinationText(o)}</strong></td>
            <td>${itemsText}</td>
            <td style="font-family:monospace;font-weight:700;">${formatXAF(o.total_amount)}</td>
            <td>${o.payment_status}</td>
            <td>${o.preparation_status}</td>
          </tr>
        `;
      })
      .join('');

    const printWindow = window.open('', '_blank', 'width=1050,height=800');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${language}">
        <head>
          <meta charset="utf-8" />
          <title>Rapport Officiel des Commandes — Convivium Home Hotel</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #1c1917; background: #ffffff; padding: 28px; }
            h1 { font-size: 20px; margin: 0 0 4px 0; }
            p.sub { color: #57534e; font-size: 12px; margin: 0 0 18px 0; }
            .summary { display: flex; gap: 16px; margin-bottom: 20px; }
            .card { background: #FAF6EE; border: 1px solid #D8C79A; border-radius: 8px; padding: 12px 16px; }
            .card span { display: block; font-size: 11px; color: #57534e; text-transform: uppercase; font-weight: 700; }
            .card strong { font-size: 18px; color: #8A6214; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; background: #ffffff; }
            th, td { border: 1px solid #d6d3d1; padding: 8px 10px; text-align: left; vertical-align: top; }
            th { background: #FAF6EE; font-size: 11px; text-transform: uppercase; color: #44403c; }
          </style>
        </head>
        <body>
          <h1>Convivium Home Hotel — Rapport Direction des Commandes</h1>
          <p class="sub">Généré le ${formatDateTime(new Date().toISOString(), language)}</p>
          <div class="summary">
            <div class="card">
              <span>Total Commandes</span>
              <strong>${orders.length}</strong>
            </div>
            <div class="card">
              <span>Commandes Payées</span>
              <strong>${paidList.length}</strong>
            </div>
            <div class="card">
              <span>Recettes Confirmées</span>
              <strong>${formatXAF(paidRev)}</strong>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Réf</th>
                <th>Date</th>
                <th>Client</th>
                <th>Lieu & Mode de service</th>
                <th>Articles</th>
                <th>Total</th>
                <th>Paiement</th>
                <th>Préparation</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleClearOrdersHistory = async () => {
    setClearHistoryError(null);
    setIsClearingHistory(true);
    try {
      const onlyCompleted = clearHistoryScope === 'completed';
      await ordersService.clearOrdersHistory(clearHistoryScope);
      if (onlyCompleted) {
        setOrders((prev) =>
          prev.filter(
            (o) =>
              o.preparation_status !== 'completed' &&
              o.preparation_status !== 'cancelled' &&
              o.payment_status !== 'payment_rejected'
          )
        );
      } else {
        setOrders([]);
      }
      setIsClearHistoryModalOpen(false);
      await refreshOrdersSilent();
      showToast(
        language === 'fr'
          ? 'Historique des commandes purgé avec succès.'
          : 'Orders history cleared successfully.'
      );
    } catch (err: unknown) {
      setClearHistoryError(
        err instanceof Error ? err.message : t.errorGeneral
      );
    } finally {
      setIsClearingHistory(false);
    }
  };

  // Update Payment Setting handler
  const handleSavePaymentSetting = async (
    id: 'mtn' | 'orange',
    updates: Partial<PaymentMethodSetting>
  ) => {
    setPaymentSettings((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    try {
      await settingsService.updatePaymentSetting(id, updates);
      await loadData(true);
      showToast(
        language === 'fr'
          ? 'Configuration Mobile Money mise à jour.'
          : 'Mobile Money settings updated.'
      );
    } catch (e) {
      await loadData(true);
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
      showToast(
        language === 'fr'
          ? 'Mode de commande mis à jour.'
          : 'Order mode updated.'
      );
    } catch (e) {
      alert('Erreur lors de la mise à jour du mode.');
    }
  };

  // Save or Clear Delivery Fee
  const handleSaveDeliveryFee = async (fee: number | null) => {
    if (!restaurantSettings) return;
    setIsSavingDeliveryFee(true);
    const normalizedFee = fee !== null && fee > 0 ? Math.round(fee) : null;
    try {
      await settingsService.updateRestaurantSettings({
        delivery_fee: normalizedFee,
      });
      setRestaurantSettings({
        ...restaurantSettings,
        delivery_fee: normalizedFee,
      });
      setDeliveryFeeInput(normalizedFee ? String(normalizedFee) : '');
      showToast(
        normalizedFee
          ? language === 'fr'
            ? `Frais de livraison définis : ${formatXAF(normalizedFee)}.`
            : `Delivery fee set: ${formatXAF(normalizedFee)}.`
          : language === 'fr'
          ? 'Frais de livraison retirés (aucun frais affiché côté client).'
          : 'Delivery fee cleared (no fee displayed to clients).'
      );
    } catch (e) {
      alert(
        language === 'fr'
          ? 'Erreur lors de la mise à jour des frais de livraison.'
          : 'Error updating delivery fee.'
      );
    } finally {
      setIsSavingDeliveryFee(false);
    }
  };

  // Toggle Staff status
  const handleToggleStaff = async (staffId: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    setStaffProfiles((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, is_active: nextActive } : s))
    );
    try {
      await staffService.toggleStaffStatus(staffId, nextActive);
      await loadData(true);
      showToast(
        language === 'fr' ? 'Statut du compte mis à jour.' : 'Account status updated.'
      );
    } catch (e) {
      await loadData(true);
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
      await loadData(true);
      showToast(
        language === 'fr' ? 'Compte Cuisine ajouté.' : 'Kitchen account added.'
      );
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la création');
    }
  };

  // Real Metrics Calculation (strictly zero fake figures)
  const paidOrders = orders.filter((o) => o.payment_status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const pendingVerificationsCount = orders.filter(
    (o) => o.payment_status === 'payment_declared'
  ).length;

  const filteredOrders = orders.filter((o) => {
    if (orderPaymentFilter !== 'all' && o.payment_status !== orderPaymentFilter) {
      return false;
    }
    if (!orderSearch.trim()) return true;
    const s = orderSearch.toLowerCase();
    return (
      o.public_reference.toLowerCase().includes(s) ||
      o.customer_name.toLowerCase().includes(s) ||
      (o.customer_phone ? o.customer_phone.toLowerCase().includes(s) : false)
    );
  });

  const getPaymentBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return {
          label: language === 'fr' ? 'Confirmé (Cuisine)' : 'Confirmed (Kitchen)',
          className: 'badge-paid',
        };
      case 'payment_declared':
        return {
          label: language === 'fr' ? 'Déclaré — À vérifier' : 'Declared — Pending',
          className: 'badge-pending',
        };
      case 'payment_rejected':
        return {
          label: language === 'fr' ? 'Rejeté' : 'Rejected',
          className: 'badge-rejected',
        };
      case 'payment_review_required':
        return {
          label: language === 'fr' ? 'À vérifier' : 'Under review',
          className: 'badge-pending',
        };
      case 'awaiting_payment':
      default:
        return {
          label: language === 'fr' ? 'En attente' : 'Awaiting payment',
          className: 'badge-neutral',
        };
    }
  };

  const getPrepBadge = (status: PreparationStatus) => {
    switch (status) {
      case 'ready':
        return { label: t.statusReady, className: 'badge-paid' };
      case 'preparing':
        return { label: t.statusPreparing, className: 'badge-info' };
      case 'accepted':
        return { label: t.statusAccepted, className: 'badge-info' };
      case 'completed':
        return { label: t.statusCompleted, className: 'badge-paid' };
      case 'cancelled':
        return { label: t.statusCancelled, className: 'badge-rejected' };
      case 'new':
      default:
        return { label: t.statusNew, className: 'badge-neutral' };
    }
  };

  const getModeLabel = (o: Order) => {
    if (o.order_mode === 'dine_in') {
      return `${t.modeDineIn}${o.table_number ? ` (${o.table_number})` : ''}`;
    }
    if (o.order_mode === 'room_service') {
      return `${t.modeRoomService}${o.room_number ? ` (${o.room_number})` : ''}`;
    }
    if (o.order_mode === 'delivery') {
      const schedInfo =
        o.delivery_schedule_type === 'scheduled' && o.scheduled_delivery_time
          ? ` • ${language === 'fr' ? 'Heure' : 'Time'}: ${o.scheduled_delivery_time}`
          : ` • ${language === 'fr' ? 'Immédiate' : 'Instant'}`;
      return `${t.modeDelivery}${o.delivery_address ? ` (${o.delivery_address})` : ''}${schedInfo}`;
    }
    return o.order_mode;
  };

  // Section Hierarchy per specification
  const navItems: {
    id: AdminSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    {
      id: 'orders',
      label: language === 'fr' ? 'Suivi des commandes' : 'Orders Tracking',
      icon: ClipboardList,
      badge: orders.length,
    },
    {
      id: 'menu',
      label: language === 'fr' ? 'Menu & Catégories' : 'Menu & Categories',
      icon: Utensils,
      badge: menuItems.length,
    },
    {
      id: 'payments',
      label: language === 'fr' ? 'Moyens de paiement' : 'Payment Methods',
      icon: CreditCard,
    },
    {
      id: 'staff',
      label: language === 'fr' ? 'Comptes Cuisine' : 'Kitchen Staff',
      icon: Users,
      badge: staffProfiles.filter((s) => s.role === 'cuisine').length,
    },
    {
      id: 'modes',
      label: language === 'fr' ? 'Modes de commande' : 'Order Modes',
      icon: Sliders,
    },
    {
      id: 'audit',
      label: language === 'fr' ? 'Journal d’audit' : 'Audit Trail',
      icon: History,
    },
  ];

  return (
    <div className="min-h-screen bg-hotel-bg text-hotel-text flex flex-col lg:flex-row">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-hotel-border z-30">
        {/* Brand Header */}
        <div className="p-5 border-b border-hotel-border flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Convivium Home Hotel"
            className="w-10 h-10 rounded-full object-cover border border-stone-200 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-serif text-lg font-semibold text-hotel-text truncate leading-none">
              Convivium
            </h1>
            <span className="text-[10px] uppercase tracking-[0.16em] text-[#9A721C] font-semibold block mt-1">
              {t.adminTitle}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-hotel-dark text-white font-semibold shadow-subtle'
                    : 'text-hotel-secondary hover:text-hotel-text hover:bg-hotel-subtle/70'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-[#C59B27]' : 'text-hotel-muted'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {typeof item.badge === 'number' && (
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-hotel-subtle text-hotel-muted'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: User Profile, Language & Logout */}
        <div className="p-4 border-t border-hotel-border space-y-3 bg-[#FAF8F5]">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-hotel-text truncate">
                {profile?.full_name || 'Direction'}
              </p>
              <p className="text-[11px] text-hotel-muted flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#9A721C]" />
                <span>Admin</span>
              </p>
            </div>

            <div className="inline-flex items-center rounded-lg border border-hotel-border bg-white p-0.5 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setLanguage('fr')}
                className={`px-2 py-0.5 rounded ${
                  language === 'fr'
                    ? 'bg-hotel-dark text-white font-semibold'
                    : 'text-hotel-muted'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 rounded ${
                  language === 'en'
                    ? 'bg-hotel-dark text-white font-semibold'
                    : 'text-hotel-muted'
                }`}
              >
                EN
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StaffNotificationButton placement="up" />
            <button
              type="button"
              onClick={() => loadData(true)}
              className="btn-outline-gold flex-1 py-2 px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t.refresh}</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="btn-outline-gold py-2 px-3 text-xs text-red-700 hover:bg-red-50 hover:border-red-200"
              title={t.logoutButton}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER & NAVIGATION */}
      <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-hotel-border">
        <div className="px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.jpg"
              alt="Convivium Home Hotel"
              className="w-9 h-9 rounded-full object-cover border border-stone-200"
            />
            <div>
              <span className="font-serif font-semibold text-base text-hotel-text block leading-none">
                {t.adminTitle}
              </span>
              <span className="text-[11px] text-hotel-secondary">
                Convivium Home Hotel
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-hotel-border bg-hotel-subtle/60 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLanguage('fr')}
                className={`px-2 py-1 rounded-md ${
                  language === 'fr' ? 'bg-white font-semibold shadow-subtle' : 'text-hotel-muted'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-md ${
                  language === 'en' ? 'bg-white font-semibold shadow-subtle' : 'text-hotel-muted'
                }`}
              >
                EN
              </button>
            </div>

            <StaffNotificationButton />

            <button
              type="button"
              onClick={() => loadData(true)}
              className="btn-outline-gold p-2 text-xs"
              title={t.refresh}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="btn-outline-gold p-2 text-xs text-red-700"
              title={t.logoutButton}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Section Bar */}
        <div className="px-4 py-2.5 bg-[#FAF8F5] border-t border-hotel-border flex items-center gap-2 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-hotel-dark text-white font-semibold shadow-subtle'
                    : 'bg-white text-hotel-secondary border border-hotel-border'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 lg:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* Status Toast Banner */}
          {statusFeedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2 shadow-subtle">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusFeedback}</span>
            </div>
          )}

          {/* SECTION 1: ORDERS TRACKING & REAL-TIME SUMMARY */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-hotel-border shadow-subtle">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-serif text-2xl font-semibold text-hotel-text">
                      {language === 'fr' ? 'Suivi des commandes & Rapports' : 'Orders Tracking & Reports'}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#FAF6EE] border border-[#D8C79A] text-[#8A6214] text-[10px] font-bold uppercase tracking-wider">
                      Admin
                    </span>
                  </div>
                  <p className="text-xs text-hotel-secondary mt-0.5">
                    {language === 'fr'
                      ? 'Vue consolidée en temps réel, rapports financiers et exports réservés à la Direction.'
                      : 'Consolidated real-time view, financial reports, and exports reserved for Management.'}
                  </p>
                </div>

                {/* Admin-Only Reports & History Actions (100% Solid Non-Transparent) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(true)}
                    className="btn-gold text-xs py-2.5 px-3.5 font-semibold"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>
                      {language === 'fr' ? 'Rapport financier' : 'Financial report'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportOrdersCsv}
                    disabled={orders.length === 0}
                    className="btn-outline-gold bg-white text-xs py-2.5 px-3.5 disabled:opacity-40"
                    title={
                      language === 'fr'
                        ? 'Exporter le rapport des commandes en CSV (Excel)'
                        : 'Export orders report to CSV (Excel)'
                    }
                  >
                    <Download className="w-3.5 h-3.5 text-[#9A721C]" />
                    <span>{language === 'fr' ? 'Exporter CSV' : 'Export CSV'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintOrdersReport}
                    disabled={orders.length === 0}
                    className="btn-outline-gold bg-white text-xs py-2.5 px-3.5 disabled:opacity-40"
                    title={
                      language === 'fr'
                        ? 'Imprimer ou enregistrer le rapport PDF des commandes'
                        : 'Print or save PDF report of orders'
                    }
                  >
                    <Printer className="w-3.5 h-3.5 text-hotel-secondary" />
                    <span>{language === 'fr' ? 'Rapport PDF' : 'PDF Report'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setClearHistoryError(null);
                      setIsClearHistoryModalOpen(true);
                    }}
                    disabled={orders.length === 0}
                    className="btn-outline-gold bg-white text-xs py-2.5 px-3.5 text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-40"
                    title={
                      language === 'fr'
                        ? 'Vider l’historique des commandes'
                        : 'Clear orders history'
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {language === 'fr' ? 'Vider l’historique' : 'Clear history'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Real-Time Operational Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="hotel-card p-5 bg-white">
                  <span className="text-xs font-medium text-hotel-secondary block">
                    {language === 'fr'
                      ? 'Recettes confirmées (Cuisine)'
                      : 'Confirmed revenue (Kitchen)'}
                  </span>
                  <div className="font-serif text-2xl sm:text-3xl font-bold text-hotel-text mt-1">
                    {formatXAF(totalRevenue)}
                  </div>
                  <p className="text-[11px] text-hotel-muted mt-1">
                    {paidOrders.length}{' '}
                    {language === 'fr' ? 'commandes réglées' : 'paid orders'}
                  </p>
                </div>

                <div className="hotel-card p-5 bg-white">
                  <span className="text-xs font-medium text-hotel-secondary block">
                    {language === 'fr' ? 'Total des commandes' : 'Total orders'}
                  </span>
                  <div className="font-serif text-2xl sm:text-3xl font-bold text-hotel-text mt-1">
                    {orders.length}
                  </div>
                  <p className="text-[11px] text-hotel-muted mt-1">
                    {language === 'fr'
                      ? 'Toutes les commandes enregistrées'
                      : 'All recorded orders'}
                  </p>
                </div>

                <div className="hotel-card p-5 bg-white">
                  <span className="text-xs font-medium text-hotel-secondary block">
                    {language === 'fr'
                      ? 'Déclarations en attente'
                      : 'Pending declarations'}
                  </span>
                  <div className="font-serif text-2xl sm:text-3xl font-bold text-amber-700 mt-1">
                    {pendingVerificationsCount}
                  </div>
                  <p className="text-[11px] text-hotel-muted mt-1">
                    {language === 'fr'
                      ? 'En attente de contrôle par la Cuisine'
                      : 'Awaiting Kitchen verification'}
                  </p>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 bg-white p-3.5 sm:p-4 rounded-xl border border-hotel-border shadow-subtle">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setOrderPaymentFilter('all')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      orderPaymentFilter === 'all'
                        ? 'bg-hotel-dark text-white font-semibold'
                        : 'bg-[#FAF8F5] border border-hotel-border text-hotel-secondary hover:text-hotel-text'
                    }`}
                  >
                    {t.all} ({orders.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderPaymentFilter('payment_declared')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                      orderPaymentFilter === 'payment_declared'
                        ? 'bg-amber-600 text-white font-semibold'
                        : pendingVerificationsCount > 0
                        ? 'bg-amber-50 border border-amber-300 text-amber-900 font-semibold'
                        : 'bg-[#FAF8F5] border border-hotel-border text-hotel-secondary hover:text-hotel-text'
                    }`}
                  >
                    <span>
                      {language === 'fr' ? 'À vérifier' : 'Pending verification'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-black/10">
                      {pendingVerificationsCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderPaymentFilter('paid')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                      orderPaymentFilter === 'paid'
                        ? 'bg-emerald-700 text-white font-semibold'
                        : 'bg-[#FAF8F5] border border-hotel-border text-hotel-secondary hover:text-hotel-text'
                    }`}
                  >
                    <span>{language === 'fr' ? 'Payées' : 'Paid'}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-black/10">
                      {paidOrders.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderPaymentFilter('payment_rejected')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                      orderPaymentFilter === 'payment_rejected'
                        ? 'bg-red-700 text-white font-semibold'
                        : 'bg-[#FAF8F5] border border-hotel-border text-hotel-secondary hover:text-hotel-text'
                    }`}
                  >
                    <span>{language === 'fr' ? 'Rejetées' : 'Rejected'}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-black/10">
                      {orders.filter((o) => o.payment_status === 'payment_rejected').length}
                    </span>
                  </button>
                </div>

                <div className="relative w-full lg:w-72 shrink-0">
                  <Search className="w-4 h-4 text-hotel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder={
                      language === 'fr'
                        ? 'Rechercher par référence, client, téléphone...'
                        : 'Search by reference, customer, phone...'
                    }
                    className="input-hotel pl-10 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block hotel-card overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] border-b border-hotel-border text-hotel-secondary uppercase font-semibold">
                      <tr>
                        <th className="py-3.5 px-4">
                          {language === 'fr' ? 'Référence' : 'Reference'}
                        </th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">
                          {language === 'fr' ? 'Client' : 'Customer'}
                        </th>
                        <th className="py-3.5 px-4">
                          {language === 'fr' ? 'Service & Horaire' : 'Service & Schedule'}
                        </th>
                        <th className="py-3.5 px-4">Total</th>
                        <th className="py-3.5 px-4">
                          {language === 'fr' ? 'Paiement' : 'Payment'}
                        </th>
                        <th className="py-3.5 px-4">
                          {language === 'fr' ? 'Cuisine' : 'Kitchen'}
                        </th>
                        <th className="py-3.5 px-4 text-right">
                          {language === 'fr' ? 'Dossier' : 'Record'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hotel-border bg-white">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-hotel-muted">
                            {language === 'fr'
                              ? 'Aucune commande trouvée.'
                              : 'No orders found.'}
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((o) => {
                          const pBadge = getPaymentBadge(o.payment_status);
                          const kBadge = getPrepBadge(o.preparation_status);
                          return (
                            <tr
                              key={o.id}
                              className="hover:bg-[#FAF8F5] transition-colors"
                            >
                              <td className="py-3.5 px-4 font-mono font-bold text-hotel-text">
                                {o.public_reference}
                              </td>
                              <td className="py-3.5 px-4 text-hotel-secondary whitespace-nowrap">
                                {formatDateTime(o.created_at, language)}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-semibold text-hotel-text block">
                                  {o.customer_name}
                                </span>
                                {o.customer_phone && (
                                  <span className="text-[11px] text-hotel-muted font-mono">
                                    {o.customer_phone}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-hotel-secondary">
                                {getModeLabel(o)}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-hotel-text whitespace-nowrap">
                                {formatXAF(o.total_amount)}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={pBadge.className}>{pBadge.label}</span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={kBadge.className}>{kBadge.label}</span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => setInspectingOrder(o)}
                                  className="btn-outline-gold py-1.5 px-3 text-xs"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#9A721C]" />
                                  <span>
                                    {language === 'fr' ? 'Consulter' : 'Inspect'}
                                  </span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Orders List */}
              <div className="md:hidden space-y-3">
                {filteredOrders.length === 0 ? (
                  <div className="hotel-card p-8 text-center text-xs text-hotel-muted bg-white">
                    {language === 'fr' ? 'Aucune commande trouvée.' : 'No orders found.'}
                  </div>
                ) : (
                  filteredOrders.map((o) => {
                    const pBadge = getPaymentBadge(o.payment_status);
                    const kBadge = getPrepBadge(o.preparation_status);
                    return (
                      <div key={o.id} className="hotel-card p-4 space-y-3 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-sm text-hotel-text">
                              {o.public_reference}
                            </span>
                            <p className="text-xs font-semibold text-hotel-text mt-0.5">
                              {o.customer_name}
                            </p>
                            <p className="text-[11px] text-hotel-muted">
                              {formatDateTime(o.created_at, language)} • {getModeLabel(o)}
                            </p>
                          </div>
                          <span className="font-serif text-lg font-bold text-hotel-text">
                            {formatXAF(o.total_amount)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-hotel-border">
                          <span className={pBadge.className}>{pBadge.label}</span>
                          <span className={kBadge.className}>{kBadge.label}</span>
                          <button
                            type="button"
                            onClick={() => setInspectingOrder(o)}
                            className="btn-outline-gold py-1.5 px-3 text-xs ml-auto"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#9A721C]" />
                            <span>{language === 'fr' ? 'Consulter' : 'Inspect'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* SECTION 2: MENU & CATEGORIES */}
          {activeTab === 'menu' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-hotel-text">
                  {t.adminTabMenu}
                </h2>
                <p className="text-xs text-hotel-secondary mt-0.5">
                  {language === 'fr'
                    ? 'Gérez les plats, boissons, temps de préparation, prix en XAF et catégories de la carte.'
                    : 'Manage dishes, beverages, preparation times, XAF prices, and menu categories.'}
                </p>
              </div>

              {/* Unified Toolbar: Sub-tabs on left, Contextual Primary Action Button on right */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white p-4 rounded-xl border border-hotel-border shadow-subtle">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setMenuSubTab('items')}
                    className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
                      menuSubTab === 'items'
                        ? 'bg-hotel-dark text-white font-semibold'
                        : 'bg-[#FAF8F5] text-hotel-secondary border border-hotel-border hover:text-hotel-text'
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>
                      {t.kitchenTabMenu} ({menuItems.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuSubTab('categories')}
                    className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
                      menuSubTab === 'categories'
                        ? 'bg-hotel-dark text-white font-semibold'
                        : 'bg-[#FAF8F5] text-hotel-secondary border border-hotel-border hover:text-hotel-text'
                    }`}
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    <span>
                      {t.kitchenTabCategories} ({categories.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuSubTab('complements')}
                    className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
                      menuSubTab === 'complements'
                        ? 'bg-hotel-dark text-white font-semibold'
                        : 'bg-[#FAF8F5] text-hotel-secondary border border-hotel-border hover:text-hotel-text'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>
                      {t.complements}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  {menuSubTab === 'categories' && (
                    <button
                      type="button"
                      onClick={handleOpenAddCategory}
                      className="btn-gold text-xs py-2.5 px-4 font-semibold w-full sm:w-auto justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.addCategoryTitle}</span>
                    </button>
                  )}
                  {menuSubTab === 'items' && (
                    <>
                      <button
                        type="button"
                        onClick={handleOpenAddCategory}
                        className="btn-outline-gold text-xs py-2.5 px-3.5"
                      >
                        <FolderTree className="w-3.5 h-3.5 text-[#9A721C]" />
                        <span>{t.addCategoryTitle}</span>
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
                    </>
                  )}
                </div>
              </div>

              {/* Subtab: Menu Items */}
              {menuSubTab === 'items' && (() => {
                const ADMIN_MENU_PER_PAGE = 12; // 2 columns x 6 rows
                const filteredAdminItems = menuItems.filter((item) =>
                  selectedCategoryFilter === 'all'
                    ? true
                    : item.category_id === selectedCategoryFilter
                );
                const totalAdminPages = Math.max(
                  1,
                  Math.ceil(filteredAdminItems.length / ADMIN_MENU_PER_PAGE)
                );
                const safeAdminPage = Math.min(adminMenuPage, totalAdminPages);
                const paginatedAdminItems = filteredAdminItems.slice(
                  (safeAdminPage - 1) * ADMIN_MENU_PER_PAGE,
                  safeAdminPage * ADMIN_MENU_PER_PAGE
                );

                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategoryFilter('all');
                          setAdminMenuPage(1);
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
                              setAdminMenuPage(1);
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

                    {filteredAdminItems.length === 0 ? (
                      <div className="py-16 text-center hotel-card p-8 bg-white">
                        <Utensils className="w-10 h-10 text-hotel-muted mx-auto mb-3" />
                        <h4 className="font-serif text-lg text-hotel-text font-semibold mb-1">
                          {t.noItemsAvailable}
                        </h4>
                      </div>
                    ) : (
                      <>
                        {/* 2 columns × 6 rows layout (12 vertical cards per page) */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-5">
                          {paginatedAdminItems.map((item) => {
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

                                  {/* 100% Solid Non-Transparent Category Badge */}
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
                                          .then(refreshMenuSilent)
                                          .catch(refreshMenuSilent);
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

                        {/* Pagination Bar */}
                        {totalAdminPages > 1 && (
                          <div className="pt-4 border-t border-hotel-border flex flex-col sm:flex-row items-center justify-between gap-3">
                            <p className="text-xs text-hotel-secondary">
                              {language === 'fr' ? (
                                <>
                                  Affichage de{' '}
                                  <span className="font-semibold text-hotel-text">
                                    {(safeAdminPage - 1) * ADMIN_MENU_PER_PAGE + 1}
                                  </span>{' '}
                                  à{' '}
                                  <span className="font-semibold text-hotel-text">
                                    {Math.min(
                                      safeAdminPage * ADMIN_MENU_PER_PAGE,
                                      filteredAdminItems.length
                                    )}
                                  </span>{' '}
                                  sur{' '}
                                  <span className="font-semibold text-hotel-text">
                                    {filteredAdminItems.length}
                                  </span>{' '}
                                  articles (disposition 2 × 6)
                                </>
                              ) : (
                                <>
                                  Showing{' '}
                                  <span className="font-semibold text-hotel-text">
                                    {(safeAdminPage - 1) * ADMIN_MENU_PER_PAGE + 1}
                                  </span>{' '}
                                  to{' '}
                                  <span className="font-semibold text-hotel-text">
                                    {Math.min(
                                      safeAdminPage * ADMIN_MENU_PER_PAGE,
                                      filteredAdminItems.length
                                    )}
                                  </span>{' '}
                                  of{' '}
                                  <span className="font-semibold text-hotel-text">
                                    {filteredAdminItems.length}
                                  </span>{' '}
                                  items (2 × 6 layout)
                                </>
                              )}
                            </p>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={safeAdminPage <= 1}
                                onClick={() =>
                                  setAdminMenuPage((p) => Math.max(1, p - 1))
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-hotel-border bg-white text-hotel-text hover:bg-hotel-subtle disabled:opacity-40 disabled:pointer-events-none transition-colors"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>{language === 'fr' ? 'Précédent' : 'Previous'}</span>
                              </button>

                              <div className="flex items-center gap-1 px-1">
                                {Array.from({ length: totalAdminPages }, (_, idx) => idx + 1).map(
                                  (pageNum) => (
                                    <button
                                      key={pageNum}
                                      type="button"
                                      onClick={() => setAdminMenuPage(pageNum)}
                                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                                        pageNum === safeAdminPage
                                          ? 'bg-hotel-dark text-white shadow-xs'
                                          : 'bg-white border border-hotel-border text-hotel-secondary hover:text-hotel-text hover:bg-hotel-subtle'
                                      }`}
                                    >
                                      {pageNum}
                                    </button>
                                  )
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={safeAdminPage >= totalAdminPages}
                                onClick={() =>
                                  setAdminMenuPage((p) =>
                                    Math.min(totalAdminPages, p + 1)
                                  )
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-hotel-border bg-white text-hotel-text hover:bg-hotel-subtle disabled:opacity-40 disabled:pointer-events-none transition-colors"
                              >
                                <span>{language === 'fr' ? 'Suivant' : 'Next'}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Subtab: Categories */}
              {menuSubTab === 'categories' && (
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

              {/* Subtab: Complements */}
              {menuSubTab === 'complements' && (
                <ComplementManager
                  categories={categories}
                  onRefresh={refreshMenuSilent}
                  showToast={showToast}
                />
              )}
            </div>
          )}

          {/* SECTION 3: PAYMENT METHODS CONFIGURATION */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-hotel-text">
                  {t.paymentConfigTitle}
                </h2>
                <p className="text-xs text-hotel-secondary mt-0.5">
                  {t.paymentConfigNotice}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {paymentSettings.map((setting) => {
                  const isOrange = setting.id === 'orange';
                  return (
                    <form
                      key={setting.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const accountName = String(formData.get('account_name') || '').trim();

                        if (isOrange) {
                          const merchantCode = String(formData.get('merchant_code') || '').trim();
                          handleSavePaymentSetting(setting.id, {
                            merchant_code: merchantCode,
                            account_name: accountName,
                          });
                        } else {
                          const phoneNumber = String(formData.get('phone_number') || '').trim();
                          // Keep merchant_code in sync with phone_number for seamless backward compatibility
                          handleSavePaymentSetting(setting.id, {
                            phone_number: phoneNumber,
                            merchant_code: phoneNumber,
                            account_name: accountName,
                          });
                        }
                      }}
                      className="hotel-card p-6 flex flex-col justify-between space-y-5 bg-white"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-hotel-border">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-3 h-3 rounded-full ${
                                isOrange ? 'bg-orange-500' : 'bg-yellow-500'
                              }`}
                            />
                            <div>
                              <h3 className="font-serif text-lg font-semibold text-hotel-text">
                                {isOrange ? 'Orange Money' : 'MTN Mobile Money'}
                              </h3>
                              <span
                                className={`mt-1 ${
                                  setting.is_active ? 'badge-paid' : 'badge-neutral'
                                }`}
                              >
                                {setting.is_active ? t.accountActive : t.accountDisabled}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleSavePaymentSetting(setting.id, {
                                is_active: !setting.is_active,
                              })
                            }
                            className="btn-outline-gold py-1.5 px-3 text-xs"
                          >
                            {setting.is_active
                              ? language === 'fr'
                                ? 'Désactiver'
                                : 'Disable'
                              : language === 'fr'
                              ? 'Activer'
                              : 'Enable'}
                          </button>
                        </div>

                        {isOrange ? (
                          <div>
                            <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                              {t.merchantCodeLabel} (Orange)
                            </label>
                            <input
                              type="text"
                              name="merchant_code"
                              defaultValue={setting.merchant_code}
                              placeholder="Ex : 123456"
                              className="input-hotel font-mono"
                            />
                            <p className="text-[11px] text-hotel-secondary mt-1">
                              {language === 'fr'
                                ? 'Code marchand Orange Money (#150*47*CODE*MONTANT#).'
                                : 'Orange Money merchant code (#150*47*CODE*AMOUNT#).'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                              {t.mtnRecipientPhoneLabel}
                            </label>
                            <input
                              type="tel"
                              name="phone_number"
                              defaultValue={setting.phone_number || setting.merchant_code || ''}
                              placeholder={t.mtnRecipientPhonePlaceholder}
                              className="input-hotel font-mono"
                            />
                            <p className="text-[11px] text-hotel-secondary mt-1">
                              {language === 'fr'
                                ? 'Numéro de téléphone de réception MoMo vers lequel le client effectue le transfert (*126#).'
                                : 'MTN MoMo recipient phone number to which customer sends the transfer (*126#).'}
                            </p>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                            {isOrange ? t.merchantAccount : t.recipientPhoneLabel} (Nom du titulaire)
                          </label>
                          <input
                            type="text"
                            name="account_name"
                            defaultValue={setting.account_name}
                            placeholder="Convivium Home Hotel"
                            className="input-hotel"
                          />
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-hotel-border">
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={setting.is_tested_on_device}
                              onChange={(e) =>
                                handleSavePaymentSetting(setting.id, {
                                  is_tested_on_device: e.target.checked,
                                })
                              }
                              className="mt-0.5 rounded border-hotel-borderStrong text-[#9A721C] focus:ring-[#9A721C]"
                            />
                            <div>
                              <span className="text-xs font-semibold text-hotel-text block">
                                {t.testedOnDeviceLabel}
                              </span>
                              <span className="text-[11px] text-hotel-secondary leading-relaxed block mt-0.5">
                                {t.testedOnDeviceHelp}
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Explicit Save Action Footer */}
                      <div className="pt-3.5 border-t border-hotel-border flex justify-end">
                        <button
                          type="submit"
                          className="btn-gold py-2.5 px-5 text-xs font-semibold w-full sm:w-auto justify-center"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {language === 'fr'
                              ? 'Enregistrer la configuration'
                              : 'Save configuration'}
                          </span>
                        </button>
                      </div>
                    </form>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 4: KITCHEN STAFF MANAGEMENT */}
          {activeTab === 'staff' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-hotel-text">
                    {t.staffTitle}
                  </h2>
                  <p className="text-xs text-hotel-secondary mt-0.5">
                    {language === 'fr'
                      ? 'Gérez les comptes autorisés à vérifier les paiements et piloter la cuisine.'
                      : 'Manage accounts authorized to verify payments and operate the kitchen.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="btn-gold text-xs py-2.5 px-4 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.inviteStaffButton}</span>
                </button>
              </div>

              {/* Desktop Staff Table */}
              <div className="hidden md:block hotel-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] border-b border-hotel-border text-hotel-secondary uppercase font-semibold">
                      <tr>
                        <th className="py-3.5 px-4">{t.fullName}</th>
                        <th className="py-3.5 px-4">{t.roleLabel}</th>
                        <th className="py-3.5 px-4">{t.status}</th>
                        <th className="py-3.5 px-4 text-right">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hotel-border bg-white">
                      {staffProfiles.map((s) => (
                        <tr key={s.id} className="hover:bg-[#FAF8F5]/80">
                          <td className="py-3.5 px-4 font-semibold text-hotel-text">
                            {s.full_name}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={
                                s.role === 'admin' ? 'badge-neutral' : 'badge-info'
                              }
                            >
                              {s.role === 'admin' ? t.roleAdmin : t.roleCuisine}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={
                                s.is_active ? 'badge-paid' : 'badge-rejected'
                              }
                            >
                              {s.is_active ? t.accountActive : t.accountDisabled}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {s.role !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleToggleStaff(s.id, s.is_active)}
                                className="btn-outline-gold py-1 px-3 text-xs"
                              >
                                {s.is_active
                                  ? language === 'fr'
                                    ? 'Désactiver'
                                    : 'Deactivate'
                                  : language === 'fr'
                                  ? 'Activer'
                                  : 'Activate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Staff Cards */}
              <div className="md:hidden space-y-3">
                {staffProfiles.map((s) => (
                  <div
                    key={s.id}
                    className="hotel-card p-4 flex flex-col gap-3 bg-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-hotel-text">
                          {s.full_name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span
                            className={
                              s.role === 'admin' ? 'badge-neutral' : 'badge-info'
                            }
                          >
                            {s.role === 'admin' ? t.roleAdmin : t.roleCuisine}
                          </span>
                          <span
                            className={
                              s.is_active ? 'badge-paid' : 'badge-rejected'
                            }
                          >
                            {s.is_active ? t.accountActive : t.accountDisabled}
                          </span>
                        </div>
                      </div>
                    </div>
                    {s.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleToggleStaff(s.id, s.is_active)}
                        className="btn-outline-gold py-2 px-3 text-xs w-full"
                      >
                        {s.is_active
                          ? language === 'fr'
                            ? 'Désactiver le compte'
                            : 'Deactivate account'
                          : language === 'fr'
                          ? 'Activer le compte'
                          : 'Activate account'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 5: ORDER MODES SETTINGS & DELIVERY FEE */}
          {activeTab === 'modes' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-hotel-text">
                  {t.orderModesTitle}
                </h2>
                <p className="text-xs text-hotel-secondary mt-0.5">
                  {t.orderModesDesc}
                </p>
              </div>

              {restaurantSettings && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(
                      [
                        ['dine_in', t.modeDineIn],
                        ['room_service', t.modeRoomService],
                        ['delivery', t.modeDelivery],
                      ] as const
                    ).map(([key, label]) => {
                      const isActive = restaurantSettings.modes_active[key];
                      return (
                        <div
                          key={key}
                          className="hotel-card p-5 flex flex-col justify-between gap-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-serif text-lg font-semibold text-hotel-text">
                                {label}
                              </h3>
                              <span
                                className={`mt-1.5 ${
                                  isActive ? 'badge-paid' : 'badge-neutral'
                                }`}
                              >
                                {isActive
                                  ? language === 'fr'
                                    ? 'Activé sur le menu'
                                    : 'Active on menu'
                                  : language === 'fr'
                                  ? 'Désactivé'
                                  : 'Disabled'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleOrderMode(key)}
                            className={
                              isActive
                                ? 'btn-outline-gold text-xs py-2 w-full'
                                : 'btn-gold text-xs py-2 w-full'
                            }
                          >
                            {isActive
                              ? language === 'fr'
                                ? 'Désactiver ce mode'
                                : 'Disable mode'
                              : language === 'fr'
                              ? 'Activer ce mode'
                              : 'Enable mode'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* DELIVERY FEE CONFIGURATION CARD */}
                  <div className="hotel-card p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-hotel-border pb-4">
                      <div>
                        <h3 className="font-serif text-lg font-semibold text-hotel-text">
                          {t.deliveryFeeConfigTitle}
                        </h3>
                        <p className="text-xs text-hotel-secondary mt-1 max-w-2xl leading-relaxed">
                          {t.deliveryFeeConfigDesc}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {restaurantSettings.delivery_fee &&
                        restaurantSettings.delivery_fee > 0 ? (
                          <span className="badge-paid">
                            {t.deliveryFee} : {formatXAF(restaurantSettings.delivery_fee)}
                          </span>
                        ) : (
                          <span className="badge-neutral">
                            {t.deliveryFeeNotDefined}
                          </span>
                        )}
                      </div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const parsed = parseInt(deliveryFeeInput.trim(), 10);
                        if (!deliveryFeeInput.trim() || isNaN(parsed) || parsed <= 0) {
                          handleSaveDeliveryFee(null);
                        } else {
                          handleSaveDeliveryFee(parsed);
                        }
                      }}
                      className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
                    >
                      <div className="flex-1 max-w-sm">
                        <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                          {t.deliveryFee} (XAF)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={deliveryFeeInput}
                          onChange={(e) => setDeliveryFeeInput(e.target.value)}
                          placeholder={
                            language === 'fr'
                              ? 'Aucun frais défini (laisser vide ou ex: 1000)'
                              : 'No fee defined (leave empty or e.g. 1000)'
                          }
                          className="input-hotel font-mono"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        <button
                          type="submit"
                          disabled={isSavingDeliveryFee}
                          className="btn-gold text-xs py-2.5 px-5 font-semibold"
                        >
                          {isSavingDeliveryFee ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : null}
                          <span>
                            {language === 'fr'
                              ? 'Enregistrer les frais'
                              : 'Save delivery fee'}
                          </span>
                        </button>

                        {restaurantSettings.delivery_fee &&
                          restaurantSettings.delivery_fee > 0 && (
                            <button
                              type="button"
                              disabled={isSavingDeliveryFee}
                              onClick={() => handleSaveDeliveryFee(null)}
                              className="btn-outline-gold text-xs py-2.5 px-4 text-red-700 border-red-200 hover:bg-red-50"
                            >
                              {t.clearDeliveryFee}
                            </button>
                          )}
                      </div>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SECTION 6: AUDIT TRAIL */}
          {activeTab === 'audit' && (() => {
            const getAuditCategory = (
              action: string,
              targetEntity: string
            ): 'payments' | 'orders' | 'catalog' | 'settings' => {
              const act = (action || '').toUpperCase();
              const ent = (targetEntity || '').toLowerCase();

              if (
                act === 'CONFIRM_PAYMENT_CUISINE' ||
                act === 'REJECT_PAYMENT_CUISINE' ||
                act === 'REVIEW_REQUIRED_PAYMENT_CUISINE' ||
                act === 'DECLARE_PAYMENT_CLIENT' ||
                act === 'UPDATE_PAYMENT_SETTINGS' ||
                act.startsWith('PAYMENT_') ||
                act.includes('PAYMENT') ||
                ent === 'payment_declarations' ||
                ent === 'payment_verifications' ||
                ent === 'payment_settings'
              ) {
                return 'payments';
              }
              if (
                act === 'CREATE_ORDER' ||
                act === 'UPDATE_PREPARATION_STATUS' ||
                act === 'CLEAR_ORDERS_HISTORY' ||
                act.startsWith('ORDER_') ||
                act.startsWith('ORDERS_') ||
                act.includes('PREPARATION_STATUS') ||
                ent === 'orders'
              ) {
                return 'orders';
              }
              if (
                act === 'CREATE_MENU_ITEM' ||
                act === 'UPDATE_MENU_ITEM' ||
                act === 'DELETE_MENU_ITEM' ||
                act === 'CREATE_CATEGORY' ||
                act === 'UPDATE_CATEGORY' ||
                act === 'DELETE_CATEGORY' ||
                act.startsWith('MENU_') ||
                ent === 'menu_items' ||
                ent === 'menu_categories'
              ) {
                return 'catalog';
              }
              return 'settings';
            };

            const getAuditMeta = (log: AuditLogEntry) => {
              const act = (log.action || '').toUpperCase();
              const fr = language === 'fr';
              switch (act) {
                case 'CONFIRM_PAYMENT_CUISINE':
                case 'PAYMENT_CONFIRMED':
                  return {
                    label: fr ? 'Paiement confirmé (Cuisine)' : 'Payment confirmed (Kitchen)',
                    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    Icon: ShieldCheck,
                  };
                case 'REJECT_PAYMENT_CUISINE':
                case 'PAYMENT_REJECTED':
                  return {
                    label: fr ? 'Paiement rejeté (Cuisine)' : 'Payment rejected (Kitchen)',
                    badgeClass: 'bg-red-50 text-red-800 border-red-200',
                    Icon: XCircle,
                  };
                case 'REVIEW_REQUIRED_PAYMENT_CUISINE':
                  return {
                    label: fr ? 'Paiement mis en vérification' : 'Payment flagged for review',
                    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
                    Icon: AlertTriangle,
                  };
                case 'DECLARE_PAYMENT_CLIENT':
                case 'PAYMENT_DECLARED':
                  return {
                    label: fr ? 'SMS paiement déclaré (Client)' : 'Payment SMS declared (Client)',
                    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
                    Icon: CreditCard,
                  };
                case 'UPDATE_PAYMENT_SETTINGS':
                case 'PAYMENT_SETTINGS_UPDATED':
                  return {
                    label: fr ? 'Compte Mobile Money modifié' : 'Mobile Money account updated',
                    badgeClass: 'bg-[#FAF6EE] text-[#8A6214] border-[#D8C79A]',
                    Icon: CreditCard,
                  };
                case 'CREATE_ORDER':
                case 'ORDER_CREATED':
                  return {
                    label: fr ? 'Nouvelle commande créée' : 'New order created',
                    badgeClass: 'bg-stone-100 text-stone-800 border-stone-200',
                    Icon: ClipboardList,
                  };
                case 'UPDATE_PREPARATION_STATUS':
                case 'PREPARATION_STATUS_UPDATED':
                  return {
                    label: fr ? 'Statut cuisine mis à jour' : 'Kitchen status updated',
                    badgeClass: 'bg-[#FAF6EE] text-[#8A6214] border-[#D8C79A]',
                    Icon: ChefHat,
                  };
                case 'CLEAR_ORDERS_HISTORY':
                case 'ORDERS_HISTORY_CLEARED':
                  return {
                    label: fr ? 'Historique commandes vidé' : 'Orders history cleared',
                    badgeClass: 'bg-red-50 text-red-800 border-red-200',
                    Icon: Trash2,
                  };
                case 'CREATE_MENU_ITEM':
                case 'MENU_ITEM_CREATED':
                  return {
                    label: fr ? 'Article ajouté au menu' : 'Menu item created',
                    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    Icon: Utensils,
                  };
                case 'UPDATE_MENU_ITEM':
                case 'MENU_ITEM_UPDATED':
                  return {
                    label: fr ? 'Article du menu modifié' : 'Menu item updated',
                    badgeClass: 'bg-[#FAF6EE] text-[#8A6214] border-[#D8C79A]',
                    Icon: Utensils,
                  };
                case 'DELETE_MENU_ITEM':
                case 'MENU_ITEM_DELETED':
                  return {
                    label: fr ? 'Article retiré du menu' : 'Menu item deleted',
                    badgeClass: 'bg-red-50 text-red-800 border-red-200',
                    Icon: Trash2,
                  };
                case 'CREATE_CATEGORY':
                case 'MENU_CATEGORY_CREATED':
                  return {
                    label: fr ? 'Catégorie créée' : 'Category created',
                    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    Icon: FolderTree,
                  };
                case 'UPDATE_CATEGORY':
                case 'MENU_CATEGORY_UPDATED':
                  return {
                    label: fr ? 'Catégorie modifiée' : 'Category updated',
                    badgeClass: 'bg-[#FAF6EE] text-[#8A6214] border-[#D8C79A]',
                    Icon: FolderTree,
                  };
                case 'DELETE_CATEGORY':
                case 'MENU_CATEGORY_DELETED':
                  return {
                    label: fr ? 'Catégorie supprimée' : 'Category deleted',
                    badgeClass: 'bg-red-50 text-red-800 border-red-200',
                    Icon: Trash2,
                  };
                case 'UPDATE_RESTAURANT_SETTINGS':
                case 'RESTAURANT_SETTINGS_UPDATED':
                  return {
                    label: fr ? 'Paramètres service modifiés' : 'Service settings updated',
                    badgeClass: 'bg-[#FAF6EE] text-[#8A6214] border-[#D8C79A]',
                    Icon: Sliders,
                  };
                case 'CREATE_STAFF_PROFILE':
                case 'UPDATE_STAFF_PROFILE':
                case 'STAFF_PROFILE_CREATED':
                case 'STAFF_PROFILE_UPDATED':
                case 'STAFF_PROFILE_DELETED':
                  return {
                    label: fr ? 'Équipe / Personnel modifié' : 'Staff profile updated',
                    badgeClass: 'bg-stone-100 text-stone-800 border-stone-200',
                    Icon: Users,
                  };
                default:
                  return {
                    label: log.action.replace(/_/g, ' '),
                    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
                    Icon: History,
                  };
              }
            };

            const formatPrepLabel = (st: string) => {
              const mapFr: Record<string, string> = {
                new: 'Nouvelle',
                not_started: 'En attente',
                accepted: 'Acceptée',
                received: 'Reçue en cuisine',
                preparing: 'En préparation',
                ready: 'Prête à servir',
                completed: 'Terminée / Servie',
                cancelled: 'Annulée',
              };
              const mapEn: Record<string, string> = {
                new: 'New',
                not_started: 'Waiting',
                accepted: 'Accepted',
                received: 'Received',
                preparing: 'Preparing',
                ready: 'Ready',
                completed: 'Completed',
                cancelled: 'Cancelled',
              };
              return (language === 'fr' ? mapFr[st] : mapEn[st]) || st;
            };

            const renderStructuredAuditDetails = (log: AuditLogEntry) => {
              const d = (log.details || {}) as Record<string, unknown>;
              const matchedOrder =
                log.target_id
                  ? orders.find((o) => o.id === log.target_id)
                  : undefined;
              const orderRef =
                (typeof d.reference === 'string' && d.reference) ||
                (typeof d.public_reference === 'string' && d.public_reference) ||
                matchedOrder?.public_reference ||
                null;

              const chips: React.ReactNode[] = [];

              if (orderRef) {
                chips.push(
                  <button
                    key="order-ref"
                    type="button"
                    onClick={() => {
                      if (matchedOrder) {
                        setInspectingOrder(matchedOrder);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border transition-colors ${
                      matchedOrder
                        ? 'bg-[#FAF6EE] text-[#8A6214] border-[#D8C79A] hover:bg-[#F3E9D2] cursor-pointer'
                        : 'bg-stone-100 text-stone-700 border-stone-200 cursor-default'
                    }`}
                    title={
                      matchedOrder
                        ? language === 'fr'
                          ? 'Inspecter cette commande'
                          : 'Inspect this order'
                        : undefined
                    }
                  >
                    <span>{orderRef}</span>
                    {matchedOrder && <Eye className="w-3 h-3" />}
                  </button>
                );
              }

              if (typeof d.name_fr === 'string' && d.name_fr) {
                chips.push(
                  <span
                    key="item-name"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-stone-100 text-hotel-text border border-stone-200"
                  >
                    {d.name_fr}
                  </span>
                );
              }

              if (typeof d.old_status === 'string' && typeof d.new_status === 'string') {
                chips.push(
                  <span
                    key="status-transition"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-stone-50 text-hotel-text border border-hotel-border"
                  >
                    <span className="text-hotel-secondary">{formatPrepLabel(d.old_status)}</span>
                    <ArrowRight className="w-3 h-3 text-[#9A721C]" />
                    <span className="font-semibold text-hotel-text">
                      {formatPrepLabel(d.new_status)}
                    </span>
                  </span>
                );
              }

              const operatorOrMethod =
                (typeof d.payment_method === 'string' && d.payment_method) ||
                (typeof d.operator === 'string' && d.operator) ||
                null;

              if (operatorOrMethod) {
                const isOM =
                  operatorOrMethod === 'orange_money' || operatorOrMethod === 'orange';
                chips.push(
                  <span
                    key="pay-method"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                      isOM
                        ? 'bg-orange-50 text-orange-800 border-orange-200'
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOM ? 'bg-[#EA580C]' : 'bg-[#D97706]'
                      }`}
                    />
                    {isOM ? 'Orange Money' : 'MTN MoMo'}
                  </span>
                );
              }

              const numericAmount =
                typeof d.total_amount === 'number'
                  ? d.total_amount
                  : typeof d.declared_amount === 'number'
                    ? d.declared_amount
                    : typeof d.price === 'number'
                      ? d.price
                      : null;

              if (numericAmount !== null) {
                chips.push(
                  <span
                    key="amount"
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200"
                  >
                    {formatXAF(numericAmount)}
                  </span>
                );
              }

              const txRef =
                (typeof d.verified_reference === 'string' && d.verified_reference) ||
                (typeof d.transaction_reference === 'string' && d.transaction_reference) ||
                null;

              if (txRef) {
                chips.push(
                  <span
                    key="tx-ref"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-stone-100 text-stone-700 border border-stone-200"
                  >
                    TX: {txRef}
                  </span>
                );
              }

              if (
                typeof d.preparation_time_minutes === 'number' &&
                d.preparation_time_minutes > 0
              ) {
                chips.push(
                  <span
                    key="prep-time"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FAF6EE] text-[#8A6214] border border-[#D8C79A]"
                  >
                    <Clock className="w-3 h-3" />
                    {d.preparation_time_minutes} min
                  </span>
                );
              }

              if (typeof d.is_available === 'boolean') {
                chips.push(
                  <span
                    key="avail"
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                      d.is_available
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-stone-100 text-stone-600 border-stone-200'
                    }`}
                  >
                    {d.is_available
                      ? language === 'fr'
                        ? 'Disponible'
                        : 'Available'
                      : language === 'fr'
                        ? 'Indisponible'
                        : 'Unavailable'}
                  </span>
                );
              }

              const clearedCount =
                typeof d.deleted_orders_count === 'number'
                  ? d.deleted_orders_count
                  : typeof d.deleted_count === 'number'
                    ? d.deleted_count
                    : null;

              if (clearedCount !== null) {
                chips.push(
                  <span
                    key="cleared-count"
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-50 text-red-800 border border-red-200"
                  >
                    {clearedCount}{' '}
                    {language === 'fr' ? 'commande(s) purgée(s)' : 'order(s) cleared'}
                  </span>
                );
              }

              const reasonOrNotes =
                (typeof d.reason === 'string' && d.reason.trim()) ||
                (typeof d.notes === 'string' && d.notes.trim()) ||
                null;

              if (reasonOrNotes) {
                chips.push(
                  <span
                    key="notes"
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs italic bg-[#FAF8F5] text-hotel-secondary border border-hotel-border"
                  >
                    « {reasonOrNotes} »
                  </span>
                );
              }

              if (chips.length === 0) {
                const fallbackEntries = Object.entries(d).filter(
                  ([k, v]) =>
                    v !== null &&
                    v !== undefined &&
                    v !== '' &&
                    k !== 'order_id'
                );
                if (fallbackEntries.length === 0) {
                  return <span className="text-xs text-hotel-muted">—</span>;
                }
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {fallbackEntries.slice(0, 4).map(([k, v]) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 text-[11px] font-mono"
                      >
                        <span className="text-stone-500">{k}:</span>{' '}
                        <span>{ typeof v === 'object' ? JSON.stringify(v) : String(v) }</span>
                      </span>
                    ))}
                  </div>
                );
              }

              return <div className="flex flex-wrap items-center gap-1.5">{chips}</div>;
            };

            const paymentsCount = auditLogs.filter(
              (l) => getAuditCategory(l.action, l.target_entity) === 'payments'
            ).length;
            const ordersCount = auditLogs.filter(
              (l) => getAuditCategory(l.action, l.target_entity) === 'orders'
            ).length;
            const catalogCount = auditLogs.filter(
              (l) => getAuditCategory(l.action, l.target_entity) === 'catalog'
            ).length;
            const settingsCount = auditLogs.filter(
              (l) => getAuditCategory(l.action, l.target_entity) === 'settings'
            ).length;

            const filteredAuditLogs = auditLogs.filter((log) => {
              const cat = getAuditCategory(log.action, log.target_entity);
              if (auditCategoryFilter !== 'all' && cat !== auditCategoryFilter) {
                return false;
              }
              if (auditSearchQuery.trim()) {
                const q = auditSearchQuery.toLowerCase();
                const meta = getAuditMeta(log);
                const actorName = log.profiles?.full_name || '';
                const detailsStr = log.details ? JSON.stringify(log.details) : '';
                return (
                  log.action.toLowerCase().includes(q) ||
                  meta.label.toLowerCase().includes(q) ||
                  actorName.toLowerCase().includes(q) ||
                  (log.target_id || '').toLowerCase().includes(q) ||
                  detailsStr.toLowerCase().includes(q)
                );
              }
              return true;
            });

            const AUDIT_PER_PAGE = 10;
            const totalAuditPages = Math.max(
              1,
              Math.ceil(filteredAuditLogs.length / AUDIT_PER_PAGE)
            );
            const safeAuditPage = Math.min(auditPage, totalAuditPages);
            const paginatedAuditLogs = filteredAuditLogs.slice(
              (safeAuditPage - 1) * AUDIT_PER_PAGE,
              safeAuditPage * AUDIT_PER_PAGE
            );

            return (
              <div className="space-y-6">
                {/* Header & Live Sync Indicator */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="font-serif text-2xl font-semibold text-hotel-text">
                        {t.adminTabAudit}
                      </h2>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {language === 'fr' ? 'En direct' : 'Live'}
                      </span>
                    </div>
                    <p className="text-xs text-hotel-secondary mt-1">
                      {language === 'fr'
                        ? 'Traçabilité complète et horodatée en temps réel des paiements, commandes, articles du menu et paramètres.'
                        : 'Real-time timestamped audit trail of payments, orders, menu catalog, and settings.'}
                    </p>
                  </div>
                </div>

                {/* Audit KPI Summary Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="hotel-card p-4 bg-white flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-hotel-secondary block">
                        {language === 'fr' ? 'Total événements' : 'Total events'}
                      </span>
                      <span className="font-serif text-2xl font-bold text-hotel-text mt-1 block">
                        {auditLogs.length}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border border-[#D8C79A] flex items-center justify-center text-[#8A6214]">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="hotel-card p-4 bg-white flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-hotel-secondary block">
                        {language === 'fr' ? 'Paiements Mobile' : 'Mobile Payments'}
                      </span>
                      <span className="font-serif text-2xl font-bold text-emerald-700 mt-1 block">
                        {paymentsCount}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="hotel-card p-4 bg-white flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-hotel-secondary block">
                        {language === 'fr' ? 'Flux Commandes' : 'Order Operations'}
                      </span>
                      <span className="font-serif text-2xl font-bold text-hotel-text mt-1 block">
                        {ordersCount}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700">
                      <ChefHat className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="hotel-card p-4 bg-white flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-hotel-secondary block">
                        {language === 'fr' ? 'Menu & Paramètres' : 'Catalog & Settings'}
                      </span>
                      <span className="font-serif text-2xl font-bold text-[#9A721C] mt-1 block">
                        {catalogCount + settingsCount}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border border-[#D8C79A] flex items-center justify-center text-[#8A6214]">
                      <Utensils className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Filter & Search Toolbar */}
                <div className="hotel-card p-4 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
                    {(
                      [
                        {
                          id: 'all',
                          label: language === 'fr' ? 'Tout' : 'All',
                          count: auditLogs.length,
                        },
                        {
                          id: 'payments',
                          label: language === 'fr' ? 'Paiements Mobile' : 'Mobile Payments',
                          count: paymentsCount,
                        },
                        {
                          id: 'orders',
                          label: language === 'fr' ? 'Commandes & Cuisine' : 'Orders & Kitchen',
                          count: ordersCount,
                        },
                        {
                          id: 'catalog',
                          label: language === 'fr' ? 'Menu & Carte' : 'Menu Catalog',
                          count: catalogCount,
                        },
                        {
                          id: 'settings',
                          label: language === 'fr' ? 'Configuration' : 'Settings',
                          count: settingsCount,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setAuditCategoryFilter(tab.id);
                          setAuditPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                          auditCategoryFilter === tab.id
                            ? 'bg-hotel-dark text-white font-semibold'
                            : 'bg-[#FAF8F5] text-hotel-secondary border border-hotel-border hover:text-hotel-text'
                        }`}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full lg:w-72">
                    <Search className="w-4 h-4 text-hotel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={auditSearchQuery}
                      onChange={(e) => {
                        setAuditSearchQuery(e.target.value);
                        setAuditPage(1);
                      }}
                      placeholder={
                        language === 'fr'
                          ? 'Rechercher réf, agent, plat, TX...'
                          : 'Search ref, staff, item, TX...'
                      }
                      className="input-hotel pl-9 py-2 text-xs"
                    />
                    {auditSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuditSearchQuery('');
                          setAuditPage(1);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-hotel-muted hover:text-hotel-text"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop Audit Table */}
                <div className="hidden md:block hotel-card overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAF8F5] border-b border-hotel-border text-hotel-secondary uppercase font-semibold tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3.5 px-4">
                            {language === 'fr' ? 'Horodatage' : 'Timestamp'}
                          </th>
                          <th className="py-3.5 px-4">
                            {language === 'fr' ? 'Événement' : 'Event'}
                          </th>
                          <th className="py-3.5 px-4">
                            {language === 'fr' ? 'Opérateur' : 'Actor'}
                          </th>
                          <th className="py-3.5 px-4">
                            {language === 'fr'
                              ? 'Détails & Références'
                              : 'Details & References'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hotel-border bg-white">
                        {paginatedAuditLogs.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-12 text-center text-hotel-muted font-sans"
                            >
                              {language === 'fr'
                                ? 'Aucun événement ne correspond aux critères sélectionnés.'
                                : 'No audit events match the selected filters.'}
                            </td>
                          </tr>
                        ) : (
                          paginatedAuditLogs.map((log) => {
                            const meta = getAuditMeta(log);
                            const IconComp = meta.Icon;
                            const actorName =
                              log.profiles?.full_name ||
                              (log.user_id
                                ? language === 'fr'
                                  ? 'Personnel autorisé'
                                  : 'Authorized staff'
                                : language === 'fr'
                                  ? 'Client / Portail'
                                  : 'Client / Guest');
                            const actorRole = log.profiles?.role;

                            return (
                              <tr
                                key={log.id}
                                className="hover:bg-[#FAF8F5] transition-colors"
                              >
                                <td className="py-3.5 px-4 text-hotel-secondary font-mono whitespace-nowrap align-middle">
                                  {formatDateTime(log.created_at, language)}
                                </td>
                                <td className="py-3.5 px-4 align-middle">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.badgeClass}`}
                                  >
                                    <IconComp className="w-3.5 h-3.5 shrink-0" />
                                    <span>{meta.label}</span>
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-hotel-text">
                                      {actorName}
                                    </span>
                                    {actorRole && (
                                      <span
                                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                                          actorRole === 'admin'
                                            ? 'bg-[#FAF6EE] text-[#8A6214] border-[#D8C79A]'
                                            : 'bg-stone-100 text-stone-700 border-stone-200'
                                        }`}
                                      >
                                        {actorRole === 'admin' ? 'Admin' : 'Cuisine'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 align-middle">
                                  {renderStructuredAuditDetails(log)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Audit Cards */}
                <div className="md:hidden space-y-3">
                  {paginatedAuditLogs.length === 0 ? (
                    <div className="hotel-card p-8 text-center text-xs text-hotel-muted bg-white">
                      {language === 'fr'
                        ? 'Aucun événement ne correspond aux critères sélectionnés.'
                        : 'No audit events match the selected filters.'}
                    </div>
                  ) : (
                    paginatedAuditLogs.map((log) => {
                      const meta = getAuditMeta(log);
                      const IconComp = meta.Icon;
                      const actorName =
                        log.profiles?.full_name ||
                        (log.user_id
                          ? language === 'fr'
                            ? 'Personnel autorisé'
                            : 'Authorized staff'
                          : language === 'fr'
                            ? 'Client / Portail'
                            : 'Client / Guest');
                      const actorRole = log.profiles?.role;

                      return (
                        <div
                          key={log.id}
                          className="hotel-card p-4 space-y-3 bg-white text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.badgeClass}`}
                            >
                              <IconComp className="w-3.5 h-3.5 shrink-0" />
                              <span>{meta.label}</span>
                            </span>
                            <span className="text-[11px] font-mono text-hotel-secondary shrink-0">
                              {formatDateTime(log.created_at, language)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1 border-t border-hotel-border">
                            <span className="text-hotel-secondary">
                              {language === 'fr' ? 'Opérateur :' : 'Actor:'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-hotel-text">
                                {actorName}
                              </span>
                              {actorRole && (
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#FAF6EE] text-[#8A6214] border border-[#D8C79A]">
                                  {actorRole === 'admin' ? 'Admin' : 'Cuisine'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-1">{renderStructuredAuditDetails(log)}</div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Audit Pagination Bar */}
                {totalAuditPages > 1 && (
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-hotel-secondary">
                      {language === 'fr' ? (
                        <>
                          Affichage de{' '}
                          <span className="font-semibold text-hotel-text">
                            {(safeAuditPage - 1) * AUDIT_PER_PAGE + 1}
                          </span>{' '}
                          à{' '}
                          <span className="font-semibold text-hotel-text">
                            {Math.min(
                              safeAuditPage * AUDIT_PER_PAGE,
                              filteredAuditLogs.length
                            )}
                          </span>{' '}
                          sur{' '}
                          <span className="font-semibold text-hotel-text">
                            {filteredAuditLogs.length}
                          </span>{' '}
                          événements
                        </>
                      ) : (
                        <>
                          Showing{' '}
                          <span className="font-semibold text-hotel-text">
                            {(safeAuditPage - 1) * AUDIT_PER_PAGE + 1}
                          </span>{' '}
                          to{' '}
                          <span className="font-semibold text-hotel-text">
                            {Math.min(
                              safeAuditPage * AUDIT_PER_PAGE,
                              filteredAuditLogs.length
                            )}
                          </span>{' '}
                          of{' '}
                          <span className="font-semibold text-hotel-text">
                            {filteredAuditLogs.length}
                          </span>{' '}
                          events
                        </>
                      )}
                    </p>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeAuditPage <= 1}
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-hotel-border bg-white text-hotel-text hover:bg-hotel-subtle disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>{language === 'fr' ? 'Précédent' : 'Previous'}</span>
                      </button>

                      <span className="px-3 py-1.5 text-xs font-semibold text-hotel-text">
                        {safeAuditPage} / {totalAuditPages}
                      </span>

                      <button
                        type="button"
                        disabled={safeAuditPage >= totalAuditPages}
                        onClick={() =>
                          setAuditPage((p) => Math.min(totalAuditPages, p + 1))
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-hotel-border bg-white text-hotel-text hover:bg-hotel-subtle disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      >
                        <span>{language === 'fr' ? 'Suivant' : 'Next'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </main>

      {/* INVITE CUISINE MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-stone-900/60"
            onClick={() => setIsInviteModalOpen(false)}
          />
          <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-6 z-10 pb-safe">
            <h3 className="font-serif text-xl font-semibold text-hotel-text pb-3 border-b border-hotel-border">
              {t.inviteStaffButton}
            </h3>

            <form onSubmit={handleAddCuisineStaff} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  Supabase Auth User ID (UUID) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCuisineId}
                  onChange={(e) => setNewCuisineId(e.target.value)}
                  placeholder="Ex : 877ab03f-6d45-..."
                  className="input-hotel font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.fullName} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCuisineName}
                  onChange={(e) => setNewCuisineName(e.target.value)}
                  placeholder="Ex : Chef Eric M."
                  className="input-hotel"
                />
              </div>

              <div className="pt-3 border-t border-hotel-border flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
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

      {/* ITEM CREATE / EDIT MODAL (ADMIN) */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-stone-900/60"
            onClick={() => setIsItemModalOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-6 z-10 pb-safe">
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

                <div className="flex items-center gap-3 flex-wrap">
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

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="availCheckAdmin"
                  checked={itemAvailable}
                  onChange={(e) => setItemAvailable(e.target.checked)}
                  className="rounded border-hotel-borderStrong text-[#9A721C] focus:ring-[#9A721C]"
                />
                <label
                  htmlFor="availCheckAdmin"
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

      {/* CATEGORY CREATE / EDIT MODAL (ADMIN) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-stone-900/60"
            onClick={() => {
              setIsCategoryModalOpen(false);
              setEditingCategory(null);
            }}
          />
          <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-6 z-10 pb-safe">
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
                    id="adminCatActiveCheck"
                    checked={categoryIsActive}
                    onChange={(e) => setCategoryIsActive(e.target.checked)}
                    className="rounded border-hotel-borderStrong text-[#9A721C] focus:ring-[#9A721C]"
                  />
                  <label
                    htmlFor="adminCatActiveCheck"
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

      {/* SUPERVISOR VIEW: READ-ONLY PAYMENT VERIFICATION FICHE MODAL */}
      {inspectingOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-stone-900/60"
            onClick={() => setInspectingOrder(null)}
          />
          <div className="relative w-full max-w-4xl max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-4 sm:p-6 z-10 sm:my-auto space-y-4 pb-safe">
            <div className="flex items-center justify-between pb-3.5 border-b border-hotel-border">
              <div>
                <span className="text-[11px] font-semibold text-[#9A721C] uppercase tracking-wider block">
                  {language === 'fr'
                    ? 'Consultation Direction (Lecture seule)'
                    : 'Management Inspection (Read-only)'}
                </span>
                <h3 className="font-serif text-lg sm:text-xl font-semibold text-hotel-text">
                  {language === 'fr'
                    ? `Fiche de contrôle — ${inspectingOrder.public_reference}`
                    : `Verification Record — ${inspectingOrder.public_reference}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingOrder(null)}
                className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-subtle"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <PaymentVerificationCard
              order={inspectingOrder}
              allOrders={orders}
              readOnly={true}
            />
          </div>
        </div>
      )}

      {/* ADMIN-ONLY SOLID FINANCIAL & OPERATIONAL REPORT MODAL */}
      {isReportModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-stone-950/80"
            onClick={() => setIsReportModalOpen(false)}
          />
          <div className="relative w-full max-w-4xl max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-6 z-10 space-y-5 pb-safe">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-hotel-border bg-white">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#FAF6EE] border border-[#D8C79A] text-[#8A6214] text-[10px] font-bold uppercase tracking-wider mb-1">
                  {language === 'fr'
                    ? 'Rapport Officiel Direction (Admin)'
                    : 'Official Management Report (Admin)'}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-semibold text-hotel-text">
                  {language === 'fr'
                    ? 'Synthèse Financière & Rapport des Commandes'
                    : 'Financial Summary & Orders Report'}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportOrdersCsv}
                  disabled={orders.length === 0}
                  className="btn-outline-gold bg-white text-xs py-2 px-3 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5 text-[#9A721C]" />
                  <span>{language === 'fr' ? 'Exporter CSV' : 'Export CSV'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintOrdersReport}
                  disabled={orders.length === 0}
                  className="btn-gold text-xs py-2 px-3.5 font-semibold disabled:opacity-40"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{language === 'fr' ? 'Imprimer / PDF' : 'Print / PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-2 rounded-lg bg-[#FAF8F5] border border-hotel-border text-hotel-text hover:bg-stone-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Solid KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#D8C79A]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A6214] block">
                  {language === 'fr' ? 'Recettes Confirmées' : 'Confirmed Revenue'}
                </span>
                <strong className="font-serif text-xl font-bold text-hotel-text mt-1 block">
                  {formatXAF(totalRevenue)}
                </strong>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-hotel-border">
                <span className="text-[11px] font-bold uppercase tracking-wider text-hotel-secondary block">
                  {language === 'fr' ? 'Total Commandes' : 'Total Orders'}
                </span>
                <strong className="font-serif text-xl font-bold text-hotel-text mt-1 block">
                  {orders.length}
                </strong>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                  {language === 'fr' ? 'Payées (Cuisine)' : 'Paid (Kitchen)'}
                </span>
                <strong className="font-serif text-xl font-bold text-emerald-900 mt-1 block">
                  {paidOrders.length}
                </strong>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                  {language === 'fr' ? 'En attente' : 'Pending'}
                </span>
                <strong className="font-serif text-xl font-bold text-amber-900 mt-1 block">
                  {pendingVerificationsCount}
                </strong>
              </div>
            </div>

            {/* Breakdown by Service Mode (Solid Opaque Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  ['room_service', t.modeRoomService],
                  ['dine_in', t.modeDineIn],
                  ['delivery', t.modeDelivery],
                ] as const
              ).map(([mKey, mLabel]) => {
                const modeOrders = orders.filter((o) => o.order_mode === mKey);
                const modePaidSum = modeOrders
                  .filter((o) => o.payment_status === 'paid')
                  .reduce((s, o) => s + o.total_amount, 0);
                return (
                  <div
                    key={mKey}
                    className="p-3.5 rounded-xl bg-white border border-hotel-border flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-hotel-text block">
                        {mLabel}
                      </span>
                      <span className="text-[11px] text-hotel-secondary">
                        {modeOrders.length} commande(s)
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#8A6214] bg-[#FAF6EE] px-2.5 py-1 rounded-md border border-[#D8C79A]">
                      {formatXAF(modePaidSum)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Detailed Solid Table */}
            <div className="border border-hotel-border rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left text-xs bg-white">
                  <thead className="bg-[#FAF6EE] border-b border-[#D8C79A] text-[#8A6214] uppercase text-[11px] font-bold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Réf</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Service & Horaire</th>
                      <th className="py-2.5 px-3">Total</th>
                      <th className="py-2.5 px-3">Paiement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hotel-border bg-white">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-hotel-muted">
                          {language === 'fr'
                            ? 'Aucune commande enregistrée.'
                            : 'No orders recorded.'}
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => {
                        const pBadge = getPaymentBadge(o.payment_status);
                        return (
                          <tr key={o.id} className="bg-white hover:bg-[#FAF8F5]">
                            <td className="py-2.5 px-3 font-mono font-bold text-hotel-text">
                              {o.public_reference}
                            </td>
                            <td className="py-2.5 px-3 text-hotel-secondary whitespace-nowrap">
                              {formatDateTime(o.created_at, language)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-hotel-text">
                              {o.customer_name}
                            </td>
                            <td className="py-2.5 px-3 text-hotel-secondary">
                              {getModeLabel(o)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-hotel-text whitespace-nowrap">
                              {formatXAF(o.total_amount)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={pBadge.className}>{pBadge.label}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN-ONLY CLEAR ORDERS HISTORY MODAL */}
      {isClearHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="fixed inset-0 bg-stone-950/75"
            onClick={() => {
              if (!isClearingHistory) {
                setIsClearHistoryModalOpen(false);
              }
            }}
          />
          <div className="relative w-full max-w-md max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-6 pb-safe z-10">
            <div className="flex items-start gap-3 pb-3 border-b border-hotel-border">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0 text-red-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold text-hotel-text">
                  {language === 'fr'
                    ? 'Vider l’historique des commandes (Admin)'
                    : 'Clear Orders History (Admin)'}
                </h3>
                <p className="text-xs text-hotel-secondary mt-0.5">
                  {language === 'fr'
                    ? 'Conseil : exportez votre rapport CSV ou PDF avant de vider l’historique.'
                    : 'Tip: export your CSV or PDF report before clearing the history.'}
                </p>
              </div>
            </div>

            {clearHistoryError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
                {clearHistoryError}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  clearHistoryScope === 'completed'
                    ? 'bg-[#FAF6EE] border-[#9A721C]'
                    : 'bg-white border-hotel-border hover:bg-[#FAF8F5]'
                }`}
              >
                <input
                  type="radio"
                  name="clearScopeAdmin"
                  checked={clearHistoryScope === 'completed'}
                  onChange={() => setClearHistoryScope('completed')}
                  className="mt-0.5 text-[#9A721C] focus:ring-[#9A721C]"
                />
                <div className="text-xs">
                  <span className="font-bold text-hotel-text block">
                    {language === 'fr'
                      ? 'Commandes terminées, rejetées ou annulées uniquement'
                      : 'Completed, rejected, or cancelled orders only'}
                  </span>
                  <span className="text-hotel-secondary mt-0.5 block">
                    {language === 'fr'
                      ? 'Conserve les commandes actives en cours de préparation ou d’attente.'
                      : 'Keeps active orders currently in preparation or pending.'}
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  clearHistoryScope === 'all'
                    ? 'bg-red-50 border-red-400'
                    : 'bg-white border-hotel-border hover:bg-[#FAF8F5]'
                }`}
              >
                <input
                  type="radio"
                  name="clearScopeAdmin"
                  checked={clearHistoryScope === 'all'}
                  onChange={() => setClearHistoryScope('all')}
                  className="mt-0.5 text-red-600 focus:ring-red-600"
                />
                <div className="text-xs">
                  <span className="font-bold text-red-900 block">
                    {language === 'fr'
                      ? `Tout l’historique (${orders.length} commande(s))`
                      : `All orders history (${orders.length} order(s))`}
                  </span>
                  <span className="text-red-800 mt-0.5 block">
                    {language === 'fr'
                      ? 'Supprime définitivement toutes les commandes enregistrées pour remettre le tableau à zéro.'
                      : 'Permanently deletes all recorded orders to reset the dashboard.'}
                  </span>
                </div>
              </label>
            </div>

            <div className="mt-5 pt-3 border-t border-hotel-border flex gap-2.5">
              <button
                type="button"
                disabled={isClearingHistory}
                onClick={() => setIsClearHistoryModalOpen(false)}
                className="btn-outline-gold flex-1 text-xs py-2.5"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={isClearingHistory}
                onClick={handleClearOrdersHistory}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2.5 px-4 transition-colors disabled:opacity-50"
              >
                {isClearingHistory ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>
                  {language === 'fr' ? 'Confirmer la suppression' : 'Confirm deletion'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISH IMAGE PREVIEW MODAL (ADMIN) */}
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

