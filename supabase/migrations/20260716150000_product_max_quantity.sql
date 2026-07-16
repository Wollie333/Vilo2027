-- Products: optional hard cap on how many can ever be sold (e.g. "30 beta
-- subscriptions only"). NULL = unlimited (the default). Once units sold reaches
-- the cap, the buy/signup surfaces lock and checkout-start is refused.
alter table public.products
  add column if not exists max_quantity integer
    check (max_quantity is null or max_quantity >= 0);

comment on column public.products.max_quantity is
  'Optional hard cap on total units sold. NULL = unlimited. When units sold >= this, purchase/signup is locked.';

-- Authoritative "units sold" for a product, used by both the checkout guards and
-- the public catalog so the cap is defined in exactly one place:
--   * subscription-like (membership | service): distinct holders — one
--     `subscriptions` row per (host, product), any status = lifetime take-up.
--   * everything else (one-off product | wielo_credits): paid `product_orders`.
create or replace function public.product_units_sold(p_product_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(case
    when p.product_type in ('membership', 'service') then
      (select count(*) from public.subscriptions s where s.product_id = p.id)
    else
      (select count(*) from public.product_orders o
        where o.product_id = p.id and o.status = 'paid')
  end, 0)::integer
  from public.products p
  where p.id = p_product_id;
$$;

grant execute on function public.product_units_sold(uuid) to authenticated, anon, service_role;
