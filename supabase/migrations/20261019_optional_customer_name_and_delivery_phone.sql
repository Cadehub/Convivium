-- ============================================================================
-- Migration: Make customer_name optional (default 'Client') and phone required for delivery
-- Date: 2026-10-19
-- ============================================================================

-- 1. Modify orders table: customer_name is no longer NOT NULL and defaults to 'Client'
ALTER TABLE public.orders ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN customer_name SET DEFAULT 'Client';

-- 2. Update create_order_with_schedule function
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
  v_customer_name TEXT := 'Client';
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

  -- 2. Customer & Phone validation
  v_customer_name := COALESCE(NULLIF(TRIM(p_customer_name), ''), 'Client');

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

    IF NULLIF(TRIM(COALESCE(p_customer_phone, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Le numéro de téléphone est obligatoire pour une livraison.';
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
    v_customer_name,
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
      RAISE EXCEPTION 'Quantité invalide : %', v_item.quantity;
    END IF;

    -- Lock the item row to ensure accurate availability and price
    SELECT id, name_fr, price, is_available, category_id
    INTO v_db_item
    FROM public.menu_items
    WHERE id = v_item.item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article introuvable : %', v_item.item_id;
    END IF;

    IF NOT v_db_item.is_available THEN
      RAISE EXCEPTION 'L''article "%" n''est plus disponible actuellement.', v_db_item.name_fr;
    END IF;

    -- Count active variants for this item
    SELECT COUNT(*)
    INTO v_active_variants_count
    FROM public.item_variants
    WHERE item_id = v_item.item_id AND is_active = true;

    IF v_active_variants_count > 0 THEN
      IF v_item.variant_id IS NULL THEN
        RAISE EXCEPTION 'Une variante doit être sélectionnée pour l''article "%".', v_db_item.name_fr;
      END IF;

      SELECT id, name_fr, price, is_active
      INTO v_variant
      FROM public.item_variants
      WHERE id = v_item.variant_id AND item_id = v_item.item_id;

      IF NOT FOUND OR NOT v_variant.is_active THEN
        RAISE EXCEPTION 'La variante sélectionnée pour l''article "%" n''est plus disponible.', v_db_item.name_fr;
      END IF;

      v_item_unit_price := v_variant.price;
      v_variant_id := v_variant.id;
      v_variant_name := v_variant.name_fr;
    ELSE
      v_item_unit_price := v_db_item.price;
      v_variant_id := NULL;
      v_variant_name := NULL;
    END IF;

    -- Get parent category if any
    SELECT parent_id INTO v_parent_category_id
    FROM public.menu_categories
    WHERE id = v_db_item.category_id;

    -- Process complements
    v_complements_subtotal := 0;
    v_item_complements_snapshot := '[]'::JSONB;

    IF v_item.complements IS NOT NULL AND jsonb_array_length(v_item.complements) > 0 THEN
      FOR v_comp_elem IN SELECT * FROM jsonb_array_elements(v_item.complements)
      LOOP
        v_comp_id := (v_comp_elem->>'complement_id')::UUID;
        v_comp_qty := COALESCE((v_comp_elem->>'quantity')::INTEGER, 1);

        IF v_comp_qty <= 0 OR v_comp_qty > 20 THEN
          RAISE EXCEPTION 'Quantité de complément invalide (% pour %)', v_comp_qty, v_comp_id;
        END IF;

        SELECT id, name_fr, name_en, price, is_active, category_id
        INTO v_db_comp
        FROM public.complements
        WHERE id = v_comp_id;

        IF NOT FOUND OR NOT v_db_comp.is_active THEN
          RAISE EXCEPTION 'Le complément sélectionné n''est plus disponible.';
        END IF;

        -- Verify applicability
        v_is_comp_applicable := (
          v_db_comp.category_id IS NULL OR
          v_db_comp.category_id = v_db_item.category_id OR
          (v_parent_category_id IS NOT NULL AND v_db_comp.category_id = v_parent_category_id)
        );

        IF NOT v_is_comp_applicable THEN
          RAISE EXCEPTION 'Le complément "%" n''est pas applicable à l''article "%".', v_db_comp.name_fr, v_db_item.name_fr;
        END IF;

        v_complements_subtotal := v_complements_subtotal + (v_db_comp.price * v_comp_qty);

        v_item_complements_snapshot := v_item_complements_snapshot || jsonb_build_object(
          'complement_id', v_db_comp.id,
          'name_fr', v_db_comp.name_fr,
          'name_en', v_db_comp.name_en,
          'unit_price', v_db_comp.price,
          'quantity', v_comp_qty,
          'total_price', (v_db_comp.price * v_comp_qty)
        );
      END LOOP;
    END IF;

    v_line_subtotal := (v_item_unit_price + v_complements_subtotal) * v_item.quantity;
    v_calculated_total := v_calculated_total + v_line_subtotal;
    v_item_count := v_item_count + 1;

    INSERT INTO public.order_items (
      order_id,
      item_id,
      item_name,
      unit_price,
      quantity,
      subtotal,
      notes,
      variant_id,
      variant_name,
      complements_snapshot
    ) VALUES (
      v_order_id,
      v_db_item.id,
      v_db_item.name_fr,
      v_item_unit_price,
      v_item.quantity,
      v_line_subtotal,
      NULLIF(TRIM(v_item.notes), ''),
      v_variant_id,
      v_variant_name,
      v_item_complements_snapshot
    );
  END LOOP;

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
      'customer_name', v_customer_name,
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
