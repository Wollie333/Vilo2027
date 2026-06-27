-- Migration: External Reviews Performance Indexes
-- Adds composite indexes for common query patterns to optimize dashboard and directory queries.

-- Fast lookup: host's sources by status
CREATE INDEX IF NOT EXISTS idx_external_review_sources_host_active
  ON external_review_sources (host_id, is_active)
  WHERE deleted_at IS NULL;

-- Fast lookup: reviews by property for directory display
CREATE INDEX IF NOT EXISTS idx_external_reviews_property_visible
  ON external_reviews (property_id, is_visible, reviewed_at DESC)
  WHERE deleted_at IS NULL AND property_id IS NOT NULL;

-- Fast lookup: reviews by source for dashboard filtering
CREATE INDEX IF NOT EXISTS idx_external_reviews_source_reviewed
  ON external_reviews (source_id, reviewed_at DESC)
  WHERE deleted_at IS NULL;

-- Fast lookup: featured reviews per property
CREATE INDEX IF NOT EXISTS idx_external_reviews_featured
  ON external_reviews (property_id, is_featured)
  WHERE deleted_at IS NULL AND is_featured = true;

-- Sync log: recent syncs per source (for dashboard status)
CREATE INDEX IF NOT EXISTS idx_external_review_sync_log_source_recent
  ON external_review_sync_log (source_id, started_at DESC);

-- Partial index: sources needing token refresh (expires within 7 days)
CREATE INDEX IF NOT EXISTS idx_external_review_sources_token_expiring
  ON external_review_sources (token_expires_at)
  WHERE deleted_at IS NULL
    AND is_active = true
    AND token_expires_at IS NOT NULL;
