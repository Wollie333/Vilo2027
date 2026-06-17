-- ════════════════════════════════════════════════════════════════════════
--  Rename R2 — core tables: listings + core children → properties + property_*
-- ════════════════════════════════════════════════════════════════════════
-- Part of the listings→properties rename (see RENAME_LISTINGS_TO_PROPERTIES.md).
-- R2 renames the PROPERTY itself and its intrinsic inventory/content children.
-- Pre-MVP: no data to migrate; Docker unavailable so every function whose BODY
-- names a renamed table is recreated from its LATEST definition in the migration
-- history, swapping ONLY the renamed table references.
--
-- What this migration does and does NOT touch:
--   * Renames 7 tables (below). FKs, indexes, triggers, sequences and RLS
--     policies all FOLLOW the rename automatically (Postgres rewires them by
--     OID — confirmed by R1). Cross-table RLS policies / views that reference a
--     renamed table in a subquery also follow automatically (their expressions
--     are stored as OID-referenced parse trees, NOT text) — so none are
--     recreated here.
--   * Recreates the 30 functions whose PL/pgSQL / SQL bodies name a renamed
--     table (function bodies are late-bound text and DO break on rename).
--   * Does NOT rename any column. listing_id / listing_type / clicked_listing
--     and the channel tables (featured_listings, listing_view_events,
--     directory_search_logs) stay exactly as-is — those are R3.
--   * Keeps RPC + function NAMES stable (resolve_listing_policy_id, etc.) so
--     .rpc('…') callers and named-arg params (p_listing_id) keep working.
--   * The 'policies' catalog table is a DIFFERENT table from listing_policies
--     (the per-property assignment table, now property_policies) — left intact.

-- ─── 1. Table renames (7) ────────────────────────────────────────
ALTER TABLE public.listings RENAME TO properties;
ALTER TABLE public.listing_rooms RENAME TO property_rooms;
ALTER TABLE public.listing_photos RENAME TO property_photos;
ALTER TABLE public.listing_amenities RENAME TO property_amenities;
ALTER TABLE public.listing_seasonal_pricing RENAME TO property_seasonal_pricing;
ALTER TABLE public.listing_policies RENAME TO property_policies;
ALTER TABLE public.listing_addons RENAME TO property_addons;

-- ─── 2. Recreate functions whose bodies reference a renamed table ─
-- Only the renamed table references change; listing_id columns, the channel
-- tables and every other reference stay as-is (later phases).

-- _host_guest_rows  (latest def: 20260610180008_guest_directory_email_merge.sql)
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
  FROM bg LEFT JOIN properties l ON l.id = bg.listing_id
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

-- _materialize_booking_party  (latest def: 20260613000002_guest_business_links_on_party.sql)
CREATE OR REPLACE FUNCTION public._materialize_booking_party(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_host        uuid;
  v_listing     uuid;
  v_business_id uuid;
  v_lead_guest  uuid;
  v_lead_email  text;
  v_lead_name   text;
  v_lead_phone  text;
  v_addl        jsonb;
  v_lead_cid    uuid;
  v_pcid        uuid;
  v_pguest      uuid;
  g             jsonb;
  v_pname       text;
  v_pemail      text;
  v_pphone      text;
BEGIN
  SELECT host_id, listing_id, guest_id, lower(nullif(trim(guest_email), '')),
         guest_name, guest_phone, additional_guests
    INTO v_host, v_listing, v_lead_guest, v_lead_email, v_lead_name,
         v_lead_phone, v_addl
    FROM public.bookings WHERE id = p_booking_id;
  IF v_host IS NULL THEN RETURN; END IF;

  -- The business that owns the booking's listing (tags the guest links).
  SELECT business_id INTO v_business_id
    FROM public.properties WHERE id = v_listing;

  -- Lead booker contact (needed as the anchor for every relationship).
  IF v_lead_email IS NOT NULL THEN
    INSERT INTO public.host_contacts (host_id, guest_id, email, name, phone)
      VALUES (v_host, v_lead_guest, v_lead_email, v_lead_name, v_lead_phone)
    ON CONFLICT (host_id, lower(email)) DO UPDATE
      SET name     = COALESCE(public.host_contacts.name,  EXCLUDED.name),
          phone    = COALESCE(public.host_contacts.phone, EXCLUDED.phone),
          guest_id = COALESCE(public.host_contacts.guest_id, EXCLUDED.guest_id)
      RETURNING id INTO v_lead_cid;

    IF v_lead_cid IS NOT NULL AND v_business_id IS NOT NULL THEN
      INSERT INTO public.guest_business_links
        (host_id, contact_id, business_id, source_booking_id)
      VALUES (v_host, v_lead_cid, v_business_id, p_booking_id)
      ON CONFLICT (contact_id, business_id) DO NOTHING;
    END IF;
  END IF;

  -- Each named party member with an email → its own contact + link to the lead.
  FOR g IN SELECT jsonb_array_elements(COALESCE(v_addl, '[]'::jsonb)) LOOP
    v_pname  := trim(COALESCE(g->>'name', ''));
    v_pemail := lower(trim(COALESCE(g->>'email', '')));
    v_pphone := nullif(trim(COALESCE(g->>'phone', '')), '');
    CONTINUE WHEN v_pname = '' OR v_pemail = '';

    SELECT id INTO v_pguest FROM public.user_profiles
      WHERE lower(email) = v_pemail LIMIT 1;

    INSERT INTO public.host_contacts (host_id, guest_id, email, name, phone)
      VALUES (v_host, v_pguest, v_pemail, v_pname, v_pphone)
    ON CONFLICT (host_id, lower(email)) DO UPDATE
      SET name     = COALESCE(public.host_contacts.name,  EXCLUDED.name),
          phone    = COALESCE(public.host_contacts.phone, EXCLUDED.phone),
          guest_id = COALESCE(public.host_contacts.guest_id, EXCLUDED.guest_id)
      RETURNING id INTO v_pcid;

    IF v_pcid IS NOT NULL AND v_business_id IS NOT NULL THEN
      INSERT INTO public.guest_business_links
        (host_id, contact_id, business_id, source_booking_id)
      VALUES (v_host, v_pcid, v_business_id, p_booking_id)
      ON CONFLICT (contact_id, business_id) DO NOTHING;
    END IF;

    IF v_lead_cid IS NOT NULL AND v_pcid IS NOT NULL AND v_lead_cid <> v_pcid THEN
      INSERT INTO public.guest_relationships
        (host_id, contact_id, related_contact_id, source_booking_id)
      VALUES
        (v_host, v_lead_cid, v_pcid, p_booking_id),
        (v_host, v_pcid, v_lead_cid, p_booking_id)
      ON CONFLICT ON CONSTRAINT guest_relationships_unique DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- app_purge_user_account  (latest def: 20260609212120_fix_purge_admin_audit_column.sql)
CREATE OR REPLACE FUNCTION public.app_purge_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid;
BEGIN
  SELECT id INTO v_host_id FROM hosts WHERE user_id = p_user_id;

  DELETE FROM refund_status_history rsh
   WHERE rsh.refund_request_id IN (
     SELECT id FROM refund_requests
      WHERE host_id = v_host_id
         OR guest_id = p_user_id
         OR booking_id IN (
              SELECT id FROM bookings
               WHERE guest_id = p_user_id OR host_id = v_host_id
            )
   );

  DELETE FROM refunds r
   WHERE r.booking_id IN (
     SELECT id FROM bookings
      WHERE guest_id = p_user_id OR host_id = v_host_id
   );

  DELETE FROM refund_requests rr
   WHERE rr.host_id = v_host_id
      OR rr.guest_id = p_user_id
      OR rr.booking_id IN (
        SELECT id FROM bookings
         WHERE guest_id = p_user_id OR host_id = v_host_id
      );

  DELETE FROM payments pm
   WHERE pm.booking_id IN (
     SELECT id FROM bookings
      WHERE guest_id = p_user_id OR host_id = v_host_id
   );

  DELETE FROM policy_snapshots ps
   WHERE ps.booking_id IN (
     SELECT id FROM bookings
      WHERE guest_id = p_user_id OR host_id = v_host_id
   );

  DELETE FROM reviews rv
   WHERE rv.guest_id = p_user_id
      OR rv.booking_id IN (
        SELECT id FROM bookings
         WHERE guest_id = p_user_id OR host_id = v_host_id
      );

  DELETE FROM invoices inv
   WHERE inv.host_id = v_host_id
      OR inv.booking_id IN (
        SELECT id FROM bookings
         WHERE guest_id = p_user_id OR host_id = v_host_id
      );

  DELETE FROM bookings
   WHERE guest_id = p_user_id OR host_id = v_host_id;

  IF v_host_id IS NOT NULL THEN
    DELETE FROM quotes WHERE host_id = v_host_id;
    DELETE FROM properties WHERE host_id = v_host_id;
    DELETE FROM host_feature_overrides WHERE host_id = v_host_id;
    DELETE FROM hosts WHERE id = v_host_id;
  END IF;

  DELETE FROM host_feature_overrides  WHERE overridden_by = p_user_id;
  DELETE FROM featured_listings       WHERE featured_by   = p_user_id;
  DELETE FROM broadcast_announcements WHERE created_by    = p_user_id;
  DELETE FROM admin_message_batches   WHERE created_by    = p_user_id;
  DELETE FROM impersonation_sessions  WHERE admin_id = p_user_id OR target_user_id = p_user_id;
  DELETE FROM admin_audit_log         WHERE admin_id = p_user_id OR impersonating  = p_user_id;
  DELETE FROM data_requests           WHERE user_id = p_user_id;
END;
$$;

-- booking_business_id  (latest def: 20260613000010_per_business_doc_numbering.sql)
CREATE OR REPLACE FUNCTION booking_business_id(p_booking_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT l.business_id
       FROM bookings bk JOIN properties l ON l.id = bk.listing_id
      WHERE bk.id = p_booking_id),
    (SELECT b.id
       FROM bookings bk JOIN businesses b
         ON b.host_id = bk.host_id AND b.is_default = true AND b.is_archived = false
      WHERE bk.id = p_booking_id
      LIMIT 1)
  );
