-- =============================================================================
-- hosts — quote-only account class + admin access controls
-- =============================================================================
-- The dual-quote-system adds an EXTERNAL user class that only uses the quote
-- system (Looking-For + Quotes + Credits + Inbox), with none of the
-- accommodation/booking/website surfaces. Rather than a parallel identity, they
-- are a `hosts` row (so credits/quotes/subscriptions/inbox reuse works untouched)
-- flagged `account_kind = 'quote_only'` — the shell + route guard gate everything
-- else off. See LOOKING_FOR_QUOTE_TYPES_AND_OFFLINE_SYSTEM_PLAN §4 (D2 locked).
--
-- Two admin access switches (D5 — both default on):
--   • quote_access    — off = the account can't SEND quotes (the metering feature).
--   • platform_access — off = bounced from the host/guest surfaces to the
--                        quotes-only shell (for a quote_only account this is a
--                        full suspend, since quotes are all they have).
-- -----------------------------------------------------------------------------

alter table public.hosts
  add column if not exists account_kind text not null default 'host',
  add column if not exists quote_access boolean not null default true,
  add column if not exists platform_access boolean not null default true;

alter table public.hosts
  drop constraint if exists hosts_account_kind_check;
alter table public.hosts
  add constraint hosts_account_kind_check
  check (account_kind in ('host', 'quote_only'));

comment on column public.hosts.account_kind is
  'host = full host · quote_only = external quote-system-only account (scoped shell).';
comment on column public.hosts.quote_access is
  'Admin switch — false blocks the account from sending quotes.';
comment on column public.hosts.platform_access is
  'Admin switch — false bounces the account to the quotes-only shell (full suspend for a quote_only account).';
