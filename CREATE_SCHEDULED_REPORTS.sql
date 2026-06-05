-- Create scheduled_reports tables (simplified - no admin policies)

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_host ON scheduled_reports(host_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON scheduled_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_report_runs_host ON report_runs(host_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_scheduled ON report_runs(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_status ON report_runs(status, started_at DESC);

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

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
