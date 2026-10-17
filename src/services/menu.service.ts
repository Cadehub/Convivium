import { supabase } from '../lib/supabase';
import { emitLiveSyncEvent } from '../lib/realtime';
import type { MenuCategory, MenuItem, MenuItemVariant, MenuComplement } from '../types';

export const menuService = {
  // Public: Read active categories sorted by sort_order
  async getPublicCategories(): Promise<MenuCategory[]> {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('id, parent_id, name_fr, name_en, sort_order, is_active, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching public categories', error);
      throw error;
    }
    return (data || []) as MenuCategory[];
  },

  // Public: Read available items with active variants sorted by sort_order
  async getPublicMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        id,
        category_id,
        name_fr,
        name_en,
        description_fr,
        description_en,
        item_type,
        price,
        has_variants,
        image_url,
        is_available,
        preparation_time_minutes,
        sort_order,
        created_at,
        updated_at,
        variants:menu_item_variants (
          id,
          menu_item_id,
          name_fr,
          name_en,
          price,
          is_active,
          sort_order,
          created_at,
          updated_at
        )
      `)
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching public menu items', error);
      throw error;
    }

    // Filter active variants and sort
    return (data || []).map((item: any) => ({
      ...item,
      variants: (item.variants || [])
        .filter((v: MenuItemVariant) => v.is_active)
        .sort((a: MenuItemVariant, b: MenuItemVariant) => a.sort_order - b.sort_order),
    })) as MenuItem[];
  },

  // Staff (Admin / Cuisine): Read all categories
  async getAllCategories(): Promise<MenuCategory[]> {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('id, parent_id, name_fr, name_en, sort_order, is_active, created_at')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data || []) as MenuCategory[];
  },

  // Staff (Admin / Cuisine): Read all menu items with all variants
  async getAllMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        id,
        category_id,
        name_fr,
        name_en,
        description_fr,
        description_en,
        item_type,
        price,
        has_variants,
        image_url,
        is_available,
        preparation_time_minutes,
        sort_order,
        created_at,
        updated_at,
        variants:menu_item_variants (
          id,
          menu_item_id,
          name_fr,
          name_en,
          price,
          is_active,
          sort_order,
          created_at,
          updated_at
        )
      `)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      variants: (item.variants || []).sort(
        (a: MenuItemVariant, b: MenuItemVariant) => a.sort_order - b.sort_order
      ),
    })) as MenuItem[];
  },

  // Staff: Create category (root or subcategory)
  async createCategory(cat: {
    name_fr: string;
    name_en?: string;
    parent_id?: string | null;
    sort_order?: number;
  }): Promise<MenuCategory> {
    const { data, error } = await supabase
      .from('menu_categories')
      .insert({
        name_fr: cat.name_fr.trim(),
        name_en: cat.name_en ? cat.name_en.trim() : null,
        parent_id: cat.parent_id || null,
        sort_order: cat.sort_order ?? 0,
        is_active: true,
      })
      .select('id, parent_id, name_fr, name_en, sort_order, is_active, created_at')
      .single();

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
    return data as MenuCategory;
  },

  // Staff: Update category
  async updateCategory(
    id: string,
    updates: Partial<Pick<MenuCategory, 'name_fr' | 'name_en' | 'parent_id' | 'sort_order' | 'is_active'>>
  ): Promise<void> {
    const payload: Record<string, unknown> = { ...updates };
    if ('parent_id' in payload && payload.parent_id === '') {
      payload.parent_id = null;
    }
    const { error } = await supabase
      .from('menu_categories')
      .update(payload as never)
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // Staff: Delete category (checks subcategories and items safely)
  async deleteCategory(id: string): Promise<void> {
    // 1. Check if category has subcategories
    const { count: childCount, error: childErr } = await supabase
      .from('menu_categories')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', id);

    if (childErr) throw childErr;
    if (childCount && childCount > 0) {
      throw new Error(
        'Impossible de supprimer cette catégorie car elle contient des sous-catégories. Veuillez d’abord réassigner ou supprimer ses sous-catégories.'
      );
    }

    // 2. Check if any items belong to this category
    const { count: itemCount, error: countErr } = await supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id);

    if (countErr) throw countErr;
    if (itemCount && itemCount > 0) {
      throw new Error(
        'Impossible de supprimer cette catégorie car elle contient encore des produits. Veuillez d’abord réassigner ou supprimer ces produits.'
      );
    }

    const { error } = await supabase
      .from('menu_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // Staff: Create menu item (dishes and drinks)
  async createMenuItem(item: {
    name_fr: string;
    name_en?: string;
    description_fr?: string | null;
    description_en?: string | null;
    category_id: string;
    item_type: 'dish' | 'drink' | 'other';
    price?: number | null;
    has_variants?: boolean;
    image_url?: string | null;
    is_available?: boolean;
    preparation_time_minutes?: number | null;
    sort_order?: number;
  }): Promise<MenuItem> {
    const hasVariants = !!item.has_variants;
    const safePrice =
      item.price !== undefined && item.price !== null && !isNaN(Number(item.price))
        ? Math.round(Number(item.price))
        : null;

    if (!hasVariants && safePrice === null) {
      throw new Error('Le prix de base est obligatoire lorsqu’un produit ne possède pas de variantes.');
    }
    if (safePrice !== null && safePrice < 0) {
      throw new Error('Le prix ne peut pas être négatif.');
    }

    const prepMins =
      item.preparation_time_minutes !== undefined &&
      item.preparation_time_minutes !== null &&
      Number(item.preparation_time_minutes) > 0
        ? Math.round(Number(item.preparation_time_minutes))
        : null;

    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        name_fr: item.name_fr.trim(),
        name_en: item.name_en ? item.name_en.trim() : null,
        description_fr: item.description_fr ? item.description_fr.trim() : null,
        description_en: item.description_en ? item.description_en.trim() : null,
        category_id: item.category_id,
        item_type: item.item_type,
        price: safePrice,
        has_variants: hasVariants,
        image_url: item.image_url ? item.image_url.trim() : null,
        is_available: item.is_available ?? true,
        preparation_time_minutes: prepMins,
        sort_order: item.sort_order ?? 0,
      })
      .select('id, category_id, name_fr, name_en, description_fr, description_en, item_type, price, has_variants, image_url, is_available, preparation_time_minutes, sort_order, created_at, updated_at')
      .single();

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
    return data as MenuItem;
  },

  // Staff: Update menu item
  async updateMenuItem(
    id: string,
    updates: Partial<Pick<MenuItem, 'name_fr' | 'name_en' | 'description_fr' | 'description_en' | 'category_id' | 'item_type' | 'price' | 'has_variants' | 'image_url' | 'is_available' | 'preparation_time_minutes' | 'sort_order'>>
  ): Promise<void> {
    const payload: Record<string, unknown> = { ...updates };
    if ('price' in payload) {
      payload.price =
        payload.price !== undefined && payload.price !== null && !isNaN(Number(payload.price))
          ? Math.round(Number(payload.price))
          : null;
    }
    if ('description_fr' in payload && typeof payload.description_fr === 'string') {
      payload.description_fr = payload.description_fr.trim() || null;
    }
    if ('description_en' in payload && typeof payload.description_en === 'string') {
      payload.description_en = payload.description_en.trim() || null;
    }
    if ('preparation_time_minutes' in payload) {
      const rawPrep = payload.preparation_time_minutes;
      payload.preparation_time_minutes =
        rawPrep !== undefined && rawPrep !== null && Number(rawPrep) > 0
          ? Math.round(Number(rawPrep))
          : null;
    }
    const { error } = await supabase
      .from('menu_items')
      .update(payload as never)
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // Staff: Toggle item availability
  async toggleItemAvailability(id: string, isAvailable: boolean): Promise<void> {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: isAvailable })
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // Staff: Delete menu item
  async deleteMenuItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // ============================================================================
  // VARIANTS CRUD
  // ============================================================================

  // Staff: Create variant for a menu item
  async createVariant(variant: {
    menu_item_id: string;
    name_fr: string;
    name_en?: string;
    price?: number | null;
    sort_order?: number;
  }): Promise<MenuItemVariant> {
    const safePrice =
      variant.price !== undefined && variant.price !== null && !isNaN(Number(variant.price))
        ? Math.round(Number(variant.price))
        : null;

    if (safePrice !== null && safePrice < 0) {
      throw new Error('Le prix d’une variante ne peut pas être négatif.');
    }

    const { data, error } = await supabase
      .from('menu_item_variants')
      .insert({
        menu_item_id: variant.menu_item_id,
        name_fr: variant.name_fr.trim(),
        name_en: variant.name_en ? variant.name_en.trim() : null,
        price: safePrice,
        is_active: true,
        sort_order: variant.sort_order ?? 0,
      })
      .select('id, menu_item_id, name_fr, name_en, price, is_active, sort_order, created_at, updated_at')
      .single();

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
    return data as MenuItemVariant;
  },

  // Staff: Update variant
  async updateVariant(
    id: string,
    updates: Partial<Pick<MenuItemVariant, 'name_fr' | 'name_en' | 'price' | 'is_active' | 'sort_order'>>
  ): Promise<void> {
    const payload: Record<string, unknown> = { ...updates };
    if ('price' in payload) {
      payload.price =
        payload.price !== undefined && payload.price !== null && !isNaN(Number(payload.price))
          ? Math.round(Number(payload.price))
          : null;
    }

    const { error } = await supabase
      .from('menu_item_variants')
      .update(payload as never)
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // Staff: Toggle variant active status
  async toggleVariantActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('menu_item_variants')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // Staff: Delete variant safely
  async deleteVariant(id: string): Promise<void> {
    // Check if variant has been used in order_items
    const { count, error: countErr } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('variant_id', id);

    if (countErr) throw countErr;
    if (count && count > 0) {
      throw new Error(
        'Cette variante ne peut pas être supprimée car elle est présente dans l’historique des commandes. Vous pouvez la désactiver à la place pour qu’elle ne soit plus proposée.'
      );
    }

    const { error } = await supabase
      .from('menu_item_variants')
      .delete()
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // ============================================================================
  // COMPLEMENTS CRUD
  // ============================================================================

  // Public: Read active complements with category links
  async getPublicComplements(): Promise<MenuComplement[]> {
    const { data: comps, error: compErr } = await supabase
      .from('menu_complements')
      .select('id, name_fr, name_en, price, is_active, is_all_categories, sort_order, created_at, updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (compErr) {
      console.error('Error fetching public complements', compErr);
      throw compErr;
    }

    const { data: links, error: linkErr } = await supabase
      .from('menu_complement_categories')
      .select('complement_id, category_id');

    if (linkErr) {
      console.error('Error fetching complement categories', linkErr);
      throw linkErr;
    }

    const linksMap: Record<string, string[]> = {};
    (links || []).forEach((l) => {
      if (!linksMap[l.complement_id]) linksMap[l.complement_id] = [];
      linksMap[l.complement_id].push(l.category_id);
    });

    return (comps || []).map((c) => ({
      ...c,
      category_ids: linksMap[c.id] || [],
    })) as MenuComplement[];
  },

  // Staff (Admin / Cuisine): Read all complements with category links
  async getAllComplements(): Promise<MenuComplement[]> {
    const { data: comps, error: compErr } = await supabase
      .from('menu_complements')
      .select('id, name_fr, name_en, price, is_active, is_all_categories, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true });

    if (compErr) throw compErr;

    const { data: links, error: linkErr } = await supabase
      .from('menu_complement_categories')
      .select('complement_id, category_id');

    if (linkErr) throw linkErr;

    const linksMap: Record<string, string[]> = {};
    (links || []).forEach((l) => {
      if (!linksMap[l.complement_id]) linksMap[l.complement_id] = [];
      linksMap[l.complement_id].push(l.category_id);
    });

    return (comps || []).map((c) => ({
      ...c,
      category_ids: linksMap[c.id] || [],
    })) as MenuComplement[];
  },

  // Staff: Create complement and its category links
  async createComplement(comp: {
    name_fr: string;
    name_en?: string;
    price: number;
    is_all_categories: boolean;
    category_ids?: string[];
    sort_order?: number;
  }): Promise<MenuComplement> {
    const safePrice = Math.round(Number(comp.price) || 0);
    if (safePrice < 0) {
      throw new Error('Le prix d’un complément ne peut pas être négatif.');
    }

    const { data, error } = await supabase
      .from('menu_complements')
      .insert({
        name_fr: comp.name_fr.trim(),
        name_en: comp.name_en ? comp.name_en.trim() : null,
        price: safePrice,
        is_all_categories: !!comp.is_all_categories,
        is_active: true,
        sort_order: comp.sort_order ?? 0,
      })
      .select('id, name_fr, name_en, price, is_active, is_all_categories, sort_order, created_at, updated_at')
      .single();

    if (error) throw error;

    // Insert category links if not global
    if (!comp.is_all_categories && comp.category_ids && comp.category_ids.length > 0) {
      const inserts = comp.category_ids.map((catId) => ({
        complement_id: data.id,
        category_id: catId,
      }));
      const { error: linkErr } = await supabase
        .from('menu_complement_categories')
        .insert(inserts);
      if (linkErr) throw linkErr;
    }

    emitLiveSyncEvent('catalog_updated');
    return {
      ...(data as MenuComplement),
      category_ids: comp.category_ids || [],
    };
  },

  // Staff: Update complement and category links
  async updateComplement(
    id: string,
    updates: Partial<{
      name_fr: string;
      name_en?: string;
      price: number;
      is_active: boolean;
      is_all_categories: boolean;
      category_ids?: string[];
      sort_order?: number;
    }>
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.name_fr !== undefined) payload.name_fr = updates.name_fr.trim();
    if (updates.name_en !== undefined) payload.name_en = updates.name_en ? updates.name_en.trim() : null;
    if (updates.price !== undefined) {
      const safePrice = Math.round(Number(updates.price) || 0);
      if (safePrice < 0) throw new Error('Le prix d’un complément ne peut pas être négatif.');
      payload.price = safePrice;
    }
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;
    if (updates.is_all_categories !== undefined) payload.is_all_categories = updates.is_all_categories;
    if (updates.sort_order !== undefined) payload.sort_order = updates.sort_order;

    if (Object.keys(payload).length > 0) {
      const { error } = await supabase
        .from('menu_complements')
        .update(payload as never)
        .eq('id', id);

      if (error) throw error;
    }

    // Update category links if specified
    if (updates.category_ids !== undefined || updates.is_all_categories === true) {
      // Remove old links
      const { error: delErr } = await supabase
        .from('menu_complement_categories')
        .delete()
        .eq('complement_id', id);
      if (delErr) throw delErr;

      // If not all categories, insert new links
      if (!updates.is_all_categories && updates.category_ids && updates.category_ids.length > 0) {
        const inserts = updates.category_ids.map((catId) => ({
          complement_id: id,
          category_id: catId,
        }));
        const { error: insErr } = await supabase
          .from('menu_complement_categories')
          .insert(inserts);
        if (insErr) throw insErr;
      }
    }

    emitLiveSyncEvent('catalog_updated');
  },

  // Staff: Toggle complement active status
  async toggleComplementActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('menu_complements')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // Staff: Delete complement safely
  async deleteComplement(id: string): Promise<void> {
    const { error } = await supabase
      .from('menu_complements')
      .delete()
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },
};
