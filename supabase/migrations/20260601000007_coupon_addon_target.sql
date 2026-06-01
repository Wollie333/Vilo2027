-- Migration: Coupons can target a single add-on
--
-- Adds coupons.addon_id so an "add-ons" coupon can be limited to one specific
-- add-on (mirrors room_id for accommodation). Only valid with scope = 'addons'.

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS addon_id uuid REFERENCES addons(id) ON DELETE CASCADE;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupon_addon_needs_scope CHECK (
    addon_id IS NULL OR scope = 'addons'
  );

CREATE INDEX IF NOT EXISTS idx_coupons_addon
  ON public.coupons (addon_id) WHERE addon_id IS NOT NULL;

COMMENT ON COLUMN public.coupons.addon_id IS
  'Restrict an add-ons coupon to a single add-on. NULL = all add-ons in the order.';
