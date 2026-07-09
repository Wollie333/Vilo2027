-- Custom-amount top-up orders (e.g. a pro-rated subscription UPGRADE delta) must
-- NOT re-activate a plan when paid: for those the tier is activated separately at
-- admin time, and the pay-link only collects the outstanding amount + mints the
-- invoice. Default TRUE so every existing full-price product purchase keeps
-- activating its plan on payment exactly as before (additive, pre-MVP).
alter table public.product_orders
  add column if not exists activate_on_pay boolean not null default true;

comment on column public.product_orders.activate_on_pay is
  'When false, settling this order does NOT call activateMappedPlan (the plan was activated elsewhere, e.g. an admin upgrade whose delta this order bills). Default true = normal product purchase.';
