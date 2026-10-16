-- =====================================================================
-- CONVIVIUM HOME HOTEL — MASTER CONFORMANCE & COMPLIANCE MIGRATION
-- Project: gmtlaptsdffcprtpkdck (Convivium)
-- Target: Strict compliance with rules:
--   1. Zero stock management (drop stock_movements, adjust_stock, stock columns)
--   2. Zero descriptions on dishes/drinks and categories
--   3. Only Cuisine role can verify, confirm, reject, or flag payments
--   4. RLS & SECURITY DEFINER hardening with explicit REVOKE / GRANT
--   5. Fix search_path on all functions
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. DROP STOCK MANAGEMENT & UNNECESSARY DESCRIPTIONS
-- ---------------------------------------------------------------------

-- Drop adjust_stock function
DROP FUNCTION IF EXISTS public.adjust_stock(UUID, TEXT, INTEGER, TEXT);

-- Drop stock movements table and its dependencies
DROP TABLE IF EXISTS public.stock_movements CASCADE;

-- Remove stock fields and description fields from menu_items
ALTER TABLE public.menu_items
  DROP COLUMN IF EXISTS track_stock CASCADE,
  DROP COLUMN IF EXISTS stock_quantity CASCADE,
  DROP COLUMN IF EXISTS unit CASCADE,
  DROP COLUMN IF EXISTS low_stock_threshold CASCADE,
  DROP COLUMN IF EXISTS description_fr CASCADE,
  DROP COLUMN IF EXISTS description_en CASCADE;

-- Remove description fields from menu_categories
ALTER TABLE public.menu_categories
  DROP COLUMN IF EXISTS description_fr CASCADE,
  DROP COLUMN IF EXISTS description_en CASCADE;

-- Remove auto_stock_decrement from restaurant_settings
ALTER TABLE public.restaurant_settings
  DROP COLUMN IF EXISTS auto_stock_decrement CASCADE;

-- Prevent deletion of categories that still have menu_items
ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_category_id_fkey,
  ADD CONSTRAINT menu_items_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- 2. SECURE FUNCTION: current_user_role
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- ---------------------------------------------------------------------
-- 3. CUISINE-ONLY PAYMENT VERIFICATION FUNCTIONS
-- Rule: Seul le rôle Cuisine vérifie et confirme ou rejette les paiements.
-- ---------------------------------------------------------------------

