-- The reconcile worker now handles BOTH host-Paystack and host-PayPal payments
-- (PayPal has no webhook either, so a captured-but-unflipped order would be
-- cancelled by the expire cron → captured-money loss). But the cron only pinged
-- the worker when a pending PAYSTACK booking was waiting, so a PayPal-only
-- backlog never triggered reconciliation. Widen the ping-gate count to include
-- payment_method / method = 'paypal'. Everything else in the cron is unchanged.

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

    -- Skip the round-trip when nothing is waiting: a pending Paystack OR PayPal
    -- booking in the reconciliation window carrying a verifiable pending payment.
    SELECT COUNT(*) INTO v_pending
    FROM public.bookings b
    WHERE b.status = 'pending'
      AND b.payment_method IN ('paystack','paypal')
      AND b.created_at < now() - interval '3 minutes'
      AND b.created_at > now() - interval '24 hours'
      AND EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.booking_id = b.id
          AND p.status = 'pending'
          AND p.method IN ('paystack','paypal')
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