$$;

-- calculate_booking_price  (latest def: 20260601000001_unified_pricing_engine.sql)
CREATE OR REPLACE FUNCTION calculate_booking_price(
  p_listing_id uuid,
  p_check_in   date,
  p_check_out  date,
  p_room_id    uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_listing      properties%ROWTYPE;
  v_room         property_rooms%ROWTYPE;
  v_current_date date;
  v_night_price  numeric;
  v_base_total   numeric := 0;
  v_nights       integer;
  v_dow          integer;
  v_base_price   numeric;
  v_weekend      numeric;
  v_cleaning     numeric;
  v_currency     text;
  v_adj_type     text;
  v_adj_value    numeric;
BEGIN
  SELECT * INTO v_listing FROM properties WHERE id = p_listing_id;

  IF p_room_id IS NOT NULL THEN
    SELECT * INTO v_room FROM property_rooms WHERE id = p_room_id;
    v_base_price := v_room.base_price;
    v_weekend    := v_room.weekend_price;
    v_cleaning   := COALESCE(v_room.cleaning_fee, 0);
    v_currency   := v_room.currency;
  ELSE
    v_base_price := v_listing.base_price;
    v_weekend    := v_listing.weekend_price;
    v_cleaning   := COALESCE(v_listing.cleaning_fee, 0);
    v_currency   := v_listing.currency;
  END IF;

  v_nights := p_check_out - p_check_in;
  v_current_date := p_check_in;

  WHILE v_current_date < p_check_out LOOP
    -- Reset each iteration: SELECT INTO leaves the var untouched on no-match.
    v_adj_type  := NULL;
    v_adj_value := NULL;

    -- Highest-priority active rule covering this night. Room rule beats listing
    -- rule (room_id IS NOT NULL ranked first), then priority, then newest.
    SELECT adjustment_type, adjustment_value
      INTO v_adj_type, v_adj_value
    FROM property_seasonal_pricing
    WHERE listing_id = p_listing_id
      AND is_active  = true
      AND v_current_date BETWEEN start_date AND end_date
      AND (
        (p_room_id IS NOT NULL AND room_id = p_room_id)
        OR room_id IS NULL
      )
    ORDER BY
      (room_id IS NOT NULL) DESC,
      priority             DESC,
      created_at           DESC
    LIMIT 1;

    IF v_adj_type = 'absolute' THEN
      v_night_price := v_adj_value;
    ELSIF v_adj_type = 'percent' THEN
      -- Percent scales the BASE rate (a seasonal rule replaces the weekend rate).
      v_night_price := GREATEST(0, v_base_price * (1 + v_adj_value / 100.0));
    ELSE
      -- No rule: weekend rate on Fri (5) / Sat (6), else base.
      v_dow := EXTRACT(DOW FROM v_current_date);
      IF v_dow IN (5, 6) AND v_weekend IS NOT NULL THEN
        v_night_price := v_weekend;
      ELSE
        v_night_price := v_base_price;
      END IF;
    END IF;

    v_base_total := v_base_total + v_night_price;
    v_current_date := v_current_date + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'nights',       v_nights,
    'base_total',   v_base_total,
    'cleaning_fee', v_cleaning,
    'total',        v_base_total + v_cleaning,
    'currency',     v_currency
  );
END;
$$;

