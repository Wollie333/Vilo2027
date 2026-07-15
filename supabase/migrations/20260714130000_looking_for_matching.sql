-- =============================================================================
-- Looking-For — matching + notification wiring
-- =============================================================================
-- Three fixes so the modelled-but-inert pieces actually work:
--  1. calculate_looking_for_match_score referenced properties.is_active and
--     properties.region — NEITHER column exists (they're is_published / province),
--     so the function 42703-errored if ever called. Recreated with the real names.
--  2. looking_for_expiry_notifications gains dispatched_at so the drain worker can
--     tell which queued warnings still need a notification sent (the cron only
--     inserted the row; nothing ever dispatched).
--  3. Schedule the /api/looking-for-worker drain (vault-secret pattern, mirrors
--     the check-in reminder + notification-system workers) to drain BOTH queues:
--     expiring-soon (→ guest) and the region digest (→ hosts).
-- -----------------------------------------------------------------------------

-- 1. Fix the match-score function -------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_looking_for_match_score(
  p_post_id UUID,
  p_host_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post RECORD;
  v_best_match_score INT := 0;
  v_best_property_id UUID;
  v_best_property_name TEXT;
  v_match_reasons JSONB := '[]'::jsonb;
  v_property RECORD;
  v_score INT;
  v_reasons JSONB;
BEGIN
  SELECT
    id, category, location_region, location_text,
    adults, children, infants, check_in_date, check_out_date,
    budget_min, budget_max, budget_per
  INTO v_post
  FROM looking_for_posts
  WHERE id = p_post_id AND status = 'active';

  IF v_post IS NULL THEN
    RETURN jsonb_build_object(
      'score', 0, 'property_id', NULL, 'property_name', NULL,
      'reasons', '[]'::jsonb, 'error', 'Post not found or inactive'
    );
  END IF;

  FOR v_property IN
    SELECT
      p.id, p.name, p.city, p.province, p.max_guests, p.base_price,
      p.currency, p.booking_mode, p.allow_children, p.allow_infants
    FROM properties p
    WHERE p.host_id = p_host_id
      AND p.is_published = TRUE
      AND p.deleted_at IS NULL
  LOOP
    v_score := 0;
    v_reasons := '[]'::jsonb;

    -- Region match (30)
    IF v_post.location_region IS NOT NULL AND v_property.province IS NOT NULL
       AND LOWER(v_property.province) = LOWER(v_post.location_region) THEN
      v_score := v_score + 30;
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type','region','label','Region match'));
    END IF;

    -- City/location text (20)
    IF v_post.location_text IS NOT NULL AND v_property.city IS NOT NULL
       AND (LOWER(v_property.city) LIKE '%' || LOWER(v_post.location_text) || '%'
            OR LOWER(v_post.location_text) LIKE '%' || LOWER(v_property.city) || '%') THEN
      v_score := v_score + 20;
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type','location','label','Location match'));
    END IF;

    -- Guest capacity (25)
    DECLARE
      total_guests INT := COALESCE(v_post.adults,0) + COALESCE(v_post.children,0);
    BEGIN
      IF v_property.max_guests >= total_guests THEN
        v_score := v_score + 25;
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type','capacity','label','Fits ' || total_guests || ' guests'));
      END IF;
    END;

    -- Child/infant friendliness (5 + 5)
    IF COALESCE(v_post.children,0) > 0 AND v_property.allow_children = TRUE THEN
      v_score := v_score + 5;
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type','children','label','Child-friendly'));
    END IF;
    IF COALESCE(v_post.infants,0) > 0 AND v_property.allow_infants = TRUE THEN
      v_score := v_score + 5;
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type','infants','label','Infant-friendly'));
    END IF;

    -- Budget (15 / 10)
    IF v_post.budget_max IS NOT NULL AND v_property.base_price IS NOT NULL
       AND v_property.base_price <= v_post.budget_max THEN
      v_score := v_score + 15;
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type','budget','label','Within budget'));
    ELSIF v_post.budget_min IS NOT NULL AND v_property.base_price IS NOT NULL
       AND v_property.base_price >= v_post.budget_min THEN
      v_score := v_score + 10;
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type','budget','label','Meets min budget'));
    END IF;

    IF v_score > v_best_match_score THEN
      v_best_match_score := v_score;
      v_best_property_id := v_property.id;
      v_best_property_name := v_property.name;
      v_match_reasons := v_reasons;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'score', v_best_match_score,
    'max_score', 100,
    'percentage', ROUND((v_best_match_score::NUMERIC / 100) * 100),
    'property_id', v_best_property_id,
    'property_name', v_best_property_name,
    'reasons', v_match_reasons
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_looking_for_match_score(UUID, UUID) TO authenticated;

-- 2. Dispatch gate on the expiry queue --------------------------------------
ALTER TABLE public.looking_for_expiry_notifications
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lf_expiry_undispatched
  ON public.looking_for_expiry_notifications (post_id)
  WHERE dispatched_at IS NULL;

-- 3. Schedule the drain worker ----------------------------------------------
-- One-time per env (Dashboard -> SQL Editor):
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/looking-for-worker',
--     'looking_for_worker_url', '');
-- Reuses the existing 'email_worker_secret' Vault entry as the bearer.

SELECT cron.unschedule('drain-looking-for-notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drain-looking-for-notifications'
);

-- Hourly at :20. Hourly (not daily) so an expiry warning still lands promptly;
-- the worker's dispatched_at / processed_at gates keep every item to one send.
SELECT cron.schedule('drain-looking-for-notifications', '20 * * * *', $cron$
  DO $body$
  DECLARE
    v_url    text;
    v_secret text;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'looking_for_worker_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-looking-for-notifications: vault looking_for_worker_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_secret,
        'Content-Type',  'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  END;
  $body$;
$cron$);