-- A. confirm_payment: Reserved STRICTLY to Cuisine
CREATE OR REPLACE FUNCTION public.confirm_payment(
  p_order_id UUID,
  p_verified_reference TEXT,
  p_internal_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_order RECORD;
BEGIN
  -- 1. Contrôle strict : Seul le rôle Cuisine est habilité à confirmer les paiements
  v_caller_role := public.current_user_role();
  IF v_caller_role != 'cuisine' THEN
    RAISE EXCEPTION 'Permission refusée. Seul le personnel de Cuisine peut vérifier et confirmer un paiement.';
  END IF;

  -- 2. Vérification de la commande avec verrouillage ligne
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande non trouvée.';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Cette commande a déjà été confirmée comme payée.';
  END IF;

  IF v_order.preparation_status = 'cancelled' THEN
    RAISE EXCEPTION 'Impossible de confirmer le paiement d''une commande annulée.';
  END IF;

  -- 3. Vérification d'unicité de la référence de transaction confirmée
  IF p_verified_reference IS NOT NULL AND TRIM(p_verified_reference) != '' THEN
    IF EXISTS (
      SELECT 1 FROM public.payment_verifications 
      WHERE verified_reference = TRIM(p_verified_reference)
        AND status = 'confirmed'
        AND order_id != p_order_id
    ) THEN
      RAISE EXCEPTION 'Cette référence de transaction a déjà été validée pour une autre commande.';
    END IF;
  END IF;

  -- 4. Enregistrement de la vérification Cuisine
  INSERT INTO public.payment_verifications (
    order_id,
    verified_by,
    status,
    verified_reference,
    internal_notes
  ) VALUES (
    p_order_id,
    auth.uid(),
    'confirmed',
    NULLIF(TRIM(p_verified_reference), ''),
    TRIM(p_internal_notes)
  );

  -- 5. Mise à jour du statut de paiement de la commande
  UPDATE public.orders
  SET payment_status = 'paid',
      updated_at = now()
  WHERE id = p_order_id;

  -- 6. Journalisation d'audit
  INSERT INTO public.audit_logs (user_id, action, target_entity, target_id, details)
  VALUES (
    auth.uid(),
    'CONFIRM_PAYMENT_CUISINE',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object(
      'public_reference', v_order.public_reference,
      'total_amount', v_order.total_amount,
      'verified_reference', p_verified_reference
    )
  );

  RETURN jsonb_build_object('success', true, 'payment_status', 'paid');
END;
$$;

-- B. reject_payment: Reserved STRICTLY to Cuisine
CREATE OR REPLACE FUNCTION public.reject_payment(
  p_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_order RECORD;
BEGIN
  -- Contrôle strict : Seul le rôle Cuisine rejette les paiements
  v_caller_role := public.current_user_role();
  IF v_caller_role != 'cuisine' THEN
    RAISE EXCEPTION 'Permission refusée. Seul le personnel de Cuisine peut rejeter un paiement.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande non trouvée.';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Impossible de rejeter un paiement déjà confirmé.';
  END IF;

  INSERT INTO public.payment_verifications (
    order_id,
    verified_by,
    status,
    internal_notes
  ) VALUES (
    p_order_id,
    auth.uid(),
    'rejected',
    TRIM(p_reason)
  );

  UPDATE public.orders
  SET payment_status = 'payment_rejected',
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, action, target_entity, target_id, details)
  VALUES (
    auth.uid(),
    'REJECT_PAYMENT_CUISINE',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object(
      'public_reference', v_order.public_reference,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'payment_status', 'payment_rejected');
END;
$$;

-- C. request_payment_review: Flag uncertain payment for additional check (Cuisine only)
CREATE OR REPLACE FUNCTION public.request_payment_review(
  p_order_id UUID,
  p_internal_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_order RECORD;
BEGIN
  v_caller_role := public.current_user_role();
  IF v_caller_role != 'cuisine' THEN
    RAISE EXCEPTION 'Permission refusée. Seul le personnel de Cuisine peut signaler une vérification supplémentaire.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande non trouvée.';
  END IF;

  INSERT INTO public.payment_verifications (
    order_id,
    verified_by,
    status,
    internal_notes
  ) VALUES (
    p_order_id,
    auth.uid(),
    'review_required',
    TRIM(p_internal_notes)
  );

  UPDATE public.orders
  SET payment_status = 'payment_review_required',
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, action, target_entity, target_id, details)
  VALUES (
    auth.uid(),
    'REVIEW_REQUIRED_PAYMENT_CUISINE',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object(
      'public_reference', v_order.public_reference,
      'notes', p_internal_notes
    )
  );

  RETURN jsonb_build_object('success', true, 'payment_status', 'payment_review_required');
END;
$$;

-- ---------------------------------------------------------------------
-- 4. PREPARATION STATUS TRANSITIONS (Staff: Admin or Cuisine)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_order_preparation_status(
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_order RECORD;
BEGIN
  v_caller_role := public.current_user_role();
  IF v_caller_role NOT IN ('admin', 'cuisine') THEN
    RAISE EXCEPTION 'Permission refusée.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande non trouvée.';
  END IF;

  -- Règle clé : la cuisine ne peut pas préparer si paiement Mobile Money non confirmé
  IF p_new_status IN ('preparing', 'ready', 'completed') AND v_order.payment_status != 'paid' THEN
    RAISE EXCEPTION 'Impossible de passer en préparation : le paiement de cette commande n''a pas encore été confirmé par la Cuisine.';
  END IF;

  IF p_new_status NOT IN ('new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Statut de préparation invalide : %', p_new_status;
  END IF;

  UPDATE public.orders
  SET preparation_status = p_new_status,
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, action, target_entity, target_id, details)
  VALUES (
    auth.uid(),
    'UPDATE_PREPARATION_STATUS',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object(
      'public_reference', v_order.public_reference,
      'old_status', v_order.preparation_status,
      'new_status', p_new_status
    )
  );

  RETURN jsonb_build_object('success', true, 'preparation_status', p_new_status);
END;
$$;

-- ---------------------------------------------------------------------
-- 5. CLIENT & PUBLIC FUNCTIONS WITH SEARCH_PATH HARDENING
-- ---------------------------------------------------------------------

-- create_order
CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_order_mode TEXT,
  p_location_detail TEXT,
  p_notes TEXT,
  p_items JSONB,
  p_idempotency_key TEXT,
  p_raw_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id UUID;
  v_public_ref TEXT;
  v_token_hash TEXT;
  v_item RECORD;
  v_db_item RECORD;
  v_calculated_total INTEGER := 0;
  v_item_subtotal INTEGER;
  v_item_count INTEGER := 0;
  v_existing_order RECORD;
  v_room_number TEXT := NULL;
  v_table_number TEXT := NULL;
  v_delivery_address TEXT := NULL;
BEGIN
  -- 1. Idempotence : si la clé existe déjà, retourner la commande existante
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT id, public_reference, total_amount, payment_status, preparation_status
    INTO v_existing_order
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_order.id,
        'public_reference', v_existing_order.public_reference,
        'total_amount', v_existing_order.total_amount,
        'payment_status', v_existing_order.payment_status,
        'preparation_status', v_existing_order.preparation_status,
        'is_replayed', true
      );
    END IF;
  END IF;

  -- 2. Validation des coordonnées client
  IF TRIM(p_customer_name) = '' OR TRIM(p_customer_phone) = '' THEN
    RAISE EXCEPTION 'Le nom et le numéro de téléphone du client sont obligatoires.';
  END IF;

  IF p_order_mode NOT IN ('dine_in', 'room_service', 'takeaway', 'delivery') THEN
    RAISE EXCEPTION 'Mode de commande non reconnu : %', p_order_mode;
  END IF;

  IF p_order_mode = 'room_service' THEN
    v_room_number := NULLIF(TRIM(p_location_detail), '');
    IF v_room_number IS NULL THEN
      RAISE EXCEPTION 'Le numéro de chambre est obligatoire pour le service en chambre.';
    END IF;
  ELSIF p_order_mode = 'dine_in' THEN
    v_table_number := NULLIF(TRIM(p_location_detail), '');
  ELSIF p_order_mode = 'delivery' THEN
    v_delivery_address := NULLIF(TRIM(p_location_detail), '');
    IF v_delivery_address IS NULL THEN
      RAISE EXCEPTION 'L''adresse de livraison est obligatoire pour une livraison.';
    END IF;
  END IF;

  -- 3. Validation de la liste des articles
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier ne peut pas être vide.';
  END IF;

  -- 4. Génération de la référence publique non prédictible (CVH-26-XXXX) et hash du token
  v_public_ref := 'CVH-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4));
  v_token_hash := crypt(p_raw_token, gen_salt('bf', 8));

  -- 5. Création de la commande
  INSERT INTO public.orders (
    public_reference,
    access_token_hash,
    idempotency_key,
    order_origin,
    order_mode,
    customer_name,
    customer_phone,
    room_number,
    table_number,
    delivery_address,
    notes,
    preparation_status,
    payment_status,
    total_amount
  ) VALUES (
    v_public_ref,
    v_token_hash,
    NULLIF(TRIM(p_idempotency_key), ''),
    'public_client',
    p_order_mode,
    TRIM(p_customer_name),
    TRIM(p_customer_phone),
    v_room_number,
    v_table_number,
    v_delivery_address,
    NULLIF(TRIM(p_notes), ''),
    'new',
    'awaiting_payment',
    0
  ) RETURNING id INTO v_order_id;

  -- 6. Parcours des articles avec prix réels de Supabase
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, quantity INTEGER, notes TEXT)
  LOOP
    IF v_item.quantity <= 0 OR v_item.quantity > 50 THEN
      RAISE EXCEPTION 'Quantité invalide pour un article : %', v_item.quantity;
    END IF;

    SELECT id, name_fr, price, is_available
    INTO v_db_item
    FROM public.menu_items
    WHERE id = v_item.item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article introuvable : %', v_item.item_id;
    END IF;

    IF NOT v_db_item.is_available THEN
      RAISE EXCEPTION 'L''article "%" n''est plus disponible actuellement.', v_db_item.name_fr;
    END IF;

    v_item_subtotal := v_db_item.price * v_item.quantity;
    v_calculated_total := v_calculated_total + v_item_subtotal;
    v_item_count := v_item_count + 1;

    INSERT INTO public.order_items (
      order_id,
      menu_item_id,
      item_name,
      unit_price,
      quantity,
      subtotal,
      special_notes
    ) VALUES (
      v_order_id,
      v_db_item.id,
      v_db_item.name_fr,
      v_db_item.price,
      v_item.quantity,
      v_item_subtotal,
      NULLIF(TRIM(v_item.notes), '')
    );
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Aucun article valide dans la commande.';
  END IF;

  -- 7. Mise à jour du total calculé côté serveur
  UPDATE public.orders
  SET total_amount = v_calculated_total
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_order_id,
    'public_reference', v_public_ref,
    'total_amount', v_calculated_total,
    'payment_status', 'awaiting_payment',
    'preparation_status', 'new'
  );
