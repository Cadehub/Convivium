import React from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Utensils,
  MessageSquare,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatXAF } from '../../lib/formatters';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  onProceedToCheckout,
}) => {
  const {
    items,
    updateQuantity,
    updateNotes,
    removeItem,
    clearCart,
    subtotal,
    totalItems,
    getItemLineKey,
    getItemUnitPrice,
    getItemLineTotal,
  } = useCart();
  const { language, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Subtle Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex sm:pl-10">
        <div className="w-screen max-w-full sm:max-w-md bg-white sm:border-l border-hotel-border shadow-elevated flex flex-col justify-between">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-hotel-border flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-[#9A721C]" />
              <h2 className="font-serif text-xl font-semibold text-hotel-text">
                {t.cartTitle}
              </h2>
              {totalItems > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-hotel-subtle text-hotel-secondary border border-hotel-border">
                  {totalItems}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-subtle transition-colors"
              aria-label={t.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-[#FAF8F5]/60">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-14 h-14 rounded-full bg-hotel-subtle flex items-center justify-center mb-3 text-[#9A721C] border border-hotel-border">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-hotel-text mb-1">
                  {t.cartEmpty}
                </h3>
                <p className="text-xs text-hotel-secondary max-w-xs mb-6 leading-relaxed">
                  {t.cartEmptySubtitle}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-outline-gold text-xs"
                >
                  {t.navMenu}
                </button>
              </div>
            ) : (
              items.map((cartItem) => {
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
                    className="p-3.5 rounded-xl bg-white border border-hotel-border shadow-subtle space-y-3 text-left"
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Item Thumbnail */}
                      {cartItem.item.image_url ? (
                        <img
                          src={cartItem.item.image_url}
                          alt={name}
                          className="w-16 h-16 rounded-lg object-cover shrink-0 border border-hotel-border bg-hotel-subtle"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-[#F6F3EC] border border-hotel-border flex items-center justify-center text-[#9A721C]/60 shrink-0">
                          <Utensils className="w-5 h-5" />
                        </div>
                      )}

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-serif text-base font-semibold text-hotel-text leading-snug truncate">
                              {name}
                            </h4>
                            {variantName && (
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#9A721C]/10 text-[#9A721C]">
                                {variantName}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(lineKey)}
                            className="text-hotel-muted hover:text-red-600 p-1 rounded transition-colors shrink-0"
                            title={t.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Complements list */}
                        {cartItem.selectedComplements && cartItem.selectedComplements.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {cartItem.selectedComplements.map((c) => {
                              const compName =
                                language === 'en' && c.complement.name_en
                                  ? c.complement.name_en
                                  : c.complement.name_fr;
                              return (
                                <div
                                  key={c.complement.id}
                                  className="text-[11px] text-hotel-secondary flex items-center justify-between"
                                >
                                  <span>
                                    + {c.quantity > 1 ? `${c.quantity}x ` : ''}
                                    {compName}
                                  </span>
                                  <span>{formatXAF(c.complement.price * c.quantity)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <p className="text-xs font-medium text-hotel-secondary mt-1">
                          {formatXAF(unitPrice)} {cartItem.quantity > 1 ? `/ unité` : ''}
                        </p>

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-between mt-2.5">
                          <div className="inline-flex items-center gap-1 bg-hotel-subtle rounded-lg border border-hotel-border p-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(lineKey, cartItem.quantity - 1)
                              }
                              className="w-7 h-7 rounded-md flex items-center justify-center text-hotel-text hover:bg-white transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-7 text-center text-xs font-bold text-hotel-text">
                              {cartItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(lineKey, cartItem.quantity + 1)
                              }
                              className="w-7 h-7 rounded-md flex items-center justify-center text-hotel-text hover:bg-white transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="text-sm font-bold text-hotel-text font-mono">
                            {formatXAF(lineTotal)}
                          </span>
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
              })
            )}
          </div>

          {/* Footer with Subtotal & Checkout */}
          {items.length > 0 && (
            <div className="p-4 sm:p-6 pb-safe border-t border-hotel-border bg-white space-y-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-hotel-secondary">{t.cartSubtotal}</span>
                <span className="font-serif text-2xl font-bold text-hotel-text font-mono">
                  {formatXAF(subtotal)}
                </span>
              </div>

              <button
                type="button"
                onClick={onProceedToCheckout}
                className="w-full btn-gold py-3 text-sm font-semibold shadow-subtle"
              >
                <span>{t.cartCheckout}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={clearCart}
                className="w-full text-center text-xs text-hotel-muted hover:text-red-600 py-1 transition-colors"
              >
                {t.cartClear}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
