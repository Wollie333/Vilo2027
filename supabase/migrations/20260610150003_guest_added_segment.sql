-- Migration: "Added guest" segment.
--
-- Flags guests who exist only because they were named on someone else's booking
-- party (materialised into host_contacts + linked via guest_relationships) and
-- have no bookings of their own. Surfaced as a segment pill on the guest record
-- and the Guests list, a filter tab, and a summary count.
--
--   is_added_guest = has a guest_relationships row (as contact_id)
--                    AND has no bookings as the lead (total_bookings = 0)
--
-- Recreates _host_guest_rows (adds the column) + the three reader RPCs that build
-- on it. Faithful copies of 20260606000002 / …003 with the additions only.

DROP FUNCTION IF EXISTS _host_guest_rows(uuid);
CREATE FUNCTION _host_guest_rows(p_host_id uuid)
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
  listing_ids uuid[], channels text[], is_added_guest boolean
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
    id AS hc_id,
    guest_id AS hc_guest_id, name AS hc_name, email AS hc_email, phone AS hc_phone,
    country AS hc_country, tags, blocked, created_at AS hc_created
  FROM host_contacts WHERE host_id = p_host_id
),
addedrel AS (
  SELECT DISTINCT contact_id FROM guest_relationships WHERE host_id = p_host_id
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
  COALESCE(a.channels, '{}')                             AS channels,
  (h.hc_id IS NOT NULL AND ar.contact_id IS NOT NULL
     AND COALESCE(a.total_bookings,0) = 0)               AS is_added_guest
FROM keys k
LEFT JOIN agg a      ON a.gkey = k.gkey
LEFT JOIN hc h       ON h.gkey = k.gkey
LEFT JOIN addedrel ar ON ar.contact_id = h.hc_id
LEFT JOIN latest lt  ON lt.gkey = k.gkey
LEFT JOIN nextstay ns ON ns.gkey = k.gkey
LEFT JOIN user_profiles up ON up.id = COALESCE(h.hc_guest_id,
    CASE WHEN k.gkey LIKE 'u\_%' THEN substring(k.gkey FROM 3)::uuid END)
LEFT JOIN rv ON rv.guest_id = COALESCE(h.hc_guest_id,
    CASE WHEN k.gkey LIKE 'u\_%' THEN substring(k.gkey FROM 3)::uuid END);
$$;

REVOKE ALL ON FUNCTION _host_guest_rows(uuid) FROM PUBLIC;

COMMENT ON FUNCTION _host_guest_rows IS
  'Internal: one aggregated directory row per guest for a host (bookings ⋃ host_contacts, deduped by gkey). is_added_guest flags party-only contacts. SECURITY DEFINER; not client-callable.';

-- ─── Summary: add the 'added' tab count ────────────────────────────────────
CREATE OR REPLACE FUNCTION fetch_host_guests_summary(p_host_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  IF NOT _can_read_host(p_host_id) THEN
    RETURN json_build_object('error','forbidden');
  END IF;

  SELECT json_build_object(
    'total_guests',          count(*),
    'total_count',           count(*),
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
      'lapsed',    count(*) FILTER (WHERE is_lapsed),
      'added',     count(*) FILTER (WHERE is_added_guest)
    )
  ) INTO result
  FROM _host_guest_rows(p_host_id);

  RETURN result;
END;
$$;

-- ─── List: add the 'added' segment filter ──────────────────────────────────
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
           OR (p_segment='lapsed'    AND is_lapsed)
           OR (p_segment='added'     AND is_added_guest))
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

