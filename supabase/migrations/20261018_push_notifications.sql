-- =====================================================================
-- CONVIVIUM HOME HOTEL — PUSH NOTIFICATIONS (Firebase Cloud Messaging)
--
-- Architecture (Supabase stays the source of truth, Firebase only delivers):
--   business change (orders / payment_declarations)
--     -> AFTER trigger enqueues a row in notification_outbox (same transaction,
--        UNIQUE dedupe_key => never twice for the same action)
--     -> AFTER INSERT trigger on the outbox asks the `send-push` Edge Function
--        to deliver it (pg_net, post-commit, best effort, never blocks the order)
--     -> pg_cron drains anything still pending every minute (retry, max 5 tries)
--   The Edge Function resolves recipients through get_push_recipients()
--   (role / order filtering happens in SQL), sends through FCM HTTP v1 and
--   reports back through finalize_notification_outbox().
--
-- Nothing here ever changes an order's business state: every enqueue/dispatch
-- step is wrapped so that a notification failure cannot fail or roll back an order.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---------------------------------------------------------------------
-- 1. SUBSCRIPTIONS (FCM registration tokens)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience    TEXT NOT NULL CHECK (audience IN ('staff', 'client')),
  fcm_token   TEXT NOT NULL CHECK (length(fcm_token) BETWEEN 20 AND 4096),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  language    TEXT NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'en')),
  user_agent  TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 300),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_audience_ref CHECK (
    (audience = 'staff'  AND user_id IS NOT NULL AND order_id IS NULL)
    OR
    (audience = 'client' AND order_id IS NOT NULL AND user_id IS NULL)
  )
);

-- No duplicates: a device token is one staff registration, or one registration per order.
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_staff_token_uk
  ON public.push_subscriptions (fcm_token) WHERE audience = 'staff';
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_client_token_order_uk
  ON public.push_subscriptions (fcm_token, order_id) WHERE audience = 'client';
CREATE INDEX IF NOT EXISTS push_subscriptions_order_idx
  ON public.push_subscriptions (order_id) WHERE audience = 'client';
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id) WHERE audience = 'staff';

-- Tokens are device secrets: no direct table access for any API role.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. TRANSACTIONAL OUTBOX (idempotent + observable)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key       TEXT NOT NULL UNIQUE,
  event_type       TEXT NOT NULL CHECK (event_type IN (
    'order_created', 'payment_declared', 'payment_review_required',
    'payment_confirmed', 'payment_rejected',
    'order_accepted', 'order_preparing', 'order_ready',
    'order_cancelled_by_client', 'order_cancelled_by_staff'
  )),
  audience         TEXT NOT NULL CHECK (audience IN ('cuisine', 'admin', 'client')),
  order_id         UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  public_reference TEXT NOT NULL,
  actor_user_id    UUID,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  recipients_count INTEGER,
  delivered_count  INTEGER,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at        TIMESTAMPTZ,
  processed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON public.notification_outbox (created_at) WHERE status IN ('pending', 'sending');

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notification_outbox TO authenticated;

-- Observability: admin can inspect delivery state (no tokens are stored here).
DROP POLICY IF EXISTS "Admin can view notification outbox" ON public.notification_outbox;
CREATE POLICY "Admin can view notification outbox"
  ON public.notification_outbox
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin'::text);

-- ---------------------------------------------------------------------
-- 3. DISPATCH CONFIG (stored in Supabase Vault, never in Git)
--    push_dispatch_secret is generated here and only ever read server side.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_dispatch_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'push_dispatch_secret',
      'Shared secret authenticating database -> send-push Edge Function calls'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_dispatch_url') THEN
    PERFORM vault.create_secret(
      'https://gmtlaptsdffcprtpkdck.supabase.co/functions/v1/send-push',
      'push_dispatch_url',
      'send-push Edge Function endpoint'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. INTERNAL HELPERS (service_role / triggers only)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_event_type TEXT,
  p_audience TEXT,
  p_order_id UUID,
  p_public_reference TEXT,
  p_dedupe_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notification_outbox
    (dedupe_key, event_type, audience, order_id, public_reference, actor_user_id)
  VALUES
    (p_dedupe_key, p_event_type, p_audience, p_order_id, p_public_reference, auth.uid())
  ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_push_dispatch_secret(p_secret TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT decrypted_secret = p_secret
       FROM vault.decrypted_secrets
      WHERE name = 'push_dispatch_secret'
      LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_notification_outbox(
  p_limit INTEGER DEFAULT 20,
  p_id UUID DEFAULT NULL
)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Give up on rows that exhausted their attempts (observable: status = failed)
  UPDATE public.notification_outbox
     SET status = 'failed',
         processed_at = now(),
         last_error = COALESCE(last_error, 'Nombre maximal de tentatives atteint.')
   WHERE attempts >= 5
     AND (status = 'pending' OR (status = 'sending' AND locked_at < now() - interval '2 minutes'));

  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
      FROM public.notification_outbox o
     WHERE (p_id IS NULL OR o.id = p_id)
       AND o.attempts < 5
       AND (o.status = 'pending'
            OR (o.status = 'sending' AND o.locked_at < now() - interval '2 minutes'))
     ORDER BY o.created_at
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50))
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_outbox o
     SET status = 'sending',
         attempts = o.attempts + 1,
         locked_at = now()
    FROM candidates c
   WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