END;
$$;

-- get_client_order
CREATE OR REPLACE FUNCTION public.get_client_order(
  p_public_reference TEXT,
  p_raw_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_items JSONB;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE public_reference = TRIM(p_public_reference);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande non trouvée.');
  END IF;

  -- Vérification cryptographique du token d'accès
  IF v_order.access_token_hash != crypt(p_raw_token, v_order.access_token_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé à cette commande.');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'item_name', oi.item_name,
      'unit_price', oi.unit_price,
      'quantity', oi.quantity,
      'subtotal', oi.subtotal,
      'special_notes', oi.special_notes
    )
  ) INTO v_items
  FROM public.order_items oi
  WHERE oi.order_id = v_order.id;

  RETURN jsonb_build_object(
    'success', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'public_reference', v_order.public_reference,
      'order_mode', v_order.order_mode,
      'customer_name', v_order.customer_name,
      'customer_phone', v_order.customer_phone,
      'room_number', v_order.room_number,
      'table_number', v_order.table_number,
      'delivery_address', v_order.delivery_address,
      'notes', v_order.notes,
      'preparation_status', v_order.preparation_status,
      'payment_status', v_order.payment_status,
      'total_amount', v_order.total_amount,
      'created_at', v_order.created_at,
      'items', COALESCE(v_items, '[]'::jsonb)
    )
  );
