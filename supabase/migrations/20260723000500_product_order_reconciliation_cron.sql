-- Reconcile Wielo product / subscription orders that were paid but never settled.
--
-- A buyer paying for a Wielo product settles on the return to the pay page
-- (confirmProductOrderByReference — the PRIMARY path), with paystack-webhook as
-- an idempotent backstop. Close the tab AND miss the webhook, and the money is
-- captured while the order sits 'pending' forever: the host has paid and got
-- nothing, and nothing self-heals.
--
-- Bookings have had reconcile-host-card-payments for exactly this since
-- 20260717001100, and subscriptions have subscription-reconcile-worker, but
-- product_orders had NO reconciler at all — which made the webhook a single
-- point of failure for Wielo's own revenue. Found 2026-07-22 while proving the
-- webhook actually fires (it had never once fired; see 20260722234500).
--
-- Worker URL lives in Vault as 'product_order_reconcile_worker_url'; the bearer
-- reuses the shared 'email_worker_secret'. Missing either → the tick is a
-- fail-soft no-op with a NOTICE, exactly like the other queue-drain crons.
--
-- ⚠️ A Vault-gated cron dies SILENTLY at three layers: the Vault secret, the
-- Vercel env var (needs a REDEPLOY or the worker 401s), and the route being
-- deployed at all. Verify a tick landed via net._http_response, not by assuming.

-- Create the URL secret if it isn't there yet (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'product_order_reconcile_worker_url'
  ) THEN
    PERFORM vault.create_secret(
      'https://wielo.co.za/api/product-order-reconcile-worker',
      'product_order_reconcile_worker_url',
      'Worker URL for the reconcile-product-orders cron.'
    );
  END IF;
END $$;

SELECT cron.unschedule('reconcile-product-orders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-product-orders');

SELECT cron.schedule('reconcile-product-orders', '*/5 * * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
    v_pending int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'product_order_reconcile_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'reconcile-product-orders: vault product_order_reconcile_worker_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    -- Skip the round-trip when nothing is waiting. Mirrors the worker's own
    -- filter: a pending card order that actually reached Paystack (so there is
    -- a reference to verify) and is inside the reconciliation window.
    SELECT COUNT(*) INTO v_pending
    FROM public.product_orders o
    WHERE o.status = 'pending'
      AND o.method = 'paystack'
      AND o.provider_reference IS NOT NULL
      AND o.created_at < now() - interval '3 minutes'
      AND o.created_at > now() - interval '24 hours';

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
