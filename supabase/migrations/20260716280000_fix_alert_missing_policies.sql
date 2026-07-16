-- Build `alert-missing-policies` properly, rather than leave it failing.
--
-- Three separate problems, all of which had to be fixed together or the job
-- would have gone from "visibly broken" to "invisibly wrong":
--
-- 1. RENAMED TABLES. It still read `listings` / `listing_policies` /
--    `lp.listing_id`, so it has failed daily since 20260617000200 renamed them
--    (see 20260716270000 — same root cause: cron.job.command is TEXT and a
--    rename cannot reach it).
--
-- 2. NO EMAIL TEMPLATE. It INSERTs straight into `notification_queue` — which,
--    despite the name, IS the email queue (drained by drain-email-queue via
--    lib/email/drain.ts). A direct insert bypasses dispatchEvent, so the drain
--    looks the type up in EMAIL_REGISTRY and, finding nothing, marks the row
--    `no_template:listing_missing_policy` and dead-letters it. The kind existed
--    NOWHERE in apps/web. Repointing the SQL alone would therefore have queued
--    rows that silently die — exactly what the still-failed affiliate_* rows
--    from 07-11 look like. The template, EMAIL_REGISTRY entry and resolver ship
--    with this migration.
--
-- 3. NO DEDUPE — the real trap. `shouldSkipEmail` lives in dispatchEvent, and
--    the drain does NOT look at dedupe_key. A direct insert is therefore not
--    deduped by anything. Fixed as-was, this job would have emailed every host
--    EVERY DAY AT 10:00, per property, forever, until they added a policy. So it
--    now self-throttles to at most one per property per 7 days.
--
-- Why the alert is worth having at all: a published property with no
-- cancellation policy has nothing for the booking's policy_snapshot to freeze,
-- so the refund engine falls back to 0% — the guest is told they get nothing
-- back and the host inherits the argument. That is a real defect, not tidiness.

SELECT cron.unschedule('alert-missing-policies')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'alert-missing-policies');

SELECT cron.schedule('alert-missing-policies', '0 10 * * *', $cron$
  INSERT INTO notification_queue (host_id, type, payload, dedupe_key)
  SELECT DISTINCT
    p.host_id,
    'listing_missing_policy',
    jsonb_build_object(
      'listing_id',   p.id,
      'listing_name', p.name,
      'missing_type', 'cancellation'
    ),
    'missing_policy:' || p.id
  FROM properties p
  WHERE p.is_published = true
    AND p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM property_policies pp
      WHERE pp.property_id = p.id
        AND pp.policy_type = 'cancellation'
    )
    -- Self-throttle: at most one nudge per property per week. The drain ignores
    -- dedupe_key, so this predicate IS the dedupe. Without it this is a daily
    -- nag machine.
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue nq
      WHERE nq.dedupe_key = 'missing_policy:' || p.id
        AND nq.created_at > now() - interval '7 days'
    );
$cron$);

-- The payload stays snake_case and thin (ids only + a label): the resolver
-- (lib/email/resolvers/misc.ts → listingMissingPolicyResolver) re-reads the
-- property at send time and re-checks that the policy is STILL missing, so a
-- host who fixes it between the 10:00 queue and the drain is not emailed at all.
