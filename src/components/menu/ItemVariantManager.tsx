import React, { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2, XCircle } from 'lucide-react';
import type { MenuItemVariant } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatXAF } from '../../lib/formatters';

interface ItemVariantManagerProps {
  hasVariants: boolean;
  onToggleHasVariants?: (has: boolean) => void;
  onHasVariantsChange?: (has: boolean) => void;
  variants: MenuItemVariant[];
  onChangeVariants?: (variants: MenuItemVariant[]) => void;
  onVariantsChange?: (variants: MenuItemVariant[]) => void;
  basePrice: number | null;
}

export const ItemVariantManager: React.FC<ItemVariantManagerProps> = ({
  hasVariants,
  onToggleHasVariants,
  onHasVariantsChange,
  variants,
  onChangeVariants,
  onVariantsChange,
  basePrice,
}) => {
  const toggleHasVariants = onHasVariantsChange || onToggleHasVariants || (() => {});
  const changeVariants = onVariantsChange || onChangeVariants || (() => {});
  const { language, t } = useLanguage();

  const [newNameFr, setNewNameFr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newPrice, setNewPrice] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddVariant = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newNameFr.trim()) {
      setErrorMsg(language === 'fr' ? 'Le nom de la variante est obligatoire.' : 'Variant name is required.');
      return;
    }

    const parsedPrice = newPrice.trim() !== '' ? Math.max(0, parseInt(newPrice) || 0) : null;

    if (parsedPrice === null && (basePrice === null || basePrice === undefined || basePrice === 0)) {
      setErrorMsg(
        language === 'fr'
          ? 'Un prix est obligatoire pour la variante si aucun prix de base applicable n’est défini sur le produit.'
          : 'A variant price is required if no applicable base price is defined on the product.'
      );
      return;
    }

    const newVariant: MenuItemVariant = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      menu_item_id: '',
      name_fr: newNameFr.trim(),
      name_en: newNameEn.trim() || null,
      price: parsedPrice,
      is_active: true,
      sort_order: variants.length,
    };

    changeVariants([...variants, newVariant]);
    setNewNameFr('');
    setNewNameEn('');
    setNewPrice('');
  };

  const handleRemoveVariant = (id: string) => {
    changeVariants(variants.filter((v) => v.id !== id));
  };

  const handleToggleVariantActive = (id: string) => {
    changeVariants(
      variants.map((v) => (v.id === id ? { ...v, is_active: !v.is_active } : v))
    );
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= variants.length) return;

    const copy = [...variants];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const reindexed = copy.map((v, i) => ({ ...v, sort_order: i }));
    changeVariants(reindexed);
  };

  return (
    <div className="pt-3 border-t border-hotel-border space-y-3">
      {/* Has Variants Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-hotel-subtle/70 border border-hotel-border">
        <div>
          <label
            htmlFor="hasVariantsToggle"
            className="text-xs font-bold text-hotel-text cursor-pointer"
          >
            {t.hasVariantsLabel}
          </label>
          <p className="text-[11px] text-hotel-secondary mt-0.5">
            {language === 'fr'
              ? 'Activez cette option si le produit propose différents formats ou options (ex: Petit, Grand, Familial).'
              : 'Enable this if the item has different sizes or formats (e.g. Small, Large, Family).'}
          </p>
        </div>

        <input
          type="checkbox"
          id="hasVariantsToggle"
          checked={hasVariants}
          onChange={(e) => toggleHasVariants(e.target.checked)}
          className="w-4 h-4 rounded border-hotel-borderStrong text-[#9A721C] focus:ring-[#9A721C]"
        />
      </div>

      {hasVariants && (
        <div className="space-y-3.5 p-3 rounded-xl bg-white border border-hotel-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-hotel-text">
              {t.variants} ({variants.length})
            </span>
            {basePrice !== null && basePrice > 0 && (
              <span className="text-[11px] text-hotel-secondary">
                {language === 'fr' ? 'Prix de base repli :' : 'Fallback base price:'}{' '}
                <strong className="text-hotel-text font-mono">{formatXAF(basePrice)}</strong>
              </span>
            )}
          </div>

          {/* List of existing variants */}
          {variants.length === 0 ? (
            <p className="text-xs text-amber-700 italic bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              {language === 'fr'
                ? 'Aucune variante ajoutée. Veuillez ajouter au moins une variante pour enregistrer ce produit.'
                : 'No variants added yet. Please add at least one variant.'}
            </p>
          ) : (
            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div
                  key={v.id}
                  className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs transition-colors ${
                    v.is_active
                      ? 'border-hotel-border bg-[#FAF8F5]/60'
                      : 'border-hotel-border bg-stone-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-5 text-center font-bold text-hotel-muted text-[11px]">
                      {idx + 1}.
                    </span>
                    <div className="min-w-0 truncate">
                      <span className="font-semibold text-hotel-text">{v.name_fr}</span>
                      {v.name_en && (
                        <span className="text-[11px] text-hotel-muted ml-1.5">
                          ({v.name_en})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-[#9A721C]">
                      {v.price !== null && v.price !== undefined
                        ? formatXAF(v.price)
                        : basePrice
                        ? `${formatXAF(basePrice)} (base)`
                        : '—'}
                    </span>

                    {/* Toggle Active */}
                    <button
                      type="button"
                      onClick={() => handleToggleVariantActive(v.id)}
                      className="p-1 text-hotel-muted hover:text-hotel-text transition-colors"
                      title={v.is_active ? t.available : t.unavailable}
                    >
                      {v.is_active ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-stone-400" />
                      )}
                    </button>

                    {/* Reorder Up */}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'up')}
                      className="p-1 text-hotel-muted hover:text-hotel-text disabled:opacity-30 transition-colors"
                      title="Monter"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Reorder Down */}
                    <button
                      type="button"
                      disabled={idx === variants.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      className="p-1 text-hotel-muted hover:text-hotel-text disabled:opacity-30 transition-colors"
                      title="Descendre"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(v.id)}
                      className="p-1 text-hotel-muted hover:text-red-600 transition-colors"
                      title={t.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Variant Form Mini Strip */}
          <div className="pt-2 border-t border-hotel-border/70">
            <span className="text-[11px] font-bold uppercase tracking-wider text-hotel-secondary block mb-1.5">
              + {t.addVariant}
            </span>

            {errorMsg && (
              <p className="text-[11px] text-red-600 font-medium mb-1.5">{errorMsg}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={newNameFr}
                onChange={(e) => setNewNameFr(e.target.value)}
                placeholder={language === 'fr' ? 'Nom FR (ex: Grand)' : 'Name FR (e.g. Large)'}
                className="input-hotel text-xs py-1.5"
              />
              <input
                type="text"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder="Name EN (optional)"
                className="input-hotel text-xs py-1.5"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder={
                    basePrice ? `${t.variantPriceOptional}` : `${t.variantPrice} *`
                  }
                  className="input-hotel text-xs py-1.5 font-mono flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="btn-gold py-1.5 px-3 text-xs font-semibold shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
