-- =====================================================================
-- Migration: Add cancel_order_client RPC function
-- Allows customers to cancel their own order before it is paid/completed
-- =====================================================================

CREATE OR REPLACE FUNCTION public.cancel_order_client(
  p_public_reference TEXT,
  p_raw_token TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- 1. Find the order with row-level lock
  SELECT * INTO v_order
  FROM public.orders
  WHERE public_reference = TRIM(p_public_reference)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande non trouvée.');
  END IF;

  -- 2. Verify token
  IF v_order.access_token_hash != extensions.crypt(p_raw_token, v_order.access_token_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé à cette commande.');
  END IF;

  -- 3. Check payment status: if already paid, cannot be cancelled directly by client
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande est déjà confirmée payée et ne peut plus être annulée directement.');
  END IF;

  -- 4. Check preparation status: if already ready, completed or cancelled
  IF v_order.preparation_status IN ('ready', 'completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande ne peut plus être annulée.');
  END IF;

  -- 5. Update preparation status to cancelled
  UPDATE public.orders
  SET preparation_status = 'cancelled',
      updated_at = now()
  WHERE id = v_order.id;

  -- 6. Audit log
  INSERT INTO public.audit_logs (user_id, action, target_entity, target_id, details)
  VALUES (
    auth.uid(),
    'CLIENT_CANCEL_ORDER',
    'orders',
    v_order.id::TEXT,
    jsonb_build_object(
      'public_reference', v_order.public_reference,
      'reason', NULLIF(TRIM(p_reason), ''),
      'previous_preparation_status', v_order.preparation_status,
      'previous_payment_status', v_order.payment_status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Commande annulée avec succès.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_order_client(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order_client(TEXT, TEXT, TEXT) TO anon, authenticated;
