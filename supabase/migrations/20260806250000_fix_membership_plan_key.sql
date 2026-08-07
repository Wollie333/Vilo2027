-- Root-cause fix: paid membership subscriptions stuck on plan = 'free'.
--
-- Every activation path derives the subscription's plan as
-- `product.plan_key ?? product.slug`, then only writes it if that value exists
-- as a row in `plans` (subscriptions.plan has an FK to plans(key)). `plans` only
-- holds free/basic/pro/business. When the catalogue was renamed, the paid
-- membership products were left with plan_key = NULL and slugs ('starter',
-- 'standard', 'founder') that are NOT plan keys — so the lookup missed and every
-- activation silently fell back to 'free'. product_id was set correctly; only the
-- `plan` label went stale. Result: a paying host reads plan='free' across the
-- sidebar, settings badge, subscription emails and admin revenue buckets, and
-- (before the product_id-based fix) counted as 0 paying in the affiliate stats.
--
-- Fixing the DATA at the source fixes ALL activation entry points at once
-- (Paystack/PayPal/EFT settle, admin manual activate, free/trial fulfil, signup
-- finalize, native + PayPal subscription rails, prorated upgrade, and the
-- dashboard reconcile backstop) because they all read plan_key before the slug
-- fallback. 'pro' is the paid tier both memberships belong to
-- (20260802140000_grant_paid_tier_features.sql: "Founder + Starter, the paid PRO
-- tiers"); per-product feature differences come from product_features, not plan.

-- 1. Give every paid membership product a valid plan_key (the FK requires one).
UPDATE public.products
SET plan_key = 'pro'
WHERE product_type = 'membership'
  AND price > 0
  AND (
    plan_key IS NULL
    OR plan_key NOT IN (SELECT key FROM public.plans)
  );

-- 2. One-time backfill: repair live subscriptions already frozen on 'free'
-- despite pointing at a paid membership product. The IN (plans) guard keeps the
-- write FK-valid.
UPDATE public.subscriptions s
SET plan = COALESCE(p.plan_key, p.slug)
FROM public.products p
WHERE s.product_id = p.id
  AND s.status IN ('active', 'past_due', 'trialing')
  AND s.plan = 'free'
  AND COALESCE(p.plan_key, p.slug) IN (SELECT key FROM public.plans);
