-- Migration: External Reviews Integration
-- Allows hosts to connect external review sources (Google, Facebook, Trustpilot)
-- and sync reviews into the Vilo reviews manager.
--
-- Tables:
--   1. external_review_sources - Host connections to external platforms
--   2. external_reviews - Imported reviews from external platforms
--   3. external_review_sync_log - Audit trail for sync operations (INSERT-only)

-- ─── 1. external_review_sources ─────────────────────────────────────────────
CREATE TABLE public.external_review_sources (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id             uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,

  -- Platform identifier
  source              text    NOT NULL CHECK (source IN ('google', 'facebook', 'trustpilot')),

  -- Platform-specific identifiers
  external_account_id text    NOT NULL,
  account_name        text,
  account_url         text,

  -- OAuth credentials (encrypted via OAUTH_CIPHER_KEY, AES-256-GCM)
  -- Format: v1.<nonce_b64>.<ciphertext_b64>.<tag_b64>
  access_token        text,
  refresh_token       text,
  token_expires_at    timestamptz,

  -- API key credentials (for Trustpilot which uses API keys, not OAuth)
  api_key             text,
  api_secret          text,

  -- Sync state
  is_active           boolean NOT NULL DEFAULT true,
  last_synced_at      timestamptz,
  last_sync_error     text,
  sync_cursor         text,

  -- Soft delete
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT external_review_sources_unique_account
    UNIQUE (host_id, source, external_account_id)
);

CREATE INDEX idx_external_review_sources_host
  ON external_review_sources(host_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_external_review_sources_sync
  ON external_review_sources(is_active, last_synced_at)
  WHERE deleted_at IS NULL AND is_active = true;

ALTER TABLE external_review_sources ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE external_review_sources IS
  'Host connections to external review platforms (Google, Facebook, Trustpilot). '
  'OAuth tokens and API keys are encrypted with AES-256-GCM using OAUTH_CIPHER_KEY.';

COMMENT ON COLUMN external_review_sources.source IS
  'Platform identifier: google | facebook | trustpilot';

COMMENT ON COLUMN external_review_sources.external_account_id IS
  'Platform-specific ID: Google location ID, Facebook page ID, Trustpilot business unit ID';

COMMENT ON COLUMN external_review_sources.sync_cursor IS
  'Last synced reviewed_at timestamp for incremental sync. ISO 8601 string.';

-- ─── 2. external_reviews ────────────────────────────────────────────────────
CREATE TABLE public.external_reviews (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id            uuid    NOT NULL REFERENCES external_review_sources(id) ON DELETE CASCADE,
  host_id              uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,

  -- Link to Vilo listing (optional - host can map external review to a property)
  property_id          uuid    REFERENCES properties(id) ON DELETE SET NULL,

  -- External identifiers
  external_review_id   text    NOT NULL,
  external_reviewer_id text,

  -- Review content
  reviewer_name        text,
  reviewer_avatar_url  text,
  rating               integer CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  body                 text,
  review_url           text,

  -- Reply tracking
  host_reply           text,
  host_reply_at        timestamptz,
  reply_synced         boolean NOT NULL DEFAULT false,
  reply_sync_error     text,

  -- Metadata
  reviewed_at          timestamptz NOT NULL,
  language             text,

  -- Display flags
  is_visible           boolean NOT NULL DEFAULT true,
  is_featured          boolean NOT NULL DEFAULT false,

  -- Soft delete
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT external_reviews_unique_per_source
    UNIQUE (source_id, external_review_id)
);

CREATE INDEX idx_external_reviews_host
  ON external_reviews(host_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_external_reviews_property
  ON external_reviews(property_id)
  WHERE deleted_at IS NULL AND is_visible = true;

CREATE INDEX idx_external_reviews_source
  ON external_reviews(source_id, reviewed_at DESC);

CREATE INDEX idx_external_reviews_featured
  ON external_reviews(host_id, is_featured)
  WHERE is_featured = true AND deleted_at IS NULL;

CREATE INDEX idx_external_reviews_reviewed_at
  ON external_reviews(host_id, reviewed_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE external_reviews ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE external_reviews IS
  'Reviews imported from external platforms (Google, Facebook, Trustpilot). '
  'Synced via Edge Function on host request or daily cron.';

COMMENT ON COLUMN external_reviews.rating IS
  'Star rating 1-5. Nullable because some platforms (Facebook) use recommend yes/no instead.';

COMMENT ON COLUMN external_reviews.reply_synced IS
  'True if host_reply was posted to the external platform via Vilo.';

COMMENT ON COLUMN external_reviews.is_visible IS
  'Host can hide external reviews from their website and directory listing.';

-- ─── 3. external_review_sync_log ────────────────────────────────────────────
-- INSERT-only audit log per AGENT_RULES.md
CREATE TABLE public.external_review_sync_log (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       uuid    NOT NULL REFERENCES external_review_sources(id) ON DELETE CASCADE,

  sync_type       text    NOT NULL CHECK (sync_type IN ('auto', 'manual')),
  status          text    NOT NULL CHECK (status IN ('started', 'completed', 'failed')),

  reviews_fetched integer DEFAULT 0,
  reviews_added   integer DEFAULT 0,
  reviews_updated integer DEFAULT 0,

  error_message   text,
  error_code      text,

  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX idx_external_review_sync_log_source
  ON external_review_sync_log(source_id, started_at DESC);

ALTER TABLE external_review_sync_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE external_review_sync_log IS
  'Audit trail for external review sync operations. INSERT-only per AGENT_RULES.md.';

-- ─── 4. RLS Policies ────────────────────────────────────────────────────────

-- external_review_sources: Host manages own sources
CREATE POLICY "host_manage_external_review_sources"
  ON external_review_sources
  FOR ALL
  USING (host_id = get_my_host_id());

-- Admin full access
CREATE POLICY "admin_full_external_review_sources"
  ON external_review_sources
  FOR ALL
  USING (is_super_admin());

-- external_reviews: Host manages own reviews
CREATE POLICY "host_manage_external_reviews"
  ON external_reviews
  FOR ALL
  USING (host_id = get_my_host_id());

-- Public reads visible reviews (for directory display)
CREATE POLICY "public_read_visible_external_reviews"
  ON external_reviews
  FOR SELECT
  USING (is_visible = true AND deleted_at IS NULL);

-- Admin full access
CREATE POLICY "admin_full_external_reviews"
  ON external_reviews
  FOR ALL
  USING (is_super_admin());

-- external_review_sync_log: Host reads own sync logs (no INSERT/UPDATE from client)
CREATE POLICY "host_read_external_review_sync_log"
  ON external_review_sync_log
  FOR SELECT
  USING (
    source_id IN (
      SELECT id FROM external_review_sources
      WHERE host_id = get_my_host_id()
    )
  );

-- Admin reads all sync logs
CREATE POLICY "admin_read_external_review_sync_log"
  ON external_review_sync_log
  FOR SELECT
  USING (is_super_admin());

-- ─── 5. Updated_at trigger ──────────────────────────────────────────────────
CREATE TRIGGER set_updated_at_external_review_sources
  BEFORE UPDATE ON external_review_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_external_reviews
  BEFORE UPDATE ON external_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
