-- Migration: Custom-domain poll cron (W13).
--
-- Pings /api/website-domain-poll every 2 minutes; the worker re-checks every
-- host_websites row with a custom_domain still pending/verifying against the
-- Vercel Domains API and flips it to active/error (the shared pollWebsiteDomain
-- SSOT), appending website_domain_events on each transition.
--
-- Worker URL lives in Vault as 'website_domain_poll_url'; the bearer reuses the
-- shared 'email_worker_secret' entry. Create the URL secret ONCE per env
-- (Dashboard → SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/website-domain-poll',
--     'website_domain_poll_url', 'Custom-domain poll worker URL');
--
-- Missing secrets, no pending domains, or the Vercel integration not yet wired
-- → the tick is a fail-soft no-op (NOTICE logged). The whole feature stays inert
-- until the founder sets VERCEL_TOKEN/VERCEL_PROJECT_ID — see WEBSITE_HOSTING.md.

SELECT cron.unschedule('poll-website-domains')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-website-domains');

SELECT cron.schedule('poll-website-domains', '*/2 * * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
    v_pending int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'website_domain_poll_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'poll-website-domains: vault website_domain_poll_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    SELECT COUNT(*) INTO v_pending
    FROM public.host_websites
    WHERE custom_domain IS NOT NULL
      AND domain_status IN ('pending','verifying')
      AND deleted_at IS NULL;

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
