import React, { useState } from 'react';
import { Plus, Check, Utensils, Wine, Clock, ZoomIn } from 'lucide-react';
import type { MenuItem, MenuItemVariant } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCart } from '../../context/CartContext';
import { formatXAF } from '../../lib/formatters';
import { ProductCustomizationModal } from './ProductCustomizationModal';

interface MenuItemCardProps {
  item: MenuItem;
  categoryName?: string;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  categoryName,
}) => {
  const { language, t } = useLanguage();
  const { items, addItem } = useCart();
  const [imageError, setImageError] = useState(false);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [isJustAdded, setIsJustAdded] = useState(false);

  const displayName = language === 'en' && item.name_en ? item.name_en : item.name_fr;
  const hasValidImage = Boolean(item.image_url && !imageError);
  const prepMinutes =
    item.preparation_time_minutes && item.preparation_time_minutes > 0
      ? item.preparation_time_minutes
      : null;

  const activeVariants = (item.variants || []).filter((v) => v.is_active);
  const hasVariants = activeVariants.length > 0;

  // Compute displayed price
  let displayedPriceText = '';
  if (hasVariants) {
    const prices = activeVariants
      .map((v) => (v.price !== null && v.price !== undefined ? v.price : item.price))
      .filter((p): p is number => p !== null && p !== undefined);

    const minPrice = prices.length > 0 ? Math.min(...prices) : item.price ?? 0;
    displayedPriceText = `${t.startingFrom} ${formatXAF(minPrice)}`;
  } else {
    displayedPriceText = formatXAF(item.price ?? 0);
  }

  // Count items of this menu item in cart across any customization
  const matchingCartItems = items.filter((c) => c.item.id === item.id);
  const totalQuantityInCart = matchingCartItems.reduce((sum, c) => sum + c.quantity, 0);

  const handleCardClick = () => {
    setIsCustomizationOpen(true);
  };

  const handleSimpleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasVariants) {
      setIsCustomizationOpen(true);
    } else {
      addItem(item, 1);
      setIsJustAdded(true);
      setTimeout(() => setIsJustAdded(false), 2000);
    }
  };

  const handleAddToCart = (
    targetItem: MenuItem,
    qty: number,
    notes: string,
    variant: MenuItemVariant | null
  ) => {
    addItem(targetItem, qty, notes, variant);
    setIsJustAdded(true);
    setTimeout(() => setIsJustAdded(false), 2000);
  };

  return (
    <>
      <article
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
        className={`group cursor-pointer bg-white border rounded-xl overflow-hidden transition-all duration-150 flex flex-col justify-between h-full text-left ${
          !item.is_available
            ? 'border-hotel-border opacity-60'
            : isJustAdded || totalQuantityInCart > 0
            ? 'border-emerald-600 ring-1 ring-emerald-500/30 shadow-card'
            : 'border-hotel-border hover:border-hotel-borderStrong shadow-subtle hover:shadow-card'
        }`}
      >
        {/* Top Card Image with strict fixed compact height */}
        <div className="relative w-full h-28 sm:h-36 md:h-40 bg-hotel-subtle overflow-hidden border-b border-hotel-border/60 shrink-0">
          {hasValidImage ? (
            <>
              <img
                src={item.image_url!}
                alt={displayName}
                onError={() => setImageError(true)}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              <span
                className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md bg-[#1C1613]/90 text-[#F5E6B8] border border-[#C59B27]/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                title={language === 'fr' ? 'Voir en grand' : 'View full details'}
              >
                <ZoomIn className="w-3 h-3" />
              </span>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#F6F3EC] text-stone-400 p-2">
              {item.item_type === 'drink' ? (
                <Wine className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.25] text-[#9A721C]/55" />
              ) : (
                <Utensils className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.25] text-[#9A721C]/55" />
              )}
              <span className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-[0.14em] text-stone-400 font-medium">
                {item.item_type === 'drink' ? t.drink : t.dish}
              </span>
            </div>
          )}

          {/* Solid Category pill on top-left */}
          {categoryName && (
            <span className="absolute top-1.5 left-1.5 px-1.5 sm:px-2 py-0.5 rounded bg-[#FAF6EE]/95 border border-[#D8C79A] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#8A6214] shadow-xs truncate max-w-[65%]">
              {categoryName}
            </span>
          )}

          {/* Preparation Time pill on bottom-left when defined */}
          {prepMinutes && (
            <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1C1613]/90 text-[#F5E6B8] border border-[#C59B27]/80 text-[9px] sm:text-[10px] font-semibold shadow-xs">
              <Clock className="w-2.5 h-2.5 text-[#C59B27] shrink-0" />
              <span>{prepMinutes} min</span>
            </span>
          )}

          {/* Total quantity in cart badge */}
          {totalQuantityInCart > 0 && item.is_available && (
            <span className="absolute top-1.5 right-1.5 min-w-[18px] sm:min-w-[22px] h-4.5 sm:h-5 px-1 rounded-full bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center shadow-xs">
              {totalQuantityInCart}
            </span>
          )}

          {/* Availability overlay when unavailable */}
          {!item.is_available && (
            <div className="absolute inset-0 bg-stone-900/75 flex items-center justify-center p-2">
              <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white border border-stone-700 text-[10px] sm:text-[11px] font-medium tracking-wide text-center">
                {t.unavailable}
              </span>
            </div>
          )}
        </div>

        {/* Card Body & Footer Action (Tight, uniform proportions) */}
        <div className="flex-1 flex flex-col justify-between p-2.5 sm:p-3">
          <div>
            {/* Title with standardized uniform height */}
            <div className="h-9 sm:h-10 flex items-start">
              <h3 className="font-serif text-xs sm:text-sm font-semibold text-hotel-text leading-snug line-clamp-2">
                {displayName}
              </h3>
            </div>

            {/* Price & Variants with standardized uniform height */}
            <div className="h-5 flex items-center justify-between gap-1.5 mt-0.5">
              <p className="text-xs sm:text-sm font-bold text-[#9A721C] font-mono">
                {displayedPriceText}
              </p>
              {hasVariants && (
                <span className="text-[9px] sm:text-[10px] font-medium px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200 shrink-0">
                  {activeVariants.length} {t.variants.toLowerCase()}
                </span>
              )}
            </div>
          </div>

          {/* Add to Cart Button (Changes to green feedback on click) */}
          <div
            className="pt-2 mt-2 border-t border-hotel-border/60"
            onClick={(e) => e.stopPropagation()}
          >
            {item.is_available ? (
              <button
                type="button"
                onClick={handleSimpleAdd}
                className={`w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-all duration-200 shadow-subtle min-w-0 cursor-pointer ${
                  isJustAdded
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 scale-[1.01]'
                    : totalQuantityInCart > 0
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-600'
                    : 'bg-hotel-dark text-white hover:bg-stone-800 active:bg-stone-950'
                }`}
              >
                {isJustAdded ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" />
                    <span className="truncate">{language === 'fr' ? 'Ajouté !' : 'Added!'}</span>
                  </>
                ) : totalQuantityInCart > 0 ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-200 stroke-[2.5] shrink-0" />
                    <span className="truncate">
                      {language === 'fr' ? `Ajouté (${totalQuantityInCart})` : `Added (${totalQuantityInCart})`}
                    </span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3 text-[#C59B27] shrink-0" />
                    <span className="truncate">{t.addToCart}</span>
                  </>
                )}
              </button>
            ) : (
              <div className="w-full py-1.5 text-center text-[10px] sm:text-xs font-medium text-hotel-muted bg-stone-50 rounded-lg border border-hotel-border/60">
                {t.unavailable}
              </div>
            )}
          </div>
        </div>
      </article>

      {/* Product Full View & Customization Modal */}
      {isCustomizationOpen && (
        <ProductCustomizationModal
          isOpen={isCustomizationOpen}
          onClose={() => setIsCustomizationOpen(false)}
          item={item}
          categoryName={categoryName}
          onAddToCart={handleAddToCart}
        />
      )}
    </>
  );
};
