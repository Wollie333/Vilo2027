-- Lock the metrics RPCs to service_role (follow-up to 20260723050000).
--
-- The metrics migration used `REVOKE ALL ... FROM PUBLIC`, which is the classic
-- no-op on Supabase: `anon` and `authenticated` hold EXPLICIT grants (Supabase's
-- default privileges grant EXECUTE on public functions to both roles), so
-- revoking only PUBLIC left them callable. Both funnels are SECURITY DEFINER —
-- an anon-executable one is an RLS bypass on a public URL that would leak
-- programme-wide referral / paying-host / commission counts to anyone holding
-- the publishable key. Every real caller is the admin page's service-role client
-- behind requirePermission, so revoking anon + authenticated is safe.
--
-- Same shape as 20260716310000_lock_down_privileged_rpcs.sql (revoke from all
-- three, re-grant service_role). Verified afterwards with:
--   has_function_privilege('anon', 'public.campaign_funnel(uuid)', 'EXECUTE')  → false
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('campaign_funnel', 'program_affiliate_funnel')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;
