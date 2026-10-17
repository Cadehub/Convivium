import { supabase } from '../lib/supabase';
import { emitLiveSyncEvent } from '../lib/realtime';
import type {
  ServiceLocation,
  ServiceLocationType,
  ResolvedServiceLocation,
} from '../types';

function generateLocationCode(prefix = 'loc'): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let randomPart = '';
  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const bytes = new Uint8Array(12);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i++) {
      randomPart += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 12; i++) {
      randomPart += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return `${prefix}_${randomPart}`;
}

export const serviceLocationService = {
  // Admin & Staff: Fetch all configured locations
  async getAllLocations(): Promise<ServiceLocation[]> {
    const { data, error } = await supabase
      .from('service_locations')
      .select('*')
      .order('location_type', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) {
      console.error('Error fetching service locations', error);
      throw error;
    }

    return (data || []) as ServiceLocation[];
  },

  // Admin: Create a new location
  async createLocation(payload: {
    location_type: ServiceLocationType;
    label: string;
    sort_order?: number;
  }): Promise<ServiceLocation> {
    const trimmedLabel = payload.label.trim();
    if (!trimmedLabel) {
      throw new Error('Le nom ou numéro d’emplacement est obligatoire.');
    }

    // Check for duplicate active location with same type and label
    const { data: existing, error: checkError } = await supabase
      .from('service_locations')
      .select('id, label, is_active')
      .eq('location_type', payload.location_type)
      .eq('is_active', true);

    if (!checkError && existing) {
      const isDuplicate = existing.some(
        (loc) => loc.label.trim().toLowerCase() === trimmedLabel.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(
          `Un emplacement actif du type "${payload.location_type === 'table' ? 'Table' : 'Chambre'}" avec le libellé "${trimmedLabel}" existe déjà.`
        );
      }
    }

    const code = generateLocationCode(payload.location_type === 'room' ? 'rm' : 'tb');

    const { data, error } = await supabase
      .from('service_locations')
      .insert({
        location_type: payload.location_type,
        label: trimmedLabel,
        code,
        is_active: true,
        sort_order: payload.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating service location', error);
      throw error;
    }

    emitLiveSyncEvent('catalog_updated');
    return data as ServiceLocation;
  },

  // Admin: Update location (label, is_active, sort_order)
  async updateLocation(
    id: string,
    updates: Partial<Pick<ServiceLocation, 'label' | 'is_active' | 'sort_order'>>
  ): Promise<ServiceLocation> {
    const payload: {
      label?: string;
      is_active?: boolean;
      sort_order?: number;
      updated_at?: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (updates.label !== undefined) {
      const trimmed = updates.label.trim();
      if (!trimmed) throw new Error('Le libellé ne peut pas être vide.');
      payload.label = trimmed;
    }
    if (updates.is_active !== undefined) {
      payload.is_active = updates.is_active;
    }
    if (updates.sort_order !== undefined) {
      payload.sort_order = updates.sort_order;
    }

    const { data, error } = await supabase
      .from('service_locations')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating service location', error);
      throw error;
    }

    emitLiveSyncEvent('catalog_updated');
    return data as ServiceLocation;
  },

  // Admin: Rotate QR code (generates a fresh URL token, revoking the previous one)
  async rotateLocationCode(id: string, locationType: ServiceLocationType): Promise<string> {
    const newCode = generateLocationCode(locationType === 'room' ? 'rm' : 'tb');
    const { error } = await supabase
      .from('service_locations')
      .update({
        code: newCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error rotating location code', error);
      throw error;
    }

    emitLiveSyncEvent('catalog_updated');
    return newCode;
  },

  // Admin: Delete location if safe
  async deleteLocation(id: string): Promise<void> {
    // Check if historical orders reference this location
    const { count, error: countError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('service_location_id', id);

    if (!countError && typeof count === 'number' && count > 0) {
      // Deactivate instead of deleting to preserve relational integrity
      await this.updateLocation(id, { is_active: false });
      return;
    }

    const { error } = await supabase
      .from('service_locations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting service location', error);
      throw error;
    }

    emitLiveSyncEvent('catalog_updated');
  },

  // Admin: Batch activate/deactivate
  async batchToggleActive(ids: string[], isActive: boolean): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('service_locations')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids);

    if (error) {
      console.error('Error batch updating locations', error);
      throw error;
    }

    emitLiveSyncEvent('catalog_updated');
  },

  // Public: Resolve a scanned QR code
  async resolveLocation(code: string): Promise<{
    success: boolean;
    location?: ResolvedServiceLocation;
    error?: 'not_found' | 'inactive' | 'missing_code' | string;
    label?: string;
    location_type?: ServiceLocationType;
  }> {
    const cleanCode = (code || '').trim();
    if (!cleanCode) {
      return { success: false, error: 'missing_code' };
    }

    const { data, error } = await supabase.rpc('resolve_service_location', {
      p_code: cleanCode,
    });

    if (error) {
      console.error('Error resolving service location RPC', error);
      return { success: false, error: error.message };
    }

    const res = data as unknown as {
      success: boolean;
      id?: string;
      location_type?: ServiceLocationType;
      label?: string;
      code?: string;
      is_active?: boolean;
      error?: string;
    };

    if (res && res.success && res.id && res.location_type && res.label) {
      return {
        success: true,
        location: {
          id: res.id,
          location_type: res.location_type,
          label: res.label,
          code: res.code || cleanCode,
          is_active: Boolean(res.is_active),
        },
      };
    }

    return {
      success: false,
      error: res?.error || 'not_found',
      label: res?.label,
      location_type: res?.location_type,
    };
  },
};
