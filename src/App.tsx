import { useState, useEffect } from 'react';
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
import { useLanguage } from './i18n/LanguageContext';
import { menuService } from './services/menu.service';
import { settingsService } from './services/settings.service';
import type { MenuCategory, MenuItem, RestaurantSettings } from './types';
import type { CreateOrderResult } from './services/orders.service';
import { UtensilsCrossed, Loader2, RefreshCw } from 'lucide-react';

export function App() {
  const { user, role, signOut, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();

  // Navigation State
  const [activeTab, setActiveTab] = useState<'menu' | 'tracking'>('menu');
  const [trackingReference, setTrackingReference] = useState<string | null>(null);

  // Modals
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState(false);
  const [activePaymentOrder, setActivePaymentOrder] = useState<CreateOrderResult | null>(null);

  // Data State
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings | null>(null);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);

  // Load public menu
  const loadPublicData = async () => {
    setIsLoadingMenu(true);
    try {
      const [cats, items, settings] = await Promise.all([
        menuService.getPublicCategories().catch(() => []),
        menuService.getPublicMenuItems().catch(() => []),
        settingsService.getRestaurantSettings().catch(() => null),
      ]);
      setCategories(cats);
      setMenuItems(items);
      setRestaurantSettings(settings);
    } catch (e) {
      console.error('Error loading public data', e);
    } finally {
      setIsLoadingMenu(false);
    }
  };

  useEffect(() => {
    loadPublicData();
  }, []);

  // Filtered Menu Items
  const displayedItems = menuItems.filter((item) => {
    if (!selectedCategoryId) return true;
    return item.category_id === selectedCategoryId;
  });

  // Calculate counts per category
  const categoryItemCounts: Record<string, number> = {};
  menuItems.forEach((item) => {
    if (item.category_id) {
      categoryItemCounts[item.category_id] = (categoryItemCounts[item.category_id] || 0) + 1;
    }
  });

  // Handle Order Created Callback
  const handleOrderCreated = (res: CreateOrderResult) => {
    setIsCheckoutOpen(false);
    setActivePaymentOrder(res);
  };

  // Handle Payment Declared Callback
  const handlePaymentDeclared = (publicRef: string) => {
    setActivePaymentOrder(null);
    setTrackingReference(publicRef);
    setActiveTab('tracking');
  };

  // If authenticated as staff member, display the dedicated internal workspace
  if (!authLoading && user && role) {
    if (role === 'cuisine') {
      return <KitchenWorkspace onLogout={signOut} />;
    }
    if (role === 'admin') {
      return <AdminDashboard onLogout={signOut} />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-hotel-black text-hotel-text selection:bg-hotel-gold selection:text-hotel-black">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenStaffLogin={() => setIsStaffLoginOpen(true)}
      />

      <main className="flex-1">
        {activeTab === 'menu' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Hero / Banner */}
            <div className="text-center max-w-2xl mx-auto pt-4 sm:pt-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-hotel-surface border border-hotel-cardBorder text-hotel-gold text-xs font-semibold mb-4 shadow-sm">
                <span>★★★</span>
                <span>Convivium Home Hotel</span>
                <span>★★★</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-hotel-text">
                {t.menuTitle}
              </h1>
              <p className="text-xs sm:text-sm text-hotel-muted mt-3 leading-relaxed">
                {t.menuSubtitle}
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="pt-4 border-t border-hotel-cardBorder/60">
              <CategoryNav
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                categoryItemCounts={categoryItemCounts}
              />
            </div>

            {/* Products Grid */}
            {isLoadingMenu ? (
              <div className="py-24 text-center text-hotel-muted">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-hotel-gold mb-3" />
                <p className="text-xs">{t.loading}</p>
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="py-20 text-center hotel-card max-w-md mx-auto p-8">
                <div className="w-16 h-16 rounded-full bg-hotel-surface flex items-center justify-center mx-auto mb-4 border border-hotel-cardBorder text-hotel-gold/50">
                  <UtensilsCrossed className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-lg font-bold text-hotel-text mb-2">
                  {selectedCategoryId ? t.noItemsAvailable : t.emptyMenuNotice}
                </h3>
                <p className="text-xs text-hotel-muted leading-relaxed">
                  Notre chef et l'équipe de cuisine actualisent quotidiennement nos sélections.
                </p>
                <button
                  onClick={loadPublicData}
                  className="mt-6 btn-secondary text-xs flex items-center gap-1.5 mx-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t.refresh}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {displayedItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tracking' && (
          <OrderTrackingView
            initialPublicRef={trackingReference}
            onOpenPaymentForOrder={(order) => {
              setActivePaymentOrder({
                id: order.id,
                public_reference: order.public_reference,
                total_amount: order.total_amount,
                payment_status: order.payment_status,
                preparation_status: order.preparation_status,
                raw_token: '',
                success: true,
              });
            }}
          />
        )}
      </main>

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
      />

      {/* Payment Modal */}
      {activePaymentOrder && (
        <PaymentModal
          orderResult={activePaymentOrder}
          onClose={() => setActivePaymentOrder(null)}
          onPaymentDeclared={handlePaymentDeclared}
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
