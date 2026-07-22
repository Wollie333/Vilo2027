-- help_articles feedback counters never moved for real users.
--
-- THE BUG (the `view_count` class, flagged by scripts/generate-schema-doc.mjs)
--   sync_help_article_feedback_counters is SECURITY INVOKER and UPDATEs a DIFFERENT
--   RLS table (help_articles). A guest may INSERT their own row into
--   help_article_feedback (user_own_help_feedback_write: user_id = auth.uid()), but
--   help_articles has NO update policy for ordinary users -- only
--   admin_full_help_articles (super-admin / help.manage) and a read-only
--   public_read_help_articles.
--
--   So the trigger's UPDATE matched ZERO rows. No error, no warning: the vote was
--   stored and the counter stayed put. Proven in a rolled-back transaction --
--   ordinary authenticated user votes 'up', helpful_count reads 0 afterwards.
--   Only an admin voting would ever have moved these numbers, which is why nobody
--   noticed: the people who could test it were the only people it worked for.
--
-- THE FIX
--   SECURITY DEFINER, so the counter update runs as the owner instead of the voter.
--   Safe here because the function takes nothing from the user: it writes only the
--   two counter columns, on the single row identified by NEW.article_id, and the
--   caller already had to satisfy help_article_feedback's own RLS to get this far.
--   search_path is pinned so the definer body cannot be redirected.
--
-- NOTE: the historical counts are lost -- the votes exist in help_article_feedback
-- but the counters were never incremented. They can be rebuilt at any time with:
--   UPDATE help_articles a SET
--     helpful_count     = (SELECT count(*) FROM help_article_feedback f WHERE f.article_id = a.id AND f.vote = 'up'),
--     not_helpful_count = (SELECT count(*) FROM help_article_feedback f WHERE f.article_id = a.id AND f.vote <> 'up');
-- Not run here: there are currently no published articles and no feedback rows, so
-- there is nothing to rebuild.

CREATE OR REPLACE FUNCTION sync_help_article_feedback_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote = 'up' THEN
      UPDATE help_articles SET helpful_count = helpful_count + 1 WHERE id = NEW.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = NEW.article_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.vote IS DISTINCT FROM NEW.vote THEN
    IF OLD.vote = 'up' THEN
      UPDATE help_articles SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = NEW.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = GREATEST(0, not_helpful_count - 1) WHERE id = NEW.article_id;
    END IF;
    IF NEW.vote = 'up' THEN
      UPDATE help_articles SET helpful_count = helpful_count + 1 WHERE id = NEW.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = NEW.article_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote = 'up' THEN
      UPDATE help_articles SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = OLD.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = GREATEST(0, not_helpful_count - 1) WHERE id = OLD.article_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION sync_help_article_feedback_counters IS
  'Keeps help_articles.helpful_count/not_helpful_count in step with help_article_feedback. SECURITY DEFINER because the voter has no update rights on help_articles — as INVOKER the update silently matched zero rows.';
