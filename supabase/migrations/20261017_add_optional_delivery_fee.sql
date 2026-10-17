-- Migration: Add optional admin-defined delivery_fee to restaurant_settings and orders
-- Date: 2026-10-17

-- 1. Add optional delivery_fee column to restaurant_settings (NULL by default = not defined)
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT NULL
  CHECK (delivery_fee IS NULL OR delivery_fee >= 0);

-- 2. Add delivery_fee snapshot column to orders (0 by default)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT 0
  CHECK (delivery_fee >= 0);

-- 3. Enable Realtime on restaurant_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'restaurant_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_settings;
  END IF;
END $$;

ALTER TABLE public.restaurant_settings REPLICA IDENTITY FULL;

-- 4. Update create_order RPC to apply admin-defined delivery_fee when p_order_mode = 'delivery'
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
  v_configured_delivery_fee INTEGER := 0;
  v_applied_delivery_fee INTEGER := 0;
BEGIN
  -- 1. Idempotence : si la clé existe déjà, retourner la commande existante
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT id, public_reference, total_amount, delivery_fee, payment_status, preparation_status
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
        'is_replayed', true
      );
    END IF;
  END IF;

  -- 2. Validation du nom client (téléphone optionnel)
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

    -- Fetch admin-configured delivery fee if defined (> 0)
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

  -- 3. Validation de la liste des articles
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier ne peut pas être vide.';
  END IF;

  -- 4. Génération de la référence publique et hash du token via extensions.gen_salt
  v_public_ref := 'CVH-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4));
  v_token_hash := extensions.crypt(p_raw_token, extensions.gen_salt('bf', 8));

  -- 5. Création de la commande (customer_phone optionnel)
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
    NULLIF(TRIM(p_notes), ''),
    'new',
    'awaiting_payment',
    v_applied_delivery_fee,
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

  -- 7. Ajout éventuel des frais de livraison au total calculé côté serveur
  v_calculated_total := v_calculated_total + v_applied_delivery_fee;

  UPDATE public.orders
  SET total_amount = v_calculated_total,
      delivery_fee = v_applied_delivery_fee
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_order_id,
    'public_reference', v_public_ref,
    'total_amount', v_calculated_total,
    'delivery_fee', v_applied_delivery_fee,
    'payment_status', 'awaiting_payment',
    'preparation_status', 'new'
  );
END;
$function$;

-- 5. Update get_client_order to return delivery_fee
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

  -- Cryptographic check
  IF v_order.access_token_hash != extensions.crypt(p_raw_token, v_order.access_token_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé à cette commande.');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'item_name', oi.item_name,
      'unit_price', oi.unit_price,
      'quantity', oi.quantity,
      'subtotal', oi.subtotal,
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
GRANT EXECUTE ON FUNCTION public.get_client_order TO anon, authenticated;
