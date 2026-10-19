import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CartItem, MenuItem, MenuItemVariant, MenuComplement, CartComplementSelection } from '../types';

export function getCartLineKey(
  itemId: string,
  variantId?: string | null,
  complements?: CartComplementSelection[]
): string {
  const sortedComps = (complements || [])
    .filter((c) => c.quantity > 0)
    .map((c) => `${c.complement.id}:${c.quantity}`)
    .sort()
    .join('|');
  return `${itemId}__${variantId || 'base'}__${sortedComps}`;
}

export function getCartItemUnitPrice(cartItem: CartItem): number {
  const baseOrVariantPrice =
    cartItem.variant && cartItem.variant.price !== null && cartItem.variant.price !== undefined
      ? cartItem.variant.price
      : cartItem.item.price ?? 0;

  const complementsTotal = (cartItem.selectedComplements || []).reduce(
    (sum, c) => sum + (c.complement.price || 0) * (c.quantity || 0),
    0
  );

  return baseOrVariantPrice + complementsTotal;
}

export function getCartItemLineTotal(cartItem: CartItem): number {
  return getCartItemUnitPrice(cartItem) * cartItem.quantity;
}

interface CartContextType {
  items: CartItem[];
  addItem: (
    item: MenuItem,
    quantity?: number,
    notes?: string,
    variant?: MenuItemVariant | null,
    complements?: CartComplementSelection[]
  ) => void;
  removeItem: (cartKeyOrItemId: string) => void;
  updateQuantity: (cartKeyOrItemId: string, quantity: number) => void;
  updateNotes: (cartKeyOrItemId: string, notes: string) => void;
  updateItemComplementQuantity: (
    cartKey: string,
    complementId: string,
    quantity: number
  ) => void;
  addComplementToCartItem: (
    cartKey: string,
    complement: MenuComplement,
    quantity?: number
  ) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  getItemLineKey: (item: CartItem) => string;
  getItemUnitPrice: (item: CartItem) => number;
  getItemLineTotal: (item: CartItem) => number;
  isOrderReviewOpen: boolean;
  setIsOrderReviewOpen: (open: boolean) => void;
  hasShownFirstOrderModal: boolean;
  setHasShownFirstOrderModal: (shown: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'convivium_cart_v2';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOrderReviewOpen, setIsOrderReviewOpen] = useState(false);
  const [hasShownFirstOrderModal, setHasShownFirstOrderModal] = useState(false);
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load cart from storage', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to storage', e);
    }
  }, [items]);

  const getItemLineKey = (cartItem: CartItem): string => {
    return getCartLineKey(
      cartItem.item.id,
      cartItem.variant?.id || null,
      cartItem.selectedComplements
    );
  };

  const addItem = (
    item: MenuItem,
    quantity: number = 1,
    notes: string = '',
    variant: MenuItemVariant | null = null,
    complements: CartComplementSelection[] = []
  ) => {
    if (!item.is_available) return;

    const targetKey = getCartLineKey(item.id, variant?.id || null, complements);

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => getItemLineKey(i) === targetKey);
      if (existingIndex > -1) {
        const next = [...prev];
        const newQty = Math.min(50, next[existingIndex].quantity + quantity);
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: newQty,
          notes: notes || next[existingIndex].notes,
        };
        return next;
      }

      return [
        ...prev,
        {
          item,
          variant: variant || null,
          selectedComplements: complements || [],
          quantity: Math.min(50, Math.max(1, quantity)),
          notes,
        },
      ];
    });
  };

  const removeItem = (cartKeyOrItemId: string) => {
    setItems((prev) => {
      const remaining = prev.filter(
        (i) => getItemLineKey(i) !== cartKeyOrItemId && i.item.id !== cartKeyOrItemId
      );
      if (remaining.length === 0) {
        setHasShownFirstOrderModal(false);
      }
      return remaining;
    });
  };

  const updateQuantity = (cartKeyOrItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartKeyOrItemId);
      return;
    }
    const safeQty = Math.min(50, quantity);
    setItems((prev) =>
      prev.map((i) => {
        if (getItemLineKey(i) === cartKeyOrItemId || i.item.id === cartKeyOrItemId) {
          return { ...i, quantity: safeQty };
        }
        return i;
      })
    );
  };

  const updateNotes = (cartKeyOrItemId: string, notes: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (getItemLineKey(i) === cartKeyOrItemId || i.item.id === cartKeyOrItemId) {
          return { ...i, notes };
        }
        return i;
      })
    );
  };

  const updateItemComplementQuantity = (
    cartKey: string,
    complementId: string,
    quantity: number
  ) => {
    setItems((prev) =>
      prev.map((i) => {
        if (getItemLineKey(i) !== cartKey && i.item.id !== cartKey) return i;
        const currentComps = i.selectedComplements || [];
        let updatedComps: CartComplementSelection[];
        if (quantity <= 0) {
          updatedComps = currentComps.filter((c) => c.complement.id !== complementId);
        } else {
          updatedComps = currentComps.map((c) =>
            c.complement.id === complementId
              ? { ...c, quantity: Math.min(20, Math.max(1, quantity)) }
              : c
          );
        }
        return {
          ...i,
          selectedComplements: updatedComps,
        };
      })
    );
  };

  const addComplementToCartItem = (
    cartKey: string,
    complement: MenuComplement,
    quantity: number = 1
  ) => {
    setItems((prev) =>
      prev.map((i) => {
        if (getItemLineKey(i) !== cartKey && i.item.id !== cartKey) return i;
        const currentComps = i.selectedComplements || [];
        const existingCompIndex = currentComps.findIndex(
          (c) => c.complement.id === complement.id
        );
        let updatedComps: CartComplementSelection[];
        if (existingCompIndex > -1) {
          updatedComps = currentComps.map((c, idx) =>
            idx === existingCompIndex
              ? { ...c, quantity: Math.min(20, c.quantity + quantity) }
              : c
          );
        } else {
          updatedComps = [
            ...currentComps,
            { complement, quantity: Math.min(20, Math.max(1, quantity)) },
          ];
        }
        return {
          ...i,
          selectedComplements: updatedComps,
        };
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    setHasShownFirstOrderModal(false);
    setIsOrderReviewOpen(false);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + getCartItemLineTotal(item), 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        updateNotes,
        updateItemComplementQuantity,
        addComplementToCartItem,
        clearCart,
        totalItems,
        subtotal,
        getItemLineKey,
        getItemUnitPrice: getCartItemUnitPrice,
        getItemLineTotal: getCartItemLineTotal,
        isOrderReviewOpen,
        setIsOrderReviewOpen,
        hasShownFirstOrderModal,
        setHasShownFirstOrderModal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
