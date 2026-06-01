-- Migration: Discount coupons — enterprise coupon management
--
-- Hosts create coupon codes guests enter at checkout. A coupon discounts a
-- chosen part of the bill — the whole order, accommodation only, or add-ons
-- only — and can be scoped to one listing or one room, time-boxed, capped by
-- total and per-guest redemptions, and percentage or fixed-amount.
--
-- The pricing engine applies a resolved coupon as a final discount stage; the
-- server re-validates and records redemptions atomically (redeem_coupon).

-- ─── 1. coupons ──────────────────────────────────────────────────
CREATE TABLE public.coupons (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          uuid        NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  code             text        NOT NULL,
  description      text,
  discount_type    text        NOT NULL DEFAULT 'percent'
                               CHECK (discount_type IN ('percent', 'fixed')),
  discount_value   numeric     NOT NULL CHECK (discount_value > 0),
  -- What the discount reduces: the whole eligible order, accommodation (room /
  -- base) only, or add-ons only.
  scope            text        NOT NULL DEFAULT 'order'
                               CHECK (scope IN ('order', 'accommodation', 'addons')),
  -- Optional targeting. listing_id null = all of the host's listings. room_id
  -- restricts to a single room (only meaningful with accommodation scope).
  listing_id       uuid        REFERENCES listings(id) ON DELETE CASCADE,
  room_id          uuid        REFERENCES listing_rooms(id) ON DELETE CASCADE,
  currency         text        NOT NULL DEFAULT 'ZAR',
  min_nights       integer     CHECK (min_nights IS NULL OR min_nights > 0),
  min_spend        numeric     CHECK (min_spend IS NULL OR min_spend >= 0),
  starts_at        timestamptz,
  ends_at          timestamptz,
  max_redemptions  integer     CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  per_guest_limit  integer     CHECK (per_guest_limit IS NULL OR per_guest_limit > 0),
  redeemed_count   integer     NOT NULL DEFAULT 0,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- percent must be 1..100; a room target needs a listing target.
  CONSTRAINT coupon_percent_range CHECK (
    discount_type <> 'percent' OR (discount_value > 0 AND discount_value <= 100)
  ),
  CONSTRAINT coupon_room_needs_listing CHECK (
    room_id IS NULL OR listing_id IS NOT NULL
  ),
  CONSTRAINT coupon_date_order CHECK (
    starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at
  )
);

-- One code per host (case-insensitive — codes are normalised to upper-case).
CREATE UNIQUE INDEX coupons_host_code_unique
  ON public.coupons (host_id, upper(code));
CREATE INDEX idx_coupons_host    ON public.coupons (host_id);
CREATE INDEX idx_coupons_listing ON public.coupons (listing_id) WHERE listing_id IS NOT NULL;

CREATE OR REPLACE FUNCTION touch_coupons_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_coupons_touch
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION touch_coupons_updated_at();

COMMENT ON COLUMN public.coupons.scope IS
  'order = whole eligible bill; accommodation = room/base only; addons = extras only.';

-- ─── 2. coupon_redemptions ───────────────────────────────────────
CREATE TABLE public.coupon_redemptions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id         uuid        NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  booking_id        uuid        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  guest_id          uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  amount_discounted numeric     NOT NULL,
  currency          text        NOT NULL DEFAULT 'ZAR',
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupon_redemption_unique UNIQUE (coupon_id, booking_id)
);
CREATE INDEX idx_coupon_redemptions_coupon ON public.coupon_redemptions (coupon_id);
CREATE INDEX idx_coupon_redemptions_guest  ON public.coupon_redemptions (coupon_id, guest_id);

-- ─── 3. bookings: remember which coupon was used ─────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS coupon_id       uuid REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric NOT NULL DEFAULT 0;

-- ─── 4. RLS ──────────────────────────────────────────────────────
ALTER TABLE public.coupons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Hosts manage their own coupons. Guests never read the catalogue directly —
-- code validation runs server-side (admin client / redeem_coupon).
CREATE POLICY "host_manage_own_coupons" ON public.coupons FOR ALL
  USING (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()))
  WITH CHECK (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()));
CREATE POLICY "admin_full_coupons" ON public.coupons FOR ALL
  USING (is_super_admin());

-- Hosts see redemptions of their own coupons.
CREATE POLICY "host_read_own_redemptions" ON public.coupon_redemptions FOR SELECT
  USING (
    coupon_id IN (
      SELECT c.id FROM coupons c
      JOIN hosts h ON h.id = c.host_id
      WHERE h.user_id = auth.uid()
    )
  );
CREATE POLICY "admin_full_redemptions" ON public.coupon_redemptions FOR ALL
  USING (is_super_admin());

-- ─── 5. redeem_coupon() — atomic cap-checked redemption ──────────
-- Called by the booking action after the booking row exists. Locks the coupon
-- row, enforces total + per-guest caps, records the redemption (idempotent per
-- booking) and bumps the counter. Returns true on success.
CREATE OR REPLACE FUNCTION redeem_coupon(
  p_coupon_id  uuid,
  p_booking_id uuid,
  p_guest_id   uuid,
  p_amount     numeric,
  p_currency   text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_coupon      coupons%ROWTYPE;
  v_guest_count integer;
BEGIN
  SELECT * INTO v_coupon FROM coupons WHERE id = p_coupon_id FOR UPDATE;
  IF NOT FOUND OR NOT v_coupon.is_active THEN
    RETURN false;
  END IF;

  -- Already redeemed for this booking? Treat as success (idempotent retry).
  IF EXISTS (
    SELECT 1 FROM coupon_redemptions
    WHERE coupon_id = p_coupon_id AND booking_id = p_booking_id
  ) THEN
    RETURN true;
  END IF;

  IF v_coupon.max_redemptions IS NOT NULL
     AND v_coupon.redeemed_count >= v_coupon.max_redemptions THEN
    RETURN false;
  END IF;

  IF v_coupon.per_guest_limit IS NOT NULL AND p_guest_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_guest_count
    FROM coupon_redemptions
    WHERE coupon_id = p_coupon_id AND guest_id = p_guest_id;
    IF v_guest_count >= v_coupon.per_guest_limit THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO coupon_redemptions
    (coupon_id, booking_id, guest_id, amount_discounted, currency)
  VALUES
    (p_coupon_id, p_booking_id, p_guest_id, p_amount, p_currency);

  UPDATE coupons SET redeemed_count = redeemed_count + 1 WHERE id = p_coupon_id;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION redeem_coupon IS
  'Atomically records a coupon redemption for a booking, enforcing total + per-guest caps. Idempotent per booking. Returns false when a cap is hit.';

-- ─── 6. feature gate — open on every plan pre-MVP ────────────────
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
  ('free',     'coupons', true, null, 'Discount coupon codes for direct bookings'),
  ('basic',    'coupons', true, null, 'Discount coupon codes for direct bookings'),
  ('pro',      'coupons', true, null, 'Discount coupon codes for direct bookings'),
  ('business', 'coupons', true, null, 'Discount coupon codes for direct bookings')
ON CONFLICT (plan, feature_key) DO UPDATE
  SET is_enabled  = EXCLUDED.is_enabled,
      limit_value = EXCLUDED.limit_value,
      description = EXCLUDED.description;
