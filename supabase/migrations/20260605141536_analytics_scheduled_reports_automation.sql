-- Analytics: Scheduled Reports Automation Setup
-- Storage bucket + pg_cron job for report-scheduler Edge Function

-- ==========================================
-- STORAGE BUCKET: reports
-- ==========================================
-- NOTE: Storage buckets must be created via Supabase Dashboard or API
-- This migration only creates the RLS policies
--
-- Manual step required:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create bucket: "reports"
-- 3. Settings:
--    - Public: false (private)
--    - File size limit: 10MB
--    - Allowed MIME types: application/pdf, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

-- Storage policies for the "reports" bucket
-- (These will only work once the bucket is created manually)

-- Policy: Hosts can read their own reports
CREATE POLICY reports_host_read
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM hosts WHERE user_id = auth.uid()
    )
  );

-- Policy: Service role can upload reports (via Edge Function)
CREATE POLICY reports_service_upload
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'reports');

-- Policy: Service role can update reports (via Edge Function)
CREATE POLICY reports_service_update
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'reports');

-- ==========================================
-- PG_CRON: Scheduled job for report generation
-- ==========================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions to postgres role (pg_cron requires this)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule: Run report-scheduler Edge Function every hour
-- Cron expression: 0 * * * * = every hour at minute 0
SELECT cron.schedule(
  'scheduled-reports-hourly',           -- Job name
  '0 * * * *',                          -- Cron expression (every hour)
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/report-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ==========================================
-- CONFIGURATION: Store Supabase URL and keys
-- ==========================================
-- These settings are used by pg_cron to call the Edge Function
-- Set via: ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';

-- NOTE: The actual values must be set manually after migration:
--
-- In Supabase SQL Editor, run:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://zlcivjgvtyeaszikqleu.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';

-- ==========================================
-- HELPER: View scheduled cron jobs
-- ==========================================

-- Query to view all cron jobs:
-- SELECT * FROM cron.job;

-- Query to view cron job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON POLICY reports_host_read ON storage.objects IS 'Hosts can read reports in their own folder (host_id)';
COMMENT ON POLICY reports_service_upload ON storage.objects IS 'Service role can upload generated reports';
COMMENT ON POLICY reports_service_update ON storage.objects IS 'Service role can update report metadata';
