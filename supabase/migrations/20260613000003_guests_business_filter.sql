-- Migration (Phase 6): add a business filter to the guest directory.
--
-- fetch_host_guests gains an optional p_business_id. A guest matches a business
-- when they've booked one of that business's listings (their listing_ids[]
-- intersect the business's listings) — mirrors the existing p_listing_id filter.
-- Default NULL = no filter, so existing callers are unaffected. Adding a
-- parameter changes the signature, so drop the old function first.

DROP FUNCTION IF EXISTS fetch_host_guests(
  uuid, text, text, uuid, text, numeric, text, int, int
);

CREATE OR REPLACE FUNCTION fetch_host_guests(
  p_host_id     uuid,
  p_segment     text DEFAULT 'all',
  p_search      text DEFAULT NULL,
  p_listing_id  uuid DEFAULT NULL,
  p_channel     text DEFAULT NULL,
  p_min_rating  numeric DEFAULT NULL,
  p_sort        text DEFAULT 'recent',
  p_limit       int  DEFAULT 50,
  p_offset      int  DEFAULT 0,
  p_business_id uuid DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  IF NOT _can_read_host(p_host_id) THEN
    RETURN json_build_object('error','forbidden','guests','[]'::json,'total_count',0);
  END IF;

  WITH base AS (SELECT * FROM _host_guest_rows(p_host_id)),
  filtered AS (
    SELECT * FROM base
    WHERE (p_segment IS NULL OR p_segment = 'all'
           OR (p_segment='vip'       AND is_vip)
           OR (p_segment='returning' AND is_returning)
           OR (p_segment='new'       AND is_new)
           OR (p_segment='ota'       AND is_ota)
           OR (p_segment='lapsed'    AND is_lapsed))
      AND (p_search IS NULL OR p_search = ''
           OR COALESCE(name,'')  ILIKE '%'||p_search||'%'
           OR COALESCE(email,'') ILIKE '%'||p_search||'%'
           OR COALESCE(phone,'') ILIKE '%'||p_search||'%')
      AND (p_listing_id IS NULL OR p_listing_id = ANY(listing_ids))
      AND (p_channel    IS NULL OR p_channel = ANY(channels))
      AND (p_min_rating IS NULL OR avg_rating >= p_min_rating)
      AND (p_business_id IS NULL OR EXISTS (
             SELECT 1 FROM public.listings l
             WHERE l.id = ANY(base.listing_ids)
               AND l.business_id = p_business_id))
  ),
  page AS (
    SELECT * FROM filtered
    ORDER BY
      CASE WHEN p_sort='value' THEN lifetime_value END DESC NULLS LAST,
      CASE WHEN p_sort='stays' THEN total_stays    END DESC NULLS LAST,
      CASE WHEN p_sort='name'  THEN lower(name)     END ASC  NULLS LAST,
      CASE WHEN p_sort='recent' OR p_sort IS NULL THEN is_inhouse::int END DESC,
      CASE WHEN p_sort='recent' OR p_sort IS NULL THEN COALESCE(next_stay, last_stay) END DESC NULLS LAST,
      guest_since DESC NULLS LAST
    LIMIT GREATEST(p_limit,1) OFFSET GREATEST(p_offset,0)
  )
  SELECT json_build_object(
    'guests',      COALESCE((SELECT json_agg(row_to_json(page)) FROM page), '[]'::json),
    'total_count', (SELECT count(*) FROM filtered)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_host_guests(
  uuid, text, text, uuid, text, numeric, text, int, int, uuid
) TO authenticated;

COMMENT ON FUNCTION fetch_host_guests IS
  'Unified guest directory for a host: filtered/sorted/paginated (incl. optional business filter). Returns { guests: [...], total_count }. Ownership-checked.';
