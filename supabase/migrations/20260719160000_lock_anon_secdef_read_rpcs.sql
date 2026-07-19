-- Lock down anon-executable SECURITY DEFINER read functions flagged by
-- docs/SCHEMA.md's red-flag scanner. Each runs as owner (bypasses RLS) and is
-- reachable at POST /rest/v1/rpc/<name> with the publishable (anon) key.
--
-- SECURITY REVIEW (2026-07-19). Judgement per function:
--
--  * check_feature_permission(host, key) — returns a host's feature entitlements
--    (plan/product/override). Every app caller is an AUTHENTICATED dashboard/admin
--    context passing the host's own id; no public page calls it. Leaving it open to
--    anon let anyone probe any host's subscription tier + feature set. Lock to
--    authenticated + service_role. (Residual: an authenticated user could still
--    probe another host_id — lower severity; a caller-ownership check inside the
--    function is the follow-up if we want to close that too.)
--
--  * product_units_sold(product) — sales/subscription counts for a product. Every
--    caller uses the service-role admin client (product page, catalog, stock guard).
--    Anon/authenticated exposure leaked per-product sales figures. Lock to
--    service_role.
--
--  * fetch_platform_commission_saved() — platform-wide GMV × 0.15 scalar. Only
--    caller (booking-management Hero) now reads it via the service-role client, so
--    the public marketing stat still renders while the raw GMV-derived figure is no
--    longer scrapeable by anyone with the anon key. Lock to service_role.
--
-- NOT changed: get_listing_policy_summary — legitimately public (cancellation
-- policy shown to every prospective guest on listing pages, rendered as anon).
--
-- Reminder: CREATE FUNCTION grants EXECUTE to PUBLIC, so a plain REVOKE ... FROM
-- anon is a no-op — revoke from PUBLIC and re-grant the roles that actually need it.

REVOKE EXECUTE ON FUNCTION public.check_feature_permission(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_feature_permission(uuid, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.product_units_sold(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_units_sold(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fetch_platform_commission_saved()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_platform_commission_saved() TO service_role;
