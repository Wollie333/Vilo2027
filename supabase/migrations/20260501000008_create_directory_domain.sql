-- Migration: Domain 8 — Directory & Discovery
-- Per supabase_database.md §11
-- Tables: featured_listings, directory_search_logs

-- ─── featured_listings ────────────────────────────────────────
CREATE TABLE public.featured_listings (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid    UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  featured_by uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  reason      text,
  sort_order  integer NOT NULL DEFAULT 0,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_featured_listings_sort    ON featured_listings(sort_order);
CREATE INDEX idx_featured_listings_expires ON featured_listings(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE featured_listings ENABLE ROW LEVEL SECURITY;

-- ─── directory_search_logs ────────────────────────────────────
CREATE TABLE public.directory_search_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query           text,
  filters         jsonb,
  result_count    integer,
  clicked_listing uuid REFERENCES listings(id) ON DELETE SET NULL,
  session_id      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_logs_query      ON directory_search_logs(query)
  WHERE query IS NOT NULL;
CREATE INDEX idx_search_logs_created_at ON directory_search_logs(created_at DESC);
CREATE INDEX idx_search_logs_zero       ON directory_search_logs(query)
  WHERE result_count = 0;

ALTER TABLE directory_search_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE directory_search_logs IS
  'Anonymised. No PII stored. session_id is a random UUID per browser session.';
