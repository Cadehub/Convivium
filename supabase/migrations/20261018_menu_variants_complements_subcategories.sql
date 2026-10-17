-- Migration: Menu Variants, Complements and Subcategories (2-Level Hierarchy)
-- Date: 2026-10-18
-- Convivium Home Hotel

-- ============================================================================
-- 1. MENU CATEGORIES HIERARCHY (Strict 2 levels: Root and Subcategories)
-- ============================================================================

-- Add parent_id column
ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID NULL REFERENCES public.menu_categories(id) ON DELETE RESTRICT;

-- Ensure self-reference is forbidden
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_category_not_self_parent'
  ) THEN
    ALTER TABLE public.menu_categories
      ADD CONSTRAINT check_category_not_self_parent CHECK (parent_id IS NULL OR parent_id != id);
  END IF;
END $$;

-- Hierarchy constraint trigger: maximum 2 levels and no subcategory with children
CREATE OR REPLACE FUNCTION public.check_menu_category_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_parent UUID;
  v_child_count INTEGER;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    -- Prevent self-parenting
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Une catégorie ne peut pas être son propre parent.';
    END IF;

    -- Check if target parent itself has a parent (would exceed 2 levels)
    SELECT parent_id INTO v_parent_parent
    FROM public.menu_categories
    WHERE id = NEW.parent_id;

    IF v_parent_parent IS NOT NULL THEN
      RAISE EXCEPTION 'Hiérarchie limitée à 2 niveaux : une sous-catégorie ne peut pas devenir le parent d''une autre catégorie.';
    END IF;

    -- If updating existing category, ensure it does not already have children
    IF TG_OP = 'UPDATE' THEN
      SELECT COUNT(*) INTO v_child_count
      FROM public.menu_categories
      WHERE parent_id = NEW.id;

      IF v_child_count > 0 THEN
        RAISE EXCEPTION 'Cette catégorie possède déjà des sous-catégories et ne peut donc pas être transformée en sous-catégorie.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_menu_category_hierarchy ON public.menu_categories;
CREATE TRIGGER trg_check_menu_category_hierarchy
BEFORE INSERT OR UPDATE ON public.menu_categories
FOR EACH ROW EXECUTE FUNCTION public.check_menu_category_hierarchy();

-- ============================================================================
-- 2. MENU ITEMS: OPTIONAL BASE PRICE & VARIANTS FLAG
-- ============================================================================

ALTER TABLE public.menu_items
  ALTER COLUMN price DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_menu_item_price_positive'
  ) THEN
    ALTER TABLE public.menu_items
      ADD CONSTRAINT check_menu_item_price_positive CHECK (price IS NULL OR price >= 0);
  END IF;
END $$;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 3. MENU ITEM VARIANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.menu_item_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name_fr TEXT NOT NULL,
  name_en TEXT NULL,
  price INTEGER NULL CHECK (price IS NULL OR price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_menu_item_variants_item_id ON public.menu_item_variants(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_variants_active ON public.menu_item_variants(is_active);

-- Enable RLS
ALTER TABLE public.menu_item_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active variants" ON public.menu_item_variants;
CREATE POLICY "Public can read active variants"
  ON public.menu_item_variants
  FOR SELECT
  TO public
  USING (
    is_active = true OR
    current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text])
  );

DROP POLICY IF EXISTS "Admin and Cuisine can manage variants" ON public.menu_item_variants;
CREATE POLICY "Admin and Cuisine can manage variants"
  ON public.menu_item_variants
  FOR ALL
  TO public
  USING (current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text]))
  WITH CHECK (current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text]));

-- Realtime for variants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_item_variants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_item_variants;
  END IF;
END $$;

ALTER TABLE public.menu_item_variants REPLICA IDENTITY FULL;

-- ============================================================================
-- 4. REUSABLE COMPLEMENTS & CATEGORY ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.menu_complements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_fr TEXT NOT NULL,
  name_en TEXT NULL,
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_all_categories BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_menu_complements_active ON public.menu_complements(is_active);

-- Junction table for targeted categories
CREATE TABLE IF NOT EXISTS public.menu_complement_categories (
  complement_id UUID NOT NULL REFERENCES public.menu_complements(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (complement_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_complement_categories_cat ON public.menu_complement_categories(category_id);

-- Enable RLS
ALTER TABLE public.menu_complements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_complement_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active complements" ON public.menu_complements;
CREATE POLICY "Public can read active complements"
  ON public.menu_complements
  FOR SELECT
  TO public
  USING (
    is_active = true OR
    current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text])
  );

DROP POLICY IF EXISTS "Admin and Cuisine can manage complements" ON public.menu_complements;
CREATE POLICY "Admin and Cuisine can manage complements"
  ON public.menu_complements
  FOR ALL
  TO public
  USING (current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text]))
  WITH CHECK (current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text]));

