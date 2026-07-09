-- Phase 4b — scheduled subscription changes ("apply at end of the current
-- cycle"). An admin can enforce a membership change NOW (handled in the app) or
-- schedule it for `current_period_end`; the scheduled row lives here and an
-- hourly cron applies due changes in-DB. Supports cancel + switch (up/downgrade).

create table if not exists public.subscription_scheduled_changes (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null
    references public.subscriptions(id) on delete cascade,
  host_id uuid not null references public.hosts(id) on delete cascade,
  -- 'cancel' → stop the sub at period end; 'switch' → move it to target_product.
  kind text not null check (kind in ('cancel', 'switch')),
  target_product_id uuid references public.products(id),
  -- When the change becomes due (the sub's current_period_end at scheduling time).
  effective_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'superseded', 'cancelled')),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  -- A 'switch' must name a target product; a 'cancel' must not.
  constraint scheduled_change_target_shape check (
    (kind = 'switch' and target_product_id is not null) or
    (kind = 'cancel' and target_product_id is null)
  )
);

create index if not exists idx_sched_changes_due
  on public.subscription_scheduled_changes (effective_at)
  where status = 'pending';

-- At most one PENDING change per subscription (a new schedule supersedes the old).
create unique index if not exists idx_sched_changes_one_pending
  on public.subscription_scheduled_changes (subscription_id)
  where status = 'pending';

alter table public.subscription_scheduled_changes enable row level security;

-- The owning host may READ their own scheduled changes (to show "cancels on …").
-- All writes go through admin server actions (service role, which bypasses RLS).
drop policy if exists sched_changes_owner_read
  on public.subscription_scheduled_changes;
create policy sched_changes_owner_read
  on public.subscription_scheduled_changes for select
  using (
    host_id in (select id from public.hosts where user_id = auth.uid())
  );

-- ─── Apply due scheduled changes (in-DB, called by the hourly cron) ──────────
create or replace function public.apply_due_subscription_changes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_plan text;
  v_cycle text;
  v_is_membership boolean;
begin
  for c in
    select *
    from public.subscription_scheduled_changes
    where status = 'pending' and effective_at <= now()
    order by effective_at
  loop
    if c.kind = 'cancel' then
      update public.subscriptions
        set status = 'cancelled',
            cancelled_at = now(),
            cancel_at_period_end = false,
            updated_at = now()
        where id = c.subscription_id;

    elsif c.kind = 'switch' and c.target_product_id is not null then
      -- Resolve the target product's feature tier + billing cycle.
      select
        (p.product_type = 'membership'),
        coalesce(
          (select pl.key from public.plans pl
             where pl.key = coalesce(p.plan_key, p.slug)),
          (select s.plan from public.subscriptions s
             where s.id = c.subscription_id),
          'free'
        ),
        case when p.billing_cycle = 'annual' then 'annual' else 'monthly' end
      into v_is_membership, v_plan, v_cycle
      from public.products p
      where p.id = c.target_product_id;

      -- One active membership per host: retire any OTHER active membership first.
      if coalesce(v_is_membership, false) then
        update public.subscriptions s
          set status = 'cancelled', updated_at = now()
          from public.products p
          where p.id = s.product_id
            and s.host_id = c.host_id
            and s.id <> c.subscription_id
            and p.product_type = 'membership'
            and s.status in ('trialing', 'active', 'past_due');
      end if;

      update public.subscriptions
        set product_id = c.target_product_id,
            plan = v_plan,
            billing_cycle = v_cycle,
            status = 'active',
            current_period_start = now(),
            current_period_end = now() +
              (case when v_cycle = 'annual'
                 then interval '12 months' else interval '1 month' end),
            cancel_at_period_end = false,
            updated_at = now()
        where id = c.subscription_id;
    end if;

    update public.subscription_scheduled_changes
      set status = 'applied', applied_at = now()
      where id = c.id;
  end loop;
end;
$$;

-- ─── Hourly cron ─────────────────────────────────────────────────────────────
select cron.unschedule('apply-subscription-changes')
where exists (
  select 1 from cron.job where jobname = 'apply-subscription-changes'
);

select cron.schedule('apply-subscription-changes', '0 * * * *', $cron$
  select public.apply_due_subscription_changes();
$cron$);
