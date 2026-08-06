-- Front-page fair search — foundation (P1)
--
-- Two changes, both in service of "hosts compete on optimisation, not spend":
--   1. Upgrade properties.search_vector to a WEIGHTED tsvector so relevance can
--      tell a name match from a description match (Google-styled ranking).
--   2. Remove the paid-plan boost from the directory ranking. Rank is now purely
--      earned: rating, reviews, listing optimisation, responsiveness. Paid plans
--      monetise via features, never search position. (Founder decision, 2026-08-06.)

-- ---------------------------------------------------------------------------
-- 1. Weighted full-text document
-- ---------------------------------------------------------------------------
-- The column already exists but concatenates every field at equal weight, so a
-- keyword buried in a description counts the same as one in the listing name —
-- which is exactly what lets keyword-stuffing win. Recreate it weighted:
--   A = name (the host's headline promise)
--   B = city / province / country (location intent, structured — can't be faked
--       by writing another town's name into the description, which lands at D)
--   C = accommodation type
--   D = description (rich detail, lowest weight, stuffing-resistant)
--
-- search_vector is not referenced by application code yet (search still uses
-- ILIKE), so reshaping it is safe. CASCADE drops the dependent GIN index; we
-- recreate it immediately.
ALTER TABLE public.properties DROP COLUMN IF EXISTS search_vector CASCADE;

ALTER TABLE public.properties
  ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english',
      coalesce(city, '') || ' ' || coalesce(province, '') || ' ' || coalesce(country, '')
    ), 'B') ||
    setweight(to_tsvector('english', coalesce(accommodation_type, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_properties_search_vector
  ON public.properties USING GIN (search_vector);

COMMENT ON COLUMN public.properties.search_vector IS
  'Weighted FTS document for directory search (A=name, B=location, C=type, D=description). Generated — never write directly.';

-- ---------------------------------------------------------------------------
-- 2. Fair ranking — drop the plan boost, redistribute to earned signals
-- ---------------------------------------------------------------------------
-- New weights sum to 1.0 and contain NO pay-to-rank term. Listing optimisation
-- ("profile") is now the joint-largest lever, because it is the one every host
-- controls regardless of what they pay:
--   rating .30 · reviews .20 · profile/optimisation .30 · response .20
UPDATE public.platform_settings
   SET value = '{"rating":0.30,"reviews":0.20,"profile":0.30,"response":0.20,"plan":0.0}'::jsonb,
       description = 'Directory ranking weights. Must sum to 1.0. plan MUST stay 0 — rank is earned, not bought (founder decision 2026-08-06).'
 WHERE key = 'ranking_weights';

INSERT INTO public.platform_settings (key, value, description)
SELECT 'ranking_weights',
       '{"rating":0.30,"reviews":0.20,"profile":0.30,"response":0.20,"plan":0.0}'::jsonb,
       'Directory ranking weights. Must sum to 1.0. plan MUST stay 0 — rank is earned, not bought (founder decision 2026-08-06).'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'ranking_weights');

-- The scorer, with the plan/subscription block removed entirely. Everything else
-- (per-key weight fallback, COALESCE-into-NOT-NULL guards, the property_rankings
-- audit row + denormalised properties.ranking_score copy) is preserved.
CREATE OR REPLACE FUNCTION public.recalculate_listing_ranking(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_weights      jsonb;
  v_avg_rating   numeric;
  v_review_count integer;
  v_review_norm  numeric;
  v_profile      numeric;
  v_response     numeric;
  v_score        numeric;
  w_rating       numeric;
  w_reviews      numeric;
  w_profile      numeric;
  w_response     numeric;
BEGIN
  SELECT value INTO v_weights FROM platform_settings WHERE key = 'ranking_weights';

  -- Per-key fallback: a missing row AND a partial blob both survive. plan is
  -- intentionally not read — it no longer influences rank.
  w_rating   := COALESCE((v_weights->>'rating')::numeric,   0.30);
  w_reviews  := COALESCE((v_weights->>'reviews')::numeric,  0.20);
  w_profile  := COALESCE((v_weights->>'profile')::numeric,  0.30);
  w_response := COALESCE((v_weights->>'response')::numeric, 0.20);

  SELECT avg_rating, total_reviews INTO v_avg_rating, v_review_count
  FROM properties WHERE id = p_listing_id;

  v_review_norm := LEAST(1.0, ln(1 + COALESCE(v_review_count, 0)) / ln(101));

  -- Listing optimisation: the coachable, pay-agnostic lever. Same components the
  -- host-facing "Listing Strength" panel will surface.
  SELECT (
    CASE WHEN l.description   IS NOT NULL THEN 0.20 ELSE 0 END +
    CASE WHEN l.city          IS NOT NULL THEN 0.20 ELSE 0 END +
    CASE WHEN (SELECT COUNT(*) FROM property_photos    WHERE property_id = l.id) >= 5 THEN 0.30 ELSE 0 END +
    CASE WHEN l.check_in_time IS NOT NULL THEN 0.15 ELSE 0 END +
    CASE WHEN (SELECT COUNT(*) FROM property_amenities WHERE property_id = l.id) >= 3 THEN 0.15 ELSE 0 END
  ) INTO v_profile FROM properties l WHERE l.id = p_listing_id;

  SELECT h.response_rate INTO v_response
  FROM properties l JOIN hosts h ON h.id = l.host_id WHERE l.id = p_listing_id;

  v_score :=
    (COALESCE(v_avg_rating / 5.0, 0) * w_rating)   +
    (COALESCE(v_review_norm, 0)      * w_reviews)  +
    (COALESCE(v_profile, 0)          * w_profile)  +
    (COALESCE(v_response, 0)         * w_response);

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
    0,  -- plan boost retired; column kept for history/back-compat
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

  UPDATE properties SET ranking_score = v_score WHERE id = p_listing_id;
END;
$fn$;

-- Recompute every published listing now so the new (plan-free) order takes
-- effect immediately rather than at the next cron tick.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.properties WHERE deleted_at IS NULL LOOP
    PERFORM public.recalculate_listing_ranking(r.id);
  END LOOP;
END $$;
