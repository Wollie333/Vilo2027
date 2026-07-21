-- Search ordering has never worked: property_rankings is empty and the
-- recalculate-rankings cron has failed every 15 minutes for days.
--
-- Cause: recalculate_listing_ranking() reads its weights from
-- platform_settings.key = 'ranking_weights'. That row does not exist on this
-- database — the seed migration that creates it (20260501000016) evidently never
-- took effect here. A missing row makes v_weights NULL, so every
-- (v_weights->>'x')::numeric term is NULL, so the score is NULL, and
-- property_rankings.ranking_score is NOT NULL. Every run aborted.
--
-- Fixed in two independent ways on purpose. Seeding the row alone would leave the
-- same landmine for the next absent key, and hardening alone would leave the
-- weights to a hardcoded default nobody can tune.

-- 1. The row itself, at the documented weights (they sum to 1.0).
insert into platform_settings (key, value, description)
values (
  'ranking_weights',
  '{"rating":0.30,"reviews":0.20,"profile":0.15,"response":0.15,"plan":0.20}'::jsonb,
  'Directory ranking weights. Must sum to 1.0.'
)
on conflict (key) do nothing;

-- 2. A function that degrades instead of dying.
--
-- Config that has gone missing should cost you tuning, not the entire feature —
-- and a nightly job must never be one absent row away from silently never
-- running again. Weights now fall back per key, so a partial or malformed blob
-- is survivable too, and every component is COALESCEd because all of them are
-- NOT NULL columns: component_reviews and component_profile could each have
-- taken the job down the same way the score did.
create or replace function public.recalculate_listing_ranking(p_listing_id uuid)
returns void
language plpgsql
as $fn$
DECLARE
  v_weights      jsonb;
  v_avg_rating   numeric;
  v_review_count integer;
  v_review_norm  numeric;
  v_profile      numeric;
  v_response     numeric;
  v_plan_boost   numeric;
  v_score        numeric;
  w_rating       numeric;
  w_reviews      numeric;
  w_profile      numeric;
  w_response     numeric;
  w_plan         numeric;
BEGIN
  SELECT value INTO v_weights FROM platform_settings WHERE key = 'ranking_weights';

  -- Per-key fallback, so a missing row AND a partial blob both survive.
  w_rating   := COALESCE((v_weights->>'rating')::numeric,   0.30);
  w_reviews  := COALESCE((v_weights->>'reviews')::numeric,  0.20);
  w_profile  := COALESCE((v_weights->>'profile')::numeric,  0.15);
  w_response := COALESCE((v_weights->>'response')::numeric, 0.15);
  w_plan     := COALESCE((v_weights->>'plan')::numeric,     0.20);

  SELECT avg_rating, total_reviews INTO v_avg_rating, v_review_count
  FROM properties WHERE id = p_listing_id;

  -- total_reviews is nullable; ln(1 + NULL) is NULL, which would then be written
  -- straight into a NOT NULL column.
  v_review_norm := LEAST(1.0, ln(1 + COALESCE(v_review_count, 0)) / ln(101));

  SELECT (
    CASE WHEN l.description   IS NOT NULL THEN 0.20 ELSE 0 END +
    CASE WHEN l.city          IS NOT NULL THEN 0.20 ELSE 0 END +
    CASE WHEN (SELECT COUNT(*) FROM property_photos  WHERE property_id = l.id) >= 5 THEN 0.30 ELSE 0 END +
    CASE WHEN l.check_in_time IS NOT NULL THEN 0.15 ELSE 0 END +
    CASE WHEN (SELECT COUNT(*) FROM property_amenities WHERE property_id = l.id) >= 3 THEN 0.15 ELSE 0 END
  ) INTO v_profile FROM properties l WHERE l.id = p_listing_id;

  SELECT h.response_rate INTO v_response
  FROM properties l JOIN hosts h ON h.id = l.host_id WHERE l.id = p_listing_id;

  SELECT CASE s.plan
    WHEN 'free'     THEN 0.0 WHEN 'basic'    THEN 0.3
    WHEN 'pro'      THEN 0.6 WHEN 'business' THEN 1.0 ELSE 0.0 END
  INTO v_plan_boost
  FROM properties l
  JOIN hosts h ON h.id = l.host_id
  JOIN subscriptions s ON s.host_id = h.id AND s.status IN ('trialing','active')
  WHERE l.id = p_listing_id;

  v_score :=
    (COALESCE(v_avg_rating / 5.0, 0) * w_rating)   +
    (COALESCE(v_review_norm, 0)      * w_reviews)  +
    (COALESCE(v_profile, 0)          * w_profile)  +
    (COALESCE(v_response, 0)         * w_response) +
    (COALESCE(v_plan_boost, 0)       * w_plan);

  INSERT INTO property_rankings (
    property_id, ranking_score, component_rating, component_reviews,
    component_profile, component_response_rate, component_plan_boost, last_calculated
  ) VALUES (
    p_listing_id,
    COALESCE(v_score, 0),
    COALESCE(v_avg_rating / 5.0, 0),
    COALESCE(v_review_norm, 0),
    COALESCE(v_profile, 0),
    COALESCE(v_response, 0),
    COALESCE(v_plan_boost, 0),
    now()
  )
  ON CONFLICT (property_id) DO UPDATE SET
    ranking_score           = EXCLUDED.ranking_score,
    component_rating        = EXCLUDED.component_rating,
    component_reviews       = EXCLUDED.component_reviews,
    component_profile       = EXCLUDED.component_profile,
    component_response_rate = EXCLUDED.component_response_rate,
    component_plan_boost    = EXCLUDED.component_plan_boost,
    last_calculated         = now();
END;
$fn$;
