-- Migration: Specials — foundation (S0 schema)
--
-- A "Special" is a host-authored, pre-packaged accommodation deal: a property
-- (+ optional room) + a date treatment + an override price + add-ons + an
-- optional cancellation policy. A booked special is a NORMAL bookings row
-- carrying a new special_id FK, so date-blocking, policy snapshots, the payment
-- ledger and Paystack settlement all work unchanged.
--
-- This migration is schema-only (no app surface yet):
--   1. specials                — the deal definition
--   2. special_addons          — compulsory / optional add-ons bundled onto a deal
--   3. bookings.special_id / booked_via + origin CHECK ('special_booked')
--   4. RLS (host owns own; public reads ACTIVE deals — incl. link-only)
--   5. redeem_special()        — atomic, race-safe quantity-cap redemption
--   6. on_booking_cancelled()  — recreated to release a redemption (also fixes a
--                                stale NEW.listing_id reference left after the R3
--                                listing_id→property_id rename)
--   7. website_pages.kind      — allow a 'specials' page on the host micro-site
--   8. expire_specials()       — flips lapsed deals to 'expired' (cron wired later;
--                                runtime queries also date-guard, never cron-only)
--
-- Pricing decisions live in app code (lib/specials/pricing.ts, S2): seasonal
-- pricing NEVER applies to a special. Currency is copied from the owning
-- business onto the special at create time.

-- ─── 1. specials ─────────────────────────────────────────────────
CREATE TABLE public.specials (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id           uuid        NOT NULL REFERENCES hosts(id)         ON DELETE CASCADE,
  business_id       uuid        NOT NULL REFERENCES businesses(id)    ON DELETE CASCADE,
  property_id       uuid        NOT NULL REFERENCES properties(id)    ON DELETE CASCADE,
  room_id           uuid        REFERENCES property_rooms(id)         ON DELETE CASCADE, -- null = whole-property

  -- presentation
  slug              text        NOT NULL,
  title             text        NOT NULL,
  description       text,
  hero_image_path   text,                          -- website-assets bucket path
  badge             text,

  -- date model (per-special toggle)
  date_mode         text        NOT NULL CHECK (date_mode IN ('fixed','flexible')),
  fixed_check_in    date,
  fixed_check_out   date,
  window_start      date,
  window_end        date,
  min_nights        integer,
  max_nights        integer,

  -- pricing model (per-special toggle); seasonal NEVER applies (enforced in app)
  price_mode        text        NOT NULL CHECK (price_mode IN ('flat','per_night')),
  flat_total        numeric(12,2),                 -- price_mode = flat
  per_night_price   numeric(12,2),                 -- price_mode = per_night
  currency          text        NOT NULL DEFAULT 'ZAR',
  max_guests        integer,                       -- cap; null = room/property max

  -- savings badge (computed at save vs the normal/seasonal price; see S2)
  was_price         numeric(12,2),
  savings_amount    numeric(12,2),
  savings_pct       integer,

  -- inventory (quantity cap with race-safe redemption — see redeem_special)
  quantity          integer     NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  redemptions_used  integer     NOT NULL DEFAULT 0 CHECK (redemptions_used >= 0),

  -- scheduling (go_live_at = runtime visibility gate; book_by = booking deadline)
  go_live_at        date,
  book_by           date,

  -- merchandising
  categories        text[]      NOT NULL DEFAULT '{}', -- curated keys (directory filter)
  custom_tags       text[]      NOT NULL DEFAULT '{}', -- host free-form (own site)
  is_featured       boolean     NOT NULL DEFAULT false,
  sort_order        integer     NOT NULL DEFAULT 0,

  -- policy override (else resolve_listing_policy_id fallback at snapshot time)
  cancellation_policy_id uuid   REFERENCES policies(id) ON DELETE SET NULL,

  -- visibility (both false + active = unlisted / link-only)
  show_in_directory boolean     NOT NULL DEFAULT true,
  show_on_website   boolean     NOT NULL DEFAULT true,

  -- lifecycle
  status            text        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','active','paused','expired','archived')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,

  -- coherent date columns per mode
  CONSTRAINT special_fixed_dates CHECK (
    date_mode <> 'fixed'
    OR (fixed_check_in IS NOT NULL AND fixed_check_out IS NOT NULL
        AND fixed_check_out > fixed_check_in)
  ),
  CONSTRAINT special_flexible_window CHECK (
    date_mode <> 'flexible'
    OR (window_start IS NOT NULL AND window_end IS NOT NULL AND window_end > window_start
        AND min_nights IS NOT NULL AND min_nights >= 1
        AND (max_nights IS NULL OR max_nights >= min_nights))
  ),
  -- coherent price column per mode
  CONSTRAINT special_flat_price CHECK (
    price_mode <> 'flat' OR (flat_total IS NOT NULL AND flat_total >= 0)
  ),
  CONSTRAINT special_per_night_price CHECK (
    price_mode <> 'per_night' OR (per_night_price IS NOT NULL AND per_night_price >= 0)
  ),
  -- the sold-out invariant (redeem_special is the atomic enforcer)
  CONSTRAINT special_redemptions_within_cap CHECK (redemptions_used <= quantity)
);

