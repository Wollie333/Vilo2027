-- =============================================================================
-- Wielo promo codes — self-serve discounts on WIELO's own products.
--
-- A host types WELCOME50 at product checkout and pays less for a membership /
-- credit pack / service / once-off. This is a MARKETING lever (limits, expiry,
-- reporting) and is deliberately NOT the same feature as comping: an admin who
-- wants to give a plan away already has "Activate without charging".
--
-- WHY A SEPARATE TABLE (and not `coupons`):
-- `coupons` is host-owned and booking-SHAPED — host_id is NOT NULL and cascades
-- from hosts, and property_id / room_id / addon_id / min_nights / scope
-- (order|accommodation|addons) are all meaningless for a product order. A Wielo
-- code has no host, so it would have to live as host_id = NULL in a table whose
-- entire access model — RLS, every existing query, the ON DELETE CASCADE — reads
-- "a host owns this row". Worse, its unique index is (host_id, upper(code)) and
-- Postgres treats NULLs as DISTINCT, so two Wielo codes could silently share a
-- code. The two features share a metaphor, not a grain: the host editor targets
-- listings/rooms/nights, this one targets products. Code reuse would have been
-- near zero either way, so the booking money path is left completely untouched.
--
-- Redemption objects differ too: coupon_redemptions.booking_id is NOT NULL, and
-- a product order is not a booking — hence a sibling ledger keyed to
-- product_orders and an order-scoped redeem_platform_coupon().
-- =============================================================================

-- ─── 1. platform_coupons ─────────────────────────────────────────
CREATE TABLE public.platform_coupons (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text        NOT NULL,
  -- Internal note (why the code exists) — never shown to the buyer.
  description      text,
  discount_type    text        NOT NULL DEFAULT 'percent'
                               CHECK (discount_type IN ('percent', 'fixed')),
  discount_value   numeric     NOT NULL CHECK (discount_value > 0),

  -- Targeting. Both NULL = every product. product_id pins ONE product;
  -- product_type pins a class (e.g. every membership). Never both.
  product_id       uuid        REFERENCES products(id) ON DELETE CASCADE,
  product_type     text        CHECK (product_type IN
                                 ('membership', 'service', 'product', 'wielo_credits')),

  currency         text        NOT NULL DEFAULT 'ZAR',
  min_spend        numeric     CHECK (min_spend IS NULL OR min_spend >= 0),
  starts_at        timestamptz,
  ends_at          timestamptz,
  max_redemptions  integer     CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  per_user_limit   integer     CHECK (per_user_limit IS NULL OR per_user_limit > 0),
  redeemed_count   integer     NOT NULL DEFAULT 0,
  is_active        boolean     NOT NULL DEFAULT true,
  created_by       uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT platform_coupon_percent_range CHECK (
    discount_type <> 'percent' OR (discount_value > 0 AND discount_value <= 100)
  ),
  CONSTRAINT platform_coupon_date_order CHECK (
    starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at
  ),
  -- One targeting dimension at most: a code aimed at BOTH one product and a
  -- product class is a contradiction the UI must never be able to express.
  CONSTRAINT platform_coupon_single_target CHECK (
    product_id IS NULL OR product_type IS NULL
  )
);

-- One code across the whole platform (case-insensitive — codes are uppercased).
-- Unlike coupons' (host_id, upper(code)) there is no NULL in this key, so this
-- genuinely prevents duplicates.
CREATE UNIQUE INDEX platform_coupons_code_unique
  ON public.platform_coupons (upper(code));
CREATE INDEX idx_platform_coupons_active
  ON public.platform_coupons (is_active) WHERE is_active;
CREATE INDEX idx_platform_coupons_product
  ON public.platform_coupons (product_id) WHERE product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION touch_platform_coupons_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_platform_coupons_touch
  BEFORE UPDATE ON public.platform_coupons
  FOR EACH ROW EXECUTE FUNCTION touch_platform_coupons_updated_at();

COMMENT ON TABLE public.platform_coupons IS
  'Wielo-owned promo codes for Wielo products (memberships, credits, services, once-offs). Admin-managed. Host booking coupons are a different feature — see public.coupons.';
COMMENT ON COLUMN public.platform_coupons.product_id IS
  'Pin to one product. NULL + product_type NULL = applies to every product.';
COMMENT ON COLUMN public.platform_coupons.product_type IS
  'Pin to a product class (membership | service | product | wielo_credits). Mutually exclusive with product_id.';

