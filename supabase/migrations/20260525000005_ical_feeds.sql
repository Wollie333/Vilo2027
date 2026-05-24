-- Migration: iCal feeds (external calendar import)
-- Per BOOKING_SYNC.md + PHASE_PLAN.md Track 3 + AGENT_RULES.md §2.5/§2.6
--
-- Hosts paste an Airbnb / Booking.com / Custom iCal URL per listing;
-- a periodic sync (or manual button) fetches, parses, and inserts
-- blocked_dates rows with source='ical' so calendar conflicts surface.

CREATE TABLE public.ical_feeds (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  source_label    text        NOT NULL,
  url             text        NOT NULL,
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'error', 'disabled')),
  last_sync_at    timestamptz,
  last_error      text,
  imported_count  integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_feed_per_listing UNIQUE (listing_id, url)
);

CREATE INDEX idx_ical_feeds_listing  ON ical_feeds(listing_id);
CREATE INDEX idx_ical_feeds_status   ON ical_feeds(status);
CREATE INDEX idx_ical_feeds_due_sync ON ical_feeds(last_sync_at NULLS FIRST)
  WHERE status = 'active';

ALTER TABLE ical_feeds ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ical_feeds IS
  'External iCal feeds (Airbnb, Booking.com, custom) we pull from to block dates on a Vilo listing.';
COMMENT ON COLUMN ical_feeds.imported_count IS
  'Number of distinct dates the most recent successful sync wrote.';

CREATE TRIGGER set_ical_feeds_updated_at
  BEFORE UPDATE ON ical_feeds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Host manages own feeds (joined through listings.host_id = get_my_host_id()).
CREATE POLICY "host_manage_own_ical_feeds"
  ON ical_feeds FOR ALL
  USING (
    listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id())
  )
  WITH CHECK (
    listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id())
  );

CREATE POLICY "admin_full_ical_feeds"
  ON ical_feeds FOR ALL
  USING (is_super_admin());

-- ─── Extend blocked_dates to track the import source ──────────
-- Per AGENT_RULES.md §2.5 we never bulk-delete a listing's blocks;
-- imports must only touch their own source='ical' + ical_feed_id rows.
ALTER TABLE blocked_dates
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'booking', 'ical', 'quote_hold'));

ALTER TABLE blocked_dates
  ADD COLUMN IF NOT EXISTS ical_feed_id uuid REFERENCES ical_feeds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_blocked_dates_ical_feed
  ON blocked_dates(ical_feed_id)
  WHERE source = 'ical';

COMMENT ON COLUMN blocked_dates.source IS
  'Provenance of the block. manual = host blocked; booking = confirmed booking; ical = imported feed; quote_hold = soft hold from a sent quote.';
