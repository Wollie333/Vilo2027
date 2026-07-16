-- =============================================================================
-- CRITICAL: anon could mint Wielo credits and settle affiliate payouts.
--
-- PROVEN on live (in a rollback), as role `anon` with NO jwt claims at all:
--
--   SET LOCAL ROLE anon;
--   SELECT apply_wielo_credit('<host>','quote',500,'grant',...);  -->  605
--
-- 500 credits minted into a host's wallet by a signed-out caller. And the anon
-- key reaches PostgREST: `POST /rest/v1/rpc/is_super_admin` with the publishable
-- key returns 200. The anon key ships in the browser bundle BY DESIGN, so this
-- was reachable by anyone on the internet.
--
-- ROOT CAUSE — a Postgres default, not a typo. `CREATE FUNCTION` grants EXECUTE
-- to **PUBLIC** automatically, and `anon` inherits it through PUBLIC. Every
-- `REVOKE ALL ON FUNCTION ... FROM anon` in this repo (e.g. the old
-- record_guest_post_and_check) was therefore a NO-OP: it revoked a grant anon
-- never held, while the PUBLIC grant it actually inherits stayed untouched.
-- You must revoke from PUBLIC. 89 of 91 SECURITY DEFINER functions are currently
-- anon-executable for exactly this reason.
--
-- SECURITY DEFINER runs as the owner and bypasses RLS, so an anon-executable one
-- is an RLS bypass with a public URL. The functions below all move money or
-- entitlements and take their "who am I" as a caller-supplied argument
-- (`p_admin`, `p_host_id`) — they never verify it, because they were only ever
-- meant to be called by trusted server code.
--
-- SAFE TO REVOKE: every legitimate caller uses the service-role client —
--   apply_wielo_credit          lib/credits/wallet.ts:155            (admin)
--   settle_affiliate_payout     admin/affiliates/actions.ts:58       (service)
--   set_affiliate_status        admin/affiliates/actions.ts:28       (service)
--   create_affiliate_payout     portal/affiliates/actions.ts:140     (admin)
--   accrue_affiliate_commission lib/affiliate/notify.ts:19           (admin)
-- clawback_affiliate_commission and redeem_coupon have no direct app callers;
-- they run from inside other DB functions, which is unaffected by these grants.
--
-- Looped by NAME so overloads cannot be missed (clawback_affiliate_commission
-- has two). This does NOT fix the other ~80 anon-executable SECURITY DEFINER
-- functions — several legitimately serve public pages as anon, so that sweep
-- needs its own pass. `docs/SCHEMA.md` now flags them all on every regeneration.
-- =============================================================================

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
        'apply_wielo_credit',
        'set_affiliate_status',
        'settle_affiliate_payout',
        'create_affiliate_payout',
        'accrue_affiliate_commission',
        'clawback_affiliate_commission',
        'redeem_coupon'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;

-- record_guest_post (20260716300000) shipped with the same no-op REVOKE. It IS
-- called by the posting guest through the request-scoped client, so it keeps
-- `authenticated` — but anon must not be able to forge action-log rows.
REVOKE ALL ON FUNCTION public.record_guest_post(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_guest_post(uuid, uuid) TO authenticated;
