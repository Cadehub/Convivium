import { supabase } from '../lib/supabase';
import type { MenuCategory, MenuItem } from '../types';

export const menuService = {
  // Public: Read active categories sorted by sort_order
  async getPublicCategories(): Promise<MenuCategory[]> {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('id, name_fr, name_en, sort_order, is_active, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching public categories', error);
      throw error;
    }
    return (data || []) as MenuCategory[];
  },

  // Public: Read available items sorted by sort_order
  async getPublicMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, category_id, name_fr, name_en, item_type, price, image_url, is_available, sort_order, created_at, updated_at')
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching public menu items', error);
      throw error;
    }
    return (data || []) as MenuItem[];
  },

  // Staff (Admin / Cuisine): Read all categories
  async getAllCategories(): Promise<MenuCategory[]> {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('id, name_fr, name_en, sort_order, is_active, created_at')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data || []) as MenuCategory[];
  },

  // Staff (Admin / Cuisine): Read all menu items
  async getAllMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, category_id, name_fr, name_en, item_type, price, image_url, is_available, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data || []) as MenuItem[];
  },

  // Staff: Create category
  async createCategory(cat: { name_fr: string; name_en?: string; sort_order?: number }): Promise<MenuCategory> {
    const { data, error } = await supabase
      .from('menu_categories')
      .insert({
        name_fr: cat.name_fr.trim(),
        name_en: cat.name_en ? cat.name_en.trim() : null,
        sort_order: cat.sort_order ?? 0,
        is_active: true,
      })
      .select('id, name_fr, name_en, sort_order, is_active, created_at')
      .single();

    if (error) throw error;
    return data as MenuCategory;
  },

  // Staff: Update category
  async updateCategory(
    id: string,
    updates: Partial<Pick<MenuCategory, 'name_fr' | 'name_en' | 'sort_order' | 'is_active'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('menu_categories')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  // Staff: Delete category (checks that no products reference it)
  async deleteCategory(id: string): Promise<void> {
    // Check if any items belong to this category
    const { count, error: countErr } = await supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id);

    if (countErr) throw countErr;
    if (count && count > 0) {
      throw new Error(
        'Impossible de supprimer cette catégorie car elle contient encore des produits. Veuillez d’abord réassigner ou supprimer ces produits.'
      );
    }

    const { error } = await supabase
      .from('menu_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Staff: Create menu item (dishes and drinks)
  async createMenuItem(item: {
    name_fr: string;
    name_en?: string;
    category_id: string;
    item_type: 'dish' | 'drink' | 'other';
    price: number;
    image_url?: string | null;
    is_available?: boolean;
    sort_order?: number;
  }): Promise<MenuItem> {
    const safePrice = Math.round(Number(item.price) || 0);
    if (safePrice < 0) {
      throw new Error('Le prix ne peut pas être négatif.');
    }

    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        name_fr: item.name_fr.trim(),
        name_en: item.name_en ? item.name_en.trim() : null,
        category_id: item.category_id,
        item_type: item.item_type,
        price: safePrice,
        image_url: item.image_url ? item.image_url.trim() : null,
        is_available: item.is_available ?? true,
        sort_order: item.sort_order ?? 0,
      })
      .select('id, category_id, name_fr, name_en, item_type, price, image_url, is_available, sort_order, created_at, updated_at')
      .single();

    if (error) throw error;
    return data as MenuItem;
  },

  // Staff: Update menu item
  async updateMenuItem(
    id: string,
    updates: Partial<Pick<MenuItem, 'name_fr' | 'name_en' | 'category_id' | 'item_type' | 'price' | 'image_url' | 'is_available' | 'sort_order'>>
  ): Promise<void> {
    const payload: Record<string, unknown> = { ...updates };
    if (payload.price !== undefined) {
      payload.price = Math.round(Number(payload.price) || 0);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('menu_items')
      .update(payload as never)
      .eq('id', id);

    if (error) throw error;
  },

  // Staff: Toggle item availability
  async toggleItemAvailability(id: string, isAvailable: boolean): Promise<void> {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: isAvailable })
      .eq('id', id);

    if (error) throw error;
  },

  // Staff: Delete menu item
  async deleteMenuItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
