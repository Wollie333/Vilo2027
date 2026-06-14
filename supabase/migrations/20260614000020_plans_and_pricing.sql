-- Migration: DB-driven, fully-custom subscription plans + pricing
-- (Super-Admin portal Pillar 1 / P1.1)
--
-- Moves plan names/prices/trials out of hardcoded TypeScript into the DB so the
-- super admin can name plans, set prices per billing cycle, set trial length and
-- mark plans free/paid/active — with no redeploy. Lets Vilo add UNLIMITED custom
-- plans by replacing the hardcoded plan CHECK constraints with FKs to plans(key).

-- ─── plans (the catalog) ──────────────────────────────────────
CREATE TABLE public.plans (
  key            text    PRIMARY KEY,            -- 'free','basic','pro','business' + future custom keys
  name           text    NOT NULL,
  tagline        text,
  description    text,
  currency       text    NOT NULL DEFAULT 'ZAR',
  trial_days     integer NOT NULL DEFAULT 14,
  is_free        boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,  -- inactive = hidden from pickers/signup
  is_recommended boolean NOT NULL DEFAULT false,
  bullets        jsonb   NOT NULL DEFAULT '[]'::jsonb,  -- string[] of selling points
  sort_order     integer NOT NULL DEFAULT 0,
  vat_inclusive  boolean NOT NULL DEFAULT true,  -- price already includes 15% VAT
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plans_active ON public.plans(is_active, sort_order);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Public (incl. anonymous signup) may read active plans. Writes go through the
-- service-role admin client (RLS bypassed) from audited admin actions.
CREATE POLICY plans_public_read ON public.plans
  FOR SELECT USING (is_active = true);

COMMENT ON COLUMN public.plans.key IS
  'Stable plan key. Immutable in the admin editor (subscriptions.plan FKs to it).';
COMMENT ON COLUMN public.plans.bullets IS
  'JSON array of selling-point strings shown on the plan card.';

-- ─── plan_prices (one row per plan × billing cycle) ───────────
CREATE TABLE public.plan_prices (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  plan          text    NOT NULL REFERENCES public.plans(key) ON UPDATE CASCADE ON DELETE CASCADE,
  billing_cycle text    NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  price         numeric NOT NULL DEFAULT 0,
  currency      text    NOT NULL DEFAULT 'ZAR',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_plan_cycle_currency UNIQUE (plan, billing_cycle, currency)
);

CREATE INDEX idx_plan_prices_plan ON public.plan_prices(plan);

ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_prices_public_read ON public.plan_prices
  FOR SELECT USING (is_active = true);

-- ─── Seed the four current plans (canonical numbers) ──────────
-- Reconciles the price divergence between the dashboard plans.ts (business 1199)
-- and signup/host/schemas.ts (business 999) to the canonical dashboard values.
INSERT INTO public.plans
  (key, name, tagline, currency, trial_days, is_free, is_active, is_recommended, bullets, sort_order)
VALUES
  ('free', 'Free', 'Get listed, no card required.', 'ZAR', 0, true, true, false,
   '["Appear in the Vilo Directory","1 listing","Up to 10 active conversations","Enquiry-only — no in-platform payments"]'::jsonb, 0),
  ('basic', 'Basic', 'For solo hosts running one place.', 'ZAR', 14, false, true, false,
   '["Direct bookings + Paystack, PayPal, EFT","1 listing, 1 staff seat","Instant booking + calendar management","Respond to reviews","Custom host page"]'::jsonb, 1),
  ('pro', 'Pro', 'For growing portfolios up to 5 listings.', 'ZAR', 14, false, true, true,
   '["Everything in Basic","Up to 5 listings, 3 staff seats","Priority directory placement","Advanced analytics + CSV export","Message templates (canned replies)"]'::jsonb, 2),
  ('business', 'Business', 'Unlimited listings for serious operators.', 'ZAR', 14, false, true, false,
   '["Everything in Pro","Unlimited listings, 10 staff seats","Top directory placement","All features unlocked"]'::jsonb, 3);

INSERT INTO public.plan_prices (plan, billing_cycle, price, currency) VALUES
  ('free', 'monthly', 0, 'ZAR'),
  ('free', 'annual', 0, 'ZAR'),
  ('basic', 'monthly', 299, 'ZAR'),
  ('basic', 'annual', 2990, 'ZAR'),
  ('pro', 'monthly', 599, 'ZAR'),
  ('pro', 'annual', 5990, 'ZAR'),
  ('business', 'monthly', 1199, 'ZAR'),
  ('business', 'annual', 11990, 'ZAR');

-- ─── Replace hardcoded plan CHECKs with FKs ───────────────────
-- Pre-MVP policy permits destructive reshapes. Drop any CHECK constraint that
-- references the plan column on subscriptions/plan_features (defensive: matches
-- regardless of the auto-generated constraint name), then FK to plans(key).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.subscriptions'::regclass, 'public.plan_features'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%plan %'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_fkey
  FOREIGN KEY (plan) REFERENCES public.plans(key) ON UPDATE CASCADE;

ALTER TABLE public.plan_features
  ADD CONSTRAINT plan_features_plan_fkey
  FOREIGN KEY (plan) REFERENCES public.plans(key) ON UPDATE CASCADE;
