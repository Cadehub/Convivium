import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Clock, Utensils, Wine, Check, ShoppingBag } from 'lucide-react';
import type { MenuItem, MenuItemVariant, MenuComplement, CartComplementSelection } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatXAF } from '../../lib/formatters';

interface ProductCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem;
  categoryName?: string;
  applicableComplements: MenuComplement[];
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    notes: string,
    variant: MenuItemVariant | null,
    complements: CartComplementSelection[]
  ) => void;
}

export const ProductCustomizationModal: React.FC<ProductCustomizationModalProps> = ({
  isOpen,
  onClose,
  item,
  categoryName,
  applicableComplements,
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

  // Complements quantity map: complementId -> quantity (0 if not selected)
  const [complementsQty, setComplementsQty] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [imageError, setImageError] = useState<boolean>(false);

  if (!isOpen) return null;

  const displayName = language === 'en' && item.name_en ? item.name_en : item.name_fr;
  const prepMinutes =
    item.preparation_time_minutes && item.preparation_time_minutes > 0
      ? item.preparation_time_minutes
      : null;

  const currentVariant = activeVariants.find((v) => v.id === selectedVariantId) || null;

  // Calculate base/variant unit price
  const basePrice =
    currentVariant && currentVariant.price !== null && currentVariant.price !== undefined
      ? currentVariant.price
      : item.price ?? 0;

  // Calculate complements subtotal per unit
  const complementsPerUnit = applicableComplements.reduce((sum, comp) => {
    const qty = complementsQty[comp.id] || 0;
    return sum + (comp.price || 0) * qty;
  }, 0);

  const unitPrice = basePrice + complementsPerUnit;
  const lineTotal = unitPrice * quantity;

  const hasVariants = activeVariants.length > 0;
  const canSubmit = !hasVariants || currentVariant !== null || item.price !== null;

  const handleUpdateCompQty = (compId: string, delta: number) => {
    setComplementsQty((prev) => {
      const current = prev[compId] || 0;
      const next = Math.max(0, Math.min(10, current + delta));
      return { ...prev, [compId]: next };
    });
  };

  const handleConfirm = () => {
    if (!canSubmit) return;

    const selectedComplementsList: CartComplementSelection[] = applicableComplements
      .filter((c) => (complementsQty[c.id] || 0) > 0)
      .map((c) => ({
        complement: c,
        quantity: complementsQty[c.id] || 1,
      }));

    onAddToCart(item, quantity, notes.trim(), currentVariant, selectedComplementsList);
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
        className="relative w-full max-w-lg bg-white rounded-2xl border border-hotel-border shadow-elevated overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-stone-900/80 text-white border border-stone-700 flex items-center justify-center hover:bg-stone-900 transition-colors shadow-sm"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Image Banner */}
        <div className="relative w-full aspect-16/9 sm:aspect-2/1 bg-hotel-subtle overflow-hidden border-b border-hotel-border">
          {item.image_url && !imageError ? (
            <img
              src={item.image_url}
              alt={displayName}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#F6F3EC] text-stone-400">
              {item.item_type === 'drink' ? (
                <Wine className="w-10 h-10 stroke-[1.2] text-[#9A721C]/50" />
              ) : (
                <Utensils className="w-10 h-10 stroke-[1.2] text-[#9A721C]/50" />
              )}
            </div>
          )}

          {categoryName && (
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-[#D8C79A] text-[10px] font-bold uppercase tracking-wider text-[#8A6214] shadow-xs">
              {categoryName}
            </span>
          )}

          {prepMinutes && (
            <span className="absolute bottom-2.5 left-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#1C1613] text-[#F5E6B8] border border-[#C59B27] text-[11px] font-semibold shadow-xs">
              <Clock className="w-3 h-3 text-[#C59B27] shrink-0" />
              <span>{prepMinutes} min</span>
            </span>
          )}
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-5 max-h-[60vh] overflow-y-auto space-y-5">
          {/* Title & Base Price */}
          <div>
            <h3 className="font-serif text-lg sm:text-xl font-bold text-hotel-text">
              {displayName}
            </h3>
            <p className="text-sm font-semibold text-[#9A721C] mt-1 font-mono">
              {formatXAF(unitPrice)}
            </p>
          </div>

          {/* 1. Variants Selection (if item has variants) */}
          {hasVariants && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-hotel-text">
                  {t.variantsTitle}
                </span>
                <span className="text-[11px] font-medium text-[#9A721C]">
                  {t.required}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeVariants.map((v) => {
                  const vName = language === 'en' && v.name_en ? v.name_en : v.name_fr;
                  const vPrice = v.price !== null && v.price !== undefined ? v.price : item.price ?? 0;
                  const isSelected = selectedVariantId === v.id;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
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

          {/* 2. Complements Selection */}
          <div className="space-y-2.5 pt-2 border-t border-hotel-border">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-hotel-text">
                {t.complements}
              </span>
              <p className="text-[11px] text-hotel-secondary mt-0.5">
                {t.complementsSubtitle}
              </p>
            </div>

            {applicableComplements.length > 0 ? (
              <div className="space-y-2">
                {applicableComplements.map((comp) => {
                  const compName = language === 'en' && comp.name_en ? comp.name_en : comp.name_fr;
                  const currentQty = complementsQty[comp.id] || 0;
                  const priceLabel = comp.price > 0 ? `+${formatXAF(comp.price)}` : t.free;

                  return (
                    <div
                      key={comp.id}
                      className="p-2.5 rounded-xl border border-hotel-border bg-[#FAF8F5]/60 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-hotel-text truncate">
                          {compName}
                        </p>
                        <p className="text-[11px] font-medium text-[#9A721C]">
                          {priceLabel}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 bg-white border border-hotel-border rounded-lg p-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={currentQty === 0}
                          onClick={() => handleUpdateCompQty(comp.id, -1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-hotel-muted hover:text-hotel-text disabled:opacity-30 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-hotel-text">
                          {currentQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCompQty(comp.id, 1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-hotel-text hover:bg-hotel-subtle transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-600 text-xs flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-white border border-stone-200 flex items-center justify-center shrink-0 text-[#9A721C]">
                  <Utensils className="w-3.5 h-3.5" />
                </div>
                <span>
                  {language === 'fr'
                    ? 'Aucun complément ou sauce n’est associé à ce plat.'
                    : 'No additional sauces or sides available for this dish.'}
                </span>
              </div>
            )}
          </div>

          {/* 3. Special Notes / Instructions */}
          <div className="space-y-1.5 pt-2 border-t border-hotel-border">
            <label className="text-xs font-medium text-hotel-secondary">
              {t.specialNotes} ({t.optional})
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'fr' ? 'Ex: Bien cuit, sans piment...' : 'e.g. Well cooked, no chili...'}
              className="w-full text-xs px-3 py-2 rounded-lg border border-hotel-border focus:border-[#9A721C] outline-hidden"
              maxLength={150}
            />
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
              className="w-8 h-8 rounded-lg flex items-center justify-center text-hotel-text hover:bg-white disabled:opacity-40 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-hotel-text">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(50, q + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-hotel-text hover:bg-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Submit button with total */}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleConfirm}
            className="flex-1 btn-gold py-2.5 px-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 shadow-subtle disabled:opacity-50"
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
