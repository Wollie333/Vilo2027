-- A phone number the partner is willing to publish on their landing page.
--
-- Deliberately NOT user_profiles.phone. That one is the account's contact
-- number — used for verification and for us to reach them — and a partner
-- should be able to invite the public to call them without publishing the
-- number their bank and their OTP use. NULL means "don't show a number", and
-- the page falls back to the Wielo support line rather than exposing anything.
--
-- The other two things a partner customises on that page already exist:
-- photo_url (their picture) and bio (their personal message). No new columns
-- for those — the profile editor already writes both.

alter table public.affiliate_accounts
  add column if not exists public_phone text;

comment on column public.affiliate_accounts.public_phone is
  'Optional number shown publicly on /partners/<slug>. NOT the account phone (user_profiles.phone). NULL = show the Wielo line instead.';