END;
$$;

-- submit_payment_declaration
CREATE OR REPLACE FUNCTION public.submit_payment_declaration(
  p_public_reference TEXT,
  p_raw_token TEXT,
  p_operator TEXT,
  p_declared_ref TEXT DEFAULT NULL,
  p_raw_sms TEXT DEFAULT NULL,
  p_payer_phone TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF p_operator NOT IN ('mtn', 'orange') THEN
    RAISE EXCEPTION 'Opérateur invalide : %', p_operator;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE public_reference = TRIM(p_public_reference);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande non trouvée.';
  END IF;

  IF v_order.access_token_hash != crypt(p_raw_token, v_order.access_token_hash) THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Cette commande est déjà marquée comme payée.');
  END IF;

  INSERT INTO public.payment_declarations (
    order_id,
    operator,
    declared_reference,
    raw_sms_text,
    payer_phone,
    customer_note
  ) VALUES (
    v_order.id,
    p_operator,
    NULLIF(TRIM(p_declared_ref), ''),
    NULLIF(TRIM(p_raw_sms), ''),
    NULLIF(TRIM(p_payer_phone), ''),
    NULLIF(TRIM(p_note), '')
  );

  UPDATE public.orders
  SET payment_status = 'payment_declared',
      updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_status', 'payment_declared'
  );
END;
$$;

-- get_public_payment_options
CREATE OR REPLACE FUNCTION public.get_public_payment_options()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_options JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'is_active', is_active,
      'merchant_code', merchant_code,
      'account_name', account_name,
      'ussd_mode', ussd_mode,
      'instructions_fr', instructions_fr,
      'instructions_en', instructions_en,
      'is_tested_on_device', is_tested_on_device
    )
  ) INTO v_options
  FROM public.payment_settings
  WHERE is_active = true AND merchant_code IS NOT NULL AND TRIM(merchant_code) != '';

  RETURN COALESCE(v_options, '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------
-- 6. RLS POLICIES AUDIT & HARMONIZATION
-- ---------------------------------------------------------------------

-- Payment declarations: accessible by BOTH Admin and Cuisine
DROP POLICY IF EXISTS "Admin can view payment declarations" ON public.payment_declarations;
DROP POLICY IF EXISTS "Staff can view payment declarations" ON public.payment_declarations;
CREATE POLICY "Staff can view payment declarations"
  ON public.payment_declarations
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text]));

-- Payment verifications: accessible by BOTH Admin and Cuisine
DROP POLICY IF EXISTS "Admin can view payment verifications" ON public.payment_verifications;
DROP POLICY IF EXISTS "Staff can view payment verifications" ON public.payment_verifications;
CREATE POLICY "Staff can view payment verifications"
  ON public.payment_verifications
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text]));

-- Audit logs: Admin can view all, Cuisine can view payments & orders
DROP POLICY IF EXISTS "Admin can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Staff can view audit logs" ON public.audit_logs;
CREATE POLICY "Staff can view audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin'::text
    OR (
      public.current_user_role() = 'cuisine'::text
      AND target_entity IN ('orders', 'payment_verifications')
    )
  );

-- ---------------------------------------------------------------------
-- 7. SQL PRIVILEGES & SECURITY DEFINER HARDENING
-- Revoke default PUBLIC execute on all functions, then grant explicitly
-- ---------------------------------------------------------------------

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Public / Anon can execute client-facing functions
GRANT EXECUTE ON FUNCTION public.create_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_declaration TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_payment_options TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role TO anon, authenticated;

-- Internal staff functions: ONLY authenticated
GRANT EXECUTE ON FUNCTION public.confirm_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payment_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_preparation_status TO authenticated;

COMMIT;
