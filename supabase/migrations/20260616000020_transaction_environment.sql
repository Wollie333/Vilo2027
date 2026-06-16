-- Migration: test/live environment tag on Vilo revenue rows
--
-- The founder runs Paystack TEST-key purchases to smoke-test the money flow. We
-- tag each Vilo-revenue row with the environment it was created in (derived from
-- the active Paystack secret key prefix: sk_test_ -> 'test', else 'live') so the
-- admin can see real test data without polluting live KPIs. Booking money
-- (host<->guest) is out of scope here — this is Vilo revenue only.

ALTER TABLE public.product_orders
  ADD COLUMN environment text NOT NULL DEFAULT 'live'
    CHECK (environment IN ('test', 'live'));

ALTER TABLE public.platform_ledger
  ADD COLUMN environment text NOT NULL DEFAULT 'live'
    CHECK (environment IN ('test', 'live'));

CREATE INDEX idx_product_orders_environment ON public.product_orders(environment);
CREATE INDEX idx_platform_ledger_environment ON public.platform_ledger(environment);

COMMENT ON COLUMN public.product_orders.environment IS
  'test = paid with a Paystack test key (sk_test_); live = real money. Lets admin filter test data out of live KPIs.';
COMMENT ON COLUMN public.platform_ledger.environment IS
  'test = settled with a Paystack test key; live = real money. Excluded from live KPIs by default.';
