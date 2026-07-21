-- Affiliate self-signup: a PENDING state before a partner can refer.
--
-- Until now an affiliate account was born 'active' — the row existing WAS the
-- activation, because the only way to get one was to already be signed in and
-- accept the terms inside the portal. The public per-campaign signup form
-- changes that: a stranger can now create one, so there has to be a state where
-- the account exists but earns nothing.
--
-- A pending account becomes active by EITHER route:
--   • self-serve — affiliate agreement signed + platform terms accepted + email
--     confirmed (+ campaign rules accepted when they came in via a competition),
--   • or an admin activating them by hand (activated_by records who).
alter table public.affiliate_accounts
  drop constraint if exists affiliate_accounts_status_check;

alter table public.affiliate_accounts
  add constraint affiliate_accounts_status_check
  check (status in ('pending', 'active', 'suspended'));

-- DEFAULT stays 'active': the in-portal accept-terms path already proves the
-- person is signed in and has signed, so it must keep working unchanged. Only
-- the public signup form inserts 'pending' explicitly.

alter table public.affiliate_accounts
  add column if not exists activated_at timestamptz,
  add column if not exists activated_by uuid
    references public.user_profiles(id) on delete set null,
  add column if not exists signup_campaign_id uuid
    references public.affiliate_campaigns(id) on delete set null;

comment on column public.affiliate_accounts.activated_at is
  'When the account became active. Null while pending.';
comment on column public.affiliate_accounts.activated_by is
  'Admin who activated by hand; NULL means the partner self-activated by clearing every gate.';
comment on column public.affiliate_accounts.signup_campaign_id is
  'Competition whose signup page created this account — enrolled on activation, and kept for attribution.';

-- Every account that already exists was active on arrival; stamp it so
-- activated_at is never a lie for pre-existing partners.
update public.affiliate_accounts
   set activated_at = coalesce(activated_at, accepted_at, created_at)
 where status = 'active'
   and activated_at is null;

-- "Who is waiting to be activated?" — the admin queue.
create index if not exists affiliate_accounts_pending_idx
  on public.affiliate_accounts (created_at desc)
  where status = 'pending';
