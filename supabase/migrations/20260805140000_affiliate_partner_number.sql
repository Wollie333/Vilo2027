-- A short, unique 5-digit PARTNER NUMBER for each affiliate, alongside the
-- existing slug/username. A referred host can be attributed by EITHER the number
-- or the handle — both resolve to the same partner. The slug stays the vanity
-- /r/<slug> link; the number is just an easier-to-say/type code.
--
-- Range 10000-99999 → always exactly 5 digits (no leading-zero ambiguity), ~90k
-- codes. Bump to 6 digits later if the program ever needs more headroom.

alter table public.affiliate_accounts
  add column if not exists partner_number text;

-- Allocate a random 5-digit code not already in use.
create or replace function public.gen_affiliate_partner_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  tries int := 0;
begin
  loop
    candidate := (10000 + floor(random() * 90000))::int::text;
    exit when not exists (
      select 1 from public.affiliate_accounts where partner_number = candidate
    );
    tries := tries + 1;
    if tries > 100 then
      raise exception 'could not allocate a free affiliate partner number';
    end if;
  end loop;
  return candidate;
end;
$$;

-- Backfill existing accounts one row at a time so each allocation sees the ones
-- assigned just before it (same transaction) and can't collide.
do $$
declare
  r record;
begin
  for r in
    select id from public.affiliate_accounts where partner_number is null
  loop
    update public.affiliate_accounts
      set partner_number = public.gen_affiliate_partner_number()
      where id = r.id;
  end loop;
end $$;

-- Enforce presence + uniqueness now every row has one.
alter table public.affiliate_accounts
  alter column partner_number set not null;

create unique index if not exists affiliate_accounts_partner_number_key
  on public.affiliate_accounts (partner_number);

-- Auto-assign on insert when the caller doesn't provide one (covers every signup
-- + admin-enable path without touching app code).
create or replace function public.set_affiliate_partner_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_number is null then
    new.partner_number := public.gen_affiliate_partner_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_affiliate_partner_number on public.affiliate_accounts;
create trigger trg_affiliate_partner_number
  before insert on public.affiliate_accounts
  for each row execute function public.set_affiliate_partner_number();

revoke all on function public.gen_affiliate_partner_number() from public;
revoke all on function public.gen_affiliate_partner_number() from anon;
revoke all on function public.gen_affiliate_partner_number() from authenticated;
