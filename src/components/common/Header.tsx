import React from 'react';
import { ShoppingBag, Search, ShieldCheck, ChefHat, CreditCard } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  activeTab: 'menu' | 'tracking';
  setActiveTab: (tab: 'menu' | 'tracking') => void;
  onOpenCart: () => void;
  onOpenStaffLogin: () => void;
  pendingPaymentOrder?: { public_reference: string } | null;
  onOpenPendingPayment?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenCart,
  onOpenStaffLogin,
  pendingPaymentOrder,
  onOpenPendingPayment,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const { totalItems } = useCart();
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-hotel-border">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Official Logo & Brand Name */}
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className="flex items-center gap-2 sm:gap-3 text-left group focus:outline-none min-w-0"
          >
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-stone-200 bg-stone-900 shrink-0 shadow-subtle">
              <img
                src="/logo.jpg"
                alt="Convivium Home Hotel"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <span className="block font-serif text-base sm:text-xl font-semibold text-hotel-text tracking-tight leading-none truncate">
                Convivium
              </span>
              <span className="block text-[9px] sm:text-[10px] uppercase tracking-[0.16em] text-[#9A721C] font-medium mt-0.5 truncate">
                Home Hotel
              </span>
            </div>
          </button>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'menu'
                  ? 'bg-hotel-subtle text-hotel-text font-semibold'
                  : 'text-hotel-secondary hover:text-hotel-text hover:bg-stone-100/70'
              }`}
            >
              {t.navMenu}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tracking')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'tracking'
                  ? 'bg-hotel-subtle text-hotel-text font-semibold'
                  : 'text-hotel-secondary hover:text-hotel-text hover:bg-stone-100/70'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-hotel-muted" />
              {t.navTrack}
            </button>
          </nav>

          {/* Right Controls: Mobile Nav, Language Switcher, Staff, Cart */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Menu / Track switcher */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'tracking' ? 'menu' : 'tracking')}
              className={`md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activeTab === 'tracking'
                  ? 'bg-hotel-dark text-white border-hotel-dark'
                  : 'bg-white text-hotel-secondary border-hotel-border hover:bg-hotel-subtle'
              }`}
              title={t.navTrack}
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>{activeTab === 'tracking' ? t.navMenu : (language === 'fr' ? 'Suivi' : 'Orders')}</span>
            </button>

            {/* Staff login button (desktop) */}
            {!profile && (
              <button
                type="button"
                onClick={onOpenStaffLogin}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-hotel-muted hover:text-hotel-text hover:bg-hotel-subtle transition-colors"
              >
                {t.navStaff}
              </button>
            )}

            {profile && profile.is_active && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FBF7EE] text-[#9A721C] border border-[#E5D099]">
                {profile.role === 'admin' ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ChefHat className="w-3.5 h-3.5" />
                )}
                <span>{profile.role === 'admin' ? 'Admin' : 'Cuisine'}</span>
              </span>
            )}

            {/* Discreet FR / EN Toggle */}
            <div
              className="inline-flex items-center rounded-lg border border-hotel-border bg-hotel-subtle/60 p-0.5 text-[11px] sm:text-xs font-medium"
              role="group"
              aria-label="Language selector"
            >
              <button
                type="button"
                onClick={() => setLanguage('fr')}
                className={`px-1.5 sm:px-2 py-1 rounded-md transition-colors ${
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
                className={`px-1.5 sm:px-2 py-1 rounded-md transition-colors ${
                  language === 'en'
                    ? 'bg-white text-hotel-text shadow-subtle font-semibold'
                    : 'text-hotel-muted hover:text-hotel-text'
                }`}
              >
                EN
              </button>
            </div>

            {/* Reopen Pending Payment declaration button if client has an unpaid order */}
            {pendingPaymentOrder && onOpenPendingPayment && (
              <button
                type="button"
                onClick={onOpenPendingPayment}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors shadow-2xs animate-pulse"
                title={language === 'fr' ? 'Finaliser votre déclaration de paiement' : 'Finalize payment declaration'}
              >
                <CreditCard className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="hidden md:inline font-mono text-[11px] font-bold">
                  {pendingPaymentOrder.public_reference}
                </span>
                <span className="text-[11px] font-medium">
                  {language === 'fr' ? 'Paiement en attente' : 'Pending payment'}
                </span>
              </button>
            )}

            {/* Cart Button */}
            <button
              type="button"
              onClick={onOpenCart}
              aria-label={t.navCart}
              className={`relative inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                totalItems > 0
                  ? 'bg-hotel-dark text-white hover:bg-stone-800 shadow-subtle'
                  : 'bg-white text-hotel-text border border-hotel-borderStrong hover:bg-hotel-subtle'
              }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t.navCart}</span>
              {totalItems > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] sm:min-w-[20px] h-[18px] sm:h-5 px-1 sm:px-1.5 text-[11px] sm:text-xs font-semibold rounded-full bg-[#C59B27] text-stone-950">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
