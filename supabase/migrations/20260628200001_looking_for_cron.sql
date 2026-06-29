-- Migration: Looking For cron jobs
--
-- Sets up scheduled jobs for:
-- 1. Auto-expiring posts when expires_at passes
-- 2. Sending expiring notifications (3 days, 1 day before)
-- 3. Batched notifications to hosts about new posts in their region (daily digest)
--
-- Requires pg_cron extension (enabled by default in Supabase).

-- =========================================================================
-- 1. AUTO-EXPIRE POSTS
-- Runs every hour, marks posts as 'expired' when expires_at < now()
-- =========================================================================

SELECT cron.schedule(
  'looking_for_auto_expire',
  '0 * * * *',  -- Every hour at minute 0
  $$
    UPDATE public.looking_for_posts
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now();
  $$
);

-- =========================================================================
-- 2. EXPIRING SOON QUEUE
-- Runs daily at 10:00 UTC, queues notifications for posts expiring in 3 days and 1 day
-- =========================================================================

-- Create a table to track expiry notifications sent (to avoid duplicates)
CREATE TABLE IF NOT EXISTS public.looking_for_expiry_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  days_before INT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, days_before)
);

CREATE INDEX IF NOT EXISTS idx_lf_expiry_post ON public.looking_for_expiry_notifications(post_id);

-- RLS: only system can write
ALTER TABLE public.looking_for_expiry_notifications ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON public.looking_for_expiry_notifications
  FOR ALL USING (auth.role() = 'service_role');

-- Schedule the expiry notification check
-- This inserts into pending_push_queue and in_app_notifications
-- The actual push drain worker handles delivery
SELECT cron.schedule(
  'looking_for_expiry_notify',
  '0 10 * * *',  -- Daily at 10:00 UTC
  $$
    -- Insert records for 3-day warning (only if not already sent)
    INSERT INTO public.looking_for_expiry_notifications (post_id, days_before)
    SELECT id, 3
    FROM public.looking_for_posts
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at > now()
      AND expires_at <= now() + interval '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.looking_for_expiry_notifications
        WHERE post_id = looking_for_posts.id AND days_before = 3
      )
    ON CONFLICT DO NOTHING;

    -- Insert records for 1-day warning
    INSERT INTO public.looking_for_expiry_notifications (post_id, days_before)
    SELECT id, 1
    FROM public.looking_for_posts
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at > now()
      AND expires_at <= now() + interval '1 day'
      AND NOT EXISTS (
        SELECT 1 FROM public.looking_for_expiry_notifications
        WHERE post_id = looking_for_posts.id AND days_before = 1
      )
    ON CONFLICT DO NOTHING;
  $$
);

-- =========================================================================
-- 3. NEW POST DIGEST FOR HOSTS
-- Runs daily at 09:00 UTC, aggregates new posts per region and notifies hosts
-- This is a lightweight implementation; the actual notification dispatch
-- happens via an Edge Function or API route that reads from this queue
-- =========================================================================

-- Create a table to queue regional digests
CREATE TABLE IF NOT EXISTS public.looking_for_region_digest_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  post_count INT NOT NULL DEFAULT 0,
  sample_post_ids UUID[] NOT NULL DEFAULT '{}',
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lf_digest_region ON public.looking_for_region_digest_queue(region);
CREATE INDEX IF NOT EXISTS idx_lf_digest_processed ON public.looking_for_region_digest_queue(processed_at) WHERE processed_at IS NULL;

ALTER TABLE public.looking_for_region_digest_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.looking_for_region_digest_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Schedule daily digest queue population
SELECT cron.schedule(
  'looking_for_region_digest',
  '0 9 * * *',  -- Daily at 09:00 UTC
  $$
    -- Queue new posts per region from the last 24 hours
    INSERT INTO public.looking_for_region_digest_queue (region, post_count, sample_post_ids)
    SELECT
      location_region,
      COUNT(*),
      ARRAY_AGG(id ORDER BY created_at DESC)[:5]  -- First 5 as sample
    FROM public.looking_for_posts
    WHERE status = 'active'
      AND is_public = true
      AND location_region IS NOT NULL
      AND created_at > now() - interval '24 hours'
    GROUP BY location_region
    HAVING COUNT(*) > 0;
  $$
);

-- =========================================================================
-- COMMENTS
-- =========================================================================

COMMENT ON TABLE public.looking_for_expiry_notifications IS
  'Tracks expiry warning notifications sent to prevent duplicates';

COMMENT ON TABLE public.looking_for_region_digest_queue IS
  'Queues regional post digests for host notification. Drained by the digest worker.';
