import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Clock, Utensils, Wine, Check, ShoppingBag } from 'lucide-react';
import type { MenuItem, MenuItemVariant } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatXAF } from '../../lib/formatters';

interface ProductCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem;
  categoryName?: string;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    notes: string,
    variant: MenuItemVariant | null
  ) => void;
}

export const ProductCustomizationModal: React.FC<ProductCustomizationModalProps> = ({
  isOpen,
  onClose,
  item,
  categoryName,
  onAddToCart,
}) => {
  const { language, t } = useLanguage();

  const activeVariants = useMemo(() => {
    return (item.variants || []).filter((v) => v.is_active);
  }, [item.variants]);

  // Selected variant state: defaults to first variant if present
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() => {
    return activeVariants.length > 0 ? activeVariants[0].id : null;
  });

  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [imageError, setImageError] = useState<boolean>(false);

  if (!isOpen) return null;

  const displayName = language === 'en' && item.name_en ? item.name_en : item.name_fr;
  const prepMinutes =
    item.preparation_time_minutes && item.preparation_time_minutes > 0
      ? item.preparation_time_minutes
      : null;

  // Description is only truthy if non-empty trimmed text exists
  const itemDescription = (
    language === 'en'
      ? item.description_en || item.description_fr
      : item.description_fr || item.description_en
  )?.trim() || null;

  const currentVariant = activeVariants.find((v) => v.id === selectedVariantId) || null;

  // Calculate base/variant unit price
  const basePrice =
    currentVariant && currentVariant.price !== null && currentVariant.price !== undefined
      ? currentVariant.price
      : item.price ?? 0;

  const unitPrice = basePrice;
  const lineTotal = unitPrice * quantity;

  const hasVariants = activeVariants.length > 0;
  const canSubmit = !hasVariants || currentVariant !== null || item.price !== null;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onAddToCart(item, quantity, notes.trim(), currentVariant);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/80 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl sm:max-w-2xl bg-white rounded-2xl border border-hotel-border shadow-elevated overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-stone-900/80 text-white border border-stone-700 flex items-center justify-center hover:bg-stone-900 transition-colors shadow-sm cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Large Image Banner */}
        <div className="relative w-full aspect-16/10 sm:aspect-16/9 md:aspect-2/1 max-h-72 sm:max-h-80 md:max-h-96 bg-hotel-subtle overflow-hidden border-b border-hotel-border">
          {item.image_url && !imageError ? (
            <img
              src={item.image_url}
              alt={displayName}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#F6F3EC] text-stone-400 p-6 min-h-[180px]">
              {item.item_type === 'drink' ? (
                <Wine className="w-12 h-12 stroke-[1.25] text-[#9A721C]/50" />
              ) : (
                <Utensils className="w-12 h-12 stroke-[1.25] text-[#9A721C]/50" />
              )}
              <span className="mt-2 text-xs uppercase tracking-wider text-stone-400 font-medium">
                {item.item_type === 'drink' ? t.drink : t.dish}
              </span>
            </div>
          )}

          {categoryName && (
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-[#D8C79A] text-[10px] font-bold uppercase tracking-wider text-[#8A6214] shadow-xs">
              {categoryName}
            </span>
          )}

          {prepMinutes && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1C1613] text-[#F5E6B8] border border-[#C59B27] text-[10px] font-semibold shadow-xs">
              <Clock className="w-3 h-3 text-[#C59B27]" />
              <span>{prepMinutes} min</span>
            </span>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[55vh] overflow-y-auto">
          {/* Title & Price */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-hotel-text leading-snug">
                {displayName}
              </h2>
              <span className="text-lg sm:text-xl font-bold text-[#9A721C] shrink-0 font-mono">
                {formatXAF(unitPrice)}
              </span>
            </div>

            {/* Description: ONLY rendered when a real non-empty description exists */}
            {itemDescription && (
              <div className="mt-3 text-xs sm:text-sm text-stone-700 leading-relaxed bg-[#FAF8F5] p-3 sm:p-3.5 rounded-xl border border-hotel-border/70 shadow-2xs">
                {itemDescription}
              </div>
            )}
          </div>

          {/* 1. Variants Selection (ONLY rendered if product has variants) */}
          {hasVariants && (
            <div className="space-y-2 pt-2 border-t border-hotel-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-hotel-text">
                  {t.variantsTitle}
                </span>
                <p className="text-[11px] text-hotel-secondary mt-0.5">
                  {t.selectVariant}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeVariants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  const vName = language === 'en' && v.name_en ? v.name_en : v.name_fr;
                  const vPrice = v.price !== null && v.price !== undefined ? v.price : item.price ?? 0;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#9A721C] bg-[#FAF6EE] shadow-xs'
                          : 'border-hotel-border bg-white hover:border-hotel-borderStrong'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-[#9A721C] bg-[#9A721C] text-white'
                              : 'border-stone-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span className="text-xs font-semibold text-hotel-text truncate">
                          {vName}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#9A721C] shrink-0 font-mono ml-2">
                        {formatXAF(vPrice)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Special Notes / Instructions (Spacious multi-line textarea) */}
          <div className="space-y-1.5 pt-2 border-t border-hotel-border">
            <label className="text-xs font-semibold text-hotel-text block">
              {t.specialNotes} <span className="font-normal text-hotel-secondary">({t.optional})</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'fr' ? 'Ex: Cuisson à point, sans piment, bien chaud...' : 'e.g. Medium well, no chili, extra hot...'}
              className="w-full text-xs sm:text-sm p-3 rounded-xl border border-hotel-border focus:border-[#9A721C] focus:ring-1 focus:ring-[#9A721C] outline-hidden leading-relaxed resize-y bg-white"
              maxLength={250}
            />
            <p className="text-[11px] text-hotel-muted text-right">
              {notes.length}/250
            </p>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 sm:p-5 border-t border-hotel-border bg-white flex items-center justify-between gap-3">
          {/* Quantity stepper */}
          <div className="inline-flex items-center gap-1 bg-hotel-subtle rounded-xl border border-hotel-border p-1">
            <button
              type="button"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-hotel-text hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-hotel-text">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(50, q + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-hotel-text hover:bg-white transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Submit button with total */}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleConfirm}
            className="flex-1 btn-gold py-2.5 px-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 shadow-subtle disabled:opacity-50 cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5 truncate">
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>{t.confirmCustomization}</span>
            </span>
            <span className="font-mono font-bold shrink-0">
              {formatXAF(lineTotal)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
