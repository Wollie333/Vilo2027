-- Recurring billing — Phase 4: schedule the subscription reconcile worker.
--
-- Hourly (minute 20), ping /api/subscription-reconcile-worker, which repairs
-- missed-webhook / crashed-worker drift on BOTH recurring rails:
--   * Paystack: settle stuck `renew_…` claims (charged but never extended).
--   * PayPal: cross-check provider state (extend on a missed renewal, end on a
--     provider cancel/expire).
-- Each rail is gated by its own recurring flag inside the worker + fully
-- idempotent, so this is safe to schedule NOW, before go-live (a no-op until a
-- rail is armed and there is actual drift to repair).
--
-- Worker URL lives in Vault as 'subscription_reconcile_worker_url'; the bearer
-- reuses the shared 'email_worker_secret'. Create once per env (SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://wielo.co.za/api/subscription-reconcile-worker',
--     'subscription_reconcile_worker_url', '');
--
-- Missing secret → the tick is a fail-soft no-op (NOTICE logged).

SELECT cron.unschedule('reconcile-subscriptions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-subscriptions');

SELECT cron.schedule('reconcile-subscriptions', '20 * * * *', $cron$
  DO $body$
  DECLARE
    v_url          text;
    v_secret       text;
    v_paystack_on  boolean;
    v_paypal_on    boolean;
    v_due          int := 0;
  BEGIN
    -- Kill switch: don't ping the worker unless at least one rail is armed.
    SELECT paystack_recurring_enabled, paypal_recurring_enabled
      INTO v_paystack_on, v_paypal_on
    FROM public.platform_payment_settings WHERE id = true LIMIT 1;
    IF v_paystack_on IS NOT TRUE AND v_paypal_on IS NOT TRUE THEN
      RETURN;
    END IF;

    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'subscription_reconcile_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'reconcile-subscriptions: vault subscription_reconcile_worker_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    -- Skip the round-trip when there is nothing to reconcile: stuck Paystack
    -- renewal claims (pending > 15 min) OR live PayPal subs at/past due.
    IF v_paystack_on IS TRUE THEN
      SELECT v_due + COUNT(*) INTO v_due
      FROM public.platform_ledger l
      WHERE l.provider = 'paystack'
        AND l.type = 'charge'
        AND l.status = 'pending'
        AND l.subscription_id IS NOT NULL
        AND l.provider_reference LIKE 'renew\_%'
        AND l.created_at < now() - interval '15 minutes';
    END IF;

    IF v_paypal_on IS TRUE THEN
      SELECT v_due + COUNT(*) INTO v_due
      FROM public.subscriptions s
      WHERE s.status IN ('active','past_due')
        AND s.paypal_subscription_id IS NOT NULL
        AND s.current_period_end <= now() + interval '1 day';
    END IF;

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
