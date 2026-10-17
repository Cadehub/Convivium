import React, { useState } from 'react';
import { Plus, Minus, Utensils, Wine, Clock, ZoomIn, SlidersHorizontal } from 'lucide-react';
import type { MenuItem, MenuComplement, MenuItemVariant, CartComplementSelection } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCart } from '../../context/CartContext';
import { formatXAF } from '../../lib/formatters';
import { ProductCustomizationModal } from './ProductCustomizationModal';

interface MenuItemCardProps {
  item: MenuItem;
  categoryName?: string;
  applicableComplements?: MenuComplement[];
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  categoryName,
  applicableComplements = [],
}) => {
  const { language, t } = useLanguage();
  const { items, addItem, updateQuantity } = useCart();
  const [imageError, setImageError] = useState(false);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);

  const displayName = language === 'en' && item.name_en ? item.name_en : item.name_fr;
  const hasValidImage = Boolean(item.image_url && !imageError);
  const prepMinutes =
    item.preparation_time_minutes && item.preparation_time_minutes > 0
      ? item.preparation_time_minutes
      : null;

  const activeVariants = (item.variants || []).filter((v) => v.is_active);
  const hasVariants = activeVariants.length > 0;
  const hasCustomization = hasVariants || applicableComplements.length > 0;

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
    if (hasCustomization) {
      setIsCustomizationOpen(true);
    } else {
      addItem(item, 1);
    }
  };

  const handleAddToCart = (
    targetItem: MenuItem,
    qty: number,
    notes: string,
    variant: MenuItemVariant | null,
    complements: CartComplementSelection[]
  ) => {
    addItem(targetItem, qty, notes, variant, complements);
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
            : totalQuantityInCart > 0
            ? 'border-[#C59B27] ring-1 ring-[#C59B27]/30 shadow-card'
            : 'border-hotel-border hover:border-hotel-borderStrong shadow-subtle hover:shadow-card'
        }`}
      >
        {/* Top Card Image */}
        <div className="relative w-full aspect-4/3 sm:aspect-16/10 bg-hotel-subtle overflow-hidden border-b border-hotel-border/60">
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
                className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-[#1C1613] text-[#F5E6B8] border border-[#C59B27] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                title={language === 'fr' ? 'Personnaliser et voir' : 'Customize and view'}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </span>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#F6F3EC] text-stone-400 p-3">
              {item.item_type === 'drink' ? (
                <Wine className="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.25] text-[#9A721C]/55" />
              ) : (
                <Utensils className="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.25] text-[#9A721C]/55" />
              )}
              <span className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-stone-400 font-medium">
                {item.item_type === 'drink' ? t.drink : t.dish}
              </span>
            </div>
          )}

          {/* Solid Opaque Category pill on top-left */}
          {categoryName && (
            <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-[#D8C79A] text-[10px] font-bold uppercase tracking-wider text-[#8A6214] shadow-xs truncate max-w-[80%]">
              {categoryName}
            </span>
          )}

          {/* Preparation Time pill on bottom-left when defined */}
          {prepMinutes && (
            <span className="absolute bottom-2 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1C1613] text-[#F5E6B8] border border-[#C59B27] text-[10px] font-semibold shadow-xs">
              <Clock className="w-3 h-3 text-[#C59B27] shrink-0" />
              <span>{prepMinutes} min</span>
            </span>
          )}

          {/* Total quantity in cart badge */}
          {totalQuantityInCart > 0 && item.is_available && (
            <span className="absolute top-2.5 right-2.5 min-w-[24px] h-6 px-1.5 rounded-full bg-[#C59B27] text-stone-950 text-xs font-bold flex items-center justify-center shadow-xs">
              {totalQuantityInCart}
            </span>
          )}

          {/* Availability overlay when unavailable */}
          {!item.is_available && (
            <div className="absolute inset-0 bg-stone-900/75 flex items-center justify-center p-2">
              <span className="px-2.5 py-1 rounded-md bg-stone-900 text-white border border-stone-700 text-[11px] font-medium tracking-wide text-center">
                {t.unavailable}
              </span>
            </div>
          )}
        </div>

        {/* Card Body & Footer Action */}
        <div className="flex-1 flex flex-col justify-between p-3 sm:p-4">
          <div>
            <div className="flex items-start justify-between gap-1.5">
              <h3 className="font-serif text-sm sm:text-base md:text-lg font-semibold text-hotel-text leading-snug line-clamp-2">
                {displayName}
              </h3>
            </div>

            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-xs sm:text-sm md:text-base font-bold text-[#9A721C] font-mono">
                {displayedPriceText}
              </p>
              {hasVariants && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                  {activeVariants.length} {t.variants.toLowerCase()}
                </span>
              )}
            </div>
          </div>

          {/* Add / Customization Controls */}
          <div
            className="pt-3 mt-2.5 border-t border-hotel-border/60"
            onClick={(e) => e.stopPropagation()}
          >
            {item.is_available ? (
              hasCustomization ? (
                <button
                  type="button"
                  onClick={handleSimpleAdd}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-hotel-dark text-white hover:bg-stone-800 active:bg-stone-950 transition-colors shadow-subtle"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#C59B27] shrink-0" />
                  <span className="truncate">{t.customizeDish}</span>
                </button>
              ) : totalQuantityInCart > 0 ? (
                <div className="flex items-center justify-between rounded-lg border border-[#C59B27] bg-[#FBF7EE] p-1">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, totalQuantityInCart - 1)}
                    aria-label={language === 'fr' ? 'Diminuer la quantité' : 'Decrease quantity'}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-hotel-text hover:bg-white transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs sm:text-sm font-bold text-hotel-text">
                    {totalQuantityInCart}
                  </span>
                  <button
                    type="button"
                    onClick={() => addItem(item, 1)}
                    aria-label={language === 'fr' ? 'Augmenter la quantité' : 'Increase quantity'}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-hotel-text hover:bg-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSimpleAdd}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-hotel-dark text-white hover:bg-stone-800 active:bg-stone-950 transition-colors shadow-subtle"
                >
                  <Plus className="w-3.5 h-3.5 text-[#C59B27] shrink-0" />
                  <span className="truncate">{t.addToCart}</span>
                </button>
              )
            ) : (
              <div className="w-full py-2 text-center text-xs font-medium text-hotel-muted bg-stone-50 rounded-lg border border-hotel-border/60">
                {t.unavailable}
              </div>
            )}
          </div>
        </div>
      </article>

      {/* Product Customization & Full View Modal */}
      {isCustomizationOpen && (
        <ProductCustomizationModal
          isOpen={isCustomizationOpen}
          onClose={() => setIsCustomizationOpen(false)}
          item={item}
          categoryName={categoryName}
          applicableComplements={applicableComplements}
          onAddToCart={handleAddToCart}
        />
      )}
    </>
  );
};
