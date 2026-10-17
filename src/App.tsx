import { useState, useEffect, useRef } from 'react';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { CategoryNav } from './components/menu/CategoryNav';
import { MenuItemCard } from './components/menu/MenuItemCard';
import { CartDrawer } from './components/cart/CartDrawer';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { PaymentModal } from './components/payment/PaymentModal';
import { OrderTrackingView } from './components/tracking/OrderTrackingView';
import { StaffLoginModal } from './components/staff/StaffLoginModal';
import { KitchenWorkspace } from './components/kitchen/KitchenWorkspace';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { useAuth } from './context/AuthContext';
import { useCart } from './context/CartContext';
import { useLanguage } from './i18n/LanguageContext';
import { menuService } from './services/menu.service';
import { settingsService } from './services/settings.service';
import { serviceLocationService } from './services/service-location.service';
import { supabase } from './lib/supabase';
import { subscribeToLiveSyncEvents } from './lib/realtime';
import { formatXAF } from './lib/formatters';
import {
  OPEN_NOTIFICATION_EVENT,
  parseNotificationDeepLink,
  stripNotificationParams,
} from './lib/push';
import type { MenuCategory, MenuItem, MenuComplement, RestaurantSettings, ResolvedServiceLocation } from './types';
import type { CreateOrderResult } from './services/orders.service';
import {
  getStoredClientOrderToken,
  saveActiveTrackingRef,
  getActiveTrackingRef,
  getLatestStoredClientOrder,
  savePendingPaymentOrder,
  getPendingPaymentOrder,
  clearPendingPaymentOrder,
} from './lib/security';
import {
  UtensilsCrossed,
  Loader2,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';

const MENU_ITEMS_PER_PAGE = 12; // 2 columns x 6 rows

export function App() {
  const { user, role, signOut, isLoading: authLoading } = useAuth();
  const { totalItems, subtotal } = useCart();
  const { language, t } = useLanguage();

  // Navigation State with localStorage persistence across page refreshes
  const [activeTab, setActiveTabState] = useState<'menu' | 'tracking'>(() => {
    try {
      const saved = localStorage.getItem('convivium_active_tab_v1');
      if (saved === 'tracking' || saved === 'menu') return saved;
    } catch {}
    return 'menu';
  });

  const setActiveTab = (tab: 'menu' | 'tracking') => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('convivium_active_tab_v1', tab);
    } catch {}
  };

  // Active tracking reference persisted across reloads
  const [trackingReference, setTrackingReferenceState] = useState<string | null>(() => {
    try {
      return getActiveTrackingRef() || getLatestStoredClientOrder()?.public_reference || null;
    } catch {
      return null;
    }
  });

  const setTrackingReference = (ref: string | null) => {
    setTrackingReferenceState(ref);
    saveActiveTrackingRef(ref);
  };

  // Modals
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState(false);

  // Active pending payment order retained in memory & localStorage across page reloads
  const [pendingPaymentOrder, setPendingPaymentOrderState] = useState<CreateOrderResult | null>(() => {
    try {
      return getPendingPaymentOrder<CreateOrderResult>();
    } catch {
      return null;
    }
  });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(() => {
    // If a pending order was stored, automatically show the modal on initial visit
    return Boolean(getPendingPaymentOrder<CreateOrderResult>());
  });

  const setPendingPaymentOrder = (order: CreateOrderResult | null) => {
    setPendingPaymentOrderState(order);
    if (order) {
      savePendingPaymentOrder(order);
    } else {
      clearPendingPaymentOrder();
    }
  };

  // Active QR Code Service Location (table or room) persisted across session
  const [activeServiceLocation, setActiveServiceLocation] = useState<ResolvedServiceLocation | null>(() => {
    try {
      const saved = sessionStorage.getItem('convivium_active_spot_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [spotScanFeedback, setSpotScanFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleClearServiceLocation = () => {
    setActiveServiceLocation(null);
    try {
      sessionStorage.removeItem('convivium_active_spot_v1');
    } catch {}
  };

  // Service location QR code scanning: `/?spot=CVH-...`
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotCode = params.get('spot');
    if (!spotCode) return;

    let isMounted = true;
    (async () => {
      try {
        const res = await serviceLocationService.resolveLocation(spotCode);
        if (!isMounted) return;
        if (res && res.success && res.location && res.location.is_active) {
          const loc = res.location;
          setActiveServiceLocation(loc);
          try {
            sessionStorage.setItem('convivium_active_spot_v1', JSON.stringify(loc));
          } catch {}
          setSpotScanFeedback({
            type: 'success',
            message:
              language === 'fr'
                ? `Emplacement validé : ${loc.label} (${loc.location_type === 'room' ? 'Service en chambre' : 'Sur place'})`
                : `Location verified: ${loc.label} (${loc.location_type === 'room' ? 'Room service' : 'Dine-in'})`,
          });
        } else {
          setSpotScanFeedback({
            type: 'error',
            message:
              language === 'fr'
                ? 'Emplacement QR non reconnu ou actuellement inactif. Vous pouvez choisir votre mode manuellement.'
                : 'QR location not recognized or currently inactive. You may select your order mode manually.',
          });
        }
      } catch (err) {
        console.error('Error resolving service location from QR', err);
      } finally {
        params.delete('spot');
        const query = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [language]);

  // Data State
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [complements, setComplements] = useState<MenuComplement[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [menuPage, setMenuPage] = useState<number>(1);
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings | null>(null);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const hasLoadedMenuRef = useRef(false);

  // Load public menu (silent=true updates in-place without unmounting or scrolling)
  const loadPublicData = async (silent = true) => {
    if (!hasLoadedMenuRef.current && !silent) {
      setIsLoadingMenu(true);
    }
    try {
      const [cats, items, comps, settings] = await Promise.all([
        menuService.getPublicCategories().catch(() => []),
        menuService.getPublicMenuItems().catch(() => []),
        menuService.getPublicComplements().catch(() => []),
        settingsService.getRestaurantSettings().catch(() => null),
      ]);
      setCategories(cats);
      setMenuItems(items);
      setComplements(comps);
      setRestaurantSettings(settings);
      hasLoadedMenuRef.current = true;
    } catch (e) {
      console.error('Error loading public data', e);
    } finally {
      setIsLoadingMenu(false);
    }
  };

  useEffect(() => {
    loadPublicData(false);

    // Real-time synchronization for public menu catalog & restaurant settings (delivery fee, active modes)
    const menuChannel = supabase
      .channel('public_menu_catalog_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => {
          loadPublicData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_item_variants' },
        () => {
          loadPublicData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_categories' },
        () => {
          loadPublicData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_complements' },
        () => {
          loadPublicData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_complement_categories' },
        () => {
          loadPublicData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_settings' },
        () => {
          loadPublicData(true);
        }
      )
      .subscribe();

    const unsubscribeLive = subscribeToLiveSyncEvents((evt) => {
      if (evt.type === 'catalog_updated') {
        loadPublicData(true);
      }
    });

    return () => {
      unsubscribeLive();
      supabase.removeChannel(menuChannel);
    };
  }, []);

  // Notification deep links: `/?n=track&ref=CVH-…` (opened from a push). Only a public reference
  // is carried; the tracking view re-reads the real order from the server with the stored token.
  useEffect(() => {
    const apply = (link: { target: string; ref: string | null }) => {
      if (link.target === 'track') {
        if (link.ref) setTrackingReference(link.ref);
        setActiveTab('tracking');
      }
      // kitchen / admin targets: the staff workspace is shown by the authenticated session itself.
    };

    const initial = parseNotificationDeepLink(window.location.search);
    if (initial) {
      apply(initial);
      const cleaned = stripNotificationParams(window.location.search);
      window.history.replaceState(null, '', `${window.location.pathname}${cleaned}${window.location.hash}`);
    }

    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ target: string; ref: string | null }>).detail;
      if (detail) apply(detail);
    };
    window.addEventListener(OPEN_NOTIFICATION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_NOTIFICATION_EVENT, onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtered Menu Items: includes items in selected category or any of its subcategories
  const displayedItems = menuItems.filter((item) => {
    if (!selectedCategoryId) return true;
    if (item.category_id === selectedCategoryId) return true;
    const childCategoryIds = categories
      .filter((c) => c.parent_id === selectedCategoryId)
      .map((c) => c.id);
    return childCategoryIds.includes(item.category_id || '');
  });

  const totalMenuPages = Math.max(1, Math.ceil(displayedItems.length / MENU_ITEMS_PER_PAGE));
  const safeMenuPage = Math.min(menuPage, totalMenuPages);
  const startIndex = (safeMenuPage - 1) * MENU_ITEMS_PER_PAGE;
  const paginatedMenuItems = displayedItems.slice(
    startIndex,
    startIndex + MENU_ITEMS_PER_PAGE
  );

  // Calculate counts per category
  const categoryItemCounts: Record<string, number> = {};
  menuItems.forEach((item) => {
    if (item.category_id) {
      categoryItemCounts[item.category_id] = (categoryItemCounts[item.category_id] || 0) + 1;
    }
  });

  // Map category ID to localized name
  const categoryNameMap: Record<string, string> = {};
  categories.forEach((c) => {
    categoryNameMap[c.id] = language === 'en' && c.name_en ? c.name_en : c.name_fr;
  });

  // Helper to determine applicable complements for a given product (with parent category inheritance)
  const getApplicableComplementsForItem = (item: MenuItem): MenuComplement[] => {
    if (!item.category_id) {
      return complements.filter((c) => c.is_all_categories);
    }
    const itemCategory = categories.find((c) => c.id === item.category_id);
    const parentId = itemCategory?.parent_id;

    return complements.filter((c) => {
      if (c.is_all_categories) return true;
      const catIds = c.category_ids || [];
      return catIds.includes(item.category_id!) || (parentId ? catIds.includes(parentId) : false);
    });
  };

  // Handle Order Created Callback
  const handleOrderCreated = (res: CreateOrderResult) => {
    setIsCheckoutOpen(false);
    setPendingPaymentOrder(res);
    setIsPaymentModalOpen(true);
  };

  // Handle Payment Declared Callback
  const handlePaymentDeclared = (publicRef: string) => {
    setPendingPaymentOrder(null);
    setIsPaymentModalOpen(false);
    setTrackingReference(publicRef);
    setActiveTab('tracking');
  };

  // If authenticated as staff member, display the dedicated internal workspace
  if (!authLoading && user && role) {
    if (role === 'admin') {
      return <AdminDashboard onLogout={signOut} />;
    }
    if (
      role === 'cuisine' ||
      (role as string) === 'caisse' ||
      (role as string) === 'cashier' ||
      (role as string) === 'bar'
    ) {
      return <KitchenWorkspace onLogout={signOut} />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-hotel-bg text-hotel-text">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenStaffLogin={() => setIsStaffLoginOpen(true)}
        pendingPaymentOrder={pendingPaymentOrder}
        onOpenPendingPayment={() => setIsPaymentModalOpen(true)}
      />

      <main className="flex-1">
        {activeTab === 'menu' && (
          <div>
            {/* Editorial Menu Header */}
            <div className="bg-white border-b border-hotel-border">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[#9A721C] font-semibold mb-1.5">
                      Convivium Home Hotel
                    </p>
                    <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-semibold text-hotel-text tracking-tight">
                      {t.menuTitle}
                    </h1>
                    <p className="text-xs sm:text-sm text-hotel-secondary mt-1.5 max-w-xl">
                      {t.menuSubtitle}
                    </p>
                  </div>

                  {pendingPaymentOrder ? (
                    <button
                      type="button"
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="self-start sm:self-auto inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-50 border-2 border-amber-400 text-xs font-bold text-amber-950 shadow-sm hover:bg-amber-100 transition-all animate-pulse"
                    >
                      <CreditCard className="w-4 h-4 text-amber-700 shrink-0" />
                      <div className="text-left">
                        <span className="block text-[11px] font-mono text-amber-800">
                          {pendingPaymentOrder.public_reference} • {formatXAF(pendingPaymentOrder.total_amount)}
                        </span>
                        <span className="block text-xs font-bold text-amber-950">
                          {language === 'fr'
                            ? 'Revenir et finaliser le paiement'
                            : 'Resume & finalize payment'}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-amber-700 shrink-0 ml-1" />
                    </button>
                  ) : trackingReference ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('tracking')}
                      className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FBF7EE] border border-[#E5D099] text-xs font-medium text-hotel-text hover:bg-[#F5EBD6] transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#9A721C]" />
                      <span>
                        {language === 'fr' ? 'Suivre ma commande' : 'Track my order'}{' '}
                        <strong className="font-mono">{trackingReference}</strong>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#9A721C]" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Active Service Location Pill / Banner */}
            {activeServiceLocation && (
              <div className="bg-[#FAF6EE] border-b border-[#D8C79A]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-hotel-text">
                    <span className="w-6 h-6 rounded-md bg-[#9A721C] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <QrCode className="w-3.5 h-3.5" />
                    </span>
                    <span>
                      <strong className="text-[#8A6214] font-bold">
                        {t.verifiedByQr} :
                      </strong>{' '}
                      <span className="font-semibold">{activeServiceLocation.label}</span>
                      <span className="text-hotel-secondary ml-1">
                        ({activeServiceLocation.location_type === 'room' ? t.modeRoomService : t.modeDineIn})
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearServiceLocation}
                    className="text-xs text-[#9A721C] hover:text-hotel-text font-semibold underline shrink-0 px-2 py-1 rounded hover:bg-[#FAF6EE]"
                  >
                    {language === 'fr' ? 'Changer' : 'Change'}
                  </button>
                </div>
              </div>
            )}

            {/* Scan Feedback Banner (e.g. error / confirmation) */}
            {spotScanFeedback && (
              <div
                className={`border-b text-xs px-4 py-2.5 flex items-center justify-between gap-3 ${
                  spotScanFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {spotScanFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span className="font-medium">{spotScanFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpotScanFeedback(null)}
                    className="p-1 hover:opacity-70 shrink-0 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Sticky Category Filter Bar */}
            <div className="sticky top-14 sm:top-16 z-30 bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-hotel-border">
              <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
                <CategoryNav
                  categories={categories}
                  selectedCategoryId={selectedCategoryId}
                  onSelectCategory={(catId) => {
                    setSelectedCategoryId(catId);
                    setMenuPage(1);
                  }}
                  categoryItemCounts={categoryItemCounts}
                />
              </div>
            </div>

            {/* Products Grid (2 columns x 6 rows = 12 per page) */}
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 pb-28 sm:pb-12">
              {isLoadingMenu ? (
                <div className="py-20 text-center text-hotel-muted">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#9A721C] mb-3" />
                  <p className="text-xs">{t.loading}</p>
                </div>
              ) : displayedItems.length === 0 ? (
                <div className="py-12 sm:py-16 text-center hotel-card max-w-md mx-auto p-6 sm:p-8">
                  <div className="w-12 h-12 rounded-full bg-hotel-subtle flex items-center justify-center mx-auto mb-3 border border-hotel-border text-[#9A721C]">
                    <UtensilsCrossed className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-hotel-text mb-1.5">
                    {selectedCategoryId ? t.noItemsAvailable : t.emptyMenuNotice}
                  </h3>
                  <button
                    type="button"
                    onClick={() => loadPublicData(false)}
                    className="mt-4 btn-outline-gold text-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t.refresh}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 2 Columns x 6 Rows Editorial Menu Cards Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:gap-6">
                    {paginatedMenuItems.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        categoryName={item.category_id ? categoryNameMap[item.category_id] : undefined}
                        applicableComplements={getApplicableComplementsForItem(item)}
                      />
                    ))}
                  </div>

                  {/* Pagination Bar */}
                  <div className="pt-4 border-t border-hotel-border flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-hotel-secondary">
                      {language === 'fr' ? (
                        <>
                          Affichage de{' '}
                          <strong className="text-hotel-text font-semibold">
                            {startIndex + 1}
                          </strong>{' '}
                          à{' '}
                          <strong className="text-hotel-text font-semibold">
                            {Math.min(startIndex + MENU_ITEMS_PER_PAGE, displayedItems.length)}
                          </strong>{' '}
                          sur{' '}
                          <strong className="text-hotel-text font-semibold">
                            {displayedItems.length}
                          </strong>{' '}
                          articles (format 2 × 6)
                        </>
                      ) : (
                        <>
                          Showing{' '}
                          <strong className="text-hotel-text font-semibold">
                            {startIndex + 1}
                          </strong>{' '}
                          to{' '}
                          <strong className="text-hotel-text font-semibold">
                            {Math.min(startIndex + MENU_ITEMS_PER_PAGE, displayedItems.length)}
                          </strong>{' '}
                          of{' '}
                          <strong className="text-hotel-text font-semibold">
                            {displayedItems.length}
                          </strong>{' '}
                          items (2 × 6 layout)
                        </>
                      )}
                    </p>

                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeMenuPage <= 1}
                        onClick={() => setMenuPage((p) => Math.max(1, p - 1))}
                        className="btn-outline-gold py-2 px-3 text-xs disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>{language === 'fr' ? 'Précédent' : 'Previous'}</span>
                      </button>

                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalMenuPages }, (_, i) => i + 1).map((pageNum) => (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setMenuPage(pageNum)}
                            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                              pageNum === safeMenuPage
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
                        disabled={safeMenuPage >= totalMenuPages}
                        onClick={() => setMenuPage((p) => Math.min(totalMenuPages, p + 1))}
                        className="btn-outline-gold py-2 px-3 text-xs disabled:opacity-40"
                      >
                        <span>{language === 'fr' ? 'Suivant' : 'Next'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tracking' && (
          <OrderTrackingView
            initialPublicRef={trackingReference}
            onHistoryCleared={() => setTrackingReference(null)}
            onOpenPaymentForOrder={(order) => {
              const savedToken = getStoredClientOrderToken(order.public_reference) || '';
              setPendingPaymentOrder({
                id: order.id,
                public_reference: order.public_reference,
                total_amount: order.total_amount,
                delivery_fee: order.delivery_fee,
                payment_status: order.payment_status,
                preparation_status: order.preparation_status,
                raw_token: savedToken,
                success: true,
              });
              setIsPaymentModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Floating Bottom Bar: Resume pending payment (if modal was closed temporarily) */}
      {pendingPaymentOrder && !isPaymentModalOpen && !isCheckoutOpen && !isCartOpen && (
        <aside
          role="region"
          aria-label={language === 'fr' ? 'Paiement en attente de finalisation' : 'Pending payment'}
          className="fixed bottom-3 inset-x-3 sm:bottom-5 sm:inset-x-auto sm:right-5 sm:max-w-md z-40 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="p-3.5 sm:p-4 rounded-2xl bg-hotel-dark text-white border border-[#D8C79A]/40 shadow-elevated flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-300 uppercase tracking-wider font-semibold truncate">
                  {language === 'fr' ? 'Paiement en attente' : 'Pending payment'}
                </p>
                <p className="text-xs sm:text-sm font-bold text-white truncate">
                  <span className="font-mono text-amber-400">{pendingPaymentOrder.public_reference}</span> • {formatXAF(pendingPaymentOrder.total_amount)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="btn-gold py-2 px-3.5 text-xs font-bold shrink-0 shadow-sm inline-flex items-center gap-1.5"
            >
              <span>{language === 'fr' ? 'Finaliser' : 'Finalize'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Sticky Bottom Cart Bar when items are in cart and no pending payment banner */}
      {activeTab === 'menu' && totalItems > 0 && !isCartOpen && !isCheckoutOpen && !pendingPaymentOrder && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 px-3 pt-2.5 pb-safe bg-white/95 backdrop-blur-md border-t border-hotel-border shadow-elevated">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2.5 text-left min-w-0"
            >
              <div className="w-9 h-9 rounded-lg bg-hotel-subtle border border-hotel-border flex items-center justify-center relative shrink-0">
                <ShoppingBag className="w-4 h-4 text-hotel-text" />
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C59B27] text-stone-950 text-[10px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-hotel-muted leading-none truncate">{t.cartSubtotal}</p>
                <p className="text-sm font-bold text-hotel-text mt-0.5 truncate">{formatXAF(subtotal)}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsCheckoutOpen(true)}
              className="btn-gold py-2.5 px-4 text-xs font-semibold shrink-0"
            >
              <span>{t.cartCheckout}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderCreated={handleOrderCreated}
        restaurantSettings={restaurantSettings}
        activeServiceLocation={activeServiceLocation}
        onClearServiceLocation={handleClearServiceLocation}
      />

      {/* Payment Modal */}
      {pendingPaymentOrder && isPaymentModalOpen && (
        <PaymentModal
          orderResult={pendingPaymentOrder}
          onClose={() => setIsPaymentModalOpen(false)}
          onPaymentDeclared={handlePaymentDeclared}
          onCancelOrder={(publicRef) => {
            setPendingPaymentOrder(null);
            setIsPaymentModalOpen(false);
            if (trackingReference === publicRef) {
              setTrackingReference(null);
            }
          }}
        />
      )}

      {/* Staff Login Modal */}
      <StaffLoginModal
        isOpen={isStaffLoginOpen}
        onClose={() => setIsStaffLoginOpen(false)}
        onSuccess={() => {
          setIsStaffLoginOpen(false);
        }}
      />

      {/* Footer */}
      <Footer onOpenStaffLogin={() => setIsStaffLoginOpen(true)} />
    </div>
  );
}
export default App;