-- per-host slug uniqueness (active rows) — drives the public /special/[slug] route
CREATE UNIQUE INDEX specials_host_slug_unique
  ON public.specials (host_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX specials_directory_idx
  ON public.specials (status, show_in_directory) WHERE deleted_at IS NULL;
CREATE INDEX specials_categories_gin ON public.specials USING gin (categories);
CREATE INDEX specials_property_idx   ON public.specials (property_id);
CREATE INDEX specials_business_idx   ON public.specials (business_id);
CREATE INDEX specials_host_idx       ON public.specials (host_id);
CREATE INDEX specials_featured_idx   ON public.specials (is_featured, sort_order);

COMMENT ON TABLE public.specials IS
  'Host-authored pre-packaged accommodation deals. Booked as a normal bookings row via special_id. Seasonal pricing never applies (override price only).';
COMMENT ON COLUMN public.specials.go_live_at IS
  'Runtime visibility gate: an active special is only shown/bookable once go_live_at is null or <= today.';
COMMENT ON COLUMN public.specials.show_in_directory IS
  'Both show_in_directory and show_on_website false (while active) = unlisted / link-only.';

CREATE TRIGGER trigger_specials_touch
  BEFORE UPDATE ON public.specials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. special_addons ───────────────────────────────────────────
CREATE TABLE public.special_addons (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  special_id          uuid        NOT NULL REFERENCES specials(id) ON DELETE CASCADE,
  addon_id            uuid        NOT NULL REFERENCES addons(id)   ON DELETE CASCADE,
  is_required         boolean     NOT NULL DEFAULT false,  -- true = compulsory (always bundled)
  unit_price_override numeric(12,2),
  sort_order          integer     NOT NULL DEFAULT 0,
  CONSTRAINT special_addon_unique UNIQUE (special_id, addon_id)
);
CREATE INDEX special_addons_special_idx ON public.special_addons (special_id);

COMMENT ON COLUMN public.special_addons.is_required IS
  'true = compulsory add-on, always folded into the package price; false = optional upsell offered at checkout.';

-- ─── 3. bookings: special_id + booked_via + origin ───────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS special_id uuid REFERENCES specials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booked_via text
    CHECK (booked_via IS NULL OR booked_via IN ('platform','website'));

CREATE INDEX IF NOT EXISTS bookings_special_id_idx
  ON public.bookings (special_id) WHERE special_id IS NOT NULL;

-- Extend the origin CHECK to recognise a special booking.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_origin_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_origin_check
  CHECK (origin IN ('guest_request','host_manual','quote_converted','special_booked'));

COMMENT ON COLUMN public.bookings.special_id IS
  'Set when this booking was created from a Special. The deal''s price/policy are frozen on the booking like any other.';
COMMENT ON COLUMN public.bookings.booked_via IS
  'Entry surface for a special booking: platform /specials directory vs the host website. Used for reporting.';

-- ─── 4. RLS ──────────────────────────────────────────────────────
ALTER TABLE public.specials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_addons ENABLE ROW LEVEL SECURITY;

-- Hosts fully manage their own specials.
CREATE POLICY specials_owner_all ON public.specials FOR ALL
  USING (host_id = get_my_host_id())
  WITH CHECK (host_id = get_my_host_id());
-- Public reads ACTIVE, non-deleted specials only. Visibility toggles are applied
-- as app-level query filters (directory/website); link-only deals stay readable
-- here so the direct /special/[slug] link works.
CREATE POLICY specials_public_read ON public.specials FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL);
CREATE POLICY specials_admin_all ON public.specials FOR ALL
  USING (is_super_admin());

