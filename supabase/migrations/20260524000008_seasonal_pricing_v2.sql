-- Migration: Seasonal pricing — host-managed catalog
--
-- The listing_seasonal_pricing table already exists (created in
-- 20260501000002) but is barely scaffolded — listing-scoped only, no
-- priority, no per-rule min_nights, no active toggle, no updated_at.
--
-- This migration:
--   1. Extends listing_seasonal_pricing with room_id (nullable),
--      min_nights, priority, is_active, updated_at.
--   2. Replaces calculate_booking_price() to support optional room scope
--      and priority-ordered rule selection (room > listing, then priority).
--   3. Adds get_min_nights_for_stay() so the booking-create flow (built
--      later) can enforce peak-season minimums.
--   4. Seeds the 'seasonal_pricing' feature gate across all plans.
--
-- Pre-MVP data policy (CLAUDE.md): destructive reshape is fine.

-- ─── 1. Extend listing_seasonal_pricing ──────────────────────────
ALTER TABLE public.listing_seasonal_pricing
  ADD COLUMN room_id    uuid REFERENCES listing_rooms(id) ON DELETE CASCADE,
  ADD COLUMN min_nights integer CHECK (min_nights IS NULL OR min_nights > 0),
  ADD COLUMN priority   integer NOT NULL DEFAULT 0,
  ADD COLUMN is_active  boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX idx_seasonal_pricing_listing_active
  ON listing_seasonal_pricing (listing_id, is_active, start_date, end_date);

CREATE INDEX idx_seasonal_pricing_room
  ON listing_seasonal_pricing (room_id)
  WHERE room_id IS NOT NULL;

COMMENT ON COLUMN listing_seasonal_pricing.room_id IS
  'NULL = listing-wide rule. Set = scoped to one room. Room rules win over listing rules on the same night.';
COMMENT ON COLUMN listing_seasonal_pricing.priority IS
  'Higher number wins on overlap. Lets hosts layer a short peak rule (priority 10) over a longer season (priority 1).';
COMMENT ON COLUMN listing_seasonal_pricing.min_nights IS
  'Optional override of the listing min_nights for stays inside this range. NULL = inherit from listing.';

-- ─── 2. updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_seasonal_pricing_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_seasonal_pricing_touch
  BEFORE UPDATE ON listing_seasonal_pricing
  FOR EACH ROW EXECUTE FUNCTION touch_seasonal_pricing_updated_at();

-- ─── 3. Replace calculate_booking_price() ────────────────────────
-- Adds an optional p_room_id param. When set, sources base/weekend
-- fallback prices from listing_rooms instead of listings, and prefers
-- room-scoped seasonal rules. Existing 3-arg callers stay valid.
CREATE OR REPLACE FUNCTION calculate_booking_price(
  p_listing_id uuid,
  p_check_in   date,
  p_check_out  date,
  p_room_id    uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_listing      listings%ROWTYPE;
  v_room         listing_rooms%ROWTYPE;
  v_current_date date;
  v_night_price  numeric;
  v_base_total   numeric := 0;
  v_nights       integer;
  v_dow          integer;
  v_base_price   numeric;
  v_weekend      numeric;
  v_cleaning     numeric;
  v_currency     text;
BEGIN
  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;

  IF p_room_id IS NOT NULL THEN
    SELECT * INTO v_room FROM listing_rooms WHERE id = p_room_id;
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
    -- Pick highest-priority active rule covering this night.
    -- Room rule beats listing rule (room_id IS NOT NULL ranked first).
    SELECT price INTO v_night_price
    FROM listing_seasonal_pricing
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

    IF v_night_price IS NULL THEN
      v_dow := EXTRACT(DOW FROM v_current_date);
      IF v_dow IN (0, 6) AND v_weekend IS NOT NULL THEN
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

COMMENT ON FUNCTION calculate_booking_price IS
  'Per-night price for a stay. Picks highest-priority active seasonal rule (room scope wins over listing scope), else weekend_price on Sat/Sun, else base_price. p_room_id NULL = whole-listing pricing.';

-- ─── 4. get_min_nights_for_stay() ────────────────────────────────
-- Returns the largest min_nights across the listing and any active
-- seasonal rule whose range intersects the stay. Same room-wins precedence
-- as calculate_booking_price. The booking-create Edge Function (future)
-- will use this to reject stays under peak-season minimums.
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
  FROM listings WHERE id = p_listing_id;

  SELECT MAX(min_nights) INTO v_season_min
  FROM listing_seasonal_pricing
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

COMMENT ON FUNCTION get_min_nights_for_stay IS
  'Effective minimum-nights for a candidate stay = max of listing.min_nights and any seasonal rule whose range intersects the stay.';

-- ─── 5. plan_features — seasonal_pricing gate ────────────────────
-- Enabled everywhere for now (founder's free test account needs it).
-- Flip is_enabled = false where plan = 'free' later to restrict.
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
  ('free',     'seasonal_pricing', true, null, 'Date-range price rules per listing or room'),
  ('basic',    'seasonal_pricing', true, null, 'Date-range price rules per listing or room'),
  ('pro',      'seasonal_pricing', true, null, 'Date-range price rules per listing or room'),
  ('business', 'seasonal_pricing', true, null, 'Date-range price rules per listing or room')
ON CONFLICT (plan, feature_key) DO UPDATE
  SET is_enabled  = EXCLUDED.is_enabled,
      limit_value = EXCLUDED.limit_value,
      description = EXCLUDED.description;
