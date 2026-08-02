-- Paid product tiers didn't grant the add-ons / policies / coupons features:
--   • Beta (business) granted add-ons + policies, but NOT coupons.
--   • Founder + Starter (the paid PRO tiers) granted NONE of the three.
--   • "coupons" wasn't a gated feature anywhere (the action gate was a no-op).
-- So a PAYING host couldn't use add-ons or policies, and coupons was open to all.
-- Grant add-ons, policies AND coupons on Founder, Starter and Beta so entitlement
-- matches the product tier and the checkout gate can enforce coupons. Idempotent
-- upsert on unique_product_feature (product_id, feature_key).
INSERT INTO public.product_features (product_id, feature_key, is_enabled)
SELECT p.id, f.key, true
FROM (VALUES
  ('a0000000-0000-4000-8000-000000000f01'::uuid),  -- Founder (pro)
  ('a0000000-0000-4000-8000-000000000002'::uuid),  -- Starter (pro)
  ('4bff856d-0d51-4d09-accd-d6d6dc8bd9c4'::uuid)    -- Beta (business)
) AS p(id)
CROSS JOIN (VALUES ('addons'), ('policies'), ('coupons')) AS f(key)
ON CONFLICT ON CONSTRAINT unique_product_feature
DO UPDATE SET is_enabled = true, updated_at = now();
