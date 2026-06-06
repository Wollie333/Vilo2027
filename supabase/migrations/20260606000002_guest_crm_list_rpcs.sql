-- Migration: Guests (CRM) — Phase 2a · list + summary RPCs
--
-- Builds the unified guest directory by UNIONing two sources, deduped by the
-- canonical gkey:
--   (a) distinct guests derived from `bookings` (registered guest_id OR email-only)
--   (b) `host_contacts` rows (manual "Add guest" contacts + enquiry contacts)
--
-- Shared core: `_host_guest_rows(host)` returns one fully-aggregated row per
-- guest (stats, segment flags, contactability, pillar metrics). Both wrappers
-- and the record RPC (Phase 2b) read from it, so the heavy aggregation lives in
-- exactly one place.
--
-- Realized "stays" status set = ('confirmed','checked_in','completed') (matches
-- the app — see reference_migration_repair_drift). Direct = channel IS NULL OR
-- 'direct'; OTA = channel present and <> 'direct'. est_fees_saved = direct_value
-- × 15% (decision E). VIP = 'VIP' = ANY(host_contacts.tags).

-- ─── gkey helper — must match the TS side exactly ──────────────────────────
-- TS: 'e_' + Buffer.from(email.toLowerCase().trim()).toString('base64url')
-- base64url = standard base64 with +→-, /→_, padding (= , \n, \r) stripped.
CREATE OR REPLACE FUNCTION guest_gkey_for_email(p_email text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'e_' || regexp_replace(
    translate(encode(convert_to(lower(trim(p_email)), 'UTF8'), 'base64'), '+/', '-_'),
    '[=\n\r]', '', 'g');
$$;
COMMENT ON FUNCTION guest_gkey_for_email IS
  'Canonical email gkey (e_<base64url(lower(trim(email)))>). Must match the TS gkeyForEmail() helper byte-for-byte.';

-- ─── Shared per-guest aggregate ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _host_guest_rows(p_host_id uuid)
RETURNS TABLE (
  gkey text, guest_id uuid, name text, email text, phone text, avatar_url text, country text,
  guest_since timestamptz, channel text, last_status text,
  total_stays int, total_nights int, total_bookings int,
  lifetime_value numeric, direct_value numeric, est_fees_saved numeric, currency text,
  first_stay date, last_stay date, next_stay date, next_listing text,
  avg_rating numeric, review_count int,
  is_vip boolean, is_returning boolean, is_new boolean, is_ota boolean, is_inhouse boolean,
  is_lapsed boolean, is_all_direct boolean, is_verified boolean, is_blocked boolean,
  has_email boolean, has_phone boolean, tags text[],
  listing_ids uuid[], channels text[]
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
WITH bg AS (
  SELECT
    CASE WHEN b.guest_id IS NOT NULL THEN 'u_' || b.guest_id::text
         ELSE guest_gkey_for_email(b.guest_email) END AS gkey,
    b.guest_id, b.guest_name, b.guest_email, b.guest_phone,
    b.status, b.channel, b.check_in, b.check_out, b.nights,
    b.total_amount, b.currency, b.created_at, b.listing_id,
    (b.channel IS NULL OR b.channel = 'direct') AS is_direct
  FROM bookings b
  WHERE b.host_id = p_host_id AND b.deleted_at IS NULL
    AND (b.guest_id IS NOT NULL OR b.guest_email IS NOT NULL)
),
agg AS (
  SELECT
    gkey,
    count(*)::int AS total_bookings,
    count(*) FILTER (WHERE status IN ('confirmed','checked_in','completed'))::int AS total_stays,
    COALESCE(sum(nights)        FILTER (WHERE status IN ('confirmed','checked_in','completed')),0)::int AS total_nights,
    COALESCE(sum(total_amount)  FILTER (WHERE status IN ('confirmed','checked_in','completed')),0) AS lifetime_value,
    COALESCE(sum(total_amount)  FILTER (WHERE status IN ('confirmed','checked_in','completed') AND is_direct),0) AS direct_value,
    min(check_in)  FILTER (WHERE status IN ('confirmed','checked_in','completed')) AS first_stay,
    max(check_out) FILTER (WHERE status IN ('confirmed','checked_in','completed')) AS last_stay,
    bool_or(status = 'checked_in'
            OR (status IN ('confirmed','checked_in','completed')
                AND check_in <= current_date AND check_out > current_date)) AS is_inhouse,
    bool_or(channel IS NOT NULL AND channel <> 'direct') AS is_ota,
    bool_and(is_direct) FILTER (WHERE status IN ('confirmed','checked_in','completed')) AS all_direct_realized,
    count(*) FILTER (WHERE status IN ('confirmed','checked_in','completed'))::int AS realized_cnt,
    array_remove(array_agg(DISTINCT listing_id), NULL) AS listing_ids,
    array_agg(DISTINCT COALESCE(channel,'direct')) AS channels
  FROM bg GROUP BY gkey
),
latest AS (
  SELECT DISTINCT ON (gkey)
    gkey, channel, status AS last_status, currency,
    guest_name, guest_email, guest_phone, created_at
  FROM bg ORDER BY gkey, created_at DESC
),
nextstay AS (
  SELECT DISTINCT ON (bg.gkey) bg.gkey, bg.check_in AS next_stay, l.name AS next_listing
  FROM bg LEFT JOIN listings l ON l.id = bg.listing_id
  WHERE bg.status IN ('confirmed','checked_in') AND bg.check_in >= current_date
  ORDER BY bg.gkey, bg.check_in ASC
),
hc AS (
  SELECT
    CASE WHEN guest_id IS NOT NULL THEN 'u_' || guest_id::text
         ELSE guest_gkey_for_email(email) END AS gkey,
    guest_id AS hc_guest_id, name AS hc_name, email AS hc_email, phone AS hc_phone,
    country AS hc_country, tags, blocked, created_at AS hc_created
  FROM host_contacts WHERE host_id = p_host_id
),
rv AS (
  SELECT guest_id, avg(rating)::numeric(3,2) AS avg_rating, count(*)::int AS review_count
  FROM reviews WHERE host_id = p_host_id AND is_published AND guest_id IS NOT NULL
  GROUP BY guest_id
),
keys AS (
  SELECT gkey FROM agg
  UNION
  SELECT gkey FROM hc
)
SELECT
  k.gkey,
  COALESCE(h.hc_guest_id,
    CASE WHEN k.gkey LIKE 'u\_%' THEN substring(k.gkey FROM 3)::uuid END) AS guest_id,
  COALESCE(up.full_name, h.hc_name, lt.guest_name)        AS name,
  COALESCE(up.email, h.hc_email, lt.guest_email)          AS email,
  COALESCE(up.phone, h.hc_phone, lt.guest_phone)          AS phone,
  up.avatar_url,
  COALESCE(up.country, h.hc_country)                      AS country,
  COALESCE(up.created_at, h.hc_created, lt.created_at)    AS guest_since,
  lt.channel, lt.last_status,
  COALESCE(a.total_stays,0), COALESCE(a.total_nights,0), COALESCE(a.total_bookings,0),
  COALESCE(a.lifetime_value,0), COALESCE(a.direct_value,0),
  round(COALESCE(a.direct_value,0) * 0.15, 2)            AS est_fees_saved,
  COALESCE(lt.currency,'ZAR')                            AS currency,
  a.first_stay, a.last_stay, ns.next_stay, ns.next_listing,
  rv.avg_rating, COALESCE(rv.review_count,0),
  COALESCE('VIP' = ANY(h.tags), false)                   AS is_vip,
  COALESCE(a.total_stays,0) > 1                          AS is_returning,
  COALESCE(a.total_stays,0) <= 1                         AS is_new,
  COALESCE(a.is_ota,false)                               AS is_ota,
  COALESCE(a.is_inhouse,false)                           AS is_inhouse,
  (a.last_stay IS NOT NULL
     AND a.last_stay < (current_date - interval '6 months')
     AND ns.next_stay IS NULL)                           AS is_lapsed,
  (COALESCE(a.all_direct_realized,false) AND COALESCE(a.realized_cnt,0) > 0) AS is_all_direct,
  (k.gkey LIKE 'u\_%')                                   AS is_verified,
  COALESCE(h.blocked,false)                              AS is_blocked,
  (length(trim(COALESCE(up.email, h.hc_email, lt.guest_email,''))) > 0) AS has_email,
  (length(trim(COALESCE(up.phone, h.hc_phone, lt.guest_phone,''))) > 0) AS has_phone,
  COALESCE(h.tags, '{}')                                 AS tags,
  COALESCE(a.listing_ids, '{}')                          AS listing_ids,
  COALESCE(a.channels, '{}')                             AS channels
FROM keys k
LEFT JOIN agg a      ON a.gkey = k.gkey
LEFT JOIN hc h       ON h.gkey = k.gkey
LEFT JOIN latest lt  ON lt.gkey = k.gkey
LEFT JOIN nextstay ns ON ns.gkey = k.gkey
LEFT JOIN user_profiles up ON up.id = COALESCE(h.hc_guest_id,
    CASE WHEN k.gkey LIKE 'u\_%' THEN substring(k.gkey FROM 3)::uuid END)
LEFT JOIN rv ON rv.guest_id = COALESCE(h.hc_guest_id,
    CASE WHEN k.gkey LIKE 'u\_%' THEN substring(k.gkey FROM 3)::uuid END);
$$;

-- Lock down the shared helper: only the SECURITY DEFINER wrappers (owned by the
-- same role) may call it. Clients must go through the ownership-checked wrappers.
REVOKE ALL ON FUNCTION _host_guest_rows(uuid) FROM PUBLIC;

COMMENT ON FUNCTION _host_guest_rows IS
  'Internal: one aggregated directory row per guest for a host (bookings ⋃ host_contacts, deduped by gkey). SECURITY DEFINER; not client-callable — use fetch_host_guests / fetch_host_guests_summary / fetch_guest_record.';

-- ─── Ownership guard (host / staff / admin) ────────────────────────────────
CREATE OR REPLACE FUNCTION _can_read_host(p_host_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_host_id = get_my_host_id()
      OR p_host_id = get_my_host_id_as_staff()
      OR is_super_admin();
$$;

-- ─── Summary RPC — KPI block + tab counts + sidebar badge ──────────────────
CREATE OR REPLACE FUNCTION fetch_host_guests_summary(p_host_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  IF NOT _can_read_host(p_host_id) THEN
    RETURN json_build_object('error','forbidden');
  END IF;

  SELECT json_build_object(
    'total_guests',          count(*),
    'total_count',           count(*),                                   -- sidebar badge
    'new_last_30',           count(*) FILTER (WHERE guest_since >= now() - interval '30 days'),
    'returning_count',       count(*) FILTER (WHERE is_returning),
    'repeat_rate',           round(100.0 * count(*) FILTER (WHERE is_returning) / NULLIF(count(*),0), 1),
    'avg_ltv',               round(COALESCE(avg(lifetime_value),0), 2),
    'total_ltv',             COALESCE(sum(lifetime_value),0),
    'direct_value',          COALESCE(sum(direct_value),0),
    'est_fees_saved',        COALESCE(sum(est_fees_saved),0),
    'avg_rating',            round(avg(avg_rating) FILTER (WHERE avg_rating IS NOT NULL), 2),
    'review_count',          COALESCE(sum(review_count),0),
    'staying_this_month',    count(*) FILTER (
                               WHERE is_inhouse OR (next_stay >= current_date
                                 AND next_stay < date_trunc('month', current_date) + interval '1 month')),
    'arriving_soon',         count(*) FILTER (WHERE next_stay >= current_date AND next_stay <= current_date + 7),
    'missing_contact_count', count(*) FILTER (WHERE NOT has_email OR NOT has_phone),
    'tab_counts', json_build_object(
      'all',       count(*),
      'vip',       count(*) FILTER (WHERE is_vip),
      'returning', count(*) FILTER (WHERE is_returning),
      'new',       count(*) FILTER (WHERE is_new),
      'ota',       count(*) FILTER (WHERE is_ota),
      'lapsed',    count(*) FILTER (WHERE is_lapsed)
    )
  ) INTO result
  FROM _host_guest_rows(p_host_id);

  RETURN result;
END;
$$;

-- ─── List RPC — filtered, sorted, paginated directory ──────────────────────
CREATE OR REPLACE FUNCTION fetch_host_guests(
  p_host_id    uuid,
  p_segment    text DEFAULT 'all',
  p_search     text DEFAULT NULL,
  p_listing_id uuid DEFAULT NULL,
  p_channel    text DEFAULT NULL,
  p_min_rating numeric DEFAULT NULL,
  p_sort       text DEFAULT 'recent',
  p_limit      int  DEFAULT 50,
  p_offset     int  DEFAULT 0
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
  ),
  page AS (
    SELECT * FROM filtered
    ORDER BY
      CASE WHEN p_sort='value' THEN lifetime_value END DESC NULLS LAST,
      CASE WHEN p_sort='stays' THEN total_stays    END DESC NULLS LAST,
      CASE WHEN p_sort='name'  THEN lower(name)     END ASC  NULLS LAST,
      -- recent (default): in-house first, then nearest upcoming / latest activity
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

GRANT EXECUTE ON FUNCTION fetch_host_guests_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_host_guests(uuid, text, text, uuid, text, numeric, text, int, int) TO authenticated;

COMMENT ON FUNCTION fetch_host_guests IS
  'Unified guest directory for a host: filtered/sorted/paginated. Returns { guests: [...], total_count }. Ownership-checked.';
COMMENT ON FUNCTION fetch_host_guests_summary IS
  'KPI block + segment tab counts + sidebar total for a host. Ownership-checked.';
