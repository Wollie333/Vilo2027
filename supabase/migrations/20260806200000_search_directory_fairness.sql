-- Fair-search refinements to search_directory (P-fairness):
--   1. Host diversity — a host may show at most `diversity_group` listings before
--      other hosts interleave (round-robin by the host's own best→worst). It is a
--      NO-OP for single-listing hosts, so it only ever spreads visibility when one
--      host has several listings — never demotes a lone host's listing.
--   2. Freshness/exploration — (a) a decaying grace boost gives brand-new listings
--      a small head start so they can earn their first reviews, and (b) a
--      stable-per-hour rotation shuffles listings WITHIN a narrow quality band so
--      near-equal listings take turns being seen. Deterministic within the hour,
--      so pagination never reshuffles mid-session.
-- Both apply ONLY to the default "recommended" sort; explicit price/rating/newest
-- sorts stay strict. Knobs live in platform_settings.search_fairness (tunable,
-- with per-key COALESCE fallback so a missing/partial row can never break search).

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'search_fairness',
  '{"grace_boost":0.10,"grace_days":30,"band_width":0.02,"diversity_group":2}'::jsonb,
  'Fair-search knobs. grace_boost/grace_days = new-listing head start (decays to 0). band_width = quality-band width for exploration rotation. diversity_group = max consecutive listings per host before others interleave.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.search_directory(
  p_where            text     DEFAULT NULL,
  p_category_ids     uuid[]   DEFAULT NULL,
  p_type_slug        text     DEFAULT NULL,
  p_guests           int      DEFAULT NULL,
  p_min_price        numeric  DEFAULT NULL,
  p_max_price        numeric  DEFAULT NULL,
  p_bedrooms         int      DEFAULT NULL,
  p_bathrooms        int      DEFAULT NULL,
  p_amenities        text[]   DEFAULT NULL,
  p_instant          boolean  DEFAULT false,
  p_min_rating       numeric  DEFAULT NULL,
  p_verified         boolean  DEFAULT false,
  p_checkin          date     DEFAULT NULL,
  p_checkout         date     DEFAULT NULL,
  p_priority_country text     DEFAULT NULL,
  p_sort             text     DEFAULT 'recommended',
  p_limit            int      DEFAULT 24,
  p_offset           int      DEFAULT 0
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH q AS (
    SELECT CASE
      WHEN p_where IS NULL OR length(btrim(p_where)) = 0 THEN NULL
      ELSE websearch_to_tsquery('english', p_where)
    END AS tsq
  ),
  -- Every knob resolved as a scalar with a default, so cfg is ALWAYS exactly one
  -- row (a missing settings row degrades to defaults, never to zero results).
  cfg AS (
    SELECT
      COALESCE((SELECT (value->>'relevance')::numeric      FROM platform_settings WHERE key = 'search_blend'),    0.70) AS w_rel,
      COALESCE((SELECT (value->>'quality')::numeric        FROM platform_settings WHERE key = 'search_blend'),    0.30) AS w_qual,
      COALESCE((SELECT (value->>'grace_boost')::numeric    FROM platform_settings WHERE key = 'search_fairness'), 0.10) AS grace_boost,
      COALESCE((SELECT (value->>'grace_days')::numeric     FROM platform_settings WHERE key = 'search_fairness'), 30)   AS grace_days,
      COALESCE((SELECT (value->>'band_width')::numeric     FROM platform_settings WHERE key = 'search_fairness'), 0.02) AS band_width,
      COALESCE((SELECT (value->>'diversity_group')::numeric FROM platform_settings WHERE key = 'search_fairness'), 2)   AS diversity_group
  ),
  base AS (
    SELECT
      p.id, p.host_id, p.country, p.base_price, p.avg_rating, p.created_at, p.ranking_score,
      CASE WHEN (SELECT tsq FROM q) IS NOT NULL
           THEN ts_rank_cd(p.search_vector, (SELECT tsq FROM q), 32)
           ELSE 0 END AS relevance
    FROM properties p
    JOIN hosts h ON h.id = p.host_id
    WHERE p.is_published = true
      AND p.property_type = 'accommodation'
      AND p.deleted_at IS NULL
      AND ((SELECT tsq FROM q) IS NULL OR p.search_vector @@ (SELECT tsq FROM q))
      AND (
        p_type_slug IS NULL
        OR (p_category_ids IS NOT NULL AND p.category_id = ANY (p_category_ids))
        OR p.accommodation_type = p_type_slug
      )
      AND (p_guests    IS NULL OR p.max_guests >= p_guests)
      AND (p_min_price IS NULL OR p.base_price  >= p_min_price)
      AND (p_max_price IS NULL OR p.base_price  <= p_max_price)
      AND (p_bedrooms  IS NULL OR p.bedrooms    >= p_bedrooms)
      AND (p_bathrooms IS NULL OR p.bathrooms   >= p_bathrooms)
      AND (p_instant   IS NOT true OR p.instant_booking = true)
      AND (p_min_rating IS NULL OR p.avg_rating >= p_min_rating)
      AND (p_verified  IS NOT true OR h.is_verified = true)
      AND (
        p_amenities IS NULL OR array_length(p_amenities, 1) IS NULL
        OR (
          SELECT count(DISTINCT pa.amenity_key)
          FROM property_amenities pa
          WHERE pa.property_id = p.id AND pa.amenity_key = ANY (p_amenities)
        ) = array_length(p_amenities, 1)
      )
      AND (
        p_checkin IS NULL OR p_checkout IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM blocked_dates b
          WHERE b.property_id = p.id
            AND b.room_id IS NULL
            AND b.date >= p_checkin
            AND b.date <  p_checkout
        )
      )
  ),
  scored AS (
    SELECT
      base.*,
      -- New-listing grace: full boost at creation, decaying linearly to 0 over
      -- grace_days. Clamped so an old listing never gets a negative nudge.
      GREATEST(
        0,
        cfg.grace_boost * (1 - EXTRACT(EPOCH FROM (now() - base.created_at)) / (cfg.grace_days * 86400))
      ) AS grace,
      (cfg.w_rel * base.relevance + cfg.w_qual * base.ranking_score) AS blend,
      cfg.band_width AS band_width,
      cfg.diversity_group AS diversity_group
    FROM base, cfg
  ),
  scored2 AS (
    SELECT
      scored.*,
      (blend + grace) AS score,
      -- Fine quality bands: only near-identical scores share a band, so relevance
      -- still dominates — rotation happens only among genuine ties.
      floor((blend + grace) / NULLIF(band_width, 0))::bigint AS band,
      -- Stable within the clock hour, rotates hourly → deterministic pagination.
      abs(hashtext(id::text || to_char(now(), 'YYYYMMDDHH24'))::bigint) AS jitter
    FROM scored
  ),
  ranked AS (
    SELECT
      scored2.*,
      -- Diversity bucket: a host's best `diversity_group` listings share bucket 0,
      -- the next group bucket 1, etc. Single-listing hosts are always bucket 0.
      floor(
        (row_number() OVER (PARTITION BY host_id ORDER BY score DESC, id) - 1)
        / GREATEST(diversity_group, 1)
      )::bigint AS host_bucket
    FROM scored2
  )
  SELECT ranked.id, count(*) OVER () AS total_count
  FROM ranked
  ORDER BY
    -- priority country always floats to the top, whatever the sort
    CASE WHEN p_priority_country IS NOT NULL AND ranked.country = p_priority_country
         THEN 0 ELSE 1 END,
    -- explicit sorts win and stay strict (no diversity/rotation)
    CASE WHEN p_sort = 'price_asc'  THEN ranked.base_price END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN ranked.base_price END DESC NULLS LAST,
    CASE WHEN p_sort = 'rating'     THEN ranked.avg_rating END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'     THEN ranked.created_at END DESC NULLS LAST,
    -- recommended: host diversity → quality band → exploration rotation
    CASE WHEN p_sort NOT IN ('price_asc','price_desc','rating','newest')
         THEN ranked.host_bucket END ASC NULLS LAST,
    CASE WHEN p_sort NOT IN ('price_asc','price_desc','rating','newest')
         THEN ranked.band END DESC NULLS LAST,
    CASE WHEN p_sort NOT IN ('price_asc','price_desc','rating','newest')
         THEN ranked.jitter END ASC NULLS LAST,
    ranked.score DESC,
    ranked.created_at DESC,
    ranked.id
  LIMIT  GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$fn$;

COMMENT ON FUNCTION public.search_directory IS
  'Public accommodation directory search. Single source of filter truth. Recommended sort = relevance×quality with host-diversity round-robin + new-listing grace + hourly banded rotation; explicit sorts stay strict. Returns (id, total_count).';