-- effective_vat_rate  (latest def: 20260607000005_listing_vat.sql)
CREATE OR REPLACE FUNCTION public.effective_vat_rate(p_listing_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN l.vat_number IS NOT NULL
            AND btrim(l.vat_number) <> ''
            AND COALESCE(l.vat_rate, 0) > 0
           THEN l.vat_rate
           ELSE 0
         END
  FROM properties l
  WHERE l.id = p_listing_id;
$$;

-- ensure_booking_invoice  (latest def: 20260613000010_per_business_doc_numbering.sql)
CREATE OR REPLACE FUNCTION ensure_booking_invoice(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b                  bookings%ROWTYPE;
  v_business_id      uuid;
  v_host_id          uuid;
  v_host_handle      text;
  v_host_display     text;
  v_host_email       text;
  v_host_phone       text;
  v_listing_name     text;
  v_guest_full_name  text;
  v_guest_email      text;
  v_guest_phone      text;
  v_lines            jsonb;
  v_addons           jsonb;
  v_rooms            jsonb;
  v_banking          jsonb;
  v_business         jsonb;
  v_number           text;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM invoices WHERE booking_id = b.id AND kind = 'booking'
  ) THEN
    RETURN;
  END IF;

  SELECT h.id, h.handle, h.display_name, up.email, up.phone
    INTO v_host_id, v_host_handle, v_host_display, v_host_email, v_host_phone
    FROM hosts h
    JOIN user_profiles up ON up.id = h.user_id
    WHERE h.id = b.host_id;

  -- The business that owns this booking's listing drives the document identity.
  SELECT name, business_id
    INTO v_listing_name, v_business_id
    FROM properties WHERE id = b.listing_id;
  IF v_business_id IS NULL THEN
    v_business_id := booking_business_id(b.id);
  END IF;

  SELECT full_name, email, phone
    INTO v_guest_full_name, v_guest_email, v_guest_phone
    FROM user_profiles WHERE id = b.guest_id;

  -- The business's default (non-archived) banking account.
  SELECT jsonb_build_object(
           'label',            label,
           'bank_name',        bank_name,
           'account_holder',   account_holder,
           'account_number',   account_number,
           'account_type',     account_type,
           'branch_code',      branch_code,
           'swift_code',       swift_code,
           'reference_format', reference_format
         )
    INTO v_banking
    FROM eft_banking_details
    WHERE business_id = v_business_id AND is_default = true AND is_archived = false
    LIMIT 1;

  -- Business identity → same snapshot keys the PDF templates already read.
  SELECT jsonb_build_object(
           'legal_name',                  legal_name,
           'trading_name',                trading_name,
           'vat_number',                  vat_number,
           'company_registration_number', company_registration_number,
           'billing_address_line1',       address_line1,
           'billing_address_line2',       address_line2,
           'billing_city',                city,
           'billing_postcode',            postal_code,
           'billing_country',             country
         )
    INTO v_business
    FROM businesses
    WHERE id = v_business_id;

  SELECT jsonb_agg(jsonb_build_object(
           'label',      label,
           'quantity',   quantity,
           'unit_price', unit_price,
           'subtotal',   subtotal
         ) ORDER BY sort_order)
    INTO v_addons
    FROM booking_addons WHERE booking_id = b.id AND source = 'quote';

  SELECT jsonb_agg(jsonb_build_object(
           'room_id',       br.room_id,
           'room_name',     lr.name,
           'base_amount',   br.base_amount,
           'cleaning_fee',  br.cleaning_fee
         ))
    INTO v_rooms
    FROM booking_rooms br
    JOIN property_rooms lr ON lr.id = br.room_id
    WHERE br.booking_id = b.id;

  v_lines := jsonb_build_object(
    'listing_name',  v_listing_name,
    'check_in',      b.check_in,
    'check_out',     b.check_out,
    'nights',        b.nights,
    'scope',         b.scope,
    'base_amount',   b.base_amount,
    'cleaning_fee',  b.cleaning_fee,
    'rooms',         COALESCE(v_rooms, '[]'::jsonb),
    'addons',        COALESCE(v_addons, '[]'::jsonb)
  );

  v_number := next_invoice_number(v_business_id);

  INSERT INTO invoices (
    invoice_number, booking_id, host_id, guest_id, kind,
    host_snapshot, guest_snapshot, line_items,
    subtotal, vat_amount, total_amount, currency,
    status, issued_at, paid_at
  ) VALUES (
    v_number, b.id, b.host_id, b.guest_id, 'booking',
    jsonb_build_object(
      'host_id',      v_host_id,
      'display_name', v_host_display,
      'handle',       v_host_handle,
      'email',        v_host_email,
      'phone',        v_host_phone,
      'banking',      v_banking,
      'business',     v_business,
      'booking_ref',  b.reference
    ),
    jsonb_build_object(
      'guest_id', b.guest_id,
      'name',     COALESCE(b.guest_name,  v_guest_full_name),
      'email',    COALESCE(b.guest_email, v_guest_email),
      'phone',    COALESCE(b.guest_phone, v_guest_phone)
    ),
    v_lines,
    round(b.total_amount - COALESCE(b.vat_amount, 0), 2),
    COALESCE(b.vat_amount, 0),
    b.total_amount,
    b.currency,
    CASE WHEN b.payment_status = 'completed' THEN 'paid' ELSE 'issued' END,
    now(),
    CASE WHEN b.payment_status = 'completed' THEN now() ELSE NULL END
  );
END;
$$;

-- fetch_conversion_funnel  (latest def: 20260605200526_analytics_fix_variable_mismatches.sql)
CREATE OR REPLACE FUNCTION fetch_conversion_funnel(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_views integer;
  v_inquiries integer;
  v_quotes integer;
  v_bookings integer;
BEGIN
  SELECT COALESCE(COUNT(DISTINCT session_id), 0)
  INTO v_views
  FROM listing_view_events
  WHERE listing_id IN (
    SELECT id FROM properties WHERE host_id = p_host_id AND deleted_at IS NULL
      AND (p_listing_id IS NULL OR id = p_listing_id)
  )
  AND viewed_at >= p_start_date::timestamp
  AND viewed_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second');

  -- conversations has no deleted_at column
  SELECT COALESCE(COUNT(*), 0)
  INTO v_inquiries
  FROM conversations
  WHERE host_id = p_host_id
    AND created_at >= p_start_date::timestamp
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  SELECT COALESCE(COUNT(*), 0)
  INTO v_quotes
  FROM quotes
  WHERE host_id = p_host_id
    AND created_at >= p_start_date::timestamp
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  SELECT COALESCE(COUNT(*), 0)
  INTO v_bookings
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'completed')
    AND created_at >= p_start_date::timestamp
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  RETURN jsonb_build_object(
    'views', v_views,
    'inquiries', v_inquiries,
    'quotes', v_quotes,
    'bookings', v_bookings,
    'conversion_rates', jsonb_build_object(
      'views_to_inquiries', CASE WHEN v_views > 0 THEN ROUND((v_inquiries::numeric / v_views * 100), 1) ELSE 0 END,
      'inquiries_to_quotes', CASE WHEN v_inquiries > 0 THEN ROUND((v_quotes::numeric / v_inquiries * 100), 1) ELSE 0 END,
      'quotes_to_bookings', CASE WHEN v_quotes > 0 THEN ROUND((v_bookings::numeric / v_quotes * 100), 1) ELSE 0 END,
      'views_to_bookings', CASE WHEN v_views > 0 THEN ROUND((v_bookings::numeric / v_views * 100), 1) ELSE 0 END
    )
  );
END;
$$;

-- fetch_guest_record  (latest def: 20260610150003_guest_added_segment.sql)
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
    FROM mb JOIN properties l ON l.id = mb.listing_id
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

-- fetch_host_guests  (latest def: 20260613000003_guests_business_filter.sql)
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
             SELECT 1 FROM public.properties l
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

-- fetch_popular_rooms  (latest def: 20260605200526_analytics_fix_variable_mismatches.sql)
CREATE OR REPLACE FUNCTION fetch_popular_rooms(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_period_days integer;
BEGIN
  v_period_days := p_end_date - p_start_date + 1;

  SELECT jsonb_agg(
    jsonb_build_object(
      'listing_id', listing_id, 'listing_name', listing_name, 'listing_slug', listing_slug,
      'cover_image_url', cover_image_url, 'occupancy_rate', occupancy_rate,
      'nights_booked', nights_booked, 'revenue', revenue, 'bookings_count', bookings_count
    ) ORDER BY occupancy_rate DESC
  )
  INTO v_result
  FROM (
    SELECT
      l.id AS listing_id,
      l.name AS listing_name,
      l.slug AS listing_slug,
      (SELECT lp.url FROM property_photos lp WHERE lp.listing_id = l.id ORDER BY lp.sort_order ASC NULLS LAST LIMIT 1) AS cover_image_url,
      COALESCE(SUM(CASE WHEN b.status IN ('confirmed','checked_in','completed') AND b.check_in >= p_start_date AND b.check_in <= p_end_date THEN (b.check_out - b.check_in) ELSE 0 END), 0) AS nights_booked,
      CASE WHEN v_period_days > 0
        THEN ROUND((COALESCE(SUM(CASE WHEN b.status IN ('confirmed','checked_in','completed') AND b.check_in >= p_start_date AND b.check_in <= p_end_date THEN (b.check_out - b.check_in) ELSE 0 END), 0) / v_period_days::numeric * 100)::numeric, 1)
        ELSE 0 END AS occupancy_rate,
      COALESCE(SUM(CASE WHEN b.status IN ('confirmed','checked_in','completed') AND b.check_in >= p_start_date AND b.check_in <= p_end_date THEN b.total_amount ELSE 0 END), 0) AS revenue,
      COUNT(CASE WHEN b.status IN ('confirmed','checked_in','completed') AND b.check_in >= p_start_date AND b.check_in <= p_end_date THEN 1 END) AS bookings_count
    FROM properties l
    LEFT JOIN bookings b ON b.listing_id = l.id AND b.deleted_at IS NULL
    WHERE l.host_id = p_host_id AND l.deleted_at IS NULL
    GROUP BY l.id, l.name, l.slug
    ORDER BY occupancy_rate DESC
    LIMIT p_limit
  ) popular_rooms;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- fetch_primary_kpis  (latest def: 20260605200526_analytics_fix_variable_mismatches.sql)
CREATE OR REPLACE FUNCTION fetch_primary_kpis(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL,
  p_channel text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_revenue numeric;
  v_prior_revenue numeric;
  v_current_occupied_nights integer;
  v_prior_occupied_nights integer;
  v_total_available_nights integer;
  v_prior_available_nights integer;
  v_current_adr numeric;
  v_prior_adr numeric;
  v_current_revpar numeric;
  v_prior_revpar numeric;
  v_current_occupancy numeric;
  v_prior_occupancy numeric;
  v_days_diff integer;
  v_prior_start_date date;
  v_prior_end_date date;
  v_revenue_sparkline jsonb;
BEGIN
  v_days_diff := p_end_date - p_start_date;
  v_prior_start_date := p_start_date - (v_days_diff + 1);
  v_prior_end_date := p_start_date - 1;

  -- Current period revenue + occupied nights
  SELECT
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(check_out - check_in), 0)
  INTO v_current_revenue, v_current_occupied_nights
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'completed')
    AND check_in >= p_start_date
    AND check_in <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Prior period revenue + occupied nights
  SELECT
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(check_out - check_in), 0)
  INTO v_prior_revenue, v_prior_occupied_nights
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'completed')
    AND check_in >= v_prior_start_date
    AND check_in <= v_prior_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Available nights = published properties * days in period
  IF p_listing_id IS NOT NULL THEN
    v_total_available_nights := (v_days_diff + 1);
  ELSE
    SELECT COUNT(*) * (v_days_diff + 1)
    INTO v_total_available_nights
    FROM properties
    WHERE host_id = p_host_id
      AND is_published = true
      AND deleted_at IS NULL;
  END IF;
  v_prior_available_nights := v_total_available_nights;

  v_current_adr := CASE WHEN v_current_occupied_nights > 0 THEN v_current_revenue / v_current_occupied_nights ELSE 0 END;
  v_prior_adr := CASE WHEN v_prior_occupied_nights > 0 THEN v_prior_revenue / v_prior_occupied_nights ELSE 0 END;
  v_current_revpar := CASE WHEN v_total_available_nights > 0 THEN v_current_revenue / v_total_available_nights ELSE 0 END;
  v_prior_revpar := CASE WHEN v_prior_available_nights > 0 THEN v_prior_revenue / v_prior_available_nights ELSE 0 END;
  v_current_occupancy := CASE WHEN v_total_available_nights > 0 THEN (v_current_occupied_nights::numeric / v_total_available_nights * 100) ELSE 0 END;
  v_prior_occupancy := CASE WHEN v_prior_available_nights > 0 THEN (v_prior_occupied_nights::numeric / v_prior_available_nights * 100) ELSE 0 END;

  -- Daily revenue sparkline
  SELECT jsonb_agg(
    jsonb_build_object('date', day, 'value', COALESCE(daily_revenue, 0)) ORDER BY day
  )
  INTO v_revenue_sparkline
  FROM (
    SELECT day::date AS day, SUM(b.total_amount) AS daily_revenue
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS day
    LEFT JOIN bookings b ON
      b.host_id = p_host_id
      AND b.check_in = day::date
      AND b.status IN ('confirmed', 'checked_in', 'completed')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
      AND (p_channel IS NULL OR b.channel = p_channel)
    GROUP BY day
  ) sparkline_data;

  RETURN jsonb_build_object(
    'revenue', jsonb_build_object(
      'current', ROUND(v_current_revenue, 2),
      'prior', ROUND(v_prior_revenue, 2),
      'delta', CASE WHEN v_prior_revenue > 0 THEN ROUND(((v_current_revenue - v_prior_revenue) / v_prior_revenue * 100)::numeric, 1) ELSE NULL END,
      'sparkline', COALESCE(v_revenue_sparkline, '[]'::jsonb)
    ),
    'revpar', jsonb_build_object(
      'current', ROUND(v_current_revpar, 2),
      'prior', ROUND(v_prior_revpar, 2),
      'delta', CASE WHEN v_prior_revpar > 0 THEN ROUND(((v_current_revpar - v_prior_revpar) / v_prior_revpar * 100)::numeric, 1) ELSE NULL END
    ),
    'adr', jsonb_build_object(
      'current', ROUND(v_current_adr, 2),
      'prior', ROUND(v_prior_adr, 2),
      'delta', CASE WHEN v_prior_adr > 0 THEN ROUND(((v_current_adr - v_prior_adr) / v_prior_adr * 100)::numeric, 1) ELSE NULL END
    ),
    'occupancy', jsonb_build_object(
      'current', ROUND(v_current_occupancy, 1),
      'prior', ROUND(v_prior_occupancy, 1),
      'delta', ROUND((v_current_occupancy - v_prior_occupancy)::numeric, 1),
      'occupied_nights', v_current_occupied_nights,
      'available_nights', v_total_available_nights
    )
  );
