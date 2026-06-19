-- Migration: Scheduled blog post publish cron (Phase 8).
--
-- Pings /api/blog-publish every 5 minutes; the worker finds any
-- website_blog_posts with status='scheduled' AND publish_at <= now()
-- and flips them to status='published'. Blog posts render LIVE (not from
-- the publish snapshot), so flipping status makes them appear immediately.
--
-- Worker URL lives in Vault as 'blog_publish_url'; the bearer reuses the
-- shared 'email_worker_secret' entry. Create the URL secret ONCE per env
-- (Dashboard → SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/blog-publish',
--     'blog_publish_url', 'Scheduled blog post publish worker URL');
--
-- Missing secrets or no scheduled posts → the tick is a fail-soft no-op.

SELECT cron.unschedule('publish-scheduled-posts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'publish-scheduled-posts');

SELECT cron.schedule('publish-scheduled-posts', '*/5 * * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
    v_pending int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'blog_publish_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'publish-scheduled-posts: vault blog_publish_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    SELECT COUNT(*) INTO v_pending
    FROM public.website_blog_posts
    WHERE status = 'scheduled'
      AND publish_at <= NOW()
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
