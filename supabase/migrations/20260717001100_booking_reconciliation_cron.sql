-- Host-Paystack payment reconciliation + a safety fix for the expiry cron.
--
-- A guest paying on the HOST's own Paystack settles only when they return to the
-- success page (AGENT_RULES §4.8 — the platform webhook can't see host-account
-- charges). Close the tab and the money is captured but the booking stays
-- 'pending'. Two problems followed: (1) the booking never confirms, and (2) the
-- expire-pending-bookings cron would then CANCEL that paid booking after 30 min.
--
-- Fixes both:
--   1. reconcile-host-card-payments (new, every 5 min) POSTs a worker that
--      re-verifies each recent pending card payment against the host's key and
--      settles the paid ones through the ledger (/api/booking-reconcile-worker).
--      Vault-gated + fail-soft, exactly like the queue-drain crons.
--   2. expire-pending-bookings now SKIPS any booking that already has a captured
--      (completed / partially_refunded / refunded) payment, so a paid-but-
--      unconfirmed booking can never be expired out from under the guest.
--
-- Worker URL lives in Vault as 'booking_reconcile_worker_url'; the bearer reuses
-- the shared 'email_worker_secret'. Create once per env (SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/booking-reconcile-worker',
--     'booking_reconcile_worker_url', '');
--
-- Missing secret → the cron tick is a fail-soft no-op (NOTICE logged).

-- ─── 1. reconcile-host-card-payments (every 5 minutes) ────────────────────
SELECT cron.unschedule('reconcile-host-card-payments')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-host-card-payments');

SELECT cron.schedule('reconcile-host-card-payments', '*/5 * * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
    v_pending int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'booking_reconcile_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'reconcile-host-card-payments: vault booking_reconcile_worker_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    -- Skip the round-trip when nothing is waiting: a pending card booking in the
    -- reconciliation window that carries a verifiable pending payment.
    SELECT COUNT(*) INTO v_pending
    FROM public.bookings b
    WHERE b.status = 'pending'
      AND b.payment_method = 'paystack'
      AND b.created_at < now() - interval '3 minutes'
      AND b.created_at > now() - interval '24 hours'
      AND EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.booking_id = b.id
          AND p.status = 'pending'
          AND p.method = 'paystack'
          AND p.provider_reference IS NOT NULL
      );

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

-- ─── 2. expire-pending-bookings — never expire a paid booking ─────────────
SELECT cron.unschedule('expire-pending-bookings')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-pending-bookings');

SELECT cron.schedule('expire-pending-bookings', '*/5 * * * *', $cron$
  UPDATE bookings b
     SET status = 'expired', cancelled_by = 'system'
   WHERE b.status = 'pending'
     AND b.payment_method IN ('paystack','paypal')
     AND b.created_at < now() - interval '30 minutes'
     AND NOT EXISTS (
       SELECT 1 FROM payments p
       WHERE p.booking_id = b.id
         AND p.voided_at IS NULL
         AND p.status IN ('completed','partially_refunded','refunded')
     );
$cron$);