END;
$$;

-- fetch_property_performance  (latest def: 20260605200526_analytics_fix_variable_mismatches.sql)
CREATE OR REPLACE FUNCTION fetch_property_performance(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_sort_by text DEFAULT 'revenue',
  p_sort_direction text DEFAULT 'desc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count integer;
  v_properties jsonb;
  v_period_days integer;
BEGIN
  v_period_days := p_end_date - p_start_date + 1;

  SELECT COUNT(*) INTO v_total_count
  FROM properties WHERE host_id = p_host_id AND deleted_at IS NULL;

  WITH property_current AS (
    SELECT
      l.id AS listing_id,
      l.name AS listing_name,
      l.slug AS listing_slug,
      (SELECT lp.url FROM property_photos lp WHERE lp.listing_id = l.id ORDER BY lp.sort_order ASC NULLS LAST LIMIT 1) AS cover_image_url,
      CASE WHEN l.is_suspended THEN 'suspended' WHEN l.is_published THEN 'active' ELSE 'draft' END AS listing_status,
      COALESCE(SUM(CASE WHEN b.status IN ('confirmed','checked_in','completed') AND b.check_in >= p_start_date AND b.check_in <= p_end_date THEN b.total_amount ELSE 0 END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN b.status IN ('confirmed','checked_in','completed') AND b.check_in >= p_start_date AND b.check_in <= p_end_date THEN (b.check_out - b.check_in) ELSE 0 END), 0) AS nights_booked,
      COUNT(CASE WHEN b.status IN ('confirmed','checked_in','completed') AND b.check_in >= p_start_date AND b.check_in <= p_end_date THEN 1 END) AS bookings_count,
      v_period_days AS available_nights
    FROM properties l
    LEFT JOIN bookings b ON b.listing_id = l.id AND b.deleted_at IS NULL
    WHERE l.host_id = p_host_id AND l.deleted_at IS NULL
    GROUP BY l.id, l.name, l.slug, l.is_suspended, l.is_published
  ),
  property_prior AS (
    SELECT
      l.id AS listing_id,
      COALESCE(SUM(CASE WHEN b.status IN ('confirmed','checked_in','completed') AND b.check_in >= (p_start_date - v_period_days) AND b.check_in <= (p_end_date - v_period_days) THEN b.total_amount ELSE 0 END), 0) AS revenue_prior,
      COALESCE(SUM(CASE WHEN b.status IN ('confirmed','checked_in','completed') AND b.check_in >= (p_start_date - v_period_days) AND b.check_in <= (p_end_date - v_period_days) THEN (b.check_out - b.check_in) ELSE 0 END), 0) AS nights_booked_prior
    FROM properties l
    LEFT JOIN bookings b ON b.listing_id = l.id AND b.deleted_at IS NULL
    WHERE l.host_id = p_host_id AND l.deleted_at IS NULL
    GROUP BY l.id
  ),
  sparkline_data AS (
    SELECT
      l.id AS listing_id,
      jsonb_agg(jsonb_build_object('date', day_series.day::date, 'revenue', COALESCE(daily_revenue.revenue, 0)) ORDER BY day_series.day) AS sparkline
    FROM properties l
    CROSS JOIN generate_series(p_end_date - 29, p_end_date, '1 day'::interval) AS day_series(day)
    LEFT JOIN (
      SELECT b.listing_id, b.check_in AS booking_date, SUM(b.total_amount) AS revenue
      FROM bookings b
      WHERE b.host_id = p_host_id
        AND b.status IN ('confirmed','checked_in','completed')
        AND b.check_in >= (p_end_date - 29) AND b.check_in <= p_end_date
        AND b.deleted_at IS NULL
      GROUP BY b.listing_id, b.check_in
    ) AS daily_revenue ON daily_revenue.listing_id = l.id AND daily_revenue.booking_date = day_series.day::date
    WHERE l.host_id = p_host_id AND l.deleted_at IS NULL
    GROUP BY l.id
  ),
  combined_metrics AS (
    SELECT
      pc.listing_id, pc.listing_name, pc.listing_slug, pc.cover_image_url, pc.listing_status,
      pc.revenue, pp.revenue_prior,
      CASE WHEN pp.revenue_prior > 0 THEN ROUND(((pc.revenue - pp.revenue_prior) / pp.revenue_prior * 100)::numeric, 1) ELSE NULL END AS revenue_delta,
      pc.nights_booked, pp.nights_booked_prior,
      CASE WHEN pc.available_nights > 0 THEN ROUND((pc.nights_booked::numeric / pc.available_nights * 100)::numeric, 1) ELSE 0 END AS occupancy,
      CASE WHEN pc.available_nights > 0 THEN ROUND((pp.nights_booked_prior::numeric / pc.available_nights * 100)::numeric, 1) ELSE 0 END AS occupancy_prior,
      CASE WHEN pc.available_nights > 0 AND pp.nights_booked_prior > 0
        THEN ROUND(((pc.nights_booked::numeric / pc.available_nights) - (pp.nights_booked_prior::numeric / pc.available_nights)) * 100::numeric, 1)
        ELSE NULL END AS occupancy_delta,
      CASE WHEN pc.nights_booked > 0 THEN ROUND((pc.revenue / pc.nights_booked)::numeric, 2) ELSE 0 END AS adr,
      pc.bookings_count, sd.sparkline
    FROM property_current pc
    LEFT JOIN property_prior pp ON pp.listing_id = pc.listing_id
    LEFT JOIN sparkline_data sd ON sd.listing_id = pc.listing_id
  ),
  sorted_properties AS (
    SELECT * FROM combined_metrics
    ORDER BY
      CASE WHEN p_sort_by = 'revenue' AND p_sort_direction = 'desc' THEN revenue END DESC,
      CASE WHEN p_sort_by = 'revenue' AND p_sort_direction = 'asc' THEN revenue END ASC,
      CASE WHEN p_sort_by = 'occupancy' AND p_sort_direction = 'desc' THEN occupancy END DESC,
      CASE WHEN p_sort_by = 'occupancy' AND p_sort_direction = 'asc' THEN occupancy END ASC,
      CASE WHEN p_sort_by = 'nights_booked' AND p_sort_direction = 'desc' THEN nights_booked END DESC,
      CASE WHEN p_sort_by = 'nights_booked' AND p_sort_direction = 'asc' THEN nights_booked END ASC,
      CASE WHEN p_sort_by = 'adr' AND p_sort_direction = 'desc' THEN adr END DESC,
      CASE WHEN p_sort_by = 'adr' AND p_sort_direction = 'asc' THEN adr END ASC,
      CASE WHEN p_sort_by = 'listing_name' AND p_sort_direction = 'desc' THEN listing_name END DESC,
      CASE WHEN p_sort_by = 'listing_name' AND p_sort_direction = 'asc' THEN listing_name END ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'listing_id', listing_id, 'listing_name', listing_name, 'listing_slug', listing_slug,
      'cover_image_url', cover_image_url, 'listing_status', listing_status,
      'revenue', revenue, 'revenue_prior', revenue_prior, 'revenue_delta', revenue_delta,
      'nights_booked', nights_booked, 'occupancy', occupancy, 'occupancy_prior', occupancy_prior,
      'occupancy_delta', occupancy_delta, 'adr', adr, 'bookings_count', bookings_count,
      'sparkline', COALESCE(sparkline, '[]'::jsonb)
    )
  )
  INTO v_properties
  FROM sorted_properties;

  RETURN jsonb_build_object(
    'properties', COALESCE(v_properties, '[]'::jsonb),
    'total_count', v_total_count,
    'page_size', p_limit,
    'offset', p_offset
  );
END;
$$;

-- fetch_regional_breakdown  (latest def: 20260605200526_analytics_fix_variable_mismatches.sql)
CREATE OR REPLACE FUNCTION fetch_regional_breakdown(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object('province', province, 'revenue', revenue, 'bookings', bookings, 'percentage', percentage)
    ORDER BY revenue DESC
  )
  INTO v_result
  FROM (
    SELECT
      COALESCE(l.province, 'Unknown') AS province,
      COALESCE(SUM(b.total_amount), 0) AS revenue,
      COUNT(b.id) AS bookings,
      ROUND((COALESCE(SUM(b.total_amount), 0) / NULLIF(
        (SELECT SUM(total_amount) FROM bookings
         WHERE host_id = p_host_id
           AND status IN ('confirmed','checked_in','completed')
           AND check_in >= p_start_date AND check_in <= p_end_date
           AND deleted_at IS NULL
           AND (p_listing_id IS NULL OR listing_id = p_listing_id)
        ), 0) * 100)::numeric, 1) AS percentage
    FROM properties l
    LEFT JOIN bookings b ON
      b.listing_id = l.id
      AND b.status IN ('confirmed','checked_in','completed')
      AND b.check_in >= p_start_date AND b.check_in <= p_end_date
      AND b.deleted_at IS NULL
    WHERE l.host_id = p_host_id AND l.deleted_at IS NULL
      AND (p_listing_id IS NULL OR l.id = p_listing_id)
    GROUP BY l.province
    HAVING COALESCE(SUM(b.total_amount), 0) > 0
  ) regional_data;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- fetch_seasonality_heatmap  (latest def: 20260605200526_analytics_fix_variable_mismatches.sql)
