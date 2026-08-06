-- Reduce the live product catalog to exactly TWO host memberships and align
-- name/slug/price to the founder's decisions (2026-08-06):
--   • "Standard" — R999/mo  (was "Starter", slug 'pro'; keeps annual + founding fields)
--   • "Founder"  — R499/mo  (competition/founding product; list + founding-lock rate = R499)
-- and REMOVE all other products (Beta, Wielo Quotes, StayFlow Web-design, 50 Quote Credits).
--
-- Money-safety (verified before writing):
--   * The recurring charge reads products.price LIVE at renewal (subscription-renewal.ts:33
--     "we charge and record today's price, never a stale plan amount"), and founding-locked
--     subs bill the SNAPSHOTTED locked_base_amount — so repricing never retroactively changes
--     an already-locked subscription. Only future charges/locks see the new numbers.
--   * The two kept products have 0 PayPal cached plans (product_billing_plans is keyed on the
--     exact ZAR amount, so a reprice mints a new plan — no stale provider amount).
--   * "Standard" keeps price=999 unchanged, so the 2 existing subscriptions on it are unaffected.
--     "Founder" has 0 subscriptions, so its reprice affects only future (competition) subscribers.
--
-- Delete-safety (verified against the live DB):
--   * The 4 removed products have 0 subscriptions, 0 product_orders, 0 subscription_scheduled_changes
--     (the only FK that could BLOCK a delete — NO ACTION), and 0 scoped platform_coupons.
--   * product_features rows cascade-delete with their product (expected — they gate the removed
--     products only). subscriptions.product_id / product_orders / platform_ledger FKs are SET NULL.
--   * All WHERE clauses are slug-guarded, so re-running (or running on a DB that never had these
--     rows) is a safe no-op.

-- 1) Starter → Standard (slug follows name, per the new editor rule).
UPDATE public.products
   SET name = 'Standard', slug = 'standard', updated_at = now()
 WHERE slug = 'pro';

-- 2) Founder → R499 list price + R499 founding-lock rate (annual R4,999 unchanged).
UPDATE public.products
   SET price = 499, founding_price = 499, updated_at = now()
 WHERE slug = 'founder';

-- 3) Remove every other product.
DELETE FROM public.products
 WHERE slug IN ('beta', 'wielo-quotes', '50-quote-credits', 'wielo-stayflow-web-design');
