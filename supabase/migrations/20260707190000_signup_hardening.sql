-- Migration: signup hardening — terms consent record + signup rate limiting.
--
-- Part of the MVP signup-hardening pass. Two additive, independent pieces:
--
--  1. Legal consent audit on user_profiles. The signup wizards already force a
--     "I agree to the Terms + Privacy" checkbox, but nothing was persisted.
--     We now stamp WHEN and WHICH VERSION (see lib/auth/consent.ts) the user
--     accepted, for POPIA / dispute evidence.
--
--  2. A tiny IP-keyed rate-limit ledger for account creation. The public guest
--     + host signup actions create users via the service-role admin API, which
--     bypasses Supabase's built-in per-IP `sign_in_sign_ups` throttle — so
--     without this an attacker could mass-create accounts. Service-role only
--     (the app writes/reads it from the server action); RLS denies everyone
--     else by default.

-- ── 1. Terms consent ────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version     text;

COMMENT ON COLUMN public.user_profiles.terms_accepted_at IS
  'When the user accepted the Terms of Service + Privacy Policy at signup.';
COMMENT ON COLUMN public.user_profiles.terms_version IS
  'Which legal-consent version was accepted (lib/auth/consent.ts TERMS_VERSION).';

-- ── 2. Signup rate-limit ledger ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.signup_rate_limits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fast "how many attempts from this ip in the last N minutes" lookups.
CREATE INDEX IF NOT EXISTS signup_rate_limits_ip_time_idx
  ON public.signup_rate_limits (ip_hash, created_at DESC);

-- Locked down: only the service role (server actions / edge functions) touches
-- this. RLS on with no policies = deny to anon + authenticated.
ALTER TABLE public.signup_rate_limits ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.signup_rate_limits IS
  'IP-keyed account-creation attempt ledger for signup rate limiting. '
  'Service-role only. ip_hash is a salted hash of the client IP, never the raw IP.';
