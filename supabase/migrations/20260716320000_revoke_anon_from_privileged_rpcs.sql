-- =============================================================================
-- Close the rest of the anon-executable SECURITY DEFINER surface.
--
-- 20260716310000 locked the 7 money-movers after proving `anon` could mint 500
-- Wielo credits. This finishes the job: 80 more SECURITY DEFINER functions were
-- still executable by `anon`, i.e. by anyone holding the publishable key — which
-- ships in the browser bundle — via `POST /rest/v1/rpc/<name>`.
--
-- PROVEN, not theorised. As role `anon` with no jwt claims:
--
--   SET LOCAL ROLE anon;
--   SELECT fetch_primary_kpis('<host>', '2020-01-01', '2030-01-01');
--   --> {"adr": {...}, "revpar": {...}, "revenue": {...}}   -- it RETURNED.
--
-- It reads zeros only because the platform has no bookings yet. With real data
-- that is any host's revenue, ADR and RevPAR handed to an anonymous caller who
-- knows a host_id — and host ids are not secret. The same applied to
-- fetch_host_guests (guest PII), fetch_guest_demographics, fetch_revenue_trend
-- and ~20 more, plus writers like ensure_booking_invoice and next_refund_number.
--
-- Cause (again): CREATE FUNCTION grants EXECUTE to PUBLIC and `anon` inherits
-- it, so this was never deliberate — it is the default nobody revoked.
--
-- WHAT THIS DOES: revoke PUBLIC + anon, then grant back `authenticated` and
-- `service_role` so every real caller keeps working. Functions already locked by
-- ..310000 are skipped automatically — the loop only picks up what `anon` can
-- still execute, and they can't.
--
-- ANON KEEPS (verified reachable by a signed-out visitor):
--   fetch_platform_commission_saved  booking-management/_components/Hero.tsx (public marketing)
--   get_listing_policy_summary       site/book/page.tsx + ListingPolicyBlock  (public booking)
--   product_units_sold               p/[slug]/page.tsx                        (public product)
--   check_feature_permission         read-only gate check used widely, incl. public site renders
--
-- SAFE: the public booking flow never runs as anon — lib/bookings/persist.ts and
-- lib/website/siteCheckout.ts both use createAdminClient() (service_role), as do
-- the queue/cron workers. The dashboard analytics callers run as `authenticated`,
-- which is granted below.
--
-- ⚠️ NOT FIXED HERE — a separate, real problem: these functions take `p_host_id`
-- as an argument and do not verify the caller owns that host. After this
-- migration any SIGNED-IN user can still read any host's KPIs by passing another
-- host's id (IDOR). Closing that needs an ownership check inside each function —
-- its own pass. This migration removes the unauthenticated-internet exposure,
-- which is the difference between "needs a free account" and "needs nothing".
-- =============================================================================

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
      AND p.prorettype <> 'trigger'::regtype
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND p.proname NOT IN (
        'fetch_platform_commission_saved',
        'get_listing_policy_summary',
        'product_units_sold',
        'check_feature_permission'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn.sig);
  END LOOP;
END $$;

-- The four public ones: drop the blanket PUBLIC grant but name anon explicitly,
-- so the intent is recorded rather than inherited by accident.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fetch_platform_commission_saved',
        'get_listing_policy_summary',
        'product_units_sold',
        'check_feature_permission'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', fn.sig);
  END LOOP;
END $$;
