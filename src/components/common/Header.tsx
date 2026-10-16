import React, { useState } from 'react';
import { ShoppingBag, Search, Globe, Menu as MenuIcon, X, Lock } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCart } from '../../context/CartContext';
import { getStoredClientOrders } from '../../lib/security';

interface HeaderProps {
  activeTab: 'menu' | 'tracking';
  setActiveTab: (tab: 'menu' | 'tracking') => void;
  onOpenCart: () => void;
  onOpenStaffLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenCart,
  onOpenStaffLogin,
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const { totalItems } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const storedOrdersCount = getStoredClientOrders().length;

  return (
    <header className="sticky top-0 z-40 bg-hotel-black/95 backdrop-blur-md border-b border-hotel-cardBorder shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Hotel Brand */}
          <div
            onClick={() => setActiveTab('menu')}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-hotel-gold/60 shadow-gold-glow flex-shrink-0">
              <img
                src="/logo.jpg"
                alt="Convivium Home Hotel Logo"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  // Fallback in case image fails to load
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-lg sm:text-xl font-bold tracking-wide text-hotel-text group-hover:text-hotel-gold transition-colors">
                  CONVIVIUM HOME
                </span>
                <span className="text-xs font-serif tracking-widest text-hotel-gold font-bold">
                  ★★★
                </span>
              </div>
              <p className="text-[11px] uppercase tracking-widest text-hotel-muted font-medium">
                Hotel & Restaurant
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setActiveTab('menu')}
              className={`text-sm font-medium transition-colors pb-1 border-b-2 ${
                activeTab === 'menu'
                  ? 'text-hotel-gold border-hotel-gold'
                  : 'text-hotel-muted border-transparent hover:text-hotel-text'
              }`}
            >
              {t.navMenu}
            </button>

            <button
              onClick={() => setActiveTab('tracking')}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors pb-1 border-b-2 ${
                activeTab === 'tracking'
                  ? 'text-hotel-gold border-hotel-gold'
                  : 'text-hotel-muted border-transparent hover:text-hotel-text'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>{t.navTrack}</span>
              {storedOrdersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-hotel-gold text-hotel-black">
                  {storedOrdersCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right Action Icons */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hotel-cardBorder bg-hotel-surface hover:border-hotel-gold/50 text-xs font-semibold text-hotel-text transition-all"
              title={language === 'fr' ? 'Switch to English' : 'Passer en Français'}
            >
              <Globe className="w-3.5 h-3.5 text-hotel-gold" />
              <span>{language.toUpperCase()}</span>
            </button>

            {/* Cart Button with Count Badge */}
            <button
              onClick={onOpenCart}
              className="relative p-2.5 rounded-full bg-hotel-surface border border-hotel-cardBorder hover:border-hotel-gold transition-all text-hotel-text focus:outline-none"
              aria-label={t.navCart}
            >
              <ShoppingBag className="w-5 h-5 text-hotel-gold" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-hotel-gold text-hotel-black font-bold text-xs shadow-md animate-pulse">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Discreet Staff Portal Button */}
            <button
              onClick={onOpenStaffLogin}
              className="hidden lg:flex items-center gap-1 text-xs text-hotel-muted/70 hover:text-hotel-gold transition-colors ml-2 px-2 py-1 rounded border border-transparent hover:border-hotel-cardBorder"
              title={t.navStaff}
            >
              <Lock className="w-3 h-3" />
              <span>{t.navStaff}</span>
            </button>

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-hotel-muted hover:text-hotel-text focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-hotel-cardBorder bg-hotel-surface px-4 pt-3 pb-6 space-y-3">
          <button
            onClick={() => {
              setActiveTab('menu');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left py-2 px-3 rounded-lg text-sm font-medium ${
              activeTab === 'menu'
                ? 'bg-hotel-gold/10 text-hotel-gold border border-hotel-gold/20'
                : 'text-hotel-text hover:bg-hotel-card'
            }`}
          >
            {t.navMenu}
          </button>

          <button
            onClick={() => {
              setActiveTab('tracking');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm font-medium ${
              activeTab === 'tracking'
                ? 'bg-hotel-gold/10 text-hotel-gold border border-hotel-gold/20'
                : 'text-hotel-text hover:bg-hotel-card'
            }`}
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-hotel-gold" />
              <span>{t.navTrack}</span>
            </div>
            {storedOrdersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-hotel-gold text-hotel-black">
                {storedOrdersCount}
              </span>
            )}
          </button>

          <div className="pt-2 border-t border-hotel-cardBorder flex items-center justify-between">
            <button
              onClick={() => {
                onOpenStaffLogin();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-1.5 text-xs text-hotel-muted hover:text-hotel-gold py-1"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{t.navStaff}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
