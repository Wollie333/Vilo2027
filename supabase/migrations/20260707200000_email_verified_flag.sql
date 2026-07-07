-- Migration: app-level email verification flag.
--
-- This project runs GoTrue with auto-confirm on (config.toml
-- enable_confirmations = false), so `auth.users.email_confirmed_at` is set for
-- every new account and can't tell us whether the person actually proved they
-- own the inbox. We track that ourselves: `email_verified_at` is null at signup
-- and stamped when the user clicks the signed link from their confirmation
-- email (the /verify-email route). The soft "please confirm your email" banner
-- is gated on this column, not on GoTrue's flag.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

COMMENT ON COLUMN public.user_profiles.email_verified_at IS
  'When the user confirmed ownership of their email via the /verify-email link. '
  'Null = unverified (drives the soft verification banner). Distinct from '
  'auth.users.email_confirmed_at, which is auto-set by GoTrue.';
