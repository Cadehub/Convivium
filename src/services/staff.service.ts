import { supabase } from '../lib/supabase';
import type { StaffProfile } from '../types';

export const staffService = {
  // Admin: List all staff profiles
  async getAllStaffProfiles(): Promise<StaffProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as StaffProfile[];
  },

  // Admin: Toggle staff active status (deactivate or reactivate)
  async toggleStaffStatus(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },

  // Admin: Create or update staff profile
  async createCuisineProfile(profile: { id: string; fullName: string }): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: profile.id,
        role: 'cuisine',
        full_name: profile.fullName.trim(),
        is_active: true,
      });

    if (error) throw error;
  },
};
