-- Migration: Guests (CRM) — Phase 2b · record RPC
--
-- fetch_guest_record(host, gkey) → identity + the 5 stat-band numbers + tags +
-- verification + blocked + reliability/lead-time extras for the Guest Record
-- header & Overview. Reuses _host_guest_rows for the core aggregate (one source
-- of truth) and adds record-only extras (cancellations, reliability, avg lead
-- time, preferred listing) computed from bookings under the merge rule.
--
-- The gkey is resolved back to its identity:
--   u_<uuid>  → guest_id          (merge: bookings.guest_id = uuid
--                                   OR same lowercased email as that profile)
--   e_<b64>   → lowercased email  (bookings.guest_id IS NULL AND lower(email)=…)

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

  -- Resolve the gkey to a guest_id and/or email for the merge rule.
  IF p_gkey LIKE 'u\_%' THEN
    v_guest_id := substring(p_gkey FROM 3)::uuid;
    SELECT lower(email) INTO v_email FROM user_profiles WHERE id = v_guest_id;
  ELSIF p_gkey LIKE 'e\_%' THEN
    -- Recover the email from any matching booking/contact rather than decoding
    -- base64 in SQL (the gkey is the source of truth; this just needs the email
    -- to apply the merge WHERE). Match by recomputing the gkey.
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

  -- Booking-derived extras under the merge rule (registered guest may have older
  -- manual bookings under the same email).
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

  -- No directory row for this gkey under this host → 404 signal.
  IF result IS NULL THEN
    RETURN json_build_object('error','not_found');
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_guest_record(uuid, text) TO authenticated;

COMMENT ON FUNCTION fetch_guest_record IS
  'Guest Record identity + stat band + reliability/lead-time/preferred-listing extras for one gkey. Applies the merge rule. Returns {error:not_found} if the host has no such guest. Ownership-checked.';
