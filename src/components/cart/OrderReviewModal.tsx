import React from 'react';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Utensils,
  MessageSquare,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatXAF } from '../../lib/formatters';

interface OrderReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToCheckout: () => void;
}

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  isOpen,
  onClose,
  onProceedToCheckout,
}) => {
  const {
    items,
    updateQuantity,
    updateNotes,
    removeItem,
    subtotal,
    totalItems,
    getItemLineKey,
    getItemUnitPrice,
    getItemLineTotal,
  } = useCart();
  const { language, t } = useLanguage();

  if (!isOpen) return null;

  const handleProceed = () => {
    onClose();
    onProceedToCheckout();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 lg:p-6 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated z-10 my-0 sm:my-auto max-h-[92dvh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-hotel-border bg-[#FAF8F5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#C59B27]/15 text-[#8A6214] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-[#9A721C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-hotel-text">
                  {t.orderReviewTitle}
                </h3>
                {totalItems > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#C59B27] text-stone-950">
                    {totalItems}
                  </span>
                )}
              </div>
              <p className="text-xs text-hotel-secondary mt-0.5">
                {t.orderReviewSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-stone-200/60 transition-colors shrink-0"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Order Items with Quantity Steppers and Per-Dish Special Instructions */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-3.5 bg-[#FAF8F5]/50">
          {items.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h4 className="font-serif text-base font-semibold text-hotel-text">
                {t.cartEmpty}
              </h4>
              <p className="text-xs text-hotel-secondary max-w-xs mx-auto">
                {t.cartEmptySubtitle}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="btn-outline-gold text-xs py-2 px-4"
              >
                {t.continueShoppingInMenu}
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {items.map((cartItem) => {
                const lineKey = getItemLineKey(cartItem);
                const name =
                  language === 'en' && cartItem.item.name_en
                    ? cartItem.item.name_en
                    : cartItem.item.name_fr;
                const variantName = cartItem.variant
                  ? language === 'en' && cartItem.variant.name_en
                    ? cartItem.variant.name_en
                    : cartItem.variant.name_fr
                  : null;
                const unitPrice = getItemUnitPrice(cartItem);
                const lineTotal = getItemLineTotal(cartItem);

                return (
                  <div
                    key={lineKey}
                    className="p-3.5 sm:p-4 rounded-xl bg-white border border-hotel-border shadow-subtle flex flex-col gap-3 text-left"
                  >
                    <div className="flex items-start gap-3.5 sm:gap-4">
                      {/* Item Thumbnail */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-lg overflow-hidden bg-stone-100 border border-hotel-border shrink-0 flex items-center justify-center relative">
                        {cartItem.item.image_url ? (
                          <img
                            src={cartItem.item.image_url}
                            alt={name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Utensils className="w-6 h-6 text-[#9A721C]/50" />
                        )}
                      </div>

                      {/* Content Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-serif text-sm sm:text-base lg:text-lg font-semibold text-hotel-text leading-snug">
                              {name}
                            </h4>
                            {variantName && (
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-[#9A721C]/15 text-[#9A721C]">
                                {variantName}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(lineKey)}
                            className="text-stone-400 hover:text-red-600 p-1 rounded transition-colors shrink-0"
                            title={t.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Selected Complements list */}
                        {cartItem.selectedComplements &&
                          cartItem.selectedComplements.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {cartItem.selectedComplements.map((c) => {
                                const compName =
                                  language === 'en' && c.complement.name_en
                                    ? c.complement.name_en
                                    : c.complement.name_fr;
                                return (
                                  <span
                                    key={c.complement.id}
                                    className="inline-flex items-center text-[10px] sm:text-[11px] text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200"
                                  >
                                    + {c.quantity > 1 ? `${c.quantity}× ` : ''}
                                    {compName}
                                    {c.complement.price > 0 &&
                                      ` (${formatXAF(c.complement.price * c.quantity)})`}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                        {/* Quantity Stepper & Price */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-100">
                          {/* Quantity Stepper: Increase / Decrease */}
                          <div className="inline-flex items-center gap-1 bg-[#FBF7EE] rounded-lg border border-[#E5D099] p-0.5 sm:p-1">
                            <button
                              type="button"
                              onClick={() => updateQuantity(lineKey, cartItem.quantity - 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-hotel-text hover:bg-white transition-colors"
                              aria-label={language === 'fr' ? 'Diminuer' : 'Decrease'}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs sm:text-sm font-bold text-hotel-text font-mono">
                              {cartItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(lineKey, cartItem.quantity + 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-hotel-text hover:bg-white transition-colors"
                              aria-label={language === 'fr' ? 'Augmenter' : 'Increase'}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Price breakdown */}
                          <div className="text-right">
                            <span className="text-sm sm:text-base font-extrabold text-hotel-text font-mono block">
                              {formatXAF(lineTotal)}
                            </span>
                            <span className="text-[10px] sm:text-xs text-hotel-muted font-mono block">
                              {formatXAF(unitPrice)} / {language === 'fr' ? 'unité' : 'unit'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Per-Dish Special Instructions Input */}
                    <div className="pt-2 border-t border-stone-100">
                      <div className="relative flex items-center">
                        <MessageSquare className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5 shrink-0 pointer-events-none" />
                        <textarea
                          rows={2}
                          value={cartItem.notes || ''}
                          onChange={(e) => updateNotes(lineKey, e.target.value)}
                          placeholder={t.dishSpecialNotesPlaceholder}
                          className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-hotel-border focus:border-[#C59B27] focus:ring-1 focus:ring-[#C59B27] bg-[#FAF8F5]/80 placeholder:text-stone-400 text-hotel-text resize-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Financial Total & The 2 Requested Buttons */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 lg:p-6 border-t border-hotel-border bg-white space-y-4 shrink-0">
            {/* Total Row */}
            <div className="flex items-baseline justify-between">
              <div>
                <span className="block text-xs uppercase tracking-wider font-semibold text-hotel-secondary">
                  {language === 'fr' ? 'Total de la commande' : 'Order Total'}
                </span>
                <span className="text-[11px] text-hotel-muted">
                  {totalItems} {totalItems === 1 ? 'article' : 'articles'}
                </span>
              </div>
              <span className="font-serif text-2xl sm:text-3xl font-extrabold text-stone-950 font-mono">
                {formatXAF(subtotal)}
              </span>
            </div>

            {/* The 2 Primary Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {/* Button 1: Continuer (Checkout / Finalize) */}
              <button
                type="button"
                onClick={handleProceed}
                className="w-full btn-gold py-3 px-5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 order-1 shadow-subtle hover:bg-stone-800"
              >
                <span>{t.continueToOrder}</span>
                <ArrowRight className="w-4 h-4 text-[#C59B27]" />
              </button>

              {/* Button 2: Continuer l'achat dans le menu */}
              <button
                type="button"
                onClick={onClose}
                className="w-full btn-outline-gold py-3 px-5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 order-2 hover:bg-[#FAF8F5]"
              >
                <span>{t.continueShoppingInMenu}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
