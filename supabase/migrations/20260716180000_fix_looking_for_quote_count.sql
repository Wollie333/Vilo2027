-- =============================================================================
-- Fix looking_for_posts.quote_count drifting permanently high.
--
-- The original trigger (20260628100000) only ever INCREMENTED:
--
--   AFTER INSERT ON looking_for_responses -> quote_count = quote_count + 1
--
-- There was no DELETE handling, but looking_for_responses cascades from BOTH
-- looking_for_posts AND hosts (`host_id ... ON DELETE CASCADE`). So deleting or
-- purging a host silently removes their responses while every post they quoted
-- keeps counting them — the counter can only ever climb. Found live: a post
-- showing quote_count = 3 with exactly 1 real response.
--
-- That number is not cosmetic. It is read on the public board and public post
-- page ("N quotes"), the host browse board + RequestCard, the admin posts list,
-- the guest portal list, and the saved-search digest worker — and the host board
-- FILTERS on it (`.eq("quote_count", 0)` = "no quotes yet"), so an inflated
-- count also hides a post from the hosts most likely to quote it.
--
-- Fix: recompute instead of delta. A +1/-1 counter drifts the moment any path
-- misses; a recompute is idempotent and self-healing — replay it, cascade rows
-- away, do anything at all, and the value still converges on the truth.
-- `UNIQUE(post_id, host_id)` means one response per host, so COUNT(*) over
-- looking_for_responses IS the quote count by definition.
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_looking_for_quote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_post UUID;
BEGIN
  -- NEW is unassigned on DELETE (and OLD on INSERT), so branch on TG_OP rather
  -- than COALESCE(NEW.post_id, OLD.post_id) — that would raise at runtime.
  IF TG_OP = 'DELETE' THEN
    target_post := OLD.post_id;
  ELSE
    target_post := NEW.post_id;
  END IF;

  UPDATE looking_for_posts p
  SET quote_count = (
    SELECT COUNT(*) FROM looking_for_responses r WHERE r.post_id = target_post
  )
  WHERE p.id = target_post;

  -- A response moved between posts: the post it left needs recounting too.
  IF TG_OP = 'UPDATE' AND OLD.post_id IS DISTINCT FROM NEW.post_id THEN
    UPDATE looking_for_posts p
    SET quote_count = (
      SELECT COUNT(*) FROM looking_for_responses r WHERE r.post_id = OLD.post_id
    )
    WHERE p.id = OLD.post_id;
  END IF;

  RETURN NULL;  -- AFTER trigger: return value is ignored.
END;
$$;

DROP TRIGGER IF EXISTS looking_for_responses_increment_count ON looking_for_responses;
DROP FUNCTION IF EXISTS increment_looking_for_quote_count();

CREATE TRIGGER looking_for_responses_sync_count
  AFTER INSERT OR DELETE OR UPDATE OF post_id ON looking_for_responses
  FOR EACH ROW EXECUTE FUNCTION sync_looking_for_quote_count();

-- -----------------------------------------------------------------------------
-- Reconcile every post already drifted by the old trigger.
--
-- looking_for_posts has a BEFORE UPDATE trigger stamping updated_at, and the
-- record timeline reads updated_at as the "fulfilled"/"cancelled" event time —
-- so a blind backfill would rewrite history on already-fulfilled posts. Suppress
-- the stamp for the duration of the backfill only.
-- -----------------------------------------------------------------------------

ALTER TABLE looking_for_posts DISABLE TRIGGER looking_for_posts_updated_at;

UPDATE looking_for_posts p
SET quote_count = actual.n
FROM (
  SELECT p2.id, (
    SELECT COUNT(*) FROM looking_for_responses r WHERE r.post_id = p2.id
  ) AS n
  FROM looking_for_posts p2
) AS actual
WHERE p.id = actual.id
  AND p.quote_count IS DISTINCT FROM actual.n;

ALTER TABLE looking_for_posts ENABLE TRIGGER looking_for_posts_updated_at;
