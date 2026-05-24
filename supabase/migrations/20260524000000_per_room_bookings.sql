-- Migration: Per-room bookings
--
-- Adds the `listing_rooms` + `booking_rooms` tables and the supporting
-- columns / triggers / RLS so a single listing can be either:
--   * whole_listing  (current behavior — one booking takes the whole place)
--   * rooms_only     (must book a specific room; whole-listing book impossible)
--   * flexible       (either pattern allowed)
--
-- Pre-MVP data policy is in effect (see CLAUDE.md). No backfill, no shims.
-- Per AGENT_RULES.md §7.5 normally we'd ask before creating tables, but this
-- migration is part of an approved plan.

-- ─── 1. listings.booking_mode ────────────────────────────────────
ALTER TABLE public.listings
  ADD COLUMN booking_mode text NOT NULL DEFAULT 'whole_listing'
    CHECK (booking_mode IN ('whole_listing', 'rooms_only', 'flexible'));

COMMENT ON COLUMN listings.booking_mode IS
  'whole_listing = one booking takes the whole place. rooms_only = must book a room. flexible = both.';

CREATE INDEX idx_listings_booking_mode ON listings(booking_mode);

-- ─── 2. listing_rooms ────────────────────────────────────────────
CREATE TABLE public.listing_rooms (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,

  name            text    NOT NULL,
  description     text,

  bedrooms        integer DEFAULT 1,
  bathrooms       integer DEFAULT 0,
  max_guests      integer NOT NULL DEFAULT 2,

  base_price      numeric NOT NULL,
  weekend_price   numeric,
  cleaning_fee    numeric NOT NULL DEFAULT 0,
  currency        text    NOT NULL DEFAULT 'ZAR',

  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT room_name_length CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE INDEX idx_listing_rooms_listing
  ON listing_rooms(listing_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listing_rooms_sort
  ON listing_rooms(listing_id, sort_order) WHERE deleted_at IS NULL;

ALTER TABLE listing_rooms ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE listing_rooms IS
  'Per-room bookable units inside a listing. Only meaningful when listings.booking_mode IS NOT whole_listing.';

-- ─── 3. booking_rooms (the "cart") ───────────────────────────────
CREATE TABLE public.booking_rooms (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid    NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_id       uuid    NOT NULL REFERENCES listing_rooms(id) ON DELETE RESTRICT,

  -- Captured at booking time so price changes on the room don't retroactively
  -- alter the booking total.
  base_amount   numeric NOT NULL,
  cleaning_fee  numeric NOT NULL DEFAULT 0,

  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_booking_room UNIQUE (booking_id, room_id)
);

CREATE INDEX idx_booking_rooms_booking ON booking_rooms(booking_id);
CREATE INDEX idx_booking_rooms_room    ON booking_rooms(room_id);

ALTER TABLE booking_rooms ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE booking_rooms IS
  'Join table — a single booking with scope=rooms can hold N rooms. Each row carries the per-room amounts captured at booking time.';

-- ─── 4. bookings.scope ───────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN scope text NOT NULL DEFAULT 'whole_listing'
    CHECK (scope IN ('whole_listing', 'rooms'));

COMMENT ON COLUMN bookings.scope IS
  'whole_listing = the booking blocks the entire listing for the date range. rooms = blocks only the specific rooms in booking_rooms.';

CREATE INDEX idx_bookings_scope ON bookings(scope);

-- ─── 5. blocked_dates.room_id + reshape unique key ───────────────
ALTER TABLE public.blocked_dates
  ADD COLUMN room_id uuid REFERENCES listing_rooms(id) ON DELETE CASCADE;

COMMENT ON COLUMN blocked_dates.room_id IS
  'NULL = whole-listing block (blocks every room on that date). Set = blocks only that specific room.';

-- Drop the old listing-only unique constraint.
ALTER TABLE public.blocked_dates
  DROP CONSTRAINT unique_blocked_date;

-- New unique key: same listing + same scope (room or whole) + same date can
-- only be blocked once. COALESCE handles the nullable room_id correctly.
CREATE UNIQUE INDEX unique_blocked_date_per_scope
  ON blocked_dates (
    listing_id,
    COALESCE(room_id, '00000000-0000-0000-0000-000000000000'::uuid),
    date
  );

CREATE INDEX idx_blocked_dates_room
  ON blocked_dates(room_id) WHERE room_id IS NOT NULL;

-- ─── 6. nullable room_id on photos + amenities ───────────────────
ALTER TABLE public.listing_photos
  ADD COLUMN room_id uuid REFERENCES listing_rooms(id) ON DELETE SET NULL;

COMMENT ON COLUMN listing_photos.room_id IS
  'Optional. NULL = listing-wide photo. Set = belongs to a specific room.';

CREATE INDEX idx_listing_photos_room
  ON listing_photos(room_id) WHERE room_id IS NOT NULL;

ALTER TABLE public.listing_amenities
  ADD COLUMN room_id uuid REFERENCES listing_rooms(id) ON DELETE SET NULL;

COMMENT ON COLUMN listing_amenities.room_id IS
  'Optional. NULL = listing-wide amenity. Set = belongs to a specific room only.';

CREATE INDEX idx_listing_amenities_room
  ON listing_amenities(room_id) WHERE room_id IS NOT NULL;

-- The original UNIQUE(listing_id, amenity_key) constraint would prevent two
-- different rooms from claiming the same amenity_key. Replace with a
-- scope-aware unique key.
ALTER TABLE public.listing_amenities
  DROP CONSTRAINT unique_amenity_per_listing;

CREATE UNIQUE INDEX unique_amenity_per_scope
  ON listing_amenities (
    listing_id,
    COALESCE(room_id, '00000000-0000-0000-0000-000000000000'::uuid),
    amenity_key
  );

-- ─── 7. Trigger: on_booking_confirmed — handle both scopes ───────
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
    UPDATE listings SET total_bookings = total_bookings + 1 WHERE id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger itself already exists from 20260501000013_create_triggers.sql;
-- the CREATE OR REPLACE FUNCTION above just swaps the body.

-- ─── 8. Availability helper functions ────────────────────────────
-- A specific room is available for a range iff no overlapping block exists,
-- where "block" means either a row scoped to that room or a whole-listing
-- block (room_id NULL).
CREATE OR REPLACE FUNCTION room_is_available(
  p_listing_id uuid,
  p_room_id    uuid,
  p_check_in   date,
  p_check_out  date
) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM blocked_dates
    WHERE listing_id = p_listing_id
      AND date >= p_check_in
      AND date <  p_check_out
      AND (room_id IS NULL OR room_id = p_room_id)
  );
$$;

COMMENT ON FUNCTION room_is_available IS
  'Returns false if any blocked_dates row in the [check_in, check_out) range covers this room (either room-scoped or a whole-listing block).';

-- The whole listing is available iff NO overlapping block exists, period —
-- a single room being booked is enough to refuse a whole-place booking.
CREATE OR REPLACE FUNCTION listing_is_available_whole(
  p_listing_id uuid,
  p_check_in   date,
  p_check_out  date
) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM blocked_dates
    WHERE listing_id = p_listing_id
      AND date >= p_check_in
      AND date <  p_check_out
  );
