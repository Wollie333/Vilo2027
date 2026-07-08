-- products.plan_key — which feature tier (plans.key) a subscription product
-- grants. The `products` catalog is what hosts see (signup + the subscription
-- settings tab); `plans` remains the feature-gate/pricing tiers behind them.
-- When plan_key is NULL, activation falls back to the product slug if that slug
-- is itself a valid plan key (so a product with slug 'pro' still maps to Pro).
alter table products add column if not exists plan_key text;

comment on column products.plan_key is
  'Feature tier (plans.key) this subscription product grants. NULL falls back to slug-if-plan-key. Set for products whose slug is not a plan key (e.g. a beta product granting full access).';
