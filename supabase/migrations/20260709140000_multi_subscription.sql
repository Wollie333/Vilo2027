-- Phase 3 of the commerce model: multiple subscriptions per host.
-- A host may hold ONE active membership + MANY active service subscriptions
-- (once-off products are separate, in product_orders). Feature gating unions
-- across all active subscriptions.

-- 1) Allow multiple subscription rows per host (was UNIQUE(host_id)).
alter table public.subscriptions
  drop constraint if exists subscriptions_host_id_key;
drop index if exists public.subscriptions_host_id_key;

-- 2) Enforce ONE active membership per host. product_type lives on `products`,
--    so a partial unique index can't see it — use a trigger.
create or replace function public.enforce_one_active_membership()
returns trigger language plpgsql as $$
declare v_is_membership boolean;
begin
  if new.status not in ('trialing', 'active', 'past_due') then
    return new;
  end if;
  select (p.product_type = 'membership') into v_is_membership
    from public.products p where p.id = new.product_id;
  if coalesce(v_is_membership, false) and exists (
    select 1
    from public.subscriptions s
    join public.products p on p.id = s.product_id
    where s.host_id = new.host_id
      and s.id <> new.id
      and p.product_type = 'membership'
      and s.status in ('trialing', 'active', 'past_due')
  ) then
    raise exception
      'A host can only have one active membership subscription at a time.';
  end if;
  return new;
end $$;

drop trigger if exists trg_one_active_membership on public.subscriptions;
create trigger trg_one_active_membership
  before insert or update on public.subscriptions
  for each row execute function public.enforce_one_active_membership();

-- 3) Feature gating unions across ALL active subscriptions: a feature is enabled
--    if ANY active product grants it; a limit is the MAX across active products.
create or replace function public.check_feature_permission(
  p_host_id uuid,
  p_feature_key text
)
returns jsonb
language plpgsql
stable security definer
as $function$
declare v_result jsonb;
begin
  -- 1. Per-host override (most specific).
  select jsonb_build_object(
    'is_enabled', hfo.is_enabled,
    'limit_value', hfo.limit_value,
    'source', 'override'
  ) into v_result
  from host_feature_overrides hfo
  where hfo.host_id = p_host_id
    and hfo.feature_key = p_feature_key
    and (hfo.expires_at is null or hfo.expires_at > now())
  limit 1;
  if v_result is not null then return v_result; end if;

  -- 2. Product-level — UNION across every active subscription's product.
  select jsonb_build_object(
    'is_enabled', bool_or(prf.is_enabled),
    'limit_value', max(prf.limit_value),
    'source', 'product'
  ) into v_result
  from product_features prf
  join subscriptions s on s.product_id = prf.product_id
  where s.host_id = p_host_id
    and s.status in ('trialing', 'active')
    and prf.feature_key = p_feature_key
  having count(*) > 0;
  if v_result is not null then return v_result; end if;

  -- 3. Plan-level (legacy fallback — pre-product / free subscriptions).
  select jsonb_build_object(
    'is_enabled', bool_or(pf.is_enabled),
    'limit_value', max(pf.limit_value),
    'source', 'plan'
  ) into v_result
  from plan_features pf
  join subscriptions s on s.plan = pf.plan
  where s.host_id = p_host_id
    and s.status in ('trialing', 'active')
    and pf.feature_key = p_feature_key
  having count(*) > 0;

  return coalesce(v_result,
    jsonb_build_object('is_enabled', false, 'limit_value', null, 'source', 'default'));
end;
$function$;
