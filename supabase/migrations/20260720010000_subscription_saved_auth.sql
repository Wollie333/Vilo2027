-- Recurring billing — Phase 1: store the reusable Paystack card authorization on
-- the subscription so the renewal worker can re-charge it each cycle (hybrid
-- model). The authorization_code is a reusable TOKEN (not a card number), but we
-- encrypt it at rest with the same AES-256-GCM scheme + PAYMENT_CIPHER_KEY as the
-- host gateway secrets (lib/crypto/payments.ts; v1.<nonce>.<ct>.<tag> format,
-- transparent passthrough when the key is unset). The last4/brand/exp are
-- display-only, safe in plaintext (no PAN, no CVV, ever).
--
-- Captured from the FIRST subscription charge.success (paystack-webhook), only
-- when Paystack marks the authorization `reusable`.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paystack_authorization_code_cipher text,
  ADD COLUMN IF NOT EXISTS paystack_card_last4 text,
  ADD COLUMN IF NOT EXISTS paystack_card_brand text,
  ADD COLUMN IF NOT EXISTS paystack_card_exp   text;

COMMENT ON COLUMN public.subscriptions.paystack_authorization_code_cipher IS
  'Encrypted (AES-256-GCM / PAYMENT_CIPHER_KEY) reusable Paystack authorization_code, captured from the first charge.success. Re-charged each cycle by subscription-renewal-worker. NULL = no saved card yet.';
COMMENT ON COLUMN public.subscriptions.paystack_card_last4 IS 'Display-only last four digits of the saved card.';
COMMENT ON COLUMN public.subscriptions.paystack_card_brand IS 'Display-only card brand (e.g. visa, mastercard).';
COMMENT ON COLUMN public.subscriptions.paystack_card_exp IS 'Display-only card expiry MM/YY.';
