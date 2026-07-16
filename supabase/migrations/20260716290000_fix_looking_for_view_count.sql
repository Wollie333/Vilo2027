-- =============================================================================
-- Fix looking_for_posts.view_count, which has never once counted a host view.
--
-- G3 of the spec defines the column: "Seen by X hosts" — incremented each time a
-- DISTINCT host loads the post detail view. That is why looking_for_post_views
-- exists with UNIQUE(post_id, host_id): one row per host per post, so nobody can
-- inflate a count by reloading. Three separate faults broke it end to end.
--
-- 1. THE COUNTING PIPELINE IS DEAD. Nothing inserts into looking_for_post_views.
--    `recordPostViewAction` was written for it and never called from anywhere —
--    the trigger below has therefore never fired in the life of the platform.
--    (docs/lifecycles/looking-for.md claimed the board called it. It did not.)
--
-- 2. THE ONLY LIVE WRITER WAS BACKWARDS. The public post page did a read-modify-
--    write (`update({view_count: post.view_count + 1})`) on every load. That is a
--    lost-update race, but RLS made it something worse: looking_for_posts' UPDATE
--    policy is `guest_id = auth.uid()`, so the write silently matched ZERO rows
--    for every visitor and every host — and succeeded only for the post's OWN
--    guest. "Seen by X hosts" was, in practice, "times the guest reloaded their
--    own post". Exactly inverted.
--
-- 3. THE TRIGGER COULD ONLY EVER CLIMB. `AFTER INSERT -> view_count + 1` with no
--    DELETE path, while looking_for_post_views cascades from BOTH looking_for_posts
--    AND hosts (`host_id ... ON DELETE CASCADE`). Purging a host would strand its
--    contribution forever. This is the identical defect fixed for quote_count in
--    20260716180000 — same table, same shape, one column over.
--
-- Fix: recompute instead of delta, exactly as quote_count now does. UNIQUE(post_id,
-- host_id) makes COUNT(*) over looking_for_post_views the definition of the value,
-- so the counter is idempotent and self-healing: replay it, cascade rows away, do
-- anything at all, and it converges on the truth.
--
-- SECURITY DEFINER IS LOAD-BEARING — DO NOT REMOVE IT. The counter is written by
-- a trigger on a row the HOST inserts, but the counter lives on the GUEST's post,
-- and looking_for_posts' UPDATE policy only admits the guest. A SECURITY INVOKER
-- trigger therefore runs as `authenticated` and its UPDATE matches zero rows —
-- silently. Rehearsed on live before writing this: with the invoker trigger, a
-- host inserting a view row left view_count at 0 while the view row existed. The
-- fix would have shipped green and counted nothing. The row insert stays RLS-gated
-- (`host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid())`), which is the
-- real security boundary — a host can still only ever record their OWN view. This
-- function just recomputes a COUNT, takes no caller input, and pins search_path.
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_looking_for_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  SET view_count = (
    SELECT COUNT(*) FROM looking_for_post_views v WHERE v.post_id = target_post
  )
  WHERE p.id = target_post;

  -- A view moved between posts: the post it left needs recounting too.
  IF TG_OP = 'UPDATE' AND OLD.post_id IS DISTINCT FROM NEW.post_id THEN
    UPDATE looking_for_posts p
    SET view_count = (
      SELECT COUNT(*) FROM looking_for_post_views v WHERE v.post_id = OLD.post_id
    )
    WHERE p.id = OLD.post_id;
  END IF;

  RETURN NULL;  -- AFTER trigger: return value is ignored.
END;
$$;

DROP TRIGGER IF EXISTS looking_for_views_increment_count ON looking_for_post_views;
DROP FUNCTION IF EXISTS increment_looking_for_view_count();

CREATE TRIGGER looking_for_post_views_sync_count
  AFTER INSERT OR DELETE OR UPDATE OF post_id ON looking_for_post_views
  FOR EACH ROW EXECUTE FUNCTION sync_looking_for_view_count();

-- -----------------------------------------------------------------------------
-- Harden the quote_count twin against the same silent failure.
--
-- sync_looking_for_quote_count (20260716180000) works today only because its one
-- writer — the send-quote action — happens to use the service-role client, which
-- bypasses RLS. It is SECURITY INVOKER, so the day anyone swaps that for the
-- request-scoped client, quote_count stops counting and says nothing. Same
-- reasoning as above; no behaviour change today.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_looking_for_quote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_post UUID;
BEGIN
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

  IF TG_OP = 'UPDATE' AND OLD.post_id IS DISTINCT FROM NEW.post_id THEN
    UPDATE looking_for_posts p
    SET quote_count = (
      SELECT COUNT(*) FROM looking_for_responses r WHERE r.post_id = OLD.post_id
    )
    WHERE p.id = OLD.post_id;
  END IF;

  RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- Reconcile every post the old page-load counter inflated.
--
-- looking_for_posts has a BEFORE UPDATE trigger stamping updated_at, and the
-- record timeline reads updated_at as the "fulfilled"/"cancelled" event time — so
-- a blind backfill would rewrite history on already-fulfilled posts. Suppress the
-- stamp for the duration of the backfill only.
-- -----------------------------------------------------------------------------

ALTER TABLE looking_for_posts DISABLE TRIGGER looking_for_posts_updated_at;

UPDATE looking_for_posts p
SET view_count = actual.n
FROM (
  SELECT p2.id, (
    SELECT COUNT(*) FROM looking_for_post_views v WHERE v.post_id = p2.id
  ) AS n
  FROM looking_for_posts p2
) AS actual
WHERE p.id = actual.id
  AND p.view_count IS DISTINCT FROM actual.n;

ALTER TABLE looking_for_posts ENABLE TRIGGER looking_for_posts_updated_at;
