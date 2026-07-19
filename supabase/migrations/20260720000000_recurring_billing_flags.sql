-- Recurring subscription billing — Phase 0 kill switches.
--
-- Two per-rail flags on the singleton platform_payment_settings row. Default
-- FALSE: recurring billing is OFF until the founder deliberately enables a rail,
-- so every checkout path keeps falling back to today's state-only plan switch and
-- NO real recurring charge can happen. Gate reader: apps/web/lib/billing/recurring.ts.
--
--  - paystack_recurring_enabled → Wielo re-charges the saved authorization_code
--    each cycle (hybrid model; see docs/lifecycles/recurring-billing.md).
--  - paypal_recurring_enabled   → provider-native PayPal subscriptions + webhook.

ALTER TABLE public.platform_payment_settings
  ADD COLUMN IF NOT EXISTS paystack_recurring_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paypal_recurring_enabled   boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.platform_payment_settings.paystack_recurring_enabled IS
  'When true, the subscription-renewal-worker re-charges saved Paystack authorizations each cycle. Default false = state-only switch, no real recurring charge.';
COMMENT ON COLUMN public.platform_payment_settings.paypal_recurring_enabled IS
  'When true, plan checkout creates native PayPal subscriptions and the paypal-webhook drives renewals. Default false = state-only switch, no real recurring charge.';
