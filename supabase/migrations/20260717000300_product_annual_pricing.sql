-- =============================================================================
-- Annual pricing — one subscription, billed monthly OR annually.
--
-- Until now a product was EITHER monthly or annual (a single `price` +
-- `billing_cycle`), so a monthly/annual toggle at checkout had nothing to switch
-- between. This adds an optional annual price to the SAME product: `price` stays
-- the monthly price, `annual_price` is the once-a-year total (typically ~10
-- months' worth, i.e. two months free). NULL = no annual option is offered.
--
-- The buyer's choice has to survive to activation — the subscription period is
-- 12 months for an annual order and 1 month for a monthly one — so the chosen
-- cycle is recorded on the order. activateMappedPlan reads it (falling back to
-- the product's base billing_cycle for legacy orders that predate this column).
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS annual_price numeric
    CHECK (annual_price IS NULL OR annual_price >= 0);

COMMENT ON COLUMN public.products.annual_price IS
  'Once-a-year total for this subscription (the annual option of the monthly/annual toggle). NULL = annual not offered; `price` is the monthly price.';

ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS billing_cycle text
    CHECK (billing_cycle IS NULL OR billing_cycle IN
      ('weekly', 'monthly', 'quarterly', 'biannual', 'annual'));

COMMENT ON COLUMN public.product_orders.billing_cycle IS
  'The cycle the buyer chose at checkout (monthly | annual). Drives the activated subscription period. NULL on legacy orders → fall back to products.billing_cycle.';
