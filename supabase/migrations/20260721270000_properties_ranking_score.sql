-- Make the ranking usable by search.
--
-- property_rankings is a separate table keyed by property_id, which PostgREST
-- cannot order a filtered, paginated properties query by. That is a large part
-- of why the ranking has never been wired into search despite existing for
-- months: the data was in a shape the query layer could not use.
--
-- Mirroring the score onto properties turns "best first" into an ordinary column
-- sort that composes with every filter and with pagination. property_rankings
-- stays the system of record for the component breakdown; this is a read
-- optimisation kept in step by the same function that writes it.
alter table public.properties
  add column if not exists ranking_score numeric not null default 0;

comment on column public.properties.ranking_score is
  'Denormalised copy of property_rankings.ranking_score, maintained by recalculate_listing_ranking(). Exists so directory search can ORDER BY it alongside its filters. Never write directly.';

-- Ordering by score, newest as the tie-break, over exactly the rows the public
-- directory can return.
create index if not exists properties_ranking_score_idx
  on public.properties (ranking_score desc, created_at desc)
  where is_published = true and deleted_at is null;

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

  -- Per-key fallback: a missing row AND a partial blob both survive.
  w_rating   := COALESCE((v_weights->>'rating')::numeric,   0.30);
  w_reviews  := COALESCE((v_weights->>'reviews')::numeric,  0.20);
  w_profile  := COALESCE((v_weights->>'profile')::numeric,  0.15);
  w_response := COALESCE((v_weights->>'response')::numeric, 0.15);
  w_plan     := COALESCE((v_weights->>'plan')::numeric,     0.20);

  SELECT avg_rating, total_reviews INTO v_avg_rating, v_review_count
  FROM properties WHERE id = p_listing_id;

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

  v_score := COALESCE(
    (COALESCE(v_avg_rating / 5.0, 0) * w_rating)   +
    (COALESCE(v_review_norm, 0)      * w_reviews)  +
    (COALESCE(v_profile, 0)          * w_profile)  +
    (COALESCE(v_response, 0)         * w_response) +
    (COALESCE(v_plan_boost, 0)       * w_plan), 0);

  INSERT INTO property_rankings (
    property_id, ranking_score, component_rating, component_reviews,
    component_profile, component_response_rate, component_plan_boost, last_calculated
  ) VALUES (
    p_listing_id, v_score,
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

  -- Keep the sortable copy in step, in the same transaction as the source of
  -- truth so the two can never disagree.
  UPDATE properties SET ranking_score = v_score WHERE id = p_listing_id;
END;
$fn$;

-- Backfill from what the fixed cron already computed, so search has real
-- ordering immediately rather than at the next tick.
update public.properties p
   set ranking_score = r.ranking_score
  from public.property_rankings r
 where r.property_id = p.id
   and p.ranking_score is distinct from r.ranking_score;
