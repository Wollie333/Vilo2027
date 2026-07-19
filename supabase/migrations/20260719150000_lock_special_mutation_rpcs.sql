-- Lock the specials cap/date mutation RPCs to service_role only.
--
-- SECURITY FIX (2026-07-19). These four functions mutate a special's redemption
-- count or a property's blocked_dates. They are ONLY ever called server-side via
-- the service-role admin client (deal booking `deal/[slug]/book/actions.ts`,
-- site checkout `lib/website/siteCheckout.ts`, specials editor + calendar
-- `dashboard/specials|calendar/actions.ts`). But the default PUBLIC execute grant
-- left them callable directly over PostgREST:
--   * redeem_special        — any AUTHENTICATED user could loop it on a rival's
--     special to inflate redemptions_used and falsely mark it SOLD OUT, with no
--     booking (denial of availability / inventory griefing). Proven live via a
--     JWT-impersonated call.
--   * release_special       — any authenticated user could decrement the count,
--     enabling oversell beyond `quantity`.
--   * block_special_dates   — any authenticated user could block arbitrary
--     property dates (calendar DoS).
--   * release_special_dates — was executable by ANON (unauthenticated) — anyone
--     could unblock a special's held dates, enabling double-booking.
--
-- Fix: revoke the broad grant (PUBLIC + the anon/authenticated roles explicitly,
-- since `CREATE FUNCTION` grants EXECUTE to PUBLIC and a plain `REVOKE ... FROM
-- anon` is a no-op) and grant execute to service_role only. Zero functional
-- impact: every legitimate caller already uses the service-role client.

REVOKE EXECUTE ON FUNCTION public.redeem_special(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_special(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_special(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_special(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.block_special_dates(uuid, uuid, uuid, date, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_special_dates(uuid, uuid, uuid, date, date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_special_dates(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_special_dates(uuid) TO service_role;
