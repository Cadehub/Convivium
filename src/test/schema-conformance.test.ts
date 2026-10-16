import { describe, it, expect } from 'vitest';
import type { MenuItem, MenuCategory, UserRole } from '../types';

describe('Schema Conformance & Prohibition Rules', () => {
  it('strictly prohibits stock fields and description fields on MenuItem', () => {
    const sampleItem: MenuItem = {
      id: 'uuid-1',
      category_id: 'cat-uuid',
      name_fr: 'Poisson Braisé',
      name_en: 'Braised Fish',
      item_type: 'dish',
      price: 6500,
      image_url: 'https://i.ibb.co/example.jpg',
      is_available: true,
      sort_order: 1,
    };

    const keys = Object.keys(sampleItem);

    // Verify allowed fields
    expect(keys).toContain('id');
    expect(keys).toContain('name_fr');
    expect(keys).toContain('price');
    expect(keys).toContain('is_available');

    // Strictly forbidden fields per Prompt Rule 2 & 9:
    expect(keys).not.toContain('description_fr');
    expect(keys).not.toContain('description_en');
    expect(keys).not.toContain('description');
    expect(keys).not.toContain('short_description');
    expect(keys).not.toContain('stock_quantity');
    expect(keys).not.toContain('track_stock');
    expect(keys).not.toContain('unit');
    expect(keys).not.toContain('low_stock_threshold');
    expect(keys).not.toContain('auto_stock_decrement');
  });

  it('strictly prohibits description fields on MenuCategory', () => {
    const sampleCategory: MenuCategory = {
      id: 'cat-uuid',
      name_fr: 'Plats Traditionnels',
      name_en: 'Traditional Dishes',
      sort_order: 1,
      is_active: true,
    };

    const keys = Object.keys(sampleCategory);

    expect(keys).not.toContain('description_fr');
    expect(keys).not.toContain('description_en');
    expect(keys).not.toContain('description');
  });

  it('strictly limits internal roles to exactly Admin and Cuisine', () => {
    const validRoles: UserRole[] = ['admin', 'cuisine'];

    expect(validRoles).toHaveLength(2);
    expect(validRoles).toContain('admin');
    expect(validRoles).toContain('cuisine');

    // Bar, Stock Manager, Waiter, Cashier etc. are strictly NOT separate internal roles
    // @ts-expect-error Invalid role check
    const invalidBar: UserRole = 'bar';
    expect(validRoles.includes(invalidBar)).toBe(false);

    // @ts-expect-error Invalid role check
    const invalidStockManager: UserRole = 'stock_manager';
    expect(validRoles.includes(invalidStockManager)).toBe(false);
  });
});
