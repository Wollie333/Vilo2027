-- Migration: align the Founding annual price to the source of truth (§6.1).
--
-- SoT docs/strategy/WIELO_FOUNDING_PROGRAMME.md §6.1:
--   Standard        R999/month   → products.price            (already 999)
--   Founding annual R4,999/year  → products.founding_annual_price (was 5988)
--   Founding monthly R599/month  → products.founding_price   (already 599)
--
-- Founding pricing is NOT separate products — it is the WS-5 per-subscription
-- price-lock on `pro` (founding_price / founding_annual_price applied via
-- applyFoundingLock when founding offers are open). So the only change the SoT
-- requires here is the annual number: 5988 → 4999. This makes a Founding annual
-- host pay R4,999 and the partner earn 60% = R2,999.40 (§6.1).

UPDATE public.products
SET founding_annual_price = 4999
WHERE slug = 'pro'
  AND founding_annual_price IS DISTINCT FROM 4999;
