import React from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
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
  const { items, updateQuantity, removeItem, clearCart, subtotal, totalItems } = useCart();
  const { language, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-hotel-surface border-l border-hotel-cardBorder shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-5 border-b border-hotel-cardBorder flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-hotel-gold" />
              <h2 className="font-serif text-lg font-bold text-hotel-text">
                {t.cartTitle} ({totalItems})
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-card transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-hotel-muted">
                <div className="w-16 h-16 rounded-full bg-hotel-card flex items-center justify-center mb-3 text-hotel-gold/50 border border-hotel-cardBorder">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-base font-semibold text-hotel-text mb-1">
                  {t.cartEmpty}
                </h3>
                <p className="text-xs text-hotel-muted max-w-xs mb-6">
                  {t.cartEmptySubtitle}
                </p>
                <button onClick={onClose} className="btn-secondary text-xs">
                  {t.navMenu}
                </button>
              </div>
            ) : (
              items.map((cartItem) => {
                const name =
                  language === 'en' && cartItem.item.name_en
                    ? cartItem.item.name_en
                    : cartItem.item.name_fr;
                const lineTotal = cartItem.item.price * cartItem.quantity;

                return (
                  <div
                    key={cartItem.item.id}
                    className="p-3.5 rounded-xl bg-hotel-card border border-hotel-cardBorder flex items-start gap-3.5"
                  >
                    {/* Item Thumbnail */}
                    {cartItem.item.image_url ? (
                      <img
                        src={cartItem.item.image_url}
                        alt={name}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-hotel-cardBorder"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-hotel-surface border border-hotel-cardBorder flex items-center justify-center text-hotel-gold/40 flex-shrink-0">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-serif text-sm font-semibold text-hotel-text truncate">
                          {name}
                        </h4>
                        <button
                          onClick={() => removeItem(cartItem.item.id)}
                          className="text-hotel-muted hover:text-red-400 p-1 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs font-semibold text-hotel-gold mt-1">
                        {formatXAF(cartItem.item.price)}
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 bg-hotel-surface rounded-lg border border-hotel-cardBorder p-1">
                          <button
                            onClick={() =>
                              updateQuantity(cartItem.item.id, cartItem.quantity - 1)
                            }
                            className="p-1 rounded text-hotel-muted hover:text-hotel-text hover:bg-hotel-card"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-hotel-text">
                            {cartItem.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(cartItem.item.id, cartItem.quantity + 1)
                            }
                            className="p-1 rounded text-hotel-muted hover:text-hotel-text hover:bg-hotel-card"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-xs font-bold text-hotel-text font-serif">
                          {formatXAF(lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Subtotal & Checkout */}
          {items.length > 0 && (
            <div className="p-5 border-t border-hotel-cardBorder bg-hotel-black/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-hotel-muted">{t.cartSubtotal}</span>
                <span className="font-serif text-lg font-bold text-hotel-gold">
                  {formatXAF(subtotal)}
                </span>
              </div>

              <button
                onClick={onProceedToCheckout}
                className="w-full btn-gold py-3 text-sm font-bold flex items-center justify-center gap-2"
              >
                <span>{t.cartCheckout}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={clearCart}
                className="w-full text-center text-xs text-hotel-muted hover:text-red-400 py-1 transition-colors"
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
