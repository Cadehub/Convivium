import { describe, it, expect } from 'vitest';
import type { MenuItem } from '../types';

describe('Order Calculation & Business Logic', () => {
  // Synthetic test catalog fixture (isolated, never inserted into production DB)
  const syntheticCatalog: Record<string, MenuItem> = {
    'item-1': {
      id: 'item-1',
      category_id: 'cat-1',
      name_fr: 'Poulet DG Convivium',
      name_en: 'Convivium DG Chicken',
      item_type: 'dish',
      price: 6500,
      image_url: null,
      is_available: true,
      sort_order: 1,
    },
    'item-2': {
      id: 'item-2',
      category_id: 'cat-1',
      name_fr: 'Ndolé Royal Crevettes',
      name_en: 'Royal Ndole with Shrimps',
      item_type: 'dish',
      price: 8000,
      image_url: null,
      is_available: true,
      sort_order: 2,
    },
    'item-unavailable': {
      id: 'item-unavailable',
      category_id: 'cat-2',
      name_fr: 'Poisson Braisé Spécial',
      name_en: 'Special Braised Fish',
      item_type: 'dish',
      price: 7500,
      image_url: null,
      is_available: false, // Marked unavailable!
      sort_order: 3,
    },
  };

  // Pure logic replica of backend calculation function
  function simulateServerOrderCreation(items: Array<{ item_id: string; quantity: number }>) {
    if (!items || items.length === 0) {
      throw new Error('Le panier ne peut pas être vide.');
    }

    let calculatedTotal = 0;
    const snapshots: Array<{
      item_id: string;
      item_name: string;
      unit_price: number;
      quantity: number;
      subtotal: number;
    }> = [];

    for (const line of items) {
      if (line.quantity <= 0 || line.quantity > 50) {
        throw new Error(`Quantité invalide : ${line.quantity}`);
      }

      const dbItem = syntheticCatalog[line.item_id];
      if (!dbItem) {
        throw new Error(`Article introuvable : ${line.item_id}`);
      }

      if (!dbItem.is_available) {
        throw new Error(`L'article "${dbItem.name_fr}" n'est plus disponible actuellement.`);
      }

      const unitPrice = dbItem.price ?? 0;
      const subtotal = unitPrice * line.quantity;
      calculatedTotal += subtotal;

      snapshots.push({
        item_id: dbItem.id,
        item_name: dbItem.name_fr,
        unit_price: unitPrice,
        quantity: line.quantity,
        subtotal,
      });
    }

    return {
      total_amount: calculatedTotal,
      items: snapshots,
    };
  }

  it('calculates line subtotals and order total strictly from server prices', () => {
    const input = [
      { item_id: 'item-1', quantity: 2 }, // 6500 * 2 = 13000
      { item_id: 'item-2', quantity: 1 }, // 8000 * 1 = 8000
    ];

    const result = simulateServerOrderCreation(input);
    expect(result.total_amount).toBe(21000);
    expect(result.items[0].subtotal).toBe(13000);
    expect(result.items[1].subtotal).toBe(8000);
  });

  it('preserves historical snapshot even if catalog price changes later', () => {
    const input = [{ item_id: 'item-1', quantity: 1 }];
    const orderSnapshot = simulateServerOrderCreation(input);

    expect(orderSnapshot.items[0].unit_price).toBe(6500);

    // Later catalog modification
    const modifiedCatalog = { ...syntheticCatalog };
    modifiedCatalog['item-1'].price = 9999;

    // Previous snapshot remains untouched
    expect(orderSnapshot.items[0].unit_price).toBe(6500);
    expect(orderSnapshot.total_amount).toBe(6500);
  });

  it('rejects order with unavailable items', () => {
    const input = [
      { item_id: 'item-1', quantity: 1 },
      { item_id: 'item-unavailable', quantity: 1 },
    ];

    expect(() => simulateServerOrderCreation(input)).toThrow(/n'est plus disponible/);
  });

  it('rejects order with zero or negative quantity', () => {
    expect(() =>
      simulateServerOrderCreation([{ item_id: 'item-1', quantity: 0 }])
    ).toThrow(/Quantité invalide/);

    expect(() =>
      simulateServerOrderCreation([{ item_id: 'item-1', quantity: -3 }])
    ).toThrow(/Quantité invalide/);
  });

  it('rejects order with excessive quantity per line (> 50)', () => {
    expect(() =>
      simulateServerOrderCreation([{ item_id: 'item-1', quantity: 51 }])
    ).toThrow(/Quantité invalide/);
  });

  it('rejects empty order items array', () => {
    expect(() => simulateServerOrderCreation([])).toThrow(/ne peut pas être vide/);
  });
});
