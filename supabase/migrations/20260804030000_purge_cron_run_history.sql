-- Purge pg_cron execution history so it can never balloon the DB again.
--
-- Background: cron.job_run_details logs one row per cron run and pg_cron never
-- prunes it. With ~48 active jobs (6 running every minute) it grew to 510k rows
-- / 1.45 GB — 96% of the whole database — and tripped Supabase's DB-size limit.
-- Nothing in the app reads this table; it is diagnostic-only. We keep a 7-day
-- window for debugging and drop the rest daily.
--
-- Idempotent: cron.schedule(jobname, ...) upserts by name.

select cron.schedule(
  'purge-cron-run-history',
  '30 3 * * *',  -- daily 03:30 UTC (free slot)
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
