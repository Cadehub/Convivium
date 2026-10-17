import { supabase } from '../lib/supabase';
import { emitLiveSyncEvent } from '../lib/realtime';
import type { PaymentMethodSetting, RestaurantSettings, AuditLogEntry } from '../types';

export const settingsService = {
  // Public & Staff: Get restaurant settings
  async getRestaurantSettings(): Promise<RestaurantSettings> {
    const { data, error } = await supabase
      .from('restaurant_settings')
      .select('id, hotel_name, hotel_address, hotel_phone, currency, modes_active, delivery_fee, updated_at')
      .eq('id', 'default')
      .single();

    if (error) {
      console.error('Error fetching restaurant settings', error);
      throw error;
    }

    return data as unknown as RestaurantSettings;
  },

  // Admin: Update restaurant settings (order modes active, phone, etc.)
  async updateRestaurantSettings(updates: Partial<RestaurantSettings>): Promise<void> {
    const { error } = await supabase
      .from('restaurant_settings')
      .update(updates)
      .eq('id', 'default');

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // Admin: Get all payment settings (MTN & Orange)
  async getAdminPaymentSettings(): Promise<PaymentMethodSetting[]> {
    const { data, error } = await supabase
      .from('payment_settings')
      .select('id, is_active, merchant_code, phone_number, account_name, ussd_mode, instructions_fr, instructions_en, is_tested_on_device, updated_at');

    if (error) throw error;
    return (data || []) as PaymentMethodSetting[];
  },

  // Admin: Update payment setting
  async updatePaymentSetting(
    id: 'mtn' | 'orange',
    updates: Partial<PaymentMethodSetting>
  ): Promise<void> {
    const { error } = await supabase
      .from('payment_settings')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    emitLiveSyncEvent('catalog_updated');
  },

  // Admin & Cuisine: Fetch audit logs with actor profile info
  async getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, user_id, action, target_entity, target_id, details, created_at, profiles(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as unknown as AuditLogEntry[];
  },
};
