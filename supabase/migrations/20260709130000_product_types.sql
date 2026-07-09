-- Phase 1 of the Wielo commerce model: a single product_type enum.
--   membership — the Wielo subscription (one active per user)
--   service    — a subscription service (many active)
--   product    — a once-off purchase (many)
--
-- product_type becomes the source of truth. The legacy `type`
-- (subscription | one_off) is kept as a GENERATED column derived from
-- product_type, so all existing code (incl. the Deno paystack-webhook) keeps
-- working untouched while we migrate reads/writes to product_type.

-- 1) New column + backfill (subscriptions were memberships; one-offs are products).
alter table public.products add column if not exists product_type text;
update public.products
  set product_type = case when type = 'one_off' then 'product' else 'membership' end
  where product_type is null;
alter table public.products alter column product_type set not null;
alter table public.products
  drop constraint if exists products_product_type_chk;
alter table public.products
  add constraint products_product_type_chk
  check (product_type in ('membership', 'service', 'product'));

-- 2) Replace `type` with a generated column derived from product_type.
alter table public.products drop column type;
alter table public.products
  add column type text
  generated always as (
    case when product_type = 'product' then 'one_off' else 'subscription' end
  ) stored;
