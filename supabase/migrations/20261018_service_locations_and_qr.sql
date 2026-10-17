-- Migration: 20261018_service_locations_and_qr.sql
-- Description: Service locations (tables, rooms), QR code tokens, and order location preservation

-- 1. Create service_locations table
CREATE TABLE IF NOT EXISTS public.service_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_type TEXT NOT NULL CHECK (location_type IN ('table', 'room')),
  label TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index to prevent duplicate active locations for same type
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_locations_active_unique 
  ON public.service_locations (location_type, lower(trim(label))) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_service_locations_code 
  ON public.service_locations (code);

-- 2. Add columns to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS service_location_id UUID REFERENCES public.service_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_location_snapshot TEXT DEFAULT NULL;

-- 3. Add public_app_url to restaurant_settings
ALTER TABLE public.restaurant_settings 
  ADD COLUMN IF NOT EXISTS public_app_url TEXT DEFAULT NULL;

-- 4. Enable RLS on service_locations
ALTER TABLE public.service_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage service locations" 
  ON public.service_locations 
  FOR ALL 
  USING (current_user_role() = 'admin') 
  WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "Cuisine can view service locations" 
  ON public.service_locations 
  FOR SELECT 
  USING (current_user_role() = 'cuisine');

-- 5. RPC function to resolve a service location publicly by code
CREATE OR REPLACE FUNCTION public.resolve_service_location(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_loc RECORD;
BEGIN
  IF p_code IS NULL OR TRIM(p_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_code');
  END IF;

  SELECT id, location_type, label, code, is_active
  INTO v_loc
  FROM public.service_locations
  WHERE code = TRIM(p_code);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF NOT v_loc.is_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'inactive',
      'id', v_loc.id,
      'location_type', v_loc.location_type,
      'label', v_loc.label
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_loc.id,
    'location_type', v_loc.location_type,
    'label', v_loc.label,
    'code', v_loc.code,
    'is_active', v_loc.is_active
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_service_location(TEXT) TO anon, authenticated;
