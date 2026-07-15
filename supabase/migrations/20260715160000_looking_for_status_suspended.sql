-- =============================================================================
-- Looking-For — add a 'suspended' post status (admin pause/suspend)
-- =============================================================================
-- Admins can already 'flagged' a post (moderation: "flag for review") and
-- 'cancelled'/'removed' one. Neither models a neutral, reversible "take this
-- offline for now" — a PAUSE. Reusing 'flagged' muddies moderation semantics, so
-- add a distinct 'suspended' status:
--   • hidden from public + host browse + the respond page (all already gate on
--     status = 'active', so 'suspended' is excluded automatically — no policy
--     change needed);
--   • the guest OWNER still sees their post, badged "Paused";
--   • admin resumes it back to 'active'.
-- Pre-MVP: widen the CHECK freely (no data to migrate).
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
    'flagged',
    'suspended'
  ));
