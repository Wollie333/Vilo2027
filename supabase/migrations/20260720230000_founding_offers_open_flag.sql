-- WS-5 — the "Founding offers open" flag (beta→Founding auto-conversion).
--
-- While this is ON (i.e. during beta), any host who subscribes to the paid plan
-- gets the Founding price + a lifetime price-lock applied automatically at
-- conversion (strategy: "Founding pricing exists only while Wielo is in beta").
-- Flip it OFF when beta ends → new subscribers pay the list price.
--
-- Lives on the singleton platform_payment_settings row alongside the recurring
-- rails. Default FALSE (fail-closed: no host is ever accidentally locked to the
-- Founding price — the founder opts in explicitly).

ALTER TABLE public.platform_payment_settings
  ADD COLUMN IF NOT EXISTS founding_offers_open boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.platform_payment_settings.founding_offers_open IS
  'WS-5: when true, a host converting to the paid plan is auto-priced at the Founding rate and gets the lifetime price-lock. Turn off when beta ends.';