CREATE OR REPLACE FUNCTION fetch_seasonality_heatmap(
  p_host_id uuid,
  p_year integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provinces text[];
  v_months text[];
  v_data jsonb;
BEGIN
  SELECT array_agg(province ORDER BY total_revenue DESC)
  INTO v_provinces
  FROM (
    SELECT COALESCE(l.province, 'Unknown') AS province, SUM(b.total_amount) AS total_revenue
    FROM properties l
    LEFT JOIN bookings b ON
      b.listing_id = l.id
      AND b.status IN ('confirmed','checked_in','completed')
      AND EXTRACT(YEAR FROM b.check_in) = p_year
      AND b.deleted_at IS NULL
    WHERE l.host_id = p_host_id AND l.deleted_at IS NULL
    GROUP BY l.province
    ORDER BY total_revenue DESC NULLS LAST
    LIMIT 5
  ) top_provinces;

  v_months := ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  WITH month_series AS (
    SELECT generate_series(1, 12) AS month_num, unnest(v_months) AS month_name
  ),
  revenue_by_month_province AS (
    SELECT
      EXTRACT(MONTH FROM b.check_in)::integer AS month_num,
      COALESCE(l.province, 'Unknown') AS province,
      COALESCE(SUM(b.total_amount), 0) AS revenue
    FROM bookings b
    INNER JOIN properties l ON l.id = b.listing_id
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed','checked_in','completed')
      AND EXTRACT(YEAR FROM b.check_in) = p_year
      AND b.deleted_at IS NULL
      AND l.deleted_at IS NULL
    GROUP BY month_num, l.province
  )
  SELECT jsonb_agg(
    jsonb_build_object('month', ms.month_name, 'month_num', ms.month_num) || (
      SELECT COALESCE(jsonb_object_agg(prov, COALESCE(revenue, 0)), '{}'::jsonb)
      FROM unnest(v_provinces) AS prov
      LEFT JOIN revenue_by_month_province rmp ON rmp.province = prov AND rmp.month_num = ms.month_num
    )
    ORDER BY ms.month_num
  )
  INTO v_data
  FROM month_series ms;

  RETURN jsonb_build_object(
    'months', to_jsonb(v_months),
    'provinces', to_jsonb(COALESCE(v_provinces, ARRAY[]::text[])),
    'data', COALESCE(v_data, '[]'::jsonb)
  );
END;
$$;

-- fetch_secondary_metrics  (latest def: 20260605200526_analytics_fix_variable_mismatches.sql)
CREATE OR REPLACE FUNCTION fetch_secondary_metrics(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL,
  p_channel text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net_value numeric;
  v_commission_saved numeric;
  v_avg_rating numeric;
  v_review_count integer;
  v_prior_avg_rating numeric;
  v_cancellation_count integer;
  v_total_bookings integer;
  v_cancellation_rate numeric;
  v_refund_amount numeric;
  v_refund_count integer;
  v_refund_rate numeric;
  v_quotes_sent integer;
  v_quotes_accepted integer;
  v_acceptance_rate numeric;
  v_listing_views integer;
  v_avg_session_seconds numeric;
  v_days_diff integer;
  v_prior_start_date date;
  v_prior_end_date date;
BEGIN
  v_days_diff := p_end_date - p_start_date;
  v_prior_start_date := p_start_date - (v_days_diff + 1);
  v_prior_end_date := p_start_date - 1;

  -- Net booking value
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_net_value
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'completed')
    AND check_in >= p_start_date AND check_in <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Commission saved on direct bookings (assume 15% OTA commission avoided)
  SELECT COALESCE(SUM(total_amount * 0.15), 0)
  INTO v_commission_saved
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'completed')
    AND check_in >= p_start_date AND check_in <= p_end_date
    AND channel = 'direct'
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- Average rating (reviews has no deleted_at column)
  SELECT COALESCE(AVG(rating), 0), COALESCE(COUNT(*), 0)
  INTO v_avg_rating, v_review_count
  FROM reviews
  WHERE host_id = p_host_id
    AND created_at >= p_start_date
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  SELECT COALESCE(AVG(rating), 0)
  INTO v_prior_avg_rating
  FROM reviews
  WHERE host_id = p_host_id
    AND created_at >= v_prior_start_date
    AND created_at <= (v_prior_end_date::timestamp + interval '1 day' - interval '1 second')
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- Cancellations (real statuses)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_cancellation_count
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('cancelled_by_host', 'cancelled_by_guest')
    AND check_in >= p_start_date AND check_in <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  SELECT COALESCE(COUNT(*), 0)
  INTO v_total_bookings
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'completed', 'cancelled_by_host', 'cancelled_by_guest')
    AND check_in >= p_start_date AND check_in <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  v_cancellation_rate := CASE WHEN v_total_bookings > 0 THEN (v_cancellation_count::numeric / v_total_bookings * 100) ELSE 0 END;

  -- Refunds (from refund_requests; 'completed' = issued)
  SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(COALESCE(approved_amount, requested_amount)), 0)
  INTO v_refund_count, v_refund_amount
  FROM refund_requests
  WHERE host_id = p_host_id
    AND status = 'completed'
    AND created_at >= p_start_date
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL;

  v_refund_rate := CASE WHEN v_net_value > 0 THEN (v_refund_amount / v_net_value * 100) ELSE 0 END;

  -- Quotes (accepted == converted)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_quotes_sent
  FROM quotes
  WHERE host_id = p_host_id
    AND created_at >= p_start_date
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  SELECT COALESCE(COUNT(*), 0)
  INTO v_quotes_accepted
  FROM quotes
  WHERE host_id = p_host_id
    AND status = 'converted'
    AND created_at >= p_start_date
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  v_acceptance_rate := CASE WHEN v_quotes_sent > 0 THEN (v_quotes_accepted::numeric / v_quotes_sent * 100) ELSE 0 END;

  -- Listing views
  SELECT COALESCE(COUNT(*), 0), COALESCE(AVG(duration_seconds), 0)
  INTO v_listing_views, v_avg_session_seconds
  FROM listing_view_events
  WHERE listing_id IN (
    SELECT id FROM properties
    WHERE host_id = p_host_id AND deleted_at IS NULL
      AND (p_listing_id IS NULL OR id = p_listing_id)
  )
  AND viewed_at >= p_start_date::timestamp
  AND viewed_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second');

  RETURN jsonb_build_object(
    'net_value', ROUND(v_net_value, 2),
    'commission_saved', ROUND(v_commission_saved, 2),
    'avg_rating', ROUND(v_avg_rating, 2),
    'review_count', v_review_count,
    'rating_delta', CASE WHEN v_prior_avg_rating > 0 THEN ROUND((v_avg_rating - v_prior_avg_rating)::numeric, 2) ELSE NULL END,
    'cancellation_rate', ROUND(v_cancellation_rate, 1),
    'cancellation_count', v_cancellation_count,
    'total_bookings', v_total_bookings,
    'refund_rate', ROUND(v_refund_rate, 1),
    'refund_amount', ROUND(v_refund_amount, 2),
    'refund_count', v_refund_count,
    'quotes_sent', v_quotes_sent,
    'quotes_accepted', v_quotes_accepted,
    'acceptance_rate', ROUND(v_acceptance_rate, 1),
    'listing_views', v_listing_views,
    'avg_session_seconds', ROUND(v_avg_session_seconds, 0)
  );
END;
$$;

-- fetch_time_to_book  (latest def: 20260605200526_analytics_fix_variable_mismatches.sql)
CREATE OR REPLACE FUNCTION fetch_time_to_book(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_median_days numeric;
  v_avg_touchpoints numeric;
  v_avg_session_duration numeric;
  v_breakdown jsonb;
BEGIN
  WITH booking_journey AS (
    SELECT
      b.id AS booking_id,
      EXTRACT(EPOCH FROM (b.created_at - MIN(lve.viewed_at))) / 86400 AS days_to_book
    FROM bookings b
    LEFT JOIN listing_view_events lve ON
      lve.listing_id = b.listing_id
      AND lve.viewed_at < b.created_at
      AND lve.user_id = b.guest_id
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'completed')
      AND b.created_at >= p_start_date::timestamp
      AND b.created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
    GROUP BY b.id, b.created_at
    HAVING MIN(lve.viewed_at) IS NOT NULL
  )
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_book),
    jsonb_build_object(
      'same_day', COUNT(*) FILTER (WHERE days_to_book < 1),
      'one_to_three', COUNT(*) FILTER (WHERE days_to_book >= 1 AND days_to_book < 3),
      'three_to_seven', COUNT(*) FILTER (WHERE days_to_book >= 3 AND days_to_book < 7),
      'seven_to_fourteen', COUNT(*) FILTER (WHERE days_to_book >= 7 AND days_to_book < 14),
      'over_fourteen', COUNT(*) FILTER (WHERE days_to_book >= 14)
    )
  INTO v_median_days, v_breakdown
  FROM booking_journey;

  WITH booking_touchpoints AS (
    SELECT b.id AS booking_id, COUNT(lve.id) AS touchpoint_count
    FROM bookings b
    LEFT JOIN listing_view_events lve ON
      lve.listing_id = b.listing_id
      AND lve.viewed_at < b.created_at
      AND lve.user_id = b.guest_id
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'completed')
      AND b.created_at >= p_start_date::timestamp
      AND b.created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
    GROUP BY b.id
  )
  SELECT COALESCE(AVG(touchpoint_count), 0) INTO v_avg_touchpoints FROM booking_touchpoints;

  SELECT COALESCE(AVG(duration_seconds), 0)
  INTO v_avg_session_duration
  FROM listing_view_events
  WHERE listing_id IN (
    SELECT id FROM properties WHERE host_id = p_host_id AND deleted_at IS NULL
      AND (p_listing_id IS NULL OR id = p_listing_id)
  )
  AND viewed_at >= p_start_date::timestamp
  AND viewed_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second');

  RETURN jsonb_build_object(
    'median_days', COALESCE(ROUND(v_median_days, 1), 0),
    'breakdown', COALESCE(v_breakdown, jsonb_build_object(
      'same_day', 0, 'one_to_three', 0, 'three_to_seven', 0, 'seven_to_fourteen', 0, 'over_fourteen', 0
    )),
    'avg_touchpoints', ROUND(v_avg_touchpoints, 1),
    'avg_session_duration', ROUND(v_avg_session_duration, 0)
  );
