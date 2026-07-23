-- Verified partner badge. An admin can mark an affiliate a "verified partner";
-- the badge then shows on their public profile / co-branded landing. NULL means
-- not verified. verified_by records which staff member set it (audit trail).
alter table public.affiliate_accounts
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

comment on column public.affiliate_accounts.verified_at is
  'When an admin marked this affiliate a verified partner (badge shown on their profile). NULL = not verified.';
comment on column public.affiliate_accounts.verified_by is
  'Staff user who set/cleared the verified flag.';
