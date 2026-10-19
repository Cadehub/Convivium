import { describe, it, expect } from 'vitest';
import { translations } from '../i18n/translations';
import type { MenuItem } from '../types';

describe('First-Add Order Review Modal and Cart Logic', () => {
  const dummyItem1: MenuItem = {
    id: 'item-1',
    category_id: 'cat-1',
    name_fr: 'Ndolé Royal',
    name_en: 'Royal Ndole',
    description_fr: 'Plat traditionnel camerounais aux crevettes',
    description_en: 'Traditional Cameroonian stew with prawns',
    image_url: null,
    price: 4500,
    preparation_time_minutes: 25,
    is_available: true,
    item_type: 'dish',
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const dummyItem2: MenuItem = {
    id: 'item-2',
    category_id: 'cat-2',
    name_fr: 'Jus de Bissap Artisanal',
    name_en: 'Artisanal Bissap Juice',
    description_fr: 'Infusion fraîche de fleurs d\'hibiscus',
    description_en: 'Fresh hibiscus tea infusion',
    image_url: null,
    price: 1500,
    preparation_time_minutes: 5,
    is_available: true,
    item_type: 'drink',
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('provides dedicated translations for order review title and action buttons in French and English', () => {
    expect(translations.fr.orderReviewTitle).toBe('Consulter mon panier');
    expect(translations.fr.continueToOrder).toBe('Passer la commande');
    expect(translations.fr.continueShoppingInMenu).toBe('Continuer dans le menu');

    expect(translations.en.orderReviewTitle).toBe('Review my cart');
    expect(translations.en.continueToOrder).toBe('Proceed to checkout');
    expect(translations.en.continueShoppingInMenu).toBe('Continue shopping in menu');
  });

  it('simulates first addition trigger: opens review modal once, then does not open for subsequent additions', () => {
    let hasShownFirstOrderModal = false;
    let isOrderReviewOpen = false;
    const cartItems: { item: MenuItem; quantity: number }[] = [];

    const addItem = (item: MenuItem, qty = 1) => {
      // First-add rule
      if (!hasShownFirstOrderModal) {
        isOrderReviewOpen = true;
        hasShownFirstOrderModal = true;
      }
      cartItems.push({ item, quantity: qty });
    };

    // 1st item added: modal opens!
    addItem(dummyItem1, 1);
    expect(isOrderReviewOpen).toBe(true);
    expect(hasShownFirstOrderModal).toBe(true);
    expect(cartItems).toHaveLength(1);

    // Client clicks "Continuer l'achat dans le menu" (closes modal)
    isOrderReviewOpen = false;
    expect(isOrderReviewOpen).toBe(false);

    // 2nd item added: modal must NOT open again!
    addItem(dummyItem2, 1);
    expect(isOrderReviewOpen).toBe(false); // remains false!
    expect(hasShownFirstOrderModal).toBe(true);
    expect(cartItems).toHaveLength(2);

    // 3rd item added: still does NOT open
    addItem(dummyItem1, 1);
    expect(isOrderReviewOpen).toBe(false);
  });

  it('resets first addition trigger when the cart is cleared', () => {
    let hasShownFirstOrderModal = true;
    let isOrderReviewOpen = false;
    let cartItems: { item: MenuItem; quantity: number }[] = [{ item: dummyItem1, quantity: 1 }];

    const clearCart = () => {
      cartItems = [];
      hasShownFirstOrderModal = false;
      isOrderReviewOpen = false;
    };

    clearCart();
    expect(hasShownFirstOrderModal).toBe(false);
    expect(cartItems).toHaveLength(0);

    // Adding after clear triggers first-order modal again
    if (!hasShownFirstOrderModal) {
      isOrderReviewOpen = true;
      hasShownFirstOrderModal = true;
    }
    expect(isOrderReviewOpen).toBe(true);
  });

  it('provides bilingual translations for per-dish special instructions', () => {
    expect(translations.fr.dishSpecialNotesPlaceholder).toBe(
      'Instruction particulière pour ce plat (ex : sans piment, cuisson bien cuite...)'
    );
    expect(translations.fr.dishSpecialNotesLabel).toBe('Instruction pour ce plat');
    expect(translations.fr.hasSpecialInstructionsBadge).toBe('Instruction spéciale');
    expect(translations.fr.kitchenSpecialInstructionForDish).toBe(
      'Instruction spéciale pour ce plat :'
    );

    expect(translations.en.dishSpecialNotesPlaceholder).toBe(
      'Special instruction for this dish (e.g. no pepper, well done...)'
    );
    expect(translations.en.dishSpecialNotesLabel).toBe('Instruction for this dish');
    expect(translations.en.hasSpecialInstructionsBadge).toBe('Special instruction');
    expect(translations.en.kitchenSpecialInstructionForDish).toBe(
      'Special instruction for this dish:'
    );
  });

  it('allows setting and updating special instructions under each distinct dish independently', () => {
    let cart = [
      { key: 'line-1', item: dummyItem1, quantity: 1, notes: '' },
      { key: 'line-2', item: dummyItem2, quantity: 2, notes: '' },
    ];

    const updateNotes = (key: string, notes: string) => {
      cart = cart.map((i) => (i.key === key ? { ...i, notes } : i));
    };

    // Client specifies "Sans piment fort" for Ndolé
    updateNotes('line-1', 'Sans piment fort');
    expect(cart[0].notes).toBe('Sans piment fort');
    expect(cart[1].notes).toBe('');

    // Client specifies "Très frais avec glaçons" for Bissap
    updateNotes('line-2', 'Très frais avec glaçons');
    expect(cart[0].notes).toBe('Sans piment fort');
    expect(cart[1].notes).toBe('Très frais avec glaçons');
  });

  it('supports updating and adding complements on cart items dynamically', () => {
    const dummyComp1 = {
      id: 'comp-plantain',
      name_fr: 'Frites de plantain mûr',
      name_en: 'Fried ripe plantains',
      price: 1000,
      is_active: true,
      is_all_categories: true,
      sort_order: 1,
    };

    const dummyComp2 = {
      id: 'comp-sauce',
      name_fr: 'Sauce piment maison',
      name_en: 'Homemade chili sauce',
      price: 500,
      is_active: true,
      is_all_categories: true,
      sort_order: 2,
    };

    let cartItem = {
      item: dummyItem1,
      quantity: 2,
      variant: null,
      selectedComplements: [{ complement: dummyComp1, quantity: 1 }],
      notes: 'Bien cuit',
    };

    // Calculate line total: (price: 4500 + complement: 1000) * 2 = 11000
    const calcUnit = (item: typeof cartItem) =>
      (item.item.price ?? 0) +
      (item.selectedComplements || []).reduce((s, c) => s + c.complement.price * c.quantity, 0);
    const calcTotal = (item: typeof cartItem) => calcUnit(item) * item.quantity;

    expect(calcTotal(cartItem)).toBe(11000);

    // Increase complement quantity from 1 to 2
    cartItem = {
      ...cartItem,
      selectedComplements: cartItem.selectedComplements.map((c) =>
        c.complement.id === dummyComp1.id ? { ...c, quantity: 2 } : c
      ),
    };
    // (4500 + 2000) * 2 = 13000
    expect(calcTotal(cartItem)).toBe(13000);

    // Add second complement (sauce)
    cartItem = {
      ...cartItem,
      selectedComplements: [
        ...cartItem.selectedComplements,
        { complement: dummyComp2, quantity: 1 },
      ],
    };
    // (4500 + 2000 + 500) * 2 = 14000
    expect(calcTotal(cartItem)).toBe(14000);

    // Decrease first complement to 0 (removal)
    cartItem = {
      ...cartItem,
      selectedComplements: cartItem.selectedComplements.filter(
        (c) => c.complement.id !== dummyComp1.id
      ),
    };
    // (4500 + 500) * 2 = 10000
    expect(calcTotal(cartItem)).toBe(10000);
    expect(cartItem.selectedComplements).toHaveLength(1);
    expect(cartItem.selectedComplements[0].complement.id).toBe(dummyComp2.id);
  });
});
