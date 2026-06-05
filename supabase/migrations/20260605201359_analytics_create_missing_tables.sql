-- =====================================================
-- Analytics: create tables that were never actually applied
-- =====================================================
-- Migrations 20260605135911 (listing_view_events) and
-- 20260605135912 (scheduled_reports / report_runs) were stamped as applied
-- via `supabase migration repair` but their SQL never ran, AND both contained
-- an admin RLS policy referencing the non-existent column user_profiles.user_role
-- (the real column is `role`). As a result these tables do not exist, which made
-- fetch_secondary_metrics / fetch_conversion_funnel / fetch_time_to_book fail with
-- 'relation "listing_view_events" does not exist'.
--
-- This migration creates the tables idempotently with the corrected admin check
-- (user_profiles.role = 'super_admin').
-- =====================================================

-- =====================================================
-- listing_view_events
-- =====================================================
CREATE TABLE IF NOT EXISTS public.listing_view_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  session_id       text NOT NULL,
  user_id          uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  duration_seconds integer,
  device           text CHECK (device IN ('mobile','tablet','desktop')),
  referrer         text,
  country          text,
  viewed_at        timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_views_listing ON listing_view_events(listing_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_views_session ON listing_view_events(session_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_user ON listing_view_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listing_views_created ON listing_view_events(created_at DESC);

ALTER TABLE listing_view_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listing_view_events_host_read ON listing_view_events;
CREATE POLICY listing_view_events_host_read
  ON listing_view_events FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE host_id IN (
        SELECT id FROM hosts WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS listing_view_events_admin_read ON listing_view_events;
CREATE POLICY listing_view_events_admin_read
  ON listing_view_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

COMMENT ON TABLE listing_view_events IS 'Tracks every listing page view for conversion funnel analysis. Inserted via track-listing-view Edge Function.';

-- =====================================================
-- scheduled_reports
-- =====================================================
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  report_type     text NOT NULL CHECK (report_type IN (
                    'portfolio_summary',
                    'revenue_detail',
                    'channel_mix',
                    'guest_satisfaction',
                    'refunds_cancellations',
                    'occupancy_forecast'
                  )),
  scope_filter    jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule_cron   text,
  schedule_label  text,
  recipients      jsonb NOT NULL DEFAULT '[]'::jsonb,
  format          text NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf','csv','xlsx')),
  is_active       boolean NOT NULL DEFAULT true,
  last_run_at     timestamptz,
  next_run_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_report_id uuid REFERENCES scheduled_reports(id) ON DELETE SET NULL,
  host_id             uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  report_type         text NOT NULL,
  scope_filter        jsonb NOT NULL,
  format              text NOT NULL,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  file_storage_path   text,
  file_url            text,
  error_message       text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_host ON scheduled_reports(host_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON scheduled_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_report_runs_host ON report_runs(host_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_scheduled ON report_runs(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_status ON report_runs(status, started_at DESC);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheduled_reports_host_all ON scheduled_reports;
CREATE POLICY scheduled_reports_host_all
  ON scheduled_reports FOR ALL TO authenticated
  USING (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()))
  WITH CHECK (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS report_runs_host_read ON report_runs;
CREATE POLICY report_runs_host_read
  ON report_runs FOR SELECT TO authenticated
  USING (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS scheduled_reports_admin_read ON scheduled_reports;
CREATE POLICY scheduled_reports_admin_read
  ON scheduled_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS report_runs_admin_read ON report_runs;
CREATE POLICY report_runs_admin_read
  ON report_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

DROP TRIGGER IF EXISTS set_scheduled_reports_updated_at ON scheduled_reports;
CREATE TRIGGER set_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE scheduled_reports IS 'Recurring report configurations with cron scheduling';
COMMENT ON TABLE report_runs IS 'Append-only log of every report generation (success or failure)';
