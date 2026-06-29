-- Host payment gateways — let a host store BOTH Paystack test AND live keys with
-- an active `mode` switch (mirrors platform_payment_settings), so they can test
-- on their website/listings now and flip to live for launch without re-entering
-- keys. PayPal keeps the legacy single-key columns (public_identifier/
-- secret_cipher/secret_last4/environment) unchanged.
--
-- Pre-MVP: host_payment_gateways holds no production data, so reshaping is safe.

ALTER TABLE public.host_payment_gateways
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'test'
    CHECK (mode IN ('test', 'live')),
  ADD COLUMN IF NOT EXISTS test_public_identifier text,
  ADD COLUMN IF NOT EXISTS test_secret_cipher text,
  ADD COLUMN IF NOT EXISTS test_secret_last4 text,
  ADD COLUMN IF NOT EXISTS live_public_identifier text,
  ADD COLUMN IF NOT EXISTS live_secret_cipher text,
  ADD COLUMN IF NOT EXISTS live_secret_last4 text;

-- The legacy single-key columns are still used by PayPal; Paystack now uses the
-- per-mode columns above. Make them nullable so a Paystack row can omit them.
ALTER TABLE public.host_payment_gateways
  ALTER COLUMN public_identifier DROP NOT NULL,
  ALTER COLUMN secret_cipher DROP NOT NULL,
  ALTER COLUMN secret_last4 DROP NOT NULL;

COMMENT ON COLUMN public.host_payment_gateways.mode IS
  'Active environment for charging guests (paystack): test | live. The matching <mode>_secret_cipher must be set for that rail to work.';