-- ─── Record: expose is_added_guest on the single-guest payload ─────────────
CREATE OR REPLACE FUNCTION fetch_guest_record(p_host_id uuid, p_gkey text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_guest_id uuid;
  v_email    text;
  result     json;
BEGIN
  IF NOT _can_read_host(p_host_id) THEN
    RETURN json_build_object('error','forbidden');
  END IF;

  IF p_gkey LIKE 'u\_%' THEN
    v_guest_id := substring(p_gkey FROM 3)::uuid;
    SELECT lower(email) INTO v_email FROM user_profiles WHERE id = v_guest_id;
  ELSIF p_gkey LIKE 'e\_%' THEN
    SELECT lower(guest_email) INTO v_email
    FROM bookings
    WHERE host_id = p_host_id AND deleted_at IS NULL AND guest_email IS NOT NULL
      AND guest_gkey_for_email(guest_email) = p_gkey
    LIMIT 1;
    IF v_email IS NULL THEN
      SELECT lower(email) INTO v_email
      FROM host_contacts
      WHERE host_id = p_host_id AND email IS NOT NULL
        AND guest_gkey_for_email(email) = p_gkey
      LIMIT 1;
    END IF;
  END IF;

  WITH mb AS (
    SELECT b.*,
      (b.check_out - b.check_in)                       AS los,
      (b.check_in - b.created_at::date)                AS lead_days
    FROM bookings b
    WHERE b.host_id = p_host_id AND b.deleted_at IS NULL
      AND (
        (v_guest_id IS NOT NULL AND b.guest_id = v_guest_id)
        OR (v_email IS NOT NULL AND b.guest_id IS NULL AND lower(b.guest_email) = v_email)
      )
  ),
  extras AS (
    SELECT
      count(*) FILTER (WHERE status = 'cancelled_by_guest')::int          AS guest_cancellations,
      count(*) FILTER (WHERE status IN ('confirmed','checked_in','completed','cancelled_by_guest','no_show'))::int AS decided_total,
      count(*) FILTER (WHERE status IN ('confirmed','checked_in','completed'))::int AS honoured,
      round(avg(lead_days) FILTER (WHERE lead_days >= 0
        AND status IN ('confirmed','checked_in','completed')))            AS avg_lead_days
    FROM mb
  ),
  pref AS (
    SELECT l.name AS preferred_listing
    FROM mb JOIN listings l ON l.id = mb.listing_id
    WHERE mb.status IN ('confirmed','checked_in','completed')
    GROUP BY l.name
    ORDER BY count(*) DESC, max(mb.created_at) DESC
    LIMIT 1
  )
  SELECT json_build_object(
    'gkey',                p_gkey,
    'guest_id',           r.guest_id,
    'name',               r.name,
    'email',              r.email,
    'phone',              r.phone,
    'avatar_url',         r.avatar_url,
    'country',            r.country,
    'guest_since',        r.guest_since,
    'currency',           r.currency,
    'is_verified',        r.is_verified,
    'is_blocked',         r.is_blocked,
    'is_vip',             r.is_vip,
    'is_returning',       r.is_returning,
    'is_new',             r.is_new,
    'is_ota',             r.is_ota,
    'is_inhouse',         r.is_inhouse,
    'is_lapsed',          r.is_lapsed,
    'is_all_direct',      r.is_all_direct,
    'is_added_guest',     r.is_added_guest,
    'has_email',          r.has_email,
    'has_phone',          r.has_phone,
    'tags',               r.tags,
    'total_stays',        r.total_stays,
    'total_nights',       r.total_nights,
    'total_bookings',     r.total_bookings,
    'lifetime_value',     r.lifetime_value,
    'direct_value',       r.direct_value,
    'est_fees_saved',     r.est_fees_saved,
    'avg_rating',         r.avg_rating,
    'review_count',       r.review_count,
    'first_stay',         r.first_stay,
    'last_stay',          r.last_stay,
    'last_status',        r.last_status,
    'channel',            r.channel,
    'next_stay',          r.next_stay,
    'next_listing',       r.next_listing,
    'next_stay_in_days',  CASE WHEN r.next_stay IS NOT NULL
                               THEN (r.next_stay - current_date) END,
    'avg_ltv_per_stay',   CASE WHEN r.total_stays > 0
                               THEN round(r.lifetime_value / r.total_stays, 2) ELSE 0 END,
    'guest_cancellations', e.guest_cancellations,
    'reliability_pct',     CASE WHEN e.decided_total > 0
                               THEN round(100.0 * e.honoured / e.decided_total)::int ELSE NULL END,
    'avg_lead_days',       e.avg_lead_days,
    'preferred_listing',   (SELECT preferred_listing FROM pref)
  ) INTO result
  FROM _host_guest_rows(p_host_id) r
  CROSS JOIN extras e
  WHERE r.gkey = p_gkey;

  IF result IS NULL THEN
    RETURN json_build_object('error','not_found');
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_guest_record(uuid, text) TO authenticated;
