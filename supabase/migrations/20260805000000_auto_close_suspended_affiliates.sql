-- Auto-close affiliates that have been SUSPENDED for more than 60 days.
--
-- Lifecycle (founder spec):
--   active     → referral binds, commission accrues to the partner.
--   suspended  → referral STILL binds under them + they still resolve in the
--                signup "Referred by" field, BUT no commission accrues (the
--                accrue_affiliate_commission RPC returns NULL for any non-active
--                affiliate, so 100% stays with Wielo). suspended_at starts a clock.
--   closed     → after 60 days suspended, the partner is removed from the program:
--                they stop resolving in the "Referred by" field and their links no
--                longer capture, so new referrals default to Wielo.
--
-- The money is already correct at every stage (the accrual gate). This job only
-- performs the suspended→closed transition, which no existing RPC could do
-- (set_affiliate_status rejects 'closed'; close_affiliate_account rejects a
-- non-active account). Suspension already voided any pending accrual and blocks
-- new accrual, so a long-suspended account has a nil balance — a plain state flip
-- is sufficient (no sweep/payout needed).

create or replace function public.close_long_suspended_affiliates()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with closed as (
    update public.affiliate_accounts
    set status = 'closed',
        closed_at = now(),
        closed_reason = 'auto: suspended over 60 days',
        updated_at = now()
    where status = 'suspended'
      and suspended_at is not null
      and suspended_at < now() - interval '60 days'
    returning id
  )
  select count(*) into v_count from closed;
  return v_count;
end;
$$;

-- Privileged: service-role / cron only. The SECURITY DEFINER owner still runs it
-- from cron; clients (anon/authenticated) must never call it directly.
revoke all on function public.close_long_suspended_affiliates() from public;
revoke all on function public.close_long_suspended_affiliates() from anon;
revoke all on function public.close_long_suspended_affiliates() from authenticated;

-- Daily at 03:45 UTC (a free slot). Idempotent: cron.schedule upserts by name.
select cron.schedule(
  'close-long-suspended-affiliates',
  '45 3 * * *',
  $$select public.close_long_suspended_affiliates()$$
);
