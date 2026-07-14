-- =============================================================================
-- Looking-For — allow 'cancelled' and 'flagged' post statuses
-- =============================================================================
-- The original schema (20260628100000) constrained looking_for_posts.status to
--   ('active','fulfilled','expired','removed','quotes_closed')
-- but the whole product surface writes/renders two statuses that were never in
-- that set:
--   • 'cancelled' — guest withdraws their request (cancelRequestAction) AND
--     admin removes a post (removePostAction).
--   • 'flagged'   — admin flags a post for review (flagPostAction).
-- Every one of those UPDATEs was rejected by the CHECK constraint, so cancel /
-- flag / remove silently failed. The status badges in the portal, owner detail,
-- and admin moderation views all already style 'cancelled' and 'flagged', so the
-- fix is to widen the DB constraint to match the UI (pre-MVP: reshape freely).
-- 'removed' is kept (still valid) even though the admin path uses 'cancelled'.
-- -----------------------------------------------------------------------------

ALTER TABLE looking_for_posts
  DROP CONSTRAINT IF EXISTS looking_for_posts_status_check;

ALTER TABLE looking_for_posts
  ADD CONSTRAINT looking_for_posts_status_check
  CHECK (status IN (
    'active',
    'fulfilled',
    'expired',
    'removed',
    'quotes_closed',
    'cancelled',
    'flagged'
  ));
