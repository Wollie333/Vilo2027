-- Migration: Unified pricing engine support
--
-- Backs the canonical TS pricing engine (apps/web/lib/pricing) with the schema
-- it needs, and realigns the SQL price helper so the two agree:
--   1. bookings.discount_amount + bookings.price_breakdown  — audit snapshot of
--      the exact, labelled, per-night breakdown that was charged.
--   2. listing_seasonal_pricing.adjustment_type + adjustment_value — a seasonal
--      rule is now EITHER an absolute nightly price OR a +/- % adjustment.
--   3. calculate_booking_price() — weekend = Fri+Sat (was Sat+Sun); understands
--      percentage rules. Kept as a DB-side cross-check of the TS engine for the
--      whole-listing / single-room flat case.
--
-- Pre-MVP data policy (CLAUDE.md): destructive reshape is fine; no real data.

-- ─── 1. bookings: discount + breakdown snapshot ──────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_breakdown jsonb;

COMMENT ON COLUMN public.bookings.discount_amount IS
  'Total discount applied (whole-place combo + length-of-stay), in currency units. Folded out of total_amount.';
COMMENT ON COLUMN public.bookings.price_breakdown IS
  'Frozen output of the pricing engine (priceStay): per-night rates + source label, discounts, add-ons. Source of truth for invoices, refunds, and support.';

-- ─── 2. listing_seasonal_pricing: absolute | percent rules ───────
ALTER TABLE public.listing_seasonal_pricing
  ADD COLUMN IF NOT EXISTS adjustment_type  text    NOT NULL DEFAULT 'absolute',
  ADD COLUMN IF NOT EXISTS adjustment_value numeric;

-- Backfill: every existing rule was an absolute nightly price.
UPDATE public.listing_seasonal_pricing
  SET adjustment_value = price
  WHERE adjustment_value IS NULL;

ALTER TABLE public.listing_seasonal_pricing
  ALTER COLUMN adjustment_value SET NOT NULL;

-- `price` is now legacy (kept only for any historical reads); the engine reads
-- adjustment_type/value. Relax its NOT NULL + positivity so percent rules (which
-- may be negative, e.g. -20%) don't need a meaningless price.
ALTER TABLE public.listing_seasonal_pricing
  ALTER COLUMN price DROP NOT NULL;

ALTER TABLE public.listing_seasonal_pricing
  DROP CONSTRAINT IF EXISTS positive_price;

ALTER TABLE public.listing_seasonal_pricing
  ADD CONSTRAINT seasonal_adjustment_type_valid
    CHECK (adjustment_type IN ('absolute', 'percent')),
  -- Absolute rules must be a positive nightly price; percent rules can be
  -- negative but never below -100% (which would be free), and we cap the
  -- upside at a sane +1000%.
  ADD CONSTRAINT seasonal_adjustment_value_valid CHECK (
    (adjustment_type = 'absolute' AND adjustment_value > 0)
    OR (adjustment_type = 'percent' AND adjustment_value >= -100 AND adjustment_value <= 1000)
  );

COMMENT ON COLUMN public.listing_seasonal_pricing.adjustment_type IS
  'absolute = adjustment_value is the flat nightly price. percent = adjustment_value is a +/- %% applied to the room''s own rate.';
COMMENT ON COLUMN public.listing_seasonal_pricing.adjustment_value IS
  'Absolute: nightly price (> 0). Percent: signed percentage (-100 … 1000).';

-- ─── 3. calculate_booking_price(): Fri+Sat + percentage ──────────
-- Mirrors the TS engine for the whole-listing / single-room flat case so the
-- two can be cross-checked. Per-person / extra-guest occupancy lives in the TS
-- engine (the authoritative booking path); this function prices the flat base.
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
  v_adj_type     text;
  v_adj_value    numeric;
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
    -- Reset each iteration: SELECT INTO leaves the var untouched on no-match.
    v_adj_type  := NULL;
    v_adj_value := NULL;

    -- Highest-priority active rule covering this night. Room rule beats listing
    -- rule (room_id IS NOT NULL ranked first), then priority, then newest.
    SELECT adjustment_type, adjustment_value
      INTO v_adj_type, v_adj_value
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

COMMENT ON FUNCTION calculate_booking_price IS
  'Per-night flat price for a stay. Picks highest-priority active seasonal rule (room scope wins over listing scope); absolute sets the nightly, percent scales the base. Else weekend_price on Fri/Sat, else base_price. Occupancy maths live in the TS pricing engine.';
