-- Migration: 20261018_mtn_phone_payment.sql
-- Description: Add phone_number to payment_settings and update get_public_payment_options() RPC

-- 1. Add phone_number column to payment_settings table if it doesn't exist
ALTER TABLE public.payment_settings 
ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT NULL;

-- 2. Populate default phone_number for MTN if empty, or keep existing merchant_code
UPDATE public.payment_settings
SET phone_number = COALESCE(phone_number, merchant_code)
WHERE id = 'mtn';

-- 3. Replace get_public_payment_options() to return phone_number and support MTN recipient phone
CREATE OR REPLACE FUNCTION public.get_public_payment_options()
RETURNS TABLE (
    id TEXT,
    is_active BOOLEAN,
    merchant_code TEXT,
    phone_number TEXT,
    account_name TEXT,
    ussd_mode TEXT,
    instructions_fr TEXT,
    instructions_en TEXT,
    is_tested_on_device BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        ps.id,
        ps.is_active,
        ps.merchant_code,
        ps.phone_number,
        ps.account_name,
        ps.ussd_mode,
        ps.instructions_fr,
        ps.instructions_en,
        ps.is_tested_on_device,
        ps.updated_at
    FROM public.payment_settings ps
    WHERE ps.is_active = true
      AND (
        (ps.id = 'orange' AND length(trim(coalesce(ps.merchant_code, ''))) > 0)
        OR
        (ps.id = 'mtn' AND (length(trim(coalesce(ps.phone_number, ''))) > 0 OR length(trim(coalesce(ps.merchant_code, ''))) > 0))
      );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_payment_options() TO anon, authenticated;
