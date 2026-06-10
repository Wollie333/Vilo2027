-- Migration: per-host savings summary RPC
--
-- Powers two surfaces of the commission-savings feature:
--   1. The header "$" badge → "Vilo has saved you R X so far" modal.
--   2. Reports → Savings: the competitor OTA comparison page.
--
-- Scoped sibling of fetch_platform_commission_saved. Returns the raw
-- direct-booking revenue BASE (not a pre-multiplied saving) so the web app can
-- apply each competitor OTA's commission rate from the single source of truth
-- at apps/web/lib/savings/ota-competitors.ts. Revenue set is identical to the
-- platform stat: confirmed/checked_in/completed direct bookings, not deleted.

create or replace function public.fetch_host_savings(p_host_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revenue  numeric;
  v_count    integer;
  v_first    date;
  v_currency text;
  v_by_month jsonb;
begin
  -- Authorize: security definer bypasses RLS, so verify ownership explicitly.
  if not exists (
    select 1 from hosts
    where id = p_host_id
      and user_id = auth.uid()
      and deleted_at is null
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select
    coalesce(sum(total_amount), 0),
    count(*),
    min(check_in),
    coalesce(max(currency), 'ZAR')
  into v_revenue, v_count, v_first, v_currency
  from bookings
  where host_id = p_host_id
    and status in ('confirmed', 'checked_in', 'completed')
    and channel = 'direct'
    and deleted_at is null;

  -- Monthly revenue base for the savings trend.
  select coalesce(
    jsonb_agg(
      jsonb_build_object('month', month, 'revenue', revenue)
      order by month
    ),
    '[]'::jsonb
  )
  into v_by_month
  from (
    select
      to_char(date_trunc('month', check_in), 'YYYY-MM') as month,
      sum(total_amount)                                  as revenue
    from bookings
    where host_id = p_host_id
      and status in ('confirmed', 'checked_in', 'completed')
      and channel = 'direct'
      and deleted_at is null
      and check_in is not null
    group by 1
  ) m;

  return jsonb_build_object(
    'direct_revenue',     v_revenue,
    'booking_count',      v_count,
    'first_booking_date', v_first,
    'currency',           v_currency,
    'by_month',           v_by_month
  );
end;
$$;

revoke all on function public.fetch_host_savings(uuid) from public;
grant execute on function public.fetch_host_savings(uuid) to authenticated;

comment on function public.fetch_host_savings(uuid) is
  'Per-host direct-booking revenue base + monthly trend for the savings/commission-comparison feature (header "$" badge and Reports -> Savings). Caller must own the host. Web app multiplies direct_revenue by each OTA rate in lib/savings/ota-competitors.ts. Revenue set matches fetch_platform_commission_saved: confirmed/checked_in/completed direct bookings, excluding soft-deleted.';
