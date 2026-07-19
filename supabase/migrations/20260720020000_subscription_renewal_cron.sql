-- Recurring billing — Phase 1: schedule the Paystack renewal worker.
--
-- Daily at 06:00 UTC, ping /api/subscription-renewal-worker, which re-charges the
-- saved card authorization for every subscription whose period is due (hybrid
-- Paystack rail). Vault-gated + fail-soft, exactly like the other worker crons.
-- Skips the round-trip entirely when the rail is OFF or nothing is due, so it is
-- safe to schedule NOW, before go-live (the worker itself also re-checks the gate).
--
-- Worker URL lives in Vault as 'subscription_renewal_worker_url'; the bearer
-- reuses the shared 'email_worker_secret'. Create once per env (SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://wielo.co.za/api/subscription-renewal-worker',
--     'subscription_renewal_worker_url', '');
--
-- Missing secret → the tick is a fail-soft no-op (NOTICE logged).

SELECT cron.unschedule('renew-subscriptions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'renew-subscriptions');

SELECT cron.schedule('renew-subscriptions', '0 6 * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
    v_on      boolean;
    v_due     int;
  BEGIN
    -- Kill switch: don't even ping the worker while the rail is OFF.
    SELECT paystack_recurring_enabled INTO v_on
    FROM public.platform_payment_settings WHERE id = true LIMIT 1;
    IF v_on IS NOT TRUE THEN RETURN; END IF;

    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'subscription_renewal_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'renew-subscriptions: vault subscription_renewal_worker_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    -- Skip the round-trip when nothing is due: a live-billing sub with a saved
    -- card, not scheduled to cancel, backed by a product, within a day of lapsing.
    SELECT COUNT(*) INTO v_due
    FROM public.subscriptions s
    WHERE s.status IN ('active','past_due')
      AND s.cancel_at_period_end = false
      AND s.paystack_authorization_code_cipher IS NOT NULL
      AND s.product_id IS NOT NULL
      AND s.current_period_end <= now() + interval '1 day';

    IF v_due = 0 THEN RETURN; END IF;

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
