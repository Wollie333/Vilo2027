-- Collect-before-grant for prorated membership upgrades.
--
-- Before this migration, runProratedPaystackUpgrade rewrote the host's
-- subscription to the higher tier as soon as the Paystack checkout was HANDED
-- OFF — not when the delta was actually paid. Abandon the card form and you kept
-- the tier for free (one such order, R513.79, sat pending on the live DB).
--
-- The delta order now CARRIES the upgrade instead: the tier switch is applied by
-- the settle paths once the order flips to paid, and never before.
alter table public.product_orders
  add column if not exists upgrade_subscription_id uuid
    references public.subscriptions(id) on delete set null,
  add column if not exists upgrade_plan_key text;

comment on column public.product_orders.upgrade_subscription_id is
  'Prorated upgrade delta: the subscription to switch to this order''s product ONCE PAID (period preserved). Null for every other order.';
comment on column public.product_orders.upgrade_plan_key is
  'Prorated upgrade delta: plans.key to write on the subscription when the delta is paid.';

-- Settle looks these up by order id / provider reference, which are already
-- indexed; this partial index only serves "which upgrades are still unpaid?".
create index if not exists product_orders_pending_upgrade_idx
  on public.product_orders (upgrade_subscription_id)
  where upgrade_subscription_id is not null and status = 'pending';
