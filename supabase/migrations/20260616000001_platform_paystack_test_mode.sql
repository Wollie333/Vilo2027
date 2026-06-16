-- Migration: add a Paystack test/live mode to the platform payment settings so
-- the founder can run test-key checkouts without clobbering the live keys.
--
-- The existing paystack_secret_key / paystack_public_key remain the LIVE keys.
-- We add a parallel pair of TEST keys plus a mode switch; the checkout + webhook
-- resolve the active keys from the mode.

ALTER TABLE public.platform_payment_settings
  ADD COLUMN IF NOT EXISTS paystack_mode text NOT NULL DEFAULT 'live'
    CHECK (paystack_mode IN ('live', 'test')),
  ADD COLUMN IF NOT EXISTS paystack_test_secret_key text,
  ADD COLUMN IF NOT EXISTS paystack_test_public_key text;

COMMENT ON COLUMN public.platform_payment_settings.paystack_mode IS
  'Which Paystack key pair the platform charges with: live or test.';
COMMENT ON COLUMN public.platform_payment_settings.paystack_test_secret_key IS
  'Paystack TEST secret key (sk_test_…). Used when paystack_mode = test.';
COMMENT ON COLUMN public.platform_payment_settings.paystack_test_public_key IS
  'Paystack TEST public key (pk_test_…). Used when paystack_mode = test.';
