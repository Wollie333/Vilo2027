-- =============================================================================
-- Carry each membership's configured per-cycle credit grant onto the new dial.
--
-- 20260716200000 made `wielo_credits_per_month` the SSOT for subscription grants
-- and `grantSubscriptionCredits` stopped reading `products.credit_quantity` — but
-- the values already configured there were never migrated. Result on live:
--   * "Wielo Quotes" (credit_quantity = 5, and its selling point literally says
--     "5 quote credits every month") granted 0, falling back to plan free = 0.
--   * "Beta" (credit_quantity = 50) granted 200 from plan business.
-- Neither is what the admin configured. Copy the intent onto the dial that is now
-- actually read.
--
-- `credit_quantity` remains meaningful ONLY for one-off `wielo_credits` packages
-- (grantCreditsForOrder) — untouched here, and the product editor now only shows
-- that field for packages.
-- =============================================================================

INSERT INTO product_features (product_id, feature_key, is_enabled, limit_value)
SELECT p.id, 'wielo_credits_per_month', TRUE, p.credit_quantity
FROM products p
WHERE p.product_type = 'membership'
  AND COALESCE(p.credit_quantity, 0) > 0
ON CONFLICT (product_id, feature_key) DO UPDATE
  SET is_enabled  = TRUE,
      limit_value = EXCLUDED.limit_value;
