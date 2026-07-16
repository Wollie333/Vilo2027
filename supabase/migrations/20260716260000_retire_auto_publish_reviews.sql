-- Retire `auto-publish-reviews` and correct the column contract it came from.
--
-- It is a leftover of the abandoned 48-hour moderation window: reviews used to
-- insert unpublished with `publish_at = now() + 48h`, and this cron published
-- them once the window elapsed and nobody had flagged them. Since
-- 20260610000001 a submission publishes immediately
-- (submitReviewAction: is_published = true, publish_at = now), so the cron's
--
--     WHERE is_published = false AND flagged = false AND publish_at <= now()
--
-- matches nothing on the happy path. Verified: nothing in apps/web writes
-- reviews.publish_at to a future time, and the only writer of is_published =
-- false is hideReviewAction — which also sets flagged = true, so the cron's own
-- `flagged = false` filter skips it.
--
-- So it is harmless today ONLY by coincidence: it depends on admin hiding always
-- also flagging. That is incidental coupling, not design. Any future "unpublish
-- without flagging" — an admin correction, a takedown, a soft retraction — would
-- be **silently republished within 15 minutes**, with no audit trail and nothing
-- to point at. 20260716250000 makes that footgun live rather than theoretical:
-- it exempts no-JWT contexts, so pg_cron is explicitly allowed to flip
-- is_published even though hosts no longer can.
--
-- Dead code that can only ever misfire. Remove it.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-publish-reviews') THEN
    PERFORM cron.unschedule('auto-publish-reviews');
  END IF;
END;
$$;

-- The column comments still describe the 48-hour window and are actively
-- misleading: they claim a delay and an expiry that no longer exist.
COMMENT ON COLUMN public.reviews.publish_at IS
  'When the review became public. Stamped = now() at submission (submitReviewAction); reviews publish immediately. NOT a schedule: the 48-hour moderation window it was built for is gone, and the auto-publish-reviews cron that read it was retired in 20260716260000.';

COMMENT ON COLUMN public.reviews.is_published IS
  'Public visibility. Set true at submission. Only admin moderation (hideReviewAction / restoreReviewAction) changes it afterwards — since 20260716250000 a host session cannot, only super admins and trusted no-JWT contexts (service role, pg_cron).';

-- NOTE: the `is_published` DEFAULT false is deliberately left alone. Every insert
-- names the column explicitly, so the default is unreachable — and a default of
-- false is the safe way to be wrong if some future path ever forgets it.