-- ─── 2. platform_coupon_redemptions ──────────────────────────────
CREATE TABLE public.platform_coupon_redemptions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id         uuid        NOT NULL REFERENCES platform_coupons(id) ON DELETE CASCADE,
  order_id          uuid        NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  -- Nullable: a buyer can pay as a passwordless lead before claiming an account.
  user_id           uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  amount_discounted numeric     NOT NULL,
  currency          text        NOT NULL DEFAULT 'ZAR',
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_coupon_redemption_unique UNIQUE (coupon_id, order_id)
);
CREATE INDEX idx_platform_coupon_redemptions_coupon
  ON public.platform_coupon_redemptions (coupon_id);
CREATE INDEX idx_platform_coupon_redemptions_user
  ON public.platform_coupon_redemptions (coupon_id, user_id);

-- ─── 3. product_orders: remember the code + what it took off ─────
ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS coupon_id       uuid REFERENCES platform_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0
                           CHECK (discount_amount >= 0);

COMMENT ON COLUMN public.product_orders.discount_amount IS
  'Promo discount already subtracted from `amount`. amount = price + setup_fee_amount - discount_amount. Kept so a receipt can show what was taken off.';

-- ─── 4. platform_ledger.coupon_id — adopt the P1.4 placeholder ───
-- The column shipped in 20260614000030 as a bare uuid with NO foreign key,
-- commented "subscription coupon applied (P1.4)", and was never wired: all 37
-- live rows are NULL. It is exactly the slot this feature needs, so it gets its
-- FK now rather than a second, competing column.
ALTER TABLE public.platform_ledger
  ADD CONSTRAINT platform_ledger_coupon_id_fkey
  FOREIGN KEY (coupon_id) REFERENCES platform_coupons(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.platform_ledger.coupon_id IS
  'Wielo promo code applied to this charge (platform_coupons). NULL = full price.';

-- ─── 5. RLS ──────────────────────────────────────────────────────
-- Admins manage the catalogue. Nobody else touches these tables directly: code
-- validation and redemption run server-side through the service-role client, so
-- a buyer can never enumerate codes by querying PostgREST.
ALTER TABLE public.platform_coupons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_platform_coupons" ON public.platform_coupons FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "admin_full_platform_coupon_redemptions"
  ON public.platform_coupon_redemptions FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ─── 6. redeem_platform_coupon() — atomic, idempotent per order ──
-- Called by the settle paths (Paystack confirm / PayPal capture / EFT settle)
-- once the money is real. Locks the coupon row, records the redemption and bumps
-- the counter. Idempotent per order, so the webhook backstop re-running is safe.
--
-- CAP SEMANTICS — deliberate: max_redemptions / per_user_limit are enforced when
-- the code is APPLIED (resolvePlatformCoupon), not here. By the time this runs
-- the buyer has already paid the discounted price they were shown, so refusing
-- to record would only lose the audit row — it could not un-charge them. The
-- cost is that a cap can be overshot at the margin when several buyers hold
-- pending discounted orders at once; the alternative (charging someone more than
-- the checkout page promised) is strictly worse. Same trade-off the booking
-- coupon makes for anonymous per-guest caps.
CREATE OR REPLACE FUNCTION redeem_platform_coupon(
  p_coupon_id uuid,
  p_order_id  uuid,
  p_user_id   uuid,
  p_amount    numeric,
  p_currency  text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coupon platform_coupons%ROWTYPE;
BEGIN
  SELECT * INTO v_coupon FROM platform_coupons WHERE id = p_coupon_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Already recorded for this order? Idempotent retry (webhook + return path).
  IF EXISTS (
    SELECT 1 FROM platform_coupon_redemptions
    WHERE coupon_id = p_coupon_id AND order_id = p_order_id
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO platform_coupon_redemptions
    (coupon_id, order_id, user_id, amount_discounted, currency)
  VALUES
    (p_coupon_id, p_order_id, p_user_id, p_amount, p_currency);

  UPDATE platform_coupons
     SET redeemed_count = redeemed_count + 1
   WHERE id = p_coupon_id;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION redeem_platform_coupon IS
  'Records a Wielo promo redemption for a paid product order and bumps redeemed_count. Idempotent per order. Caps are enforced at apply time (resolvePlatformCoupon), not here — the buyer has already paid by this point.';

-- Lock it down. NOTE: CREATE FUNCTION grants EXECUTE to PUBLIC by default, and
-- anon/authenticated inherit through PUBLIC — so revoking from anon alone is a
-- NO-OP (see 20260716310000). Revoke from PUBLIC. Only the service-role settle
-- paths may call this; it moves entitlements and takes no caller identity.
REVOKE ALL ON FUNCTION public.redeem_platform_coupon(uuid, uuid, uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_platform_coupon(uuid, uuid, uuid, numeric, text)
  TO service_role;
