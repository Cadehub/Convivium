-- Allow Cuisine and Admin to clear orders history (all or completed/cancelled)
CREATE OR REPLACE FUNCTION public.clear_orders_history(
  p_scope TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_deleted_count INTEGER := 0;
BEGIN
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('cuisine', 'admin') THEN
    RAISE EXCEPTION 'Permission refusée. Seul le personnel autorisé (Cuisine ou Admin) peut vider l''historique des commandes.';
  END IF;

  IF p_scope = 'completed' THEN
    WITH deleted AS (
      DELETE FROM public.orders
      WHERE preparation_status IN ('completed', 'cancelled')
         OR payment_status = 'payment_rejected'
      RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  ELSE
    WITH deleted AS (
      DELETE FROM public.orders
      WHERE id IS NOT NULL
      RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, target_entity, target_id, details)
  VALUES (
    auth.uid(),
    'CLEAR_ORDERS_HISTORY',
    'orders',
    p_scope,
    jsonb_build_object(
      'scope', p_scope,
      'deleted_count', v_deleted_count,
      'role', v_caller_role
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clear_orders_history(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_orders_history(TEXT) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'Staff can delete orders'
  ) THEN
    CREATE POLICY "Staff can delete orders"
      ON public.orders
      FOR DELETE
      TO authenticated
      USING (public.current_user_role() = ANY (ARRAY['admin'::text, 'cuisine'::text]));
  END IF;
END
$$;