$$;

COMMENT ON FUNCTION listing_is_available_whole IS
  'Returns false if ANY blocked_dates row exists in the [check_in, check_out) range — room-scoped blocks count too.';

-- ─── 9. RLS policies for new tables ──────────────────────────────

-- listing_rooms: public reads (only of published, non-deleted listings + non-deleted rooms),
-- host CRUD on own listings, admin full.
CREATE POLICY "public_read_active_rooms" ON listing_rooms FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_active = true
    AND listing_id IN (
      SELECT id FROM listings
      WHERE is_published = true
        AND is_suspended = false
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "host_manage_own_rooms" ON listing_rooms FOR ALL
  USING (
    listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id())
  );

CREATE POLICY "staff_read_rooms" ON listing_rooms FOR SELECT
  USING (
    listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id_as_staff())
  );

CREATE POLICY "staff_update_rooms" ON listing_rooms FOR UPDATE
  USING (
    listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id_as_staff())
  );

CREATE POLICY "admin_full_rooms" ON listing_rooms FOR ALL
  USING (is_super_admin());

-- booking_rooms: cascade ownership through the booking.
CREATE POLICY "guest_read_own_booking_rooms" ON booking_rooms FOR SELECT
  USING (booking_id IN (SELECT id FROM bookings WHERE guest_id = auth.uid()));

CREATE POLICY "host_read_own_booking_rooms" ON booking_rooms FOR SELECT
  USING (booking_id IN (SELECT id FROM bookings WHERE host_id = get_my_host_id()));

CREATE POLICY "host_manage_own_booking_rooms" ON booking_rooms FOR ALL
  USING (booking_id IN (SELECT id FROM bookings WHERE host_id = get_my_host_id()));

CREATE POLICY "admin_full_booking_rooms" ON booking_rooms FOR ALL
  USING (is_super_admin());

-- ─── 10. updated_at trigger for listing_rooms ────────────────────
-- Existing pattern from earlier migrations: bump updated_at on UPDATE.
CREATE OR REPLACE FUNCTION touch_listing_rooms_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_listing_rooms_touch
  BEFORE UPDATE ON listing_rooms
  FOR EACH ROW EXECUTE FUNCTION touch_listing_rooms_updated_at();
