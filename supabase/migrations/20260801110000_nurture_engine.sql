-- Funnel Manager — Phase 4: nurture drip engine.
--
-- Seeds the host nurture sequence's steps, activates it, and schedules the
-- per-minute drain-nurture cron that pings /api/nurture-worker when enrolments
-- are due. Mirrors the review-request cron (20260610000002) exactly.
--
-- Worker URL lives in Vault as 'nurture_worker_url'; the bearer REUSES the
-- shared 'email_worker_secret' entry (same one the review/notification workers
-- use). Create once per env in the SQL Editor:
--
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/nurture-worker',
--     'nurture_worker_url', '');
--
-- Missing secrets → the cron tick is a fail-soft no-op (NOTICE logged), so this
-- migration is safe to apply before the secret exists.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   SELECT cron.unschedule('drain-nurture');
--   DELETE FROM nurture_steps WHERE sequence_id IN
--     (SELECT id FROM nurture_sequences WHERE audience='host');
--   UPDATE nurture_sequences SET is_active=false WHERE audience='host';

-- ─── 1. Seed the host sequence steps ──────────────────────────────────
-- delay_hours is measured from the previous step (step 1 = from enrolment).
INSERT INTO public.nurture_steps (sequence_id, step_order, delay_hours, email_type, subject_override)
SELECT s.id, v.step_order, v.delay_hours, v.email_type, v.subject_override
FROM public.nurture_sequences s
CROSS JOIN (VALUES
  (1, 0,   'nurture_host_welcome', 'Your Direct Booking Starter Kit — start here'),
  (2, 48,  'nurture_host_value',   'What direct booking actually saves you'),
  (3, 120, 'nurture_host_offer',   'Ready to take bookings on Wielo?')
) AS v(step_order, delay_hours, email_type, subject_override)
WHERE s.audience = 'host'
ON CONFLICT (sequence_id, step_order) DO NOTHING;

-- ─── 2. Activate the host sequence now that it has steps ───────────────
-- (The funnel submit only enrols a consenting lead when the sequence is active
-- AND has active steps — see lib/funnels/submit.ts.)
UPDATE public.nurture_sequences SET is_active = true WHERE audience = 'host';

-- ─── 3. drain-nurture cron (every minute) ─────────────────────────────
SELECT cron.unschedule('drain-nurture')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-nurture');

SELECT cron.schedule('drain-nurture', '* * * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
    v_pending int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'nurture_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-nurture: vault nurture_worker_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    SELECT COUNT(*) INTO v_pending
    FROM public.nurture_enrollments
    WHERE status = 'active' AND next_send_at IS NOT NULL AND next_send_at <= now();

    IF v_pending = 0 THEN RETURN; END IF;

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_secret,
        'Content-Type',  'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  END;
  $body$;
$cron$);
