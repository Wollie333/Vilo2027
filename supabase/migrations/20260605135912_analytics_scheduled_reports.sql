-- Analytics: Scheduled report automation system
-- Part of enterprise analytics system (Phase 1)

-- Scheduled report definitions (host-configurable recurring reports)
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,

  -- Report configuration
  name            text NOT NULL,
  description     text,
  report_type     text NOT NULL CHECK (report_type IN (
                    'portfolio_summary',      -- All KPIs + revenue trend
                    'revenue_detail',         -- Revenue breakdown by listing/channel/month
                    'channel_mix',            -- Direct vs OTA performance
                    'guest_satisfaction',     -- Ratings, reviews, NPS
                    'refunds_cancellations',  -- Risk analysis
                    'occupancy_forecast'      -- Future: predictive occupancy
                  )),

  -- Scope filters (JSON: { listing_ids: [], region: 'Western Cape', date_range: 'last_30_days' })
  scope_filter    jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Schedule (cron expression)
  schedule_cron   text,  -- "0 8 1 * *" = 8am on 1st of month
  schedule_label  text,  -- Human-readable: "Monthly · 1st · 08:00"

  -- Recipients (JSON array: [{ user_id: uuid, email: text, name: text }])
  recipients      jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Output format
  format          text NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf','csv','xlsx')),

  -- Status
  is_active       boolean NOT NULL DEFAULT true,
  last_run_at     timestamptz,
  next_run_at     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Report execution log (append-only audit trail)
CREATE TABLE IF NOT EXISTS public.report_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_report_id uuid REFERENCES scheduled_reports(id) ON DELETE SET NULL,
  host_id             uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,

  -- What was generated
  report_type         text NOT NULL,
  scope_filter        jsonb NOT NULL,
  format              text NOT NULL,

  -- Execution status
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  file_storage_path   text,  -- Supabase Storage path: reports/{host_id}/{report_id}_{timestamp}.pdf
  file_url            text,  -- Signed URL (expires 7 days)
  error_message       text,

  -- Timestamps
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

-- Indexes
CREATE INDEX idx_scheduled_reports_host ON scheduled_reports(host_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX idx_scheduled_reports_type ON scheduled_reports(report_type);

CREATE INDEX idx_report_runs_host ON report_runs(host_id, started_at DESC);
CREATE INDEX idx_report_runs_scheduled ON report_runs(scheduled_report_id);
CREATE INDEX idx_report_runs_status ON report_runs(status, started_at DESC);

-- RLS policies
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

-- Hosts can manage their own scheduled reports
CREATE POLICY scheduled_reports_host_all
  ON scheduled_reports FOR ALL
  TO authenticated
  USING (
    host_id IN (
      SELECT id FROM hosts WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    host_id IN (
      SELECT id FROM hosts WHERE user_id = auth.uid()
    )
  );

-- Hosts can see their own report run history
CREATE POLICY report_runs_host_read
  ON report_runs FOR SELECT
  TO authenticated
  USING (
    host_id IN (
      SELECT id FROM hosts WHERE user_id = auth.uid()
    )
  );

-- Admins can see all
CREATE POLICY scheduled_reports_admin_read
  ON scheduled_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_role = 'super_admin'
    )
  );

CREATE POLICY report_runs_admin_read
  ON report_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_role = 'super_admin'
    )
  );

-- Service role can insert report_runs (via Edge Function)

-- Updated_at trigger for scheduled_reports
CREATE TRIGGER set_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Comments
COMMENT ON TABLE scheduled_reports IS 'Recurring report configurations with cron scheduling';
COMMENT ON TABLE report_runs IS 'Append-only log of every report generation (success or failure)';
COMMENT ON COLUMN scheduled_reports.schedule_cron IS 'Standard cron expression (minute hour day month weekday)';
COMMENT ON COLUMN scheduled_reports.scope_filter IS 'JSON filter object: { listing_ids: [], region: string, date_range: string }';
COMMENT ON COLUMN scheduled_reports.recipients IS 'JSON array of { user_id, email, name } objects to receive report emails';
COMMENT ON COLUMN report_runs.file_storage_path IS 'Path in Supabase Storage (reports bucket) where generated file lives';
COMMENT ON COLUMN report_runs.file_url IS 'Signed URL with 7-day expiration for email links';