-- Recipient filtering is done HERE, on the server, from authoritative data:
--   cuisine / admin -> active staff of that exact role (actor excluded)
--   client          -> devices registered for that exact order only
CREATE OR REPLACE FUNCTION public.get_push_recipients(p_outbox_id UUID)
RETURNS TABLE (subscription_id UUID, fcm_token TEXT, language TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.notification_outbox%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.notification_outbox WHERE id = p_outbox_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_row.audience IN ('cuisine', 'admin') THEN
    RETURN QUERY
      SELECT s.id, s.fcm_token, s.language
        FROM public.push_subscriptions s
        JOIN public.profiles p ON p.id = s.user_id
       WHERE s.audience = 'staff'
         AND p.is_active = true
         AND p.role = v_row.audience
         AND (v_row.actor_user_id IS NULL OR s.user_id <> v_row.actor_user_id);
  ELSE
    RETURN QUERY
      SELECT s.id, s.fcm_token, s.language
        FROM public.push_subscriptions s
       WHERE s.audience = 'client'
         AND s.order_id = v_row.order_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_notification_outbox(
  p_id UUID,
  p_status TEXT,
  p_recipients INTEGER,
  p_delivered INTEGER,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('pending', 'sent', 'skipped', 'failed') THEN
    RAISE EXCEPTION 'Statut invalide.';
  END IF;

  UPDATE public.notification_outbox
     SET status = p_status,
         recipients_count = p_recipients,
         delivered_count = p_delivered,
         last_error = LEFT(p_error, 500),
         locked_at = NULL,
         processed_at = CASE WHEN p_status = 'pending' THEN NULL ELSE now() END
   WHERE id = p_id;
END;
$$;

-- Removes tokens FCM reported as invalid / unregistered.
CREATE OR REPLACE FUNCTION public.prune_push_subscriptions(p_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.push_subscriptions WHERE id = ANY (p_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. DISPATCH (post-commit HTTP call, never able to fail a business write)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.call_send_push(p_body JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions, pg_temp
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_dispatch_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_dispatch_secret' LIMIT 1;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', v_secret
    ),
    body := p_body,
    timeout_milliseconds := 5000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push dispatch failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_outbox_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.call_send_push(jsonb_build_object('outbox_id', NEW.id));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push dispatch trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outbox_dispatch ON public.notification_outbox;
CREATE TRIGGER trg_outbox_dispatch
  AFTER INSERT ON public.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION public.trg_outbox_dispatch();

-- Cron safety net: retries anything still pending (Edge Function was down / FCM error).
CREATE OR REPLACE FUNCTION public.drain_push_outbox()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notification_outbox
     WHERE attempts < 5
       AND (status = 'pending'
            OR (status = 'sending' AND locked_at < now() - interval '2 minutes'))
  ) THEN
    PERFORM public.call_send_push(jsonb_build_object('drain', true));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_push_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.notification_outbox
   WHERE status IN ('sent', 'skipped', 'failed')
     AND created_at < now() - interval '30 days';
  -- Subscriptions are touched on every app load; untouched for 60 days = dead device.
  DELETE FROM public.push_subscriptions
   WHERE updated_at < now() - interval '60 days';
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('push-outbox-drain', 'push-cleanup');
  PERFORM cron.schedule('push-outbox-drain', '* * * * *', 'SELECT public.drain_push_outbox()');
  PERFORM cron.schedule('push-cleanup', '17 3 * * *', 'SELECT public.cleanup_push_data()');
END $$;

-- ---------------------------------------------------------------------
-- 6. BUSINESS EVENT TRIGGERS (the ONLY source of notification events)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_orders_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staff_actor BOOLEAN;
  v_declarations INTEGER;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.enqueue_notification(
        'order_created', 'cuisine', NEW.id, NEW.public_reference, 'order_created:' || NEW.id
      );
      RETURN NEW;
    END IF;

    v_staff_actor := public.current_user_role() IS NOT NULL;

    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      SELECT count(*) INTO v_declarations
        FROM public.payment_declarations WHERE order_id = NEW.id;

      IF NEW.payment_status = 'payment_review_required' THEN
        -- Needs a human decision: Cuisine (action) + Admin (management visibility)
        PERFORM public.enqueue_notification('payment_review_required', 'cuisine', NEW.id, NEW.public_reference,
          'payment_review_required:cuisine:' || NEW.id || ':' || v_declarations);
        PERFORM public.enqueue_notification('payment_review_required', 'admin', NEW.id, NEW.public_reference,
          'payment_review_required:admin:' || NEW.id || ':' || v_declarations);
      ELSIF NEW.payment_status = 'paid' THEN
        -- Only emitted once the server actually moved the order to 'paid'
        PERFORM public.enqueue_notification('payment_confirmed', 'client', NEW.id, NEW.public_reference,
          'payment_confirmed:' || NEW.id);
      ELSIF NEW.payment_status = 'payment_rejected' THEN
        PERFORM public.enqueue_notification('payment_rejected', 'client', NEW.id, NEW.public_reference,
          'payment_rejected:' || NEW.id || ':' || v_declarations);
      END IF;
      -- 'payment_declared' is enqueued from the payment_declarations insert (one per declaration)
    END IF;

    IF NEW.preparation_status IS DISTINCT FROM OLD.preparation_status THEN
      IF NEW.preparation_status = 'accepted' THEN
        PERFORM public.enqueue_notification('order_accepted', 'client', NEW.id, NEW.public_reference,
          'order_accepted:' || NEW.id);
      ELSIF NEW.preparation_status = 'preparing' THEN
        PERFORM public.enqueue_notification('order_preparing', 'client', NEW.id, NEW.public_reference,
          'order_preparing:' || NEW.id);
      ELSIF NEW.preparation_status = 'ready' THEN
        PERFORM public.enqueue_notification('order_ready', 'client', NEW.id, NEW.public_reference,
          'order_ready:' || NEW.id);
      ELSIF NEW.preparation_status = 'cancelled' THEN
        IF v_staff_actor THEN
          PERFORM public.enqueue_notification('order_cancelled_by_staff', 'client', NEW.id, NEW.public_reference,
            'order_cancelled_by_staff:' || NEW.id);
        ELSE
          PERFORM public.enqueue_notification('order_cancelled_by_client', 'cuisine', NEW.id, NEW.public_reference,
            'order_cancelled_by_client:cuisine:' || NEW.id);
          IF OLD.payment_status IN ('payment_declared', 'payment_review_required') THEN
            -- money was declared on this order: relevant for management
            PERFORM public.enqueue_notification('order_cancelled_by_client', 'admin', NEW.id, NEW.public_reference,
              'order_cancelled_by_client:admin:' || NEW.id);
          END IF;
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- A notification problem must never fail or alter an order write.
    RAISE WARNING 'notification enqueue failed for order %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_notify_insert ON public.orders;
CREATE TRIGGER trg_orders_notify_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_notify();

DROP TRIGGER IF EXISTS trg_orders_notify_update ON public.orders;
CREATE TRIGGER trg_orders_notify_update
  AFTER UPDATE OF payment_status, preparation_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_notify();

CREATE OR REPLACE FUNCTION public.trg_declarations_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ref TEXT;
BEGIN
  BEGIN
    SELECT public_reference INTO v_ref FROM public.orders WHERE id = NEW.order_id;
    IF v_ref IS NOT NULL THEN
      PERFORM public.enqueue_notification('payment_declared', 'cuisine', NEW.order_id, v_ref,
        'payment_declared:' || NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notification enqueue failed for declaration %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_declarations_notify ON public.payment_declarations;
CREATE TRIGGER trg_declarations_notify
  AFTER INSERT ON public.payment_declarations
  FOR EACH ROW EXECUTE FUNCTION public.trg_declarations_notify();

-- ---------------------------------------------------------------------
-- 7. SUBSCRIPTION RPCs
-- ---------------------------------------------------------------------

-- Staff: bound to the authenticated session + active Admin/Cuisine role (verified server side)
CREATE OR REPLACE FUNCTION public.register_staff_push_subscription(
  p_token TEXT,
  p_language TEXT DEFAULT 'fr',
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := public.current_user_role();
  IF auth.uid() IS NULL OR v_role IS NULL OR v_role NOT IN ('admin', 'cuisine') THEN
    RAISE EXCEPTION 'Permission refusée.';
  END IF;

  INSERT INTO public.push_subscriptions (audience, fcm_token, user_id, language, user_agent)
  VALUES ('staff', TRIM(p_token), auth.uid(),
          CASE WHEN p_language = 'en' THEN 'en' ELSE 'fr' END,
          LEFT(p_user_agent, 300))
  ON CONFLICT (fcm_token) WHERE audience = 'staff'
  DO UPDATE SET user_id = auth.uid(),
                language = EXCLUDED.language,
                user_agent = EXCLUDED.user_agent,
                updated_at = now();

  -- Keep at most 10 devices per staff member (oldest dropped first)
  DELETE FROM public.push_subscriptions
   WHERE id IN (
     SELECT id FROM public.push_subscriptions
      WHERE audience = 'staff' AND user_id = auth.uid()
      ORDER BY updated_at DESC
      OFFSET 10
   );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- A device token is an unguessable device secret; knowing it is enough to revoke it
-- (needed on logout / expired sessions). Only staff registrations are affected.
CREATE OR REPLACE FUNCTION public.unregister_staff_push_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.push_subscriptions
   WHERE audience = 'staff' AND fcm_token = TRIM(p_token);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Client: bound to the order through the existing secure access token (bcrypt hash)
CREATE OR REPLACE FUNCTION public.register_client_push_subscription(
  p_public_reference TEXT,
  p_raw_token TEXT,
  p_fcm_token TEXT,
  p_language TEXT DEFAULT 'fr',
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT id, access_token_hash, preparation_status INTO v_order
    FROM public.orders
   WHERE public_reference = TRIM(p_public_reference);

  -- Same generic answer for "unknown order" and "wrong token": no enumeration
  IF NOT FOUND OR v_order.access_token_hash <> extensions.crypt(COALESCE(p_raw_token, ''), v_order.access_token_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé à cette commande.');
  END IF;

  IF v_order.preparation_status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande est terminée.');
  END IF;

  INSERT INTO public.push_subscriptions (audience, fcm_token, order_id, language, user_agent)
  VALUES ('client', TRIM(p_fcm_token), v_order.id,
          CASE WHEN p_language = 'en' THEN 'en' ELSE 'fr' END,
          LEFT(p_user_agent, 300))
  ON CONFLICT (fcm_token, order_id) WHERE audience = 'client'
  DO UPDATE SET language = EXCLUDED.language,
                user_agent = EXCLUDED.user_agent,
                updated_at = now();

  -- Abuse guard: at most 5 devices per order
  DELETE FROM public.push_subscriptions
   WHERE id IN (
     SELECT id FROM public.push_subscriptions
      WHERE audience = 'client' AND order_id = v_order.id
      ORDER BY updated_at DESC
      OFFSET 5
   );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_client_push_subscription(
  p_public_reference TEXT,
  p_raw_token TEXT,
  p_fcm_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT id, access_token_hash INTO v_order
    FROM public.orders
   WHERE public_reference = TRIM(p_public_reference);

  IF NOT FOUND OR v_order.access_token_hash <> extensions.crypt(COALESCE(p_raw_token, ''), v_order.access_token_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé à cette commande.');
  END IF;

  DELETE FROM public.push_subscriptions
   WHERE audience = 'client' AND order_id = v_order.id AND fcm_token = TRIM(p_fcm_token);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------
-- 8. PRIVILEGES (explicit; Supabase default privileges grant anon/authenticated)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.enqueue_notification(TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_push_dispatch_secret(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_notification_outbox(INTEGER, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_push_recipients(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_notification_outbox(UUID, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_push_subscriptions(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.call_send_push(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_outbox_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.drain_push_outbox() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_push_data() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_orders_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_declarations_notify() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.verify_push_dispatch_secret(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_push_recipients(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_notification_outbox(UUID, TEXT, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_push_subscriptions(UUID[]) TO service_role;

REVOKE ALL ON FUNCTION public.register_staff_push_subscription(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_staff_push_subscription(TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.unregister_staff_push_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unregister_staff_push_token(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.register_client_push_subscription(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_client_push_subscription(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.unregister_client_push_subscription(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unregister_client_push_subscription(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
