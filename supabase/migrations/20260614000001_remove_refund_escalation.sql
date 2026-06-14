-- Migration: remove refund escalation.
--
-- Vilo never holds or routes funds — bookings and refunds are settled directly
-- between host and guest (host's own Paystack / EFT). A platform "escalation /
-- admin adjudication" step is therefore meaningless: there is nothing for Vilo
-- to adjudicate or pay out. This retires the escalation machinery.
--
-- What this does:
--   1. Stops the daily auto-escalation cron.
--   2. Parks any 'escalated' rows back to 'pending' (pre-MVP there are none).
--   3. Drops the escalated-only partial index.
--   4. Removes 'escalated' from the refund_requests.status domain.
--
-- Left in place as inert orphans (never written again): escalated_at,
-- escalation_note, admin_decision, admin_actioned_by, admin_note,
-- admin_actioned_at. Dropping them would cascade into the refund-stats function
-- and the status-history trigger for no pre-MVP benefit; revisit in a dedicated
-- schema-tidy migration if desired.

-- 1. Stop the daily auto-escalation job (guarded — no error if it isn't scheduled).
SELECT cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'auto-escalate-refunds';

-- 2. Park any rows that reached 'escalated' so the tightened constraint applies.
UPDATE refund_requests SET status = 'pending' WHERE status = 'escalated';

-- 3. Drop the escalated-only partial index.
DROP INDEX IF EXISTS idx_refund_req_escalated;

-- 4. Retire 'escalated' from the status domain. 'disputed' is a distinct value
--    and is left intact.
ALTER TABLE refund_requests DROP CONSTRAINT IF EXISTS refund_requests_status_check;
ALTER TABLE refund_requests ADD CONSTRAINT refund_requests_status_check
  CHECK (status IN (
    'pending','approved','declined','processing',
    'completed','failed','disputed','cancelled'
  ));
