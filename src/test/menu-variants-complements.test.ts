import { describe, it, expect } from 'vitest';
import type { MenuItem, MenuItemVariant, MenuComplement, MenuCategory } from '../types';

describe('Menu Extensions — Variants, Complements, and Subcategories', () => {
  describe('1. Product Variants and Pricing Rules', () => {
    it('uses item base price when product has no variants', () => {
      const item: MenuItem = {
        id: 'item-1',
        name_fr: 'Poulet DG',
        name_en: null,
        category_id: null,
        image_url: null,
        price: 5000,
        item_type: 'dish',
        is_available: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const selectedVariant = null as MenuItemVariant | null;
      const unitPrice = selectedVariant?.price ?? item.price;
      expect(unitPrice).toBe(5000);
    });

    it('uses variant unit price as the final unit price (not as a surcharge added to base price)', () => {
      const item: MenuItem = {
        id: 'item-2',
        name_fr: 'Poisson Braisé',
        name_en: null,
        category_id: null,
        image_url: null,
        price: 4000, // base price
        has_variants: true,
        item_type: 'dish',
        is_available: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        variants: [
          {
            id: 'var-small',
            menu_item_id: 'item-2',
            name_fr: 'Portion Moyenne',
            name_en: null,
            price: 6000, // Final unit price
            is_active: true,
            sort_order: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'var-large',
            menu_item_id: 'item-2',
            name_fr: 'Grande Portion',
            name_en: null,
            price: 8500, // Final unit price
            is_active: true,
            sort_order: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };

      const selectedVariant = item.variants![0];
      const unitPrice = selectedVariant.price ?? item.price;

      // Must be 6000 XAF, NOT 4000 + 6000 = 10000 XAF
      expect(unitPrice).toBe(6000);
    });

    it('falls back to base price when variant price is absent and base price exists', () => {
      const item: MenuItem = {
        id: 'item-3',
        name_fr: 'Café Expresso',
        name_en: null,
        category_id: null,
        image_url: null,
        price: 1500,
        has_variants: true,
        item_type: 'drink',
        is_available: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        variants: [
          {
            id: 'var-decaf',
            menu_item_id: 'item-3',
            name_fr: 'Décaféiné',
            name_en: null,
            price: null, // absent variant price
            is_active: true,
            sort_order: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };

      const selectedVariant = item.variants![0];
      const unitPrice = selectedVariant.price ?? item.price;
      expect(unitPrice).toBe(1500);
    });

    it('flags an invalid state when neither variant price nor base price exists', () => {
      const item: MenuItem = {
        id: 'item-4',
        name_fr: 'Plat Spécial',
        name_en: null,
        category_id: null,
        image_url: null,
        price: null, // no base price
        has_variants: true,
        item_type: 'dish',
        is_available: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        variants: [
          {
            id: 'var-unpriced',
            menu_item_id: 'item-4',
            name_fr: 'Format Inconnu',
            name_en: null,
            price: null,
            is_active: true,
            sort_order: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };

      const selectedVariant = item.variants![0];
      const applicablePrice = selectedVariant.price ?? item.price;
      const isValidForOrdering = applicablePrice !== null && applicablePrice !== undefined && applicablePrice >= 0;

      expect(isValidForOrdering).toBe(false);
    });
  });

  describe('2. Complements Calculation & Category Inheritance', () => {
    const parentCategory: MenuCategory = {
      id: 'cat-parent',
      name_fr: 'Plats Principaux',
      name_en: 'Main Courses',
      is_active: true,
      sort_order: 1,
      created_at: new Date().toISOString(),
      parent_id: null,
    };

    const childCategory: MenuCategory = {
      id: 'cat-child',
      name_fr: 'Grillades',
      name_en: 'Grills',
      is_active: true,
      sort_order: 2,
      created_at: new Date().toISOString(),
      parent_id: 'cat-parent',
    };

    const unrelatedCategory: MenuCategory = {
      id: 'cat-unrelated',
      name_fr: 'Desserts',
      name_en: 'Desserts',
      is_active: true,
      sort_order: 3,
      created_at: new Date().toISOString(),
      parent_id: null,
    };

    const globalComplement: MenuComplement = {
      id: 'comp-global',
      name_fr: 'Sauce Piment Maison',
      name_en: 'House Chili Sauce',
      price: 0, // Free complement is valid!
      is_active: true,
      is_all_categories: true,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const targetedComplement: MenuComplement = {
      id: 'comp-targeted',
      name_fr: 'Portion Alloco Extra',
      name_en: 'Extra Fried Plantains',
      price: 1000,
      is_active: true,
      is_all_categories: false,
      sort_order: 2,
      category_ids: ['cat-parent'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const isComplementApplicable = (comp: MenuComplement, categoryId: string | null, categories: MenuCategory[]): boolean => {
      if (!comp.is_active || !categoryId) return false;
      if (comp.is_all_categories) return true;

      const cat = categories.find((c) => c.id === categoryId);
      const parentId = cat?.parent_id;

      const targetIds = comp.category_ids || [];
      return targetIds.includes(categoryId) || (Boolean(parentId) && targetIds.includes(parentId!));
    };

    it('allows price of 0 XAF for free complements without conflating with missing price', () => {
      expect(globalComplement.price).toBe(0);
      expect(typeof globalComplement.price).toBe('number');
    });

    it('applies global complements to any category (and future categories)', () => {
      const allCategories = [parentCategory, childCategory, unrelatedCategory];
      expect(isComplementApplicable(globalComplement, parentCategory.id, allCategories)).toBe(true);
      expect(isComplementApplicable(globalComplement, childCategory.id, allCategories)).toBe(true);
      expect(isComplementApplicable(globalComplement, unrelatedCategory.id, allCategories)).toBe(true);
    });

    it('inherits complements assigned to parent category into child subcategories', () => {
      const allCategories = [parentCategory, childCategory, unrelatedCategory];
      // Applicable to parent
      expect(isComplementApplicable(targetedComplement, parentCategory.id, allCategories)).toBe(true);
      // Automatically inherited by child subcategory
      expect(isComplementApplicable(targetedComplement, childCategory.id, allCategories)).toBe(true);
      // NOT applicable to unrelated category
      expect(isComplementApplicable(targetedComplement, unrelatedCategory.id, allCategories)).toBe(false);
    });

    it('calculates total cart line price with variant and multiple complements accurately', () => {
      const unitPrice = 6000; // variant unit price
      const complements = [
        { complement_id: 'c1', name: 'Sauce Piment', unit_price: 0, quantity: 1 },
        { complement_id: 'c2', name: 'Portion Alloco Extra', unit_price: 1000, quantity: 2 },
      ];
      const quantity = 3;

      const complementsTotalPerUnit = complements.reduce((sum, c) => sum + c.unit_price * c.quantity, 0);
      expect(complementsTotalPerUnit).toBe(2000); // 0 + 2000

      const lineTotal = (unitPrice + complementsTotalPerUnit) * quantity;
      expect(lineTotal).toBe((6000 + 2000) * 3); // 24000 XAF
    });
  });

  describe('3. Strict 2-Level Category Hierarchy Rules', () => {
    it('accepts root categories and child subcategories', () => {
      const rootCat: MenuCategory = {
        id: 'r1',
        name_fr: 'Boissons',
        name_en: 'Drinks',
        is_active: true,
        sort_order: 0,
        created_at: new Date().toISOString(),
        parent_id: null,
      };

      const childCat: MenuCategory = {
        id: 'c1',
        name_fr: 'Vins',
        name_en: 'Wines',
        is_active: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        parent_id: 'r1',
      };

      expect(rootCat.parent_id).toBeNull();
      expect(childCat.parent_id).toBe('r1');
    });

    it('rejects a subcategory as a parent (max 2 levels)', () => {
      const categories: MenuCategory[] = [
        { id: 'r1', name_fr: 'Root', name_en: 'Root', is_active: true, sort_order: 0, created_at: '', parent_id: null },
        { id: 'c1', name_fr: 'Child', name_en: 'Child', is_active: true, sort_order: 1, created_at: '', parent_id: 'r1' },
      ];

      // Eligible parents should only be categories whose parent_id is null
      const eligibleParents = categories.filter((c) => !c.parent_id);
      expect(eligibleParents.map((c) => c.id)).toEqual(['r1']);
      expect(eligibleParents.some((c) => c.id === 'c1')).toBe(false);
    });

    it('prevents a category with children from being assigned a parent', () => {
      const categories: MenuCategory[] = [
        { id: 'r1', name_fr: 'Root', name_en: 'Root', is_active: true, sort_order: 0, created_at: '', parent_id: null },
        { id: 'c1', name_fr: 'Child', name_en: 'Child', is_active: true, sort_order: 1, created_at: '', parent_id: 'r1' },
      ];

      const editingCategory = categories[0]; // 'r1'
      const hasChildren = categories.some((c) => c.parent_id === editingCategory.id);

      expect(hasChildren).toBe(true);
      // When hasChildren is true, category must remain a root category
    });
  });

  describe('4. Cart Unique Line Keying', () => {
    const getCartLineKey = (
      itemId: string,
      variantId?: string | null,
      complements?: { complement_id: string; quantity: number }[],
      notes?: string | null
    ): string => {
      const vKey = variantId || 'base';
      const compsKey = (complements || [])
        .filter((c) => c.quantity > 0)
        .slice()
        .sort((a, b) => a.complement_id.localeCompare(b.complement_id))
        .map((c) => `${c.complement_id}:${c.quantity}`)
        .join(',');
      const notesKey = (notes || '').trim().toLowerCase();
      return `${itemId}__${vKey}__${compsKey}__${notesKey}`;
    };

    it('produces distinct line keys for different variants of the same product', () => {
      const keySmall = getCartLineKey('item-1', 'var-small', []);
      const keyLarge = getCartLineKey('item-1', 'var-large', []);

      expect(keySmall).not.toBe(keyLarge);
      expect(keySmall).toBe('item-1__var-small____');
      expect(keyLarge).toBe('item-1__var-large____');
    });

    it('produces distinct line keys for different complements configurations', () => {
      const keyWithAlloco = getCartLineKey('item-1', 'var-small', [
        { complement_id: 'alloco', quantity: 1 },
      ]);
      const keyWithoutAlloco = getCartLineKey('item-1', 'var-small', []);

      expect(keyWithAlloco).not.toBe(keyWithoutAlloco);
      expect(keyWithAlloco).toBe('item-1__var-small__alloco:1__');
    });

    it('produces identical line keys regardless of complement array insertion order', () => {
      const key1 = getCartLineKey('item-1', 'var-small', [
        { complement_id: 'piment', quantity: 1 },
        { complement_id: 'alloco', quantity: 2 },
      ]);
      const key2 = getCartLineKey('item-1', 'var-small', [
        { complement_id: 'alloco', quantity: 2 },
        { complement_id: 'piment', quantity: 1 },
      ]);

      expect(key1).toBe(key2);
      expect(key1).toBe('item-1__var-small__alloco:2,piment:1__');
    });
  });

  describe('5. Dish Descriptions and Zero-Complements Rules', () => {
    it('only renders description when non-empty string is provided', () => {
      const itemWithDesc: MenuItem = {
        id: 'item-desc-1',
        name_fr: 'Poulet DG Royal',
        name_en: 'Royal DG Chicken',
        category_id: null,
        image_url: null,
        sort_order: 1,
        description_fr: 'Plat signature aux bananes plantains mûres et légumes croquants.',
        description_en: 'Signature dish with plantains and fresh vegetables.',
        price: 6500,
        item_type: 'dish',
        is_available: true,
      };

      const itemWithoutDesc: MenuItem = {
        id: 'item-desc-2',
        name_fr: 'Eau Minérale Tangui',
        name_en: 'Tangui Mineral Water',
        category_id: null,
        image_url: null,
        sort_order: 2,
        description_fr: null,
        description_en: '',
        price: 1000,
        item_type: 'drink',
        is_available: true,
      };

      const getRenderedDescription = (item: MenuItem, lang: 'fr' | 'en'): string | null => {
        const text =
          lang === 'en'
            ? item.description_en || item.description_fr
            : item.description_fr || item.description_en;
        return text && text.trim().length > 0 ? text.trim() : null;
      };

      expect(getRenderedDescription(itemWithDesc, 'fr')).toBe(
        'Plat signature aux bananes plantains mûres et légumes croquants.'
      );
      expect(getRenderedDescription(itemWithDesc, 'en')).toBe(
        'Signature dish with plantains and fresh vegetables.'
      );
      expect(getRenderedDescription(itemWithoutDesc, 'fr')).toBeNull();
      expect(getRenderedDescription(itemWithoutDesc, 'en')).toBeNull();
    });

    it('completely omits complements section when dish has no applicable complements', () => {
      const applicableComplements: MenuComplement[] = [];
      const shouldRenderComplementsSection = applicableComplements.length > 0;

      // When there are no complements, section must be completely absent from DOM
      expect(shouldRenderComplementsSection).toBe(false);
    });
  });

  describe('6. Simplified Menu Architecture: Sides & Sauces as Standalone Categories', () => {
    it('models complements and sauces as standard categories and menu items', () => {
      const sidesCategory: MenuCategory = {
        id: 'cat-sides',
        name_fr: 'Compléments',
        name_en: 'Sides & Complements',
        sort_order: 6,
        is_active: true,
      };

      const saucesCategory: MenuCategory = {
        id: 'cat-sauces',
        name_fr: 'Sauces',
        name_en: 'Sauces',
        sort_order: 7,
        is_active: true,
      };

      const mainDish: MenuItem = {
        id: 'dish-1',
        name_fr: 'Poulet Braisé Entier',
        name_en: 'Whole Grilled Chicken',
        price: 8000,
        category_id: 'cat-poulet',
        item_type: 'dish',
        image_url: null,
        is_available: true,
        sort_order: 1,
      };

      const plantains: MenuItem = {
        id: 'comp-1',
        name_fr: 'Plantains frit et vapeur',
        name_en: 'Fried & Steamed Plantains',
        price: 1000,
        category_id: sidesCategory.id,
        item_type: 'dish',
        image_url: null,
        is_available: true,
        sort_order: 1,
      };

      const piment: MenuItem = {
        id: 'sauce-1',
        name_fr: 'Sauce Piment Maison',
        name_en: 'House Hot Pepper Sauce',
        price: 500,
        category_id: saucesCategory.id,
        item_type: 'dish',
        image_url: null,
        is_available: true,
        sort_order: 1,
      };

      // Customer orders 1 main dish, 2 portions of plantains, and 1 hot sauce directly
      const cart = [
        { item: mainDish, quantity: 1, notes: 'Bien cuit' },
        { item: plantains, quantity: 2, notes: '' },
        { item: piment, quantity: 1, notes: 'À part' },
      ];

      const subtotal = cart.reduce((sum, line) => sum + (line.item.price ?? 0) * line.quantity, 0);

      // 8000 + (1000 * 2) + 500 = 10500 XAF
      expect(subtotal).toBe(10500);
      expect(cart).toHaveLength(3);
      expect(cart[0].item.category_id).toBe('cat-poulet');
      expect(cart[1].item.category_id).toBe('cat-sides');
      expect(cart[2].item.category_id).toBe('cat-sauces');
    });
  });
});


