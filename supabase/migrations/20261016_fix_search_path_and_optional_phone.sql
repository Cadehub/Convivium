-- Migration: Fix search_path for pgcrypto functions and make customer_phone optional
-- Date: 2026-10-16

-- 1. Make customer_phone optional
ALTER TABLE public.orders ALTER COLUMN customer_phone DROP NOT NULL;

-- 2. Update create_order with extensions in search_path and optional phone
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
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order_id UUID;
  v_order_ref TEXT;
  v_total INT := 0;
  v_item JSONB;
  v_dish RECORD;
  v_qty INT;
  v_token_hash TEXT;
  v_existing_id UUID;
  v_existing_ref TEXT;
  v_existing_status TEXT;
  v_clean_phone TEXT;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT id, public_reference, payment_status
    INTO v_existing_id, v_existing_ref, v_existing_status
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'order_id', v_existing_id,
        'public_reference', v_existing_ref,
        'payment_status', v_existing_status,
        'already_exists', true
      );
    END IF;
  END IF;

  -- Validate name
  IF TRIM(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Le nom du client est requis.';
  END IF;

  -- Phone is now optional
  v_clean_phone := NULLIF(TRIM(p_customer_phone), '');

  IF p_order_mode NOT IN ('dine_in', 'takeaway', 'room_service', 'delivery') THEN
    RAISE EXCEPTION 'Mode de commande invalide: %', p_order_mode;
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide.';
  END IF;

  -- Calculate total and verify prices from database
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::INT;
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide: %', v_qty;
    END IF;

    SELECT id, name_fr, price_xaf, is_available
    INTO v_dish
    FROM public.dishes
    WHERE id = (v_item->>'dish_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plat ou boisson non trouvé: %', (v_item->>'dish_id');
    END IF;

    IF NOT v_dish.is_available THEN
      RAISE EXCEPTION 'L''article "%" n''est plus disponible actuellement.', v_dish.name_fr;
    END IF;

    v_total := v_total + (v_dish.price_xaf * v_qty);
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Montant total de la commande invalide.';
  END IF;

  -- Hash token using pgcrypto from extensions schema
  v_token_hash := extensions.crypt(p_raw_token, extensions.gen_salt('bf', 8));

  -- Insert order
  INSERT INTO public.orders (
    customer_name,
    customer_phone,
    order_mode,
    location_detail,
    notes,
    total_amount,
    currency,
    payment_status,
    preparation_status,
    idempotency_key,
    order_token_hash
  ) VALUES (
    TRIM(p_customer_name),
    v_clean_phone,
    p_order_mode,
    NULLIF(TRIM(p_location_detail), ''),
    NULLIF(TRIM(p_notes), ''),
    v_total,
    'XAF',
    'pending_declaration',
    'new',
    NULLIF(TRIM(p_idempotency_key), ''),
    v_token_hash
  )
  RETURNING id, public_reference INTO v_order_id, v_order_ref;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price_xaf, name_fr INTO v_dish
    FROM public.dishes
    WHERE id = (v_item->>'dish_id')::UUID;

    v_qty := (v_item->>'quantity')::INT;

    INSERT INTO public.order_items (
      order_id,
      dish_id,
      quantity,
      unit_price_xaf,
      total_price_xaf,
      item_name_snapshot
    ) VALUES (
      v_order_id,
      (v_item->>'dish_id')::UUID,
      v_qty,
      v_dish.price_xaf,
      v_dish.price_xaf * v_qty,
      v_dish.name_fr
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'public_reference', v_order_ref,
    'total_amount', v_total,
    'payment_status', 'pending_declaration',
    'preparation_status', 'new'
  );
END;
$$;

-- 3. Update get_client_order with extensions in search_path
CREATE OR REPLACE FUNCTION public.get_client_order(
  p_order_id UUID,
  p_raw_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_items JSONB;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande non trouvée.';
  END IF;

  IF extensions.crypt(p_raw_token, v_order.order_token_hash) <> v_order.order_token_hash THEN
    RAISE EXCEPTION 'Accès refusé. Jeton de commande invalide.';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'dish_id', oi.dish_id,
      'quantity', oi.quantity,
      'unit_price_xaf', oi.unit_price_xaf,
      'total_price_xaf', oi.total_price_xaf,
      'item_name_snapshot', oi.item_name_snapshot,
      'image_url', d.image_url
    )
  ) INTO v_items
  FROM public.order_items oi
  LEFT JOIN public.dishes d ON d.id = oi.dish_id
  WHERE oi.order_id = p_order_id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'public_reference', v_order.public_reference,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'order_mode', v_order.order_mode,
    'location_detail', v_order.location_detail,
    'notes', v_order.notes,
    'total_amount', v_order.total_amount,
    'currency', v_order.currency,
    'payment_status', v_order.payment_status,
    'preparation_status', v_order.preparation_status,
    'created_at', v_order.created_at,
    'items', COALESCE(v_items, '[]'::JSONB)
  );
END;
$$;

-- 4. Update submit_payment_declaration with extensions in search_path
CREATE OR REPLACE FUNCTION public.submit_payment_declaration(
  p_order_id UUID,
  p_raw_token TEXT,
  p_payment_method TEXT,
  p_payer_phone TEXT,
  p_transaction_reference TEXT,
  p_payer_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_decl_id UUID;
  v_pm RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande non trouvée.';
  END IF;

  IF extensions.crypt(p_raw_token, v_order.order_token_hash) <> v_order.order_token_hash THEN
    RAISE EXCEPTION 'Accès refusé. Jeton de commande invalide.';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Cette commande a déjà été déclarée payée et confirmée.';
  END IF;

  SELECT * INTO v_pm FROM public.payment_methods WHERE id = p_payment_method AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Moyen de paiement non disponible ou inactif.';
  END IF;

  INSERT INTO public.payment_declarations (
    order_id,
    payment_method,
    payer_phone,
    payer_name,
    transaction_reference,
    amount_declared
  ) VALUES (
    p_order_id,
    p_payment_method,
    TRIM(p_payer_phone),
    NULLIF(TRIM(p_payer_name), ''),
    NULLIF(TRIM(p_transaction_reference), ''),
    v_order.total_amount
  )
  RETURNING id INTO v_decl_id;

  UPDATE public.orders
  SET payment_status = 'declared_pending_verification',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'declaration_id', v_decl_id,
    'payment_status', 'declared_pending_verification'
  );
END;
$$;
