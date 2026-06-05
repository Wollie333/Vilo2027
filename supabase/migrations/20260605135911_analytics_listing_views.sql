-- Analytics: Listing view tracking for conversion funnel analysis
-- Part of enterprise analytics system (Phase 1)

-- Track every listing page view for funnel analysis
CREATE TABLE IF NOT EXISTS public.listing_view_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,

  -- Session tracking (client-side generated UUID, persisted in localStorage)
  session_id      text NOT NULL,
  user_id         uuid REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- View metadata
  duration_seconds integer,  -- NULL on first event, updated on page exit via beforeunload
  device          text CHECK (device IN ('mobile','tablet','desktop')),
  referrer        text,  -- Where the guest came from
  country         text,  -- ISO 3166-1 alpha-2 (ZA, GB, US, etc.) - inferred from IP or browser

  viewed_at       timestamptz NOT NULL DEFAULT now(),

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX idx_listing_views_listing ON listing_view_events(listing_id, viewed_at DESC);
CREATE INDEX idx_listing_views_session ON listing_view_events(session_id);
CREATE INDEX idx_listing_views_user ON listing_view_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_listing_views_created ON listing_view_events(created_at DESC);

-- RLS policies
ALTER TABLE listing_view_events ENABLE ROW LEVEL SECURITY;

-- Hosts can see view events for their own listings
CREATE POLICY listing_view_events_host_read
  ON listing_view_events FOR SELECT
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE host_id IN (
        SELECT id FROM hosts WHERE user_id = auth.uid()
      )
    )
  );

-- Admins can see all view events
CREATE POLICY listing_view_events_admin_read
  ON listing_view_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_role = 'super_admin'
    )
  );

-- Service role can insert view events (via Edge Function)
-- No authenticated user INSERT policy (guests don't auth before viewing)

COMMENT ON TABLE listing_view_events IS 'Tracks every listing page view for conversion funnel analysis. Inserted via track-listing-view Edge Function.';
COMMENT ON COLUMN listing_view_events.session_id IS 'Client-generated UUID persisted in localStorage to track multi-visit journeys';
COMMENT ON COLUMN listing_view_events.duration_seconds IS 'Time spent on page - NULL on entry, updated on exit via beforeunload event';