DROP POLICY IF EXISTS "Public can read complement categories" ON public.menu_complement_categories;
CREATE POLICY "Public can read complement categories"
  ON public.menu_complement_categories
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Admin and Cuisine can manage complement categories" ON public.menu_complement_categories;
CREATE POLICY "Admin and Cuisine can manage complement categories"
  ON public.menu_complement_categories
  FOR ALL
  TO public
  USING (current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text]))
  WITH CHECK (current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text]));

-- Realtime for complements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_complements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_complements;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_complement_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_complement_categories;
  END IF;
END $$;

ALTER TABLE public.menu_complements REPLICA IDENTITY FULL;
ALTER TABLE public.menu_complement_categories REPLICA IDENTITY FULL;

-- ============================================================================
-- 5. ORDER ITEMS SNAPSHOT COLUMNS
-- ============================================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID NULL REFERENCES public.menu_item_variants(id) ON DELETE RESTRICT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_name TEXT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS selected_complements JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================================
-- 6. RPC: CREATE_ORDER_WITH_SCHEDULE WITH FULL VARIANT & COMPLEMENT SUPPORT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_order_with_schedule(
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_order_mode TEXT,
  p_location_detail TEXT,
  p_notes TEXT,
  p_items JSONB,
  p_idempotency_key TEXT,
  p_raw_token TEXT,
  p_delivery_schedule_type TEXT DEFAULT 'instant',
  p_scheduled_delivery_time TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_order_id UUID;
  v_public_ref TEXT;
  v_token_hash TEXT;
  v_item RECORD;
  v_db_item RECORD;
  v_variant RECORD;
  v_active_variants_count INTEGER;
  v_item_unit_price INTEGER;
  v_variant_id UUID;
  v_variant_name TEXT;
  v_complements_subtotal INTEGER;
  v_line_subtotal INTEGER;
  v_calculated_total INTEGER := 0;
  v_item_count INTEGER := 0;
  v_existing_order RECORD;
  v_room_number TEXT := NULL;
  v_table_number TEXT := NULL;
  v_delivery_address TEXT := NULL;
  v_configured_delivery_fee INTEGER := 0;
  v_applied_delivery_fee INTEGER := 0;
  v_schedule_type TEXT := 'instant';
  v_schedule_time TEXT := NULL;
  v_parent_category_id UUID;
  v_comp_elem JSONB;
  v_comp_id UUID;
  v_comp_qty INTEGER;
  v_db_comp RECORD;
  v_is_comp_applicable BOOLEAN;
  v_item_complements_snapshot JSONB;
BEGIN
  -- 1. Idempotency Check
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT id, public_reference, total_amount, delivery_fee, payment_status, preparation_status, delivery_schedule_type, scheduled_delivery_time
    INTO v_existing_order
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_order.id,
        'public_reference', v_existing_order.public_reference,
        'total_amount', v_existing_order.total_amount,
        'delivery_fee', COALESCE(v_existing_order.delivery_fee, 0),
        'payment_status', v_existing_order.payment_status,
        'preparation_status', v_existing_order.preparation_status,
        'delivery_schedule_type', COALESCE(v_existing_order.delivery_schedule_type, 'instant'),
        'scheduled_delivery_time', v_existing_order.scheduled_delivery_time,
        'is_replayed', true
      );
    END IF;
  END IF;

  -- 2. Customer validation
  IF TRIM(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Le nom du client est obligatoire.';
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

    IF p_delivery_schedule_type = 'scheduled' AND NULLIF(TRIM(COALESCE(p_scheduled_delivery_time, '')), '') IS NOT NULL THEN
      v_schedule_type := 'scheduled';
      v_schedule_time := TRIM(p_scheduled_delivery_time);
    ELSE
      v_schedule_type := 'instant';
      v_schedule_time := NULL;
    END IF;

    SELECT COALESCE(
      delivery_fee,
      CASE
        WHEN (modes_active->>'delivery_fee') ~ '^[0-9]+$' THEN (modes_active->>'delivery_fee')::INTEGER
        ELSE 0
      END,
      0
    )
    INTO v_configured_delivery_fee
    FROM public.restaurant_settings
    WHERE id = 'default'
    LIMIT 1;

    IF v_configured_delivery_fee > 0 THEN
      v_applied_delivery_fee := v_configured_delivery_fee;
    END IF;
  END IF;

  -- 3. Items validation
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier ne peut pas être vide.';
  END IF;

  -- 4. Reference and token
  v_public_ref := 'CVH-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4));
  v_token_hash := extensions.crypt(p_raw_token, extensions.gen_salt('bf', 8));

  -- 5. Insert Order
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
    delivery_schedule_type,
    scheduled_delivery_time,
    notes,
    preparation_status,
    payment_status,
    delivery_fee,
    total_amount
  ) VALUES (
    v_public_ref,
    v_token_hash,
    NULLIF(TRIM(p_idempotency_key), ''),
    'public_client',
    p_order_mode,
    TRIM(p_customer_name),
    NULLIF(TRIM(p_customer_phone), ''),
    v_room_number,
    v_table_number,
    v_delivery_address,
    v_schedule_type,
    v_schedule_time,
    NULLIF(TRIM(p_notes), ''),
    'new',
    'awaiting_payment',
    v_applied_delivery_fee,
    0
  ) RETURNING id INTO v_order_id;

  -- 6. Loop through items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    item_id UUID,
    variant_id UUID,
    complements JSONB,
    quantity INTEGER,
    notes TEXT
  )
  LOOP
    IF v_item.quantity <= 0 OR v_item.quantity > 50 THEN
      RAISE EXCEPTION 'Quantité invalide pour un article : %', v_item.quantity;
    END IF;

    -- Fetch db menu item
    SELECT id, category_id, name_fr, price, is_available
    INTO v_db_item
    FROM public.menu_items
    WHERE id = v_item.item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article introuvable : %', v_item.item_id;
    END IF;

    IF NOT v_db_item.is_available THEN
      RAISE EXCEPTION 'L''article "%" n''est plus disponible actuellement.', v_db_item.name_fr;
    END IF;

    -- Look up category parent if applicable
    v_parent_category_id := NULL;
    IF v_db_item.category_id IS NOT NULL THEN
      SELECT parent_id INTO v_parent_category_id
      FROM public.menu_categories
      WHERE id = v_db_item.category_id;
    END IF;

    -- Check variants
    SELECT COUNT(*) INTO v_active_variants_count
    FROM public.menu_item_variants
    WHERE menu_item_id = v_db_item.id AND is_active = true;

    v_variant_id := NULL;
    v_variant_name := NULL;
    v_item_unit_price := NULL;

    IF v_item.variant_id IS NOT NULL THEN
      -- Specific variant requested
      SELECT id, name_fr, price, is_active
      INTO v_variant
      FROM public.menu_item_variants
      WHERE id = v_item.variant_id AND menu_item_id = v_db_item.id;

      IF NOT FOUND OR NOT v_variant.is_active THEN
        RAISE EXCEPTION 'La variante sélectionnée pour "%" n''est pas valide ou n''est plus disponible.', v_db_item.name_fr;
      END IF;

      v_variant_id := v_variant.id;
      v_variant_name := v_variant.name_fr;
      -- Pricing rule: if variant has price use it, else fallback to db_item base price
      v_item_unit_price := COALESCE(v_variant.price, v_db_item.price);
      IF v_item_unit_price IS NULL THEN
        RAISE EXCEPTION 'Aucun prix applicable n''est configuré pour la variante "%" de "%".', v_variant.name_fr, v_db_item.name_fr;
      END IF;
    ELSE
      -- No variant passed
      IF v_active_variants_count > 0 AND v_db_item.price IS NULL THEN
        RAISE EXCEPTION 'Veuillez sélectionner une variante pour l''article "%".', v_db_item.name_fr;
      ELSIF v_db_item.price IS NOT NULL THEN
        v_item_unit_price := v_db_item.price;
      ELSE
        RAISE EXCEPTION 'Aucun prix applicable pour l''article "%".', v_db_item.name_fr;
      END IF;
    END IF;

    -- Complements validation & calculation
    v_complements_subtotal := 0;
    v_item_complements_snapshot := '[]'::jsonb;

    IF v_item.complements IS NOT NULL AND jsonb_array_length(v_item.complements) > 0 THEN
      FOR v_comp_elem IN SELECT * FROM jsonb_array_elements(v_item.complements)
      LOOP
        v_comp_id := (v_comp_elem->>'complement_id')::UUID;
        v_comp_qty := COALESCE((v_comp_elem->>'quantity')::INTEGER, 1);

        IF v_comp_qty <= 0 OR v_comp_qty > 20 THEN
          RAISE EXCEPTION 'Quantité invalide pour un complément : %', v_comp_qty;
        END IF;

        -- Fetch complement
        SELECT id, name_fr, price, is_active, is_all_categories
        INTO v_db_comp
        FROM public.menu_complements
        WHERE id = v_comp_id;

        IF NOT FOUND OR NOT v_db_comp.is_active THEN
          RAISE EXCEPTION 'Le complément sélectionné n''est pas disponible.';
        END IF;

        -- Verify applicability
        v_is_comp_applicable := false;
        IF v_db_comp.is_all_categories THEN
          v_is_comp_applicable := true;
        ELSIF v_db_item.category_id IS NOT NULL THEN
          -- Direct category or inherited from parent category
          IF EXISTS (
            SELECT 1 FROM public.menu_complement_categories
            WHERE complement_id = v_db_comp.id
              AND (category_id = v_db_item.category_id OR (v_parent_category_id IS NOT NULL AND category_id = v_parent_category_id))
          ) THEN
            v_is_comp_applicable := true;
          END IF;
        END IF;

        IF NOT v_is_comp_applicable THEN
          RAISE EXCEPTION 'Le complément "%" n''est pas applicable à la catégorie de "%".', v_db_comp.name_fr, v_db_item.name_fr;
        END IF;

        v_complements_subtotal := v_complements_subtotal + (v_db_comp.price * v_comp_qty);

        v_item_complements_snapshot := v_item_complements_snapshot || jsonb_build_object(
          'complement_id', v_db_comp.id,
          'name', v_db_comp.name_fr,
          'unit_price', v_db_comp.price,
          'quantity', v_comp_qty,
          'subtotal', v_db_comp.price * v_comp_qty
        );
      END LOOP;
    END IF;

    -- Subtotal for this order item line
    v_line_subtotal := (v_item_unit_price + v_complements_subtotal) * v_item.quantity;
    v_calculated_total := v_calculated_total + v_line_subtotal;
    v_item_count := v_item_count + 1;

    INSERT INTO public.order_items (
      order_id,
      menu_item_id,
      variant_id,
      variant_name,
      item_name,
      unit_price,
      quantity,
      subtotal,
      selected_complements,
      special_notes
    ) VALUES (
      v_order_id,
      v_db_item.id,
      v_variant_id,
      v_variant_name,
      v_db_item.name_fr,
      v_item_unit_price,
      v_item.quantity,
      v_line_subtotal,
      v_item_complements_snapshot,
      NULLIF(TRIM(v_item.notes), '')
    );
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Aucun article valide dans la commande.';
  END IF;

  v_calculated_total := v_calculated_total + v_applied_delivery_fee;

  UPDATE public.orders
  SET total_amount = v_calculated_total,
      delivery_fee = v_applied_delivery_fee
  WHERE id = v_order_id;

  INSERT INTO public.audit_logs (user_id, action, target_entity, target_id, details)
  VALUES (
    auth.uid(),
    'CREATE_ORDER',
    'orders',
    v_order_id::TEXT,
    jsonb_build_object(
      'public_reference', v_public_ref,
      'order_mode', p_order_mode,
      'customer_name', TRIM(p_customer_name),
      'total_amount', v_calculated_total,
      'delivery_schedule_type', v_schedule_type,
      'scheduled_delivery_time', v_schedule_time
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_order_id,
    'public_reference', v_public_ref,
    'total_amount', v_calculated_total,
    'delivery_fee', v_applied_delivery_fee,
    'payment_status', 'awaiting_payment',
    'preparation_status', 'new',
    'delivery_schedule_type', v_schedule_type,
    'scheduled_delivery_time', v_schedule_time
  );
END;
$function$;

-- Update create_order wrapper
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
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  RETURN public.create_order_with_schedule(
    p_customer_name,
    p_customer_phone,
    p_order_mode,
    p_location_detail,
    p_notes,
    p_items,
    p_idempotency_key,
    p_raw_token,
    'instant',
    NULL
  );
END;
$function$;

-- Update get_client_order to return snapshot variant & complements
CREATE OR REPLACE FUNCTION public.get_client_order(
  p_public_reference TEXT,
  p_raw_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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

  IF v_order.access_token_hash != extensions.crypt(p_raw_token, v_order.access_token_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé à cette commande.');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'item_name', oi.item_name,
      'variant_id', oi.variant_id,
      'variant_name', oi.variant_name,
      'unit_price', oi.unit_price,
      'quantity', oi.quantity,
      'subtotal', oi.subtotal,
      'selected_complements', COALESCE(oi.selected_complements, '[]'::jsonb),
      'special_notes', oi.special_notes,
      'image_url', mi.image_url
    )
  ) INTO v_items
  FROM public.order_items oi
  LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
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
      'delivery_schedule_type', COALESCE(v_order.delivery_schedule_type, 'instant'),
      'scheduled_delivery_time', v_order.scheduled_delivery_time,
      'notes', v_order.notes,
      'preparation_status', v_order.preparation_status,
      'payment_status', v_order.payment_status,
      'delivery_fee', COALESCE(v_order.delivery_fee, 0),
      'total_amount', v_order.total_amount,
      'created_at', v_order.created_at,
      'items', COALESCE(v_items, '[]'::jsonb)
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_schedule TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_order TO anon, authenticated;
