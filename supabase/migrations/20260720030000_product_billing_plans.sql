-- Recurring billing — Phase 2: provider billing-plan registry (PayPal native subs).
--
-- PayPal recurring needs a Catalog Product + a Billing Plan created once and
-- reused. We store the created handles here, keyed so that a PRICE CHANGE forces a
-- NEW plan version (the natural key includes `amount`) while existing subscribers
-- keep their grandfathered plan — turning silent price drift into an explicit,
-- auditable versioning decision (plan pressure-test R2). Rail-generic, but only
-- PayPal writes it for now (the Paystack rail re-charges a saved authorization and
-- needs no provider plan object).
--
--  amount/currency   = the ZAR list price this plan version was minted for (the
--                      key that versions the plan).
--  provider_amount   = the fixed USD amount actually baked into the PayPal plan
--  provider_currency   (fx-converted at create time) — kept for audit/reconcile.
--  provider_product_id = PayPal catalog product id; provider_plan_id = billing plan.

CREATE TABLE IF NOT EXISTS public.product_billing_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  provider            text NOT NULL CHECK (provider IN ('paypal')),
  cycle               text NOT NULL CHECK (cycle IN ('monthly', 'annual')),
  amount              numeric NOT NULL,
  currency            text NOT NULL DEFAULT 'ZAR',
  provider_amount     numeric,
  provider_currency   text,
  environment         text NOT NULL CHECK (environment IN ('test', 'live')),
  provider_product_id text,
  provider_plan_id    text NOT NULL,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- One ACTIVE plan per (product, provider, cycle, amount, environment): the reuse
-- lookup. A different amount is a different (allowed) row = a new version.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_billing_plans_active
  ON public.product_billing_plans (product_id, provider, cycle, amount, environment)
  WHERE status = 'active';

-- Look up an active plan by its provider handle (webhook reconciliation).
CREATE INDEX IF NOT EXISTS idx_product_billing_plans_provider_plan
  ON public.product_billing_plans (provider, provider_plan_id);

-- Server-only table (created + read by admin-client server code). RLS on, no
-- policies → service_role bypasses, everyone else is denied. No host/guest ever
-- touches it directly.
ALTER TABLE public.product_billing_plans ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.product_billing_plans IS
  'Provider billing-plan registry for native recurring subscriptions (PayPal). Keyed by ZAR amount so a price edit versions the plan and grandfathers existing subscribers. Server-only (RLS on, no policies).';
