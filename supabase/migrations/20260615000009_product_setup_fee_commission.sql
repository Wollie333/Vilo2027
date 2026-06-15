-- Migration: product setup fees + richer referral commission structure.
--
-- A product can now bundle a once-off SETUP FEE alongside the recurring
-- subscription, each with its own referral commission:
--   - setup_fee / setup_fee_label: a one-time charge (e.g. "Onboarding setup").
--   - setup_fee_affiliate_*: commission on that setup fee (paid once).
--   - affiliate_type / affiliate_value (existing): commission on the recurring
--     subscription (or the one-off product price for one_off products).
--   - affiliate_duration / affiliate_duration_months: how long the recurring
--     subscription commission is paid — once, for N months, or forever.
--
-- The affiliate program is wired later; this just stores the configuration.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS setup_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_fee_label text,
  ADD COLUMN IF NOT EXISTS setup_fee_affiliate_type text NOT NULL DEFAULT 'none'
       CHECK (setup_fee_affiliate_type IN ('none', 'amount', 'percent')),
  ADD COLUMN IF NOT EXISTS setup_fee_affiliate_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affiliate_duration text NOT NULL DEFAULT 'once'
       CHECK (affiliate_duration IN ('once', 'months', 'forever')),
  ADD COLUMN IF NOT EXISTS affiliate_duration_months integer;

COMMENT ON COLUMN public.products.setup_fee IS
  'Once-off setup fee charged alongside the subscription (0 = none).';
COMMENT ON COLUMN public.products.setup_fee_label IS
  'Display name for the setup fee, e.g. "Onboarding setup".';
COMMENT ON COLUMN public.products.affiliate_duration IS
  'How long the recurring subscription commission is paid: once | months | forever.';
COMMENT ON COLUMN public.products.affiliate_duration_months IS
  'Number of months the subscription commission is paid when affiliate_duration = months.';
