-- Front-page fair search — the ranked directory query (P2)
--
-- One SQL function is the single source of filter truth for public accommodation
-- search. It exists because relevance (ts_rank) is computed against the guest's
-- query at request time and therefore cannot be precomputed into a sortable
-- column — PostgREST can filter by full-text but cannot ORDER BY the rank of a
-- runtime query. Centralising every filter here also means the result set and its
-- "N stays" count can never drift apart (the reason searchListings.ts already
-- kept one shared filter list).
--
-- Returns just (id, total_count): the caller re-fetches the rich listing rows by
-- id through its existing typed select, so the listing shape stays defined in ONE
-- place (TypeScript), and this function owns filtering + ordering only.
--
-- SECURITY DEFINER: returns ONLY publicly-visible rows (is_published, not
-- deleted, accommodation) — there is no per-caller data here, so definer rights
-- are safe and let it read platform_settings (blend weights) without needing an
-- anon RLS grant on that table. It is NOT referenced by any RLS policy.

-- Tunable relevance↔quality blend for keyword searches. relevance dominates so a
-- well-matched listing wins, quality breaks the tie toward well-run listings.
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'search_blend',
  '{"relevance":0.70,"quality":0.30}'::jsonb,
  'Keyword-search ordering: weight on text relevance vs earned quality (ranking_score). Should sum to 1.0.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.search_directory(
  p_where            text     DEFAULT NULL,
  p_category_ids     uuid[]   DEFAULT NULL,   -- category + descendants, resolved by caller
  p_type_slug        text     DEFAULT NULL,   -- legacy accommodation_type fallback
  p_guests           int      DEFAULT NULL,
  p_min_price        numeric  DEFAULT NULL,
  p_max_price        numeric  DEFAULT NULL,
  p_bedrooms         int      DEFAULT NULL,
  p_bathrooms        int      DEFAULT NULL,
  p_amenities        text[]   DEFAULT NULL,    -- listing must have ALL of these
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
  blend AS (
    SELECT
      COALESCE((value->>'relevance')::numeric, 0.70) AS w_rel,
      COALESCE((value->>'quality')::numeric,   0.30) AS w_qual
    FROM platform_settings WHERE key = 'search_blend'
  ),
  base AS (
    SELECT
      p.id,
      p.country,
      p.base_price,
      p.avg_rating,
      p.created_at,
      p.ranking_score,
      CASE WHEN (SELECT tsq FROM q) IS NOT NULL
           -- normalisation 32 => rank/(rank+1), bounding relevance to [0,1)
           THEN ts_rank_cd(p.search_vector, (SELECT tsq FROM q), 32)
           ELSE 0 END AS relevance
    FROM properties p
    JOIN hosts h ON h.id = p.host_id
    WHERE p.is_published = true
      AND p.property_type = 'accommodation'
      AND p.deleted_at IS NULL
      -- keyword match (weighted FTS)
      AND ((SELECT tsq FROM q) IS NULL OR p.search_vector @@ (SELECT tsq FROM q))
      -- type: category subtree OR legacy accommodation_type slug
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
      -- amenities: must have ALL requested (distinct-count == requested-count)
      AND (
        p_amenities IS NULL OR array_length(p_amenities, 1) IS NULL
        OR (
          SELECT count(DISTINCT pa.amenity_key)
          FROM property_amenities pa
          WHERE pa.property_id = p.id AND pa.amenity_key = ANY (p_amenities)
        ) = array_length(p_amenities, 1)
      )
      -- availability: exclude listings blocked for the WHOLE place on any night
      -- in [check-in, check-out). NULL dates = no availability constraint.
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
  )
  SELECT base.id, count(*) OVER () AS total_count
  FROM base, blend
  ORDER BY
    -- priority country always floats to the top, whatever the sort
    CASE WHEN p_priority_country IS NOT NULL AND base.country = p_priority_country
         THEN 0 ELSE 1 END,
    -- explicit sorts win; otherwise the relevance×quality blend (or pure quality
    -- when there is no keyword query)
    CASE WHEN p_sort = 'price_asc'  THEN base.base_price END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN base.base_price END DESC NULLS LAST,
    CASE WHEN p_sort = 'rating'     THEN base.avg_rating END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'     THEN base.created_at END DESC NULLS LAST,
    CASE WHEN p_sort NOT IN ('price_asc','price_desc','rating','newest')
         THEN (blend.w_rel * base.relevance) + (blend.w_qual * base.ranking_score)
         END DESC NULLS LAST,
    base.created_at DESC,
    base.id
  LIMIT  GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$fn$;

REVOKE ALL ON FUNCTION public.search_directory(
  text, uuid[], text, int, numeric, numeric, int, int, text[], boolean,
  numeric, boolean, date, date, text, text, int, int
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_directory(
  text, uuid[], text, int, numeric, numeric, int, int, text[], boolean,
  numeric, boolean, date, date, text, text, int, int
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_directory IS
  'Public accommodation directory search. Single source of filter truth; orders by relevance×quality (search_blend) for keyword queries, else ranking_score. Returns (id, total_count) — caller re-fetches rows by id.';
