-- Migration: Atomic claim for the email + push drains (anti double-send).
--
-- The per-minute email/push workers previously did read-then-send:
--   SELECT rows WHERE sent_at IS NULL AND failed_at IS NULL   (drain.ts / push-queue.ts)
--   ... send ...
--   UPDATE sent_at = now()
-- A drain run can exceed its 60s budget (50 emails through Resend), so the
-- next cron tick starts while the first is still sending. Both ticks SELECT
-- the same unsent rows → the guest gets the SAME email/push twice.
--
-- Fix: claim rows atomically before doing any sending. Each worker calls a
-- SECURITY DEFINER function that stamps `claimed_at` on a batch using
-- FOR UPDATE SKIP LOCKED, so two concurrent ticks get DISJOINT row sets and a
-- row is only ever handed to one worker. A crashed worker's claim goes stale
-- after p_stale_seconds and is reclaimed on a later tick (no stranded rows).
--
-- Additive only (new nullable column + two functions) — safe per pre-MVP
-- policy. markSent/markFailed are unchanged: they still set sent_at/failed_at,
-- which removes the row from the claimable set permanently.

-- ─── claim columns ────────────────────────────────────────────────────────
ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.pending_push_queue
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- ─── claim_email_queue_batch ────────────────────────────────────────────────
-- Atomically claims up to p_limit unsent/unfailed rows (and reclaims rows
-- whose claim is older than p_stale_seconds), stamping claimed_at and
-- returning the claimed rows for the worker to send.
CREATE OR REPLACE FUNCTION public.claim_email_queue_batch(
  p_limit         int,
  p_stale_seconds int DEFAULT 300
)
RETURNS SETOF public.notification_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notification_queue q
  SET claimed_at = now()
  FROM (
    SELECT id
    FROM public.notification_queue
    WHERE sent_at IS NULL
      AND failed_at IS NULL
      AND (claimed_at IS NULL
           OR claimed_at < now() - make_interval(secs => p_stale_seconds))
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) AS picked
  WHERE q.id = picked.id
  RETURNING q.*;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_email_queue_batch(int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_email_queue_batch(int, int) TO service_role;

-- ─── claim_push_queue_batch ─────────────────────────────────────────────────
-- Same claim, plus the push queue's release_at gate (quiet-hours deferral).
CREATE OR REPLACE FUNCTION public.claim_push_queue_batch(
  p_limit         int,
  p_stale_seconds int DEFAULT 300
)
RETURNS SETOF public.pending_push_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.pending_push_queue q
  SET claimed_at = now()
  FROM (
    SELECT id
    FROM public.pending_push_queue
    WHERE sent_at IS NULL
      AND failed_at IS NULL
      AND release_at <= now()
      AND (claimed_at IS NULL
           OR claimed_at < now() - make_interval(secs => p_stale_seconds))
    ORDER BY release_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) AS picked
  WHERE q.id = picked.id
  RETURNING q.*;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_push_queue_batch(int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_push_queue_batch(int, int) TO service_role;
