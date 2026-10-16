import React, { useState } from 'react';
import { Plus, Check, Utensils, GlassWater } from 'lucide-react';
import type { MenuItem } from '../../types';
import { formatXAF } from '../../lib/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCart } from '../../context/CartContext';

interface MenuItemCardProps {
  item: MenuItem;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  const { language, t } = useLanguage();
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const displayName = language === 'en' && item.name_en ? item.name_en : item.name_fr;

  const handleAdd = () => {
    if (!item.is_available) return;
    addItem(item, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div className="hotel-card overflow-hidden flex flex-col justify-between group">
      {/* Product Image / Luxury Fallback */}
      <div className="relative w-full h-48 bg-hotel-surface overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-hotel-surface to-hotel-card text-hotel-gold/40">
            {item.item_type === 'drink' ? (
              <GlassWater className="w-12 h-12 stroke-[1.2]" />
            ) : (
              <Utensils className="w-12 h-12 stroke-[1.2]" />
            )}
            <span className="text-[11px] uppercase tracking-widest text-hotel-muted/60 mt-2 font-serif">
              Convivium Home
            </span>
          </div>
        )}

        {/* Availability Badge */}
        {!item.is_available && (
          <div className="absolute inset-0 bg-hotel-black/75 backdrop-blur-[2px] flex items-center justify-center p-3">
            <span className="text-xs font-semibold text-red-400 bg-red-950/80 px-3 py-1 rounded-full border border-red-800">
              {t.unavailable}
            </span>
          </div>
        )}

        {/* Item Type Badge (Dish / Drink) */}
        <div className="absolute top-2.5 left-2.5">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-hotel-black/70 backdrop-blur-sm text-hotel-gold border border-hotel-gold/30">
            {item.item_type === 'drink' ? t.drink : t.dish}
          </span>
        </div>
      </div>

      {/* Product Information (strictly name and price only, no description, no stock) */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-serif text-base sm:text-lg font-semibold text-hotel-text group-hover:text-hotel-gold transition-colors line-clamp-2">
            {displayName}
          </h3>
        </div>

        <div className="mt-4 pt-3 border-t border-hotel-cardBorder/60 flex items-center justify-between">
          <div>
            <span className="text-xs text-hotel-muted block font-medium">Prix</span>
            <span className="text-base sm:text-lg font-bold text-hotel-gold font-serif">
              {formatXAF(item.price)}
            </span>
          </div>

          <button
            onClick={handleAdd}
            disabled={!item.is_available}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              justAdded
                ? 'bg-green-600 text-white'
                : item.is_available
                ? 'bg-hotel-gold text-hotel-black hover:bg-hotel-gold-light active:bg-hotel-gold-dark shadow-sm'
                : 'bg-hotel-surface text-hotel-muted border border-hotel-cardBorder cursor-not-allowed'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Ajouté</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.addToCart}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
