-- Optional two-factor authentication: recovery codes.
--
-- Supabase Auth provides TOTP enrolment and verification but NO recovery codes.
-- Without them, optional 2FA is a self-inflicted outage waiting to happen: lose
-- the phone, lose the account, and the only way back is service-role surgery on
-- the live database. So recovery codes are part of shipping 2FA, not a follow-up.
--
-- Codes are stored as sha256 hashes and are single-use. We keep only the hash
-- for the same reason we keep only a password hash — a leaked table must not be
-- a pile of working keys.
create table if not exists public.user_mfa_backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_mfa_backup_codes_user_idx
  on public.user_mfa_backup_codes (user_id)
  where used_at is null;

-- One code can never be redeemed twice, enforced by the database rather than by
-- remembering to check.
create unique index if not exists user_mfa_backup_codes_unique
  on public.user_mfa_backup_codes (user_id, code_hash);

alter table public.user_mfa_backup_codes enable row level security;

-- No policies on purpose: these rows are only ever read or written by the
-- server (service role). A signed-in user has no reason to read even their own
-- hashes, and RLS with no policy denies everyone else by default.

comment on table public.user_mfa_backup_codes is
  'Single-use recovery codes for optional 2FA. sha256 hashes only. Service-role access only — no RLS policies by design.';

-- The 2FA nudge for hosts and staff: dismissible, and it must stay dismissed.
alter table public.user_profiles
  add column if not exists mfa_prompt_dismissed_at timestamptz;

comment on column public.user_profiles.mfa_prompt_dismissed_at is
  'When the user dismissed the "turn on two-factor" prompt. Null = never dismissed. 2FA stays optional; this only silences the suggestion.';