CREATE POLICY special_addons_owner_all ON public.special_addons FOR ALL
  USING (special_id IN (SELECT id FROM specials WHERE host_id = get_my_host_id()))
  WITH CHECK (special_id IN (SELECT id FROM specials WHERE host_id = get_my_host_id()));
CREATE POLICY special_addons_public_read ON public.special_addons FOR SELECT
  USING (special_id IN (SELECT id FROM specials WHERE status = 'active' AND deleted_at IS NULL));
CREATE POLICY special_addons_admin_all ON public.special_addons FOR ALL
  USING (is_super_admin());

-- ─── 5. redeem_special() — atomic quantity-cap redemption ────────
-- Called by the special booking action AFTER the booking row exists. The single
-- conditional UPDATE locks the row, so two concurrent bookings of the last unit
-- serialise: exactly one sees redemptions_used < quantity and wins. Returns
-- false when sold out, paused, or gone — the caller then rolls its booking back.
CREATE OR REPLACE FUNCTION redeem_special(p_special_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ok boolean;
BEGIN
  UPDATE specials
     SET redemptions_used = redemptions_used + 1
   WHERE id = p_special_id
     AND status = 'active'
     AND deleted_at IS NULL
     AND redemptions_used < quantity
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END;
$$;

COMMENT ON FUNCTION redeem_special IS
  'Atomically claims one unit of a special''s quantity cap. Race-safe (row-locked UPDATE…WHERE…RETURNING). Returns false when sold out / not active.';

-- ─── 6. on_booking_cancelled() — release a redemption on cancel ──
-- Recreated to (a) decrement a special''s redemptions_used when a special booking
-- is cancelled, and (b) use NEW.property_id (the R2 def still referenced the
-- pre-rename NEW.listing_id, which no longer exists after R3).
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

    -- Return the claimed unit to the special''s pool (a special booking redeems
    -- at creation time, regardless of confirm state).
    IF NEW.special_id IS NOT NULL THEN
      UPDATE specials
        SET redemptions_used = GREATEST(0, redemptions_used - 1)
        WHERE id = NEW.special_id;
    END IF;

    -- If the booking had been counted (it was confirmed/checked_in), roll the
    -- counters back so dashboards stay accurate.
    IF COALESCE(OLD.status, '') IN ('confirmed', 'checked_in') THEN
      UPDATE hosts
        SET total_bookings = GREATEST(0, total_bookings - 1)
        WHERE id = NEW.host_id;
      UPDATE properties
        SET total_bookings = GREATEST(0, total_bookings - 1)
        WHERE id = NEW.property_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION on_booking_cancelled IS
  'Releases blocked_dates, returns any special redemption, and decrements booking counters when a booking enters a cancelled/declined/expired/no_show state.';

-- ─── 7. website_pages.kind — allow a 'specials' page ─────────────
ALTER TABLE public.website_pages DROP CONSTRAINT IF EXISTS website_pages_kind_check;
ALTER TABLE public.website_pages ADD CONSTRAINT website_pages_kind_check
  CHECK (kind IN ('home','about','rooms','contact','custom','specials'));

-- ─── 8. expire_specials() — lapse past-date deals ────────────────
-- Flips an active special to 'expired' once its stay window has passed or its
-- booking deadline is gone. Wired to a daily schedule later; runtime queries
-- also date-guard so correctness never depends on the cron firing.
CREATE OR REPLACE FUNCTION expire_specials()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE specials
       SET status = 'expired', updated_at = now()
     WHERE status = 'active'
       AND deleted_at IS NULL
       AND (
         (date_mode = 'fixed'    AND fixed_check_out < current_date)
         OR (date_mode = 'flexible' AND window_end   < current_date)
         OR (book_by IS NOT NULL AND book_by < current_date)
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION expire_specials IS
  'Flips active specials whose stay window / booking deadline has passed to expired. Intended for a daily cron; runtime queries also date-guard.';
