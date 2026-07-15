-- Credit packages are one-off purchases (not subscriptions). The generated
-- `products.type` column previously mapped everything except product_type
-- 'product' to 'subscription', which would make a wielo_credits package check
-- out as recurring and be skipped in one-off revenue reporting. Re-derive it so
-- both 'product' and 'wielo_credits' are 'one_off'.

alter table public.products drop column if exists type;
alter table public.products
  add column type text generated always as (
    case
      when product_type in ('product', 'wielo_credits') then 'one_off'
      else 'subscription'
    end
  ) stored;
