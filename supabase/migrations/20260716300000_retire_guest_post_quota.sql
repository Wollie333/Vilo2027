-- =============================================================================
-- Retire the guest post quota, which has been RAISING ON EVERY CALL since
-- 20260716200000 shipped.
--
-- WHAT HAPPENED. `..200000` retired `looking_for_quotas`, and its own comment
-- explains why it believed that was safe:
--
--   "Admin-editable since 20260628100000 and read by NOTHING — an admin could
--    set 'Pro = 50 quotes/month' and it did nothing."
--
-- That was FALSE. The table was read — not by app code, but by a DB FUNCTION:
-- check_guest_post_quota selects from it twice. The author checked TypeScript,
-- found no readers, and dropped the table. PL/pgSQL binds table names late, so
-- the DROP succeeded and left the function raising 42P01 at runtime:
--
--   ERROR: 42P01: relation "looking_for_quotas" does not exist
--   CONTEXT: PL/pgSQL function check_guest_post_quota(uuid) line 24
--
-- WHY NOBODY NOTICED: all three call sites failed OPEN — `console.error(...)`
-- + "// Continue anyway". A hard error on every guest post looked like nothing.
-- Consequences: the cap was unenforced, the "X requests left" hint silently
-- vanished, and because record_guest_post_and_check calls the quota BEFORE its
-- insert, `looking_for_usage` stopped recording guest_post rows entirely.
--
-- WHY UNCAPPED RATHER THAN RESTORED. There is no per-guest limit source left to
-- point at, and inventing one would be inventing product policy:
--   * Guests have no subscription or product. `lib/guests/permissions.ts` is
--     explicit — guest capabilities are GLOBAL booleans with no limit concept.
--   * `looking_for_quotas` keyed limits by `plan_id`, but every guest is on the
--     product-less `free` baseline, so it was only ever one global number.
--   * CLAUDE.md's pre-MVP policy requires every feature be OPEN on `free` so the
--     founder can smoke-test — a restored cap would have to be unlimited anyway.
-- So guest posting is uncapped for MVP **deliberately and visibly**, instead of
-- uncapped by accident behind a function that throws. When a cap is wanted, add
-- a `plan_features` key and gate via `check_feature_permission` (the mandated
-- SSOT), rather than reviving a second parallel limits table.
--
-- `looking_for_usage` STAYS — it is an append-only action log, not a limit, and
-- restoring its guest_post rows is the point of the replacement function below.
-- =============================================================================

DROP FUNCTION IF EXISTS public.check_guest_post_quota(uuid);

-- record_guest_post_and_check existed to serialise a check+record under an
-- advisory lock so two concurrent posts couldn't both claim the last slot. With
-- no cap there is no slot to race for, so the lock goes too — and the name stops
-- lying about checking anything.
DROP FUNCTION IF EXISTS public.record_guest_post_and_check(uuid, uuid);

CREATE OR REPLACE FUNCTION public.record_guest_post(
  p_user_id uuid,
  p_post_id uuid
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.looking_for_usage (user_id, action, post_id)
  VALUES (p_user_id, 'guest_post', p_post_id);
$$;

REVOKE ALL ON FUNCTION public.record_guest_post(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_guest_post(uuid, uuid) TO authenticated;