END;
$$;

-- generate_listing_slug  (latest def: 20260501000013_create_triggers.sql)
CREATE OR REPLACE FUNCTION generate_listing_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_base text; v_slug text; v_n integer := 0;
BEGIN
  IF NEW.slug IS NULL THEN
    v_base := lower(regexp_replace(regexp_replace(NEW.name,'[^a-zA-Z0-9\s]','','g'),'\s+','-','g'));
    v_slug := v_base;
    WHILE EXISTS (SELECT 1 FROM properties WHERE slug = v_slug AND id != NEW.id) LOOP
      v_n := v_n + 1; v_slug := v_base || '-' || v_n;
    END LOOP;
    NEW.slug := v_slug;
  END IF;
  RETURN NEW;
END;
$$;

-- get_listing_policy_summary  (latest def: 20260531000020_policy_summary_default_fallback.sql)
CREATE OR REPLACE FUNCTION get_listing_policy_summary(p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb := '{}';
  v_host   uuid;
  v_type   text;
  v_pid    uuid;
  v_pol    policies%ROWTYPE;
  v_rules  jsonb;
  v_cont   jsonb;
BEGIN
  SELECT host_id INTO v_host FROM properties WHERE id = p_listing_id;

  FOREACH v_type IN ARRAY
    ARRAY['cancellation','check_in_out','house_rules','booking_terms','privacy']
  LOOP
    v_pid := NULL;

    -- 1. Explicit listing-wide assignment (must be active).
    SELECT p.id INTO v_pid
    FROM property_policies lp
    JOIN policies p ON p.id = lp.policy_id
    WHERE lp.listing_id = p_listing_id
      AND lp.room_id IS NULL
      AND lp.policy_type = v_type
      AND p.status = 'active'
      AND p.deleted_at IS NULL
    LIMIT 1;

    -- 2. Fall back to the host's active default of this type.
    IF v_pid IS NULL AND v_host IS NOT NULL THEN
      SELECT p.id INTO v_pid
      FROM policies p
      WHERE p.host_id = v_host
        AND p.type = v_type
        AND p.is_default = true
        AND p.status = 'active'
        AND p.deleted_at IS NULL
      LIMIT 1;
    END IF;

    CONTINUE WHEN v_pid IS NULL;

    SELECT * INTO v_pol FROM policies WHERE id = v_pid;

    IF v_type = 'cancellation' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'days_before',    days_before,
          'refund_percent', refund_percent,
          'label',          label
        ) ORDER BY days_before DESC
      ) INTO v_rules
      FROM policy_cancellation_rules WHERE policy_id = v_pid;

      SELECT body_html INTO v_cont
      FROM policy_content WHERE policy_id = v_pid AND locale = 'en' LIMIT 1;

      v_result := v_result || jsonb_build_object(
        'cancellation', jsonb_build_object(
          'name',             v_pol.name,
          'summary',          v_pol.summary,
          'is_non_refundable',v_pol.is_non_refundable,
          'preset',           v_pol.preset,
          'rules',            COALESCE(v_rules, '[]'::jsonb),
          'body_html',        v_cont
        )
      );
    ELSE
      SELECT body_html INTO v_cont
      FROM policy_content WHERE policy_id = v_pid AND locale = 'en' LIMIT 1;

      v_result := v_result || jsonb_build_object(
        v_type, jsonb_build_object(
          'name',             v_pol.name,
          'summary',          v_pol.summary,
          'check_in_time',    v_pol.check_in_time,
          'check_out_time',   v_pol.check_out_time,
          'check_in_method',  v_pol.check_in_method,
          'pets_allowed',     v_pol.pets_allowed,
          'smoking_allowed',  v_pol.smoking_allowed,
          'parties_allowed',  v_pol.parties_allowed,
          'children_welcome', v_pol.children_welcome,
          'quiet_hours_start',v_pol.quiet_hours_start,
          'quiet_hours_end',  v_pol.quiet_hours_end,
          'body_html',        v_cont
        )
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- get_min_nights_for_stay  (latest def: 20260524000008_seasonal_pricing_v2.sql)
CREATE OR REPLACE FUNCTION get_min_nights_for_stay(
  p_listing_id uuid,
  p_room_id    uuid,
  p_check_in   date,
  p_check_out  date
)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_listing_min integer;
  v_season_min  integer;
BEGIN
  SELECT COALESCE(min_nights, 1) INTO v_listing_min
  FROM properties WHERE id = p_listing_id;

  SELECT MAX(min_nights) INTO v_season_min
  FROM property_seasonal_pricing
  WHERE listing_id = p_listing_id
    AND is_active  = true
    AND min_nights IS NOT NULL
    AND start_date <= p_check_out
    AND end_date   >= p_check_in
    AND (
      (p_room_id IS NOT NULL AND room_id = p_room_id)
      OR room_id IS NULL
    );

  RETURN GREATEST(COALESCE(v_listing_min, 1), COALESCE(v_season_min, 1));
END;
$$;

-- listing_doc_code  (latest def: 20260602000010_doc_numbering_per_listing.sql)
CREATE OR REPLACE FUNCTION listing_doc_code(p_listing_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
           NULLIF(left(regexp_replace(upper(name), '[^A-Z0-9]', '', 'g'), 14), ''),
           'LISTING'
         ) || '-' || upper(left(replace(p_listing_id::text, '-', ''), 5))
  FROM properties WHERE id = p_listing_id;
$$;

-- on_booking_cancelled  (latest def: 20260601000010_booking_cancellation.sql)
CREATE OR REPLACE FUNCTION on_booking_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_terminal text[] := ARRAY[
    'cancelled_by_host', 'cancelled_by_guest', 'declined', 'expired', 'no_show'
  ];
BEGIN
  IF NEW.status = ANY(v_terminal) AND COALESCE(OLD.status, '') <> NEW.status THEN
    -- Free every calendar block this booking placed.
    DELETE FROM blocked_dates WHERE booking_id = NEW.id;

    -- If the booking had been counted (it was confirmed/checked_in), roll the
    -- counters back so dashboards stay accurate.
    IF COALESCE(OLD.status, '') IN ('confirmed', 'checked_in') THEN
      UPDATE hosts
        SET total_bookings = GREATEST(0, total_bookings - 1)
        WHERE id = NEW.host_id;
      UPDATE properties
        SET total_bookings = GREATEST(0, total_bookings - 1)
        WHERE id = NEW.listing_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- on_booking_confirmed  (latest def: 20260524000000_per_room_bookings.sql)
CREATE OR REPLACE FUNCTION on_booking_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_date date;
  v_room record;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
      v_date := NEW.check_in;
      WHILE v_date < NEW.check_out LOOP
        IF NEW.scope = 'rooms' THEN
          -- Block each booked room separately.
          FOR v_room IN
            SELECT room_id FROM booking_rooms WHERE booking_id = NEW.id
          LOOP
            INSERT INTO blocked_dates (listing_id, room_id, date, reason, booking_id)
            VALUES (NEW.listing_id, v_room.room_id, v_date, 'booking', NEW.id)
            ON CONFLICT DO NOTHING;
          END LOOP;
        ELSE
          -- whole_listing scope: room_id NULL = blocks every room on that date.
          INSERT INTO blocked_dates (listing_id, room_id, date, reason, booking_id)
          VALUES (NEW.listing_id, NULL, v_date, 'booking', NEW.id)
          ON CONFLICT DO NOTHING;
        END IF;
        v_date := v_date + 1;
      END LOOP;
    END IF;
    UPDATE hosts    SET total_bookings = total_bookings + 1 WHERE id = NEW.host_id;
    UPDATE properties SET total_bookings = total_bookings + 1 WHERE id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$;

-- on_booking_confirmed_create_invoice  (latest def: 20260608000008_fix_invoice_host_snapshot_source.sql)
CREATE OR REPLACE FUNCTION on_booking_confirmed_create_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_host_id          uuid;
  v_host_handle      text;
  v_host_display     text;
  v_host_email       text;
  v_host_phone       text;
  v_listing_name     text;
  v_guest_full_name  text;
  v_guest_email      text;
  v_guest_phone      text;
  v_lines            jsonb;
  v_addons           jsonb;
  v_rooms            jsonb;
  v_banking          jsonb;
  v_business         jsonb;
  v_number           text;
BEGIN
  IF NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    -- Idempotent: skip if the booking invoice already exists.
    IF EXISTS (
      SELECT 1 FROM invoices WHERE booking_id = NEW.id AND kind = 'booking'
    ) THEN
      RETURN NEW;
    END IF;

    -- Host identity + contact. Contact lives on user_profiles (hosts has no
    -- contact_* columns) — this is exactly the bug this migration fixes.
    SELECT h.id, h.handle, h.display_name, up.email, up.phone
      INTO v_host_id, v_host_handle, v_host_display, v_host_email, v_host_phone
      FROM hosts h
      JOIN user_profiles up ON up.id = h.user_id
      WHERE h.id = NEW.host_id;

    SELECT name INTO v_listing_name FROM properties WHERE id = NEW.listing_id;

    SELECT full_name, email, phone
      INTO v_guest_full_name, v_guest_email, v_guest_phone
      FROM user_profiles WHERE id = NEW.guest_id;

    -- Host's default, non-archived banking account (settings). account_number is
    -- ciphertext copied verbatim; the PDF route decrypts on demand. NULL if the
    -- host has not set up banking — invoice still issues, block just hides.
    SELECT jsonb_build_object(
             'label',            label,
             'bank_name',        bank_name,
             'account_holder',   account_holder,
             'account_number',   account_number,
             'account_type',     account_type,
             'branch_code',      branch_code,
             'swift_code',       swift_code,
             'reference_format', reference_format
           )
      INTO v_banking
      FROM eft_banking_details
      WHERE host_id = NEW.host_id
        AND is_default = true
        AND is_archived = false
      LIMIT 1;

    -- Host business / tax details (settings).
    SELECT jsonb_build_object(
             'legal_name',                  legal_name,
             'trading_name',                trading_name,
             'vat_number',                  vat_number,
             'company_registration_number', company_registration_number,
             'billing_address_line1',       billing_address_line1,
             'billing_address_line2',       billing_address_line2,
             'billing_city',                billing_city,
             'billing_postcode',            billing_postcode,
             'billing_country',             billing_country
           )
      INTO v_business
      FROM host_business_details
      WHERE host_id = NEW.host_id;

    -- Only the add-ons that came with the original booking belong on the main
    -- invoice; post-booking add-ons get their own supplementary invoices.
    SELECT jsonb_agg(jsonb_build_object(
             'label',      label,
             'quantity',   quantity,
             'unit_price', unit_price,
             'subtotal',   subtotal
           ) ORDER BY sort_order)
      INTO v_addons
      FROM booking_addons WHERE booking_id = NEW.id AND source = 'quote';

    SELECT jsonb_agg(jsonb_build_object(
             'room_id',       br.room_id,
             'room_name',     lr.name,
             'base_amount',   br.base_amount,
             'cleaning_fee',  br.cleaning_fee
           ))
      INTO v_rooms
      FROM booking_rooms br
      JOIN property_rooms lr ON lr.id = br.room_id
      WHERE br.booking_id = NEW.id;

    v_lines := jsonb_build_object(
      'listing_name',  v_listing_name,
      'check_in',      NEW.check_in,
      'check_out',     NEW.check_out,
      'nights',        NEW.nights,
      'scope',         NEW.scope,
      'base_amount',   NEW.base_amount,
      'cleaning_fee',  NEW.cleaning_fee,
      'rooms',         COALESCE(v_rooms, '[]'::jsonb),
      'addons',        COALESCE(v_addons, '[]'::jsonb)
    );

    v_number := next_invoice_number(NEW.host_id);

    INSERT INTO invoices (
      invoice_number, booking_id, host_id, guest_id, kind,
      host_snapshot, guest_snapshot, line_items,
      subtotal, vat_amount, total_amount, currency,
      status, issued_at, paid_at
    ) VALUES (
      v_number, NEW.id, NEW.host_id, NEW.guest_id, 'booking',
      jsonb_build_object(
        'host_id',      v_host_id,
        'display_name', v_host_display,
        'handle',       v_host_handle,
        'email',        v_host_email,
        'phone',        v_host_phone,
        'banking',      v_banking,
        'business',     v_business,
        'booking_ref',  NEW.reference
      ),
      jsonb_build_object(
        'guest_id', NEW.guest_id,
        'name',     COALESCE(NEW.guest_name,  v_guest_full_name),
        'email',    COALESCE(NEW.guest_email, v_guest_email),
        'phone',    COALESCE(NEW.guest_phone, v_guest_phone)
      ),
      v_lines,
      -- subtotal (ex-VAT), vat_amount, total (VAT-inclusive)
      round(NEW.total_amount - COALESCE(NEW.vat_amount, 0), 2),
      COALESCE(NEW.vat_amount, 0),
      NEW.total_amount,
      NEW.currency,
      CASE WHEN NEW.payment_status = 'completed' THEN 'paid' ELSE 'issued' END,
      now(),
      CASE WHEN NEW.payment_status = 'completed' THEN now() ELSE NULL END
    );
  END IF;
  RETURN NEW;
END;
$$;

-- on_review_published  (latest def: 20260610000001_reviews_mvp_hardening.sql)
CREATE OR REPLACE FUNCTION on_review_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Reviews now publish immediately on insert; recalc there too, and on any
  -- later is_published change (admin hide/restore) in either direction.
  IF TG_OP = 'INSERT' OR (NEW.is_published IS DISTINCT FROM OLD.is_published) THEN
    UPDATE properties SET
      avg_rating    = (SELECT AVG(rating) FROM reviews WHERE listing_id = NEW.listing_id AND is_published = true),
      total_reviews = (SELECT COUNT(*)    FROM reviews WHERE listing_id = NEW.listing_id AND is_published = true)
    WHERE id = NEW.listing_id;

    UPDATE hosts SET
      avg_rating    = (SELECT AVG(r.rating) FROM reviews r JOIN properties l ON l.id = r.listing_id WHERE l.host_id = NEW.host_id AND r.is_published = true),
      total_reviews = (SELECT COUNT(*)      FROM reviews r JOIN properties l ON l.id = r.listing_id WHERE l.host_id = NEW.host_id AND r.is_published = true)
    WHERE id = NEW.host_id;
  END IF;
  RETURN NEW;
END;
$$;

-- recalculate_listing_ranking  (latest def: 20260617000100_rename_r1_leaf_tables.sql)
CREATE OR REPLACE FUNCTION recalculate_listing_ranking(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_weights      jsonb;
  v_avg_rating   numeric;
  v_review_count integer;
  v_review_norm  numeric;
  v_profile      numeric;
  v_response     numeric;
  v_plan_boost   numeric;
  v_score        numeric;
BEGIN
  SELECT value INTO v_weights FROM platform_settings WHERE key = 'ranking_weights';

  SELECT avg_rating, total_reviews INTO v_avg_rating, v_review_count
  FROM properties WHERE id = p_listing_id;

  v_review_norm := LEAST(1.0, ln(1 + v_review_count) / ln(101));

  SELECT (
    CASE WHEN l.description   IS NOT NULL THEN 0.20 ELSE 0 END +
    CASE WHEN l.city          IS NOT NULL THEN 0.20 ELSE 0 END +
    CASE WHEN (SELECT COUNT(*) FROM property_photos  WHERE listing_id = l.id) >= 5 THEN 0.30 ELSE 0 END +
    CASE WHEN l.check_in_time IS NOT NULL THEN 0.15 ELSE 0 END +
    CASE WHEN (SELECT COUNT(*) FROM property_amenities WHERE listing_id = l.id) >= 3 THEN 0.15 ELSE 0 END
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
    (COALESCE(v_avg_rating / 5.0, 0) * (v_weights->>'rating')::numeric)   +
    (COALESCE(v_review_norm, 0)       * (v_weights->>'reviews')::numeric)  +
    (COALESCE(v_profile, 0)           * (v_weights->>'profile')::numeric)  +
    (COALESCE(v_response, 0)          * (v_weights->>'response')::numeric) +
    (COALESCE(v_plan_boost, 0)        * (v_weights->>'plan')::numeric);

  INSERT INTO property_rankings (
    listing_id, ranking_score, component_rating, component_reviews,
    component_profile, component_response_rate, component_plan_boost, last_calculated
  ) VALUES (
    p_listing_id, v_score,
    COALESCE(v_avg_rating / 5.0, 0), v_review_norm, v_profile,
    COALESCE(v_response, 0), COALESCE(v_plan_boost, 0), now()
  )
  ON CONFLICT (listing_id) DO UPDATE SET
    ranking_score           = EXCLUDED.ranking_score,
    component_rating        = EXCLUDED.component_rating,
    component_reviews       = EXCLUDED.component_reviews,
    component_profile       = EXCLUDED.component_profile,
    component_response_rate = EXCLUDED.component_response_rate,
    component_plan_boost    = EXCLUDED.component_plan_boost,
    last_calculated         = now();
END;
$$;

-- resolve_listing_policy_id  (latest def: 20260610180000_policy_resolver_snapshot_ssot.sql)
CREATE OR REPLACE FUNCTION resolve_listing_policy_id(
  p_listing_id uuid,
  p_room_id    uuid,
  p_type       text
)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_pid  uuid;
  v_host uuid;
BEGIN
  -- 1. Room-level override (only when a room is in play).
  IF p_room_id IS NOT NULL THEN
    SELECT p.id INTO v_pid
    FROM property_policies lp
    JOIN policies p ON p.id = lp.policy_id
    WHERE lp.listing_id = p_listing_id
      AND lp.room_id = p_room_id
      AND lp.policy_type = p_type
      AND p.status = 'active'
      AND p.deleted_at IS NULL
    LIMIT 1;
    IF v_pid IS NOT NULL THEN RETURN v_pid; END IF;
  END IF;

  -- 2. Listing-wide assignment.
  SELECT p.id INTO v_pid
  FROM property_policies lp
  JOIN policies p ON p.id = lp.policy_id
  WHERE lp.listing_id = p_listing_id
    AND lp.room_id IS NULL
    AND lp.policy_type = p_type
    AND p.status = 'active'
    AND p.deleted_at IS NULL
  LIMIT 1;
  IF v_pid IS NOT NULL THEN RETURN v_pid; END IF;

  -- 3. Host active default.
  SELECT host_id INTO v_host FROM properties WHERE id = p_listing_id;
  IF v_host IS NULL THEN RETURN NULL; END IF;

  SELECT p.id INTO v_pid
  FROM policies p
  WHERE p.host_id = v_host
    AND p.type = p_type
    AND p.is_default = true
    AND p.status = 'active'
    AND p.deleted_at IS NULL
  LIMIT 1;

  RETURN v_pid;
END;
$$;

-- send_due_access_cards  (latest def: 20260617000100_rename_r1_leaf_tables.sql)
CREATE OR REPLACE FUNCTION public.send_due_access_cards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b           RECORD;
  la          RECORD;
  r           RECORD;
  v_host_user uuid;
  v_conv_id   uuid;
  v_body      text;
  v_block     text;
  v_has_rooms boolean;
  v_count     integer := 0;
BEGIN
  FOR b IN
    SELECT bk.id, bk.host_id, bk.guest_id, bk.listing_id, bk.quote_id,
           l.name AS listing_name, l.check_in_time
    FROM bookings bk
    JOIN properties l ON l.id = bk.listing_id
    WHERE bk.status IN ('confirmed', 'checked_in')
      AND bk.guest_id IS NOT NULL
      AND bk.listing_id IS NOT NULL
      AND bk.access_card_sent_at IS NULL
      AND bk.check_in IS NOT NULL
      AND bk.deleted_at IS NULL
      AND ((bk.check_in::text || ' ' || COALESCE(l.check_in_time, '00:00'))::timestamp
             AT TIME ZONE 'Africa/Johannesburg')
          BETWEEN now() - interval '12 hours' AND now() + interval '60 minutes'
  LOOP
    SELECT user_id INTO v_host_user FROM hosts WHERE id = b.host_id;
    IF v_host_user IS NULL THEN
      CONTINUE;
    END IF;

    SELECT check_in_method, check_in_instructions, gate_code, door_code,
           wifi_network, wifi_password
      INTO la
      FROM property_access WHERE listing_id = b.listing_id;

    SELECT EXISTS (SELECT 1 FROM booking_rooms WHERE booking_id = b.id)
      INTO v_has_rooms;

    v_body := '🔑 Access details for ' || b.listing_name || E'\n'
            || 'These unlock for your stay — see your trip page any time.' || E'\n\n';

    IF v_has_rooms THEN
      FOR r IN
        SELECT lr.name AS room_name,
               COALESCE(NULLIF(btrim(ra.check_in_method), ''), la.check_in_method)             AS check_in_method,
               COALESCE(NULLIF(btrim(ra.check_in_instructions), ''), la.check_in_instructions)  AS check_in_instructions,
               COALESCE(NULLIF(btrim(ra.gate_code), ''), la.gate_code)                          AS gate_code,
               COALESCE(NULLIF(btrim(ra.door_code), ''), la.door_code)                          AS door_code,
               COALESCE(NULLIF(btrim(ra.wifi_network), ''), la.wifi_network)                    AS wifi_network,
               COALESCE(NULLIF(btrim(ra.wifi_password), ''), la.wifi_password)                  AS wifi_password
        FROM booking_rooms br
        JOIN property_rooms lr ON lr.id = br.room_id
        LEFT JOIN property_room_access ra ON ra.room_id = br.room_id
        WHERE br.booking_id = b.id
        ORDER BY lr.sort_order NULLS LAST, lr.name
      LOOP
        v_block := public._access_line('Check-in', r.check_in_method)
                 || public._access_line('Gate code', r.gate_code)
                 || public._access_line('Door code', r.door_code)
                 || public._access_line('Wi-Fi network', r.wifi_network)
                 || public._access_line('Wi-Fi password', r.wifi_password)
                 || public._access_line('Arrival', r.check_in_instructions);
        IF btrim(v_block) <> '' THEN
          v_body := v_body || '— ' || r.room_name || ' —' || E'\n' || v_block || E'\n';
        END IF;
      END LOOP;
    ELSE
      v_body := v_body
              || public._access_line('Check-in', la.check_in_method)
              || public._access_line('Gate code', la.gate_code)
              || public._access_line('Door code', la.door_code)
              || public._access_line('Wi-Fi network', la.wifi_network)
              || public._access_line('Wi-Fi password', la.wifi_password)
              || public._access_line('Arrival', la.check_in_instructions);
    END IF;

    -- Conversation: the quote's thread (converted bookings), else an existing
    -- open host↔guest thread for the listing, else a fresh one.
    v_conv_id := NULL;
    IF b.quote_id IS NOT NULL THEN
      SELECT conversation_id INTO v_conv_id FROM quotes WHERE id = b.quote_id;
    END IF;
    IF v_conv_id IS NULL THEN
      SELECT id INTO v_conv_id
      FROM conversations
      WHERE host_id = b.host_id AND guest_id = b.guest_id
        AND listing_id = b.listing_id AND status <> 'archived'
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT 1;
    END IF;
    IF v_conv_id IS NULL THEN
      INSERT INTO conversations (host_id, guest_id, listing_id, booking_id, status, is_enquiry)
      VALUES (b.host_id, b.guest_id, b.listing_id, b.id, 'open', false)
      RETURNING id INTO v_conv_id;
    END IF;

    INSERT INTO messages (conversation_id, sender_id, body, is_system_message,
                          system_event, read_by_host, read_by_guest)
    VALUES (v_conv_id, v_host_user, btrim(v_body), true,
            'access_details', true, false);

    UPDATE bookings SET access_card_sent_at = now() WHERE id = b.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- snapshot_booking_policies  (latest def: 20260531000003_policies_design_rework.sql)
CREATE OR REPLACE FUNCTION snapshot_booking_policies(
  p_booking_id  uuid,
  p_listing_id  uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lp    record;
  v_pol   policies%ROWTYPE;
  v_data  jsonb;
  v_rules jsonb;
  v_cont  jsonb;
BEGIN
  FOR v_lp IN
    SELECT policy_id, policy_type
    FROM property_policies
    WHERE listing_id = p_listing_id AND room_id IS NULL
  LOOP
    SELECT * INTO v_pol FROM policies WHERE id = v_lp.policy_id;

    IF v_pol.type = 'cancellation' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'days_before',    days_before,
          'refund_percent', refund_percent,
          'label',          label
        ) ORDER BY days_before DESC
      ) INTO v_rules
      FROM policy_cancellation_rules WHERE policy_id = v_pol.id;

      v_data := jsonb_build_object(
        'id',               v_pol.id,
        'name',             v_pol.name,
        'type',             v_pol.type,
        'summary',          v_pol.summary,
        'is_non_refundable',v_pol.is_non_refundable,
        'preset',           v_pol.preset,
        'version',          v_pol.version,
        'rules',            COALESCE(v_rules, '[]'::jsonb)
      );
    ELSE
      SELECT jsonb_build_object(
        'body_html',  body_html,
        'body_plain', body_plain,
        'locale',     locale
      ) INTO v_cont
      FROM policy_content WHERE policy_id = v_pol.id AND locale = 'en' LIMIT 1;

      v_data := jsonb_build_object(
        'id',             v_pol.id,
        'name',           v_pol.name,
        'type',           v_pol.type,
        'summary',        v_pol.summary,
        'version',        v_pol.version,
        'check_in_time',  v_pol.check_in_time,
        'check_out_time', v_pol.check_out_time,
        'check_in_method',v_pol.check_in_method,
        'pets_allowed',     v_pol.pets_allowed,
        'smoking_allowed',  v_pol.smoking_allowed,
        'parties_allowed',  v_pol.parties_allowed,
        'children_welcome', v_pol.children_welcome,
        'quiet_hours_start',v_pol.quiet_hours_start,
        'quiet_hours_end',  v_pol.quiet_hours_end,
        'content',        COALESCE(v_cont, '{}'::jsonb)
      );
    END IF;

    INSERT INTO policy_snapshots (
      booking_id, policy_id, policy_type,
      policy_version, policy_name, snapshot_data
    ) VALUES (
      p_booking_id, v_pol.id, v_pol.type,
      v_pol.version, v_pol.name, v_data
    )
    ON CONFLICT (booking_id, policy_type) DO NOTHING;
  END LOOP;
END;
$$;

-- sync_listing_policy_label  (latest def: 20260529000000_policy_manager_ui_support.sql)
CREATE OR REPLACE FUNCTION sync_listing_policy_label()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pol   policies%ROWTYPE;
  v_plain text;
BEGIN
  -- Only the listing-wide assignment drives the denormalised columns.
  IF NEW.room_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pol FROM policies WHERE id = NEW.policy_id;

  IF NEW.policy_type = 'cancellation' THEN
    UPDATE properties SET
      cancellation_policy_label = v_pol.name,
      is_non_refundable         = v_pol.is_non_refundable
    WHERE id = NEW.listing_id;

  ELSIF NEW.policy_type = 'check_in_out' THEN
    UPDATE properties SET
      check_in_time  = v_pol.check_in_time,
      check_out_time = v_pol.check_out_time
    WHERE id = NEW.listing_id;

  ELSIF NEW.policy_type = 'house_rules' THEN
    SELECT body_plain INTO v_plain
    FROM policy_content WHERE policy_id = v_pol.id AND locale = 'en' LIMIT 1;
    UPDATE properties SET house_rules = v_plain WHERE id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;
