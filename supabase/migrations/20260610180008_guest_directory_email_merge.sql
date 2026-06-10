-- Migration: Guests directory — merge guests by email (kill duplicate cards)
--
-- Symptom: one person appeared as TWO rows in the Guests directory when some of
-- their rows carried guest_id and others didn't for the SAME email — e.g. a
-- manually-added contact (guest_id NULL → e_<email>) plus a signed-in booking
-- (guest_id set → u_<id>), or an email-only / OTA booking plus a direct one.
--
-- Cause: _host_guest_rows keyed each booking/contact STRICTLY on whether it had
-- a guest_id ('u_'||id else e_<email>), so the same email split across two gkeys.
-- The record RPC (fetch_guest_record) already merges these by email; the list
-- aggregate never got the same rule. This aligns them: a booking/contact whose
-- email matches a registered account collapses into that account's u_ gkey.
--
-- Read-only change to ONE function — heals existing duplicates immediately, no
-- data backfill. Email is the canonical guest identity (BUSINESS_PRINCIPLES #1).

-- Return-type changes need a DROP first (CREATE OR REPLACE can't reshape OUT
-- params). Preserve the is_added_guest column + its addedrel CTE from
-- 20260610150003 — the email-merge below layers on top of it.
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
-- One registered account per lowercased email (DISTINCT ON guards against the
-- rare soft-deleted-then-recreated case). Used to resolve an email-only
-- booking/contact to its account so both fold into a single u_ gkey.
WITH prof AS (
  SELECT DISTINCT ON (lower(email)) lower(email) AS lemail, id
  FROM user_profiles
  WHERE email IS NOT NULL AND trim(email) <> ''
  ORDER BY lower(email), created_at
),
bg AS (
  SELECT
    CASE
      WHEN b.guest_id IS NOT NULL THEN 'u_' || b.guest_id::text
      WHEN pb.id      IS NOT NULL THEN 'u_' || pb.id::text
      ELSE guest_gkey_for_email(b.guest_email)
    END AS gkey,
    COALESCE(b.guest_id, pb.id) AS guest_id,
    b.guest_name, b.guest_email, b.guest_phone,
    b.status, b.channel, b.check_in, b.check_out, b.nights,
    b.total_amount, b.currency, b.created_at, b.listing_id,
    (b.channel IS NULL OR b.channel = 'direct') AS is_direct
  FROM bookings b
  LEFT JOIN prof pb ON pb.lemail = lower(b.guest_email)
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
    CASE
      WHEN h.guest_id IS NOT NULL THEN 'u_' || h.guest_id::text
      WHEN ph.id      IS NOT NULL THEN 'u_' || ph.id::text
      ELSE guest_gkey_for_email(h.email)
    END AS gkey,
    COALESCE(h.guest_id, ph.id) AS hc_guest_id,
    h.name AS hc_name, h.email AS hc_email, h.phone AS hc_phone,
    h.country AS hc_country, h.tags, h.blocked, h.created_at AS hc_created,
    h.id AS hc_id
  FROM host_contacts h
  LEFT JOIN prof ph ON ph.lemail = lower(h.email)
  WHERE h.host_id = p_host_id
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
  'Internal: one aggregated directory row per guest for a host (bookings ⋃ host_contacts), deduped by a canonical gkey that resolves any email matching a registered account to that account (u_<id>). SECURITY DEFINER; not client-callable — use fetch_host_guests / fetch_host_guests_summary / fetch_guest_record.';
