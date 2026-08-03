-- Help centre: real article bookmarks + public-honesty seed cleanup.
--
-- WHY
--   1. `help_articles.saved_count` shipped as a column but was never written or
--      read: dead. The public lists even rendered `view_count` under a "bookmark"
--      glyph, so the number a reader reads as "saves" was actually views. We are
--      building a REAL save feature, so saved_count must reflect real rows.
--   2. The public /help page shopfront rendered fabricated seed data as if live
--      (a "degraded 14 Nov" incident, fake community forum threads, a wrong
--      support email). The public UI now hides those sections until they're real;
--      this scrubs the dormant seed so nothing misleading survives in the DB.
--
-- saved_count is kept in step by a SECURITY DEFINER trigger for the SAME reason
-- the feedback-counter trigger is DEFINER (see 20260722163751): the saver may
-- INSERT their own help_article_saves row (RLS: user_id = auth.uid()) but has NO
-- update policy on help_articles, so an INVOKER trigger's UPDATE would silently
-- match zero rows. search_path is pinned so the definer body can't be redirected.

-- 1. Bookmarks table --------------------------------------------------------

CREATE TABLE public.help_article_saves (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid        NOT NULL REFERENCES help_articles(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_save_per_user UNIQUE (article_id, user_id)
);
CREATE INDEX idx_help_article_saves_article ON help_article_saves(article_id);
CREATE INDEX idx_help_article_saves_user    ON help_article_saves(user_id, created_at DESC);
ALTER TABLE help_article_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_help_saves_read" ON help_article_saves FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "user_own_help_saves_write" ON help_article_saves FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_own_help_saves_delete" ON help_article_saves FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY "admin_full_help_saves" ON help_article_saves FOR ALL
  USING (is_super_admin() OR has_admin_permission('help.manage'));

-- 2. saved_count sync trigger (SECURITY DEFINER — see header) ----------------

CREATE OR REPLACE FUNCTION sync_help_article_saved_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE help_articles SET saved_count = saved_count + 1 WHERE id = NEW.article_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE help_articles SET saved_count = GREATEST(0, saved_count - 1) WHERE id = OLD.article_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION sync_help_article_saved_count IS
  'Keeps help_articles.saved_count in step with help_article_saves. SECURITY DEFINER because the saver has no update rights on help_articles — as INVOKER the update silently matched zero rows (the view_count class of bug).';

CREATE TRIGGER tr_help_article_saved_count
  AFTER INSERT OR DELETE ON help_article_saves
  FOR EACH ROW EXECUTE FUNCTION sync_help_article_saved_count();

-- 3. Public-honesty seed cleanup --------------------------------------------
-- The public page no longer renders these; scrub the dormant fake data so the
-- DB itself is honest and the admin editors don't show stale placeholders.

-- Correct support email; the seed pointed at a stale viloplatform.com address.
-- Nothing on the public page currently claims live chat / callbacks, so leave
-- those off until they're real.
UPDATE help_settings
   SET value = jsonb_build_object(
     'live_chat_online', false,
     'callback_enabled', false,
     'support_email', 'support@wielo.co.za',
     'median_response_minutes', 0,
     'community_member_count', 0
   )
 WHERE key = 'contact';

-- No community forum exists; drop the fabricated threads.
UPDATE help_settings SET value = '[]'::jsonb WHERE key = 'community';

-- No real monitoring feeds these; clear the fake "degraded 14 Nov" incident so
-- nothing reads as a live outage.
UPDATE help_status_components
   SET status = 'normal',
       note   = NULL
 WHERE status <> 'normal';
