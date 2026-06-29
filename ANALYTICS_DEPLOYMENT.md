# Analytics & Reports System - Deployment Guide

Complete step-by-step guide to deploy the analytics system to production.

## Prerequisites

- Supabase project created and linked
- Supabase CLI installed (`npm install -g supabase`)
- Supabase access token configured (`supabase login`)
- Node.js 20+ installed
- pnpm installed

## Step 1: Apply Database Migrations

Apply all analytics migrations to your linked Supabase project:

```bash
cd supabase
npx supabase db push --linked
```

This applies:
- `20260605135911_analytics_listing_views.sql` - Listing view events table
- `20260605135912_analytics_scheduled_reports.sql` - Scheduled reports tables
- `20260605135913_analytics_schema_additions.sql` - Schema additions (channel, country, province)
- `20260605141536_analytics_scheduled_reports_automation.sql` - pg_cron + Storage policies

Verify migrations:
```bash
npx supabase migration list --linked
```

## Step 2: Create Storage Bucket

Via Supabase Dashboard:

1. Go to **Storage** section
2. Click **Create Bucket**
3. Configure:
   - **Bucket name:** `reports`
   - **Public:** No (Private bucket)
   - **File size limit:** 10MB
   - **Allowed MIME types:**
     - `application/pdf`
     - `text/csv`
     - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
4. Click **Create**

The migration has already created the necessary RLS policies for this bucket.

## Step 3: Deploy Edge Functions

Deploy both analytics Edge Functions:

```bash
# Deploy listing view tracker
npx supabase functions deploy track-listing-view

# Deploy report scheduler
npx supabase functions deploy report-scheduler
```

Verify deployment:
```bash
npx supabase functions list
```

## Step 4: Configure Database Settings

Run these commands in Supabase SQL Editor (Dashboard > SQL Editor):

```sql
-- Set your Supabase project URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://zlcivjgvtyeaszikqleu.supabase.co';

-- Set your anon key (get from Dashboard > Settings > API)
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'eyJhbGc...'; -- your actual anon key
```

These settings allow pg_cron to call the Edge Functions.

## Step 5: Verify pg_cron Job

Check that the hourly job was created:

```sql
SELECT * FROM cron.job;
```

You should see:
- **jobname:** `scheduled-reports-hourly`
- **schedule:** `0 * * * *` (every hour)
- **command:** HTTP POST to report-scheduler function

Monitor job execution:
```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

## Step 6: Seed Demo Data (Optional)

For testing and demonstration purposes:

```bash
cd apps/web

# Seed base demo data (host, listings, bookings)
node --env-file=.env.local scripts/seed-demo.mjs

# Seed analytics-specific data (views, varied bookings)
node --env-file=.env.local scripts/seed-analytics.mjs
```

This creates:
- 1 demo host account (`host@wielodemo.com` / `WieloDemo123!`)
- 2 demo listings
- 100 listing view events (past 90 days)
- 50+ bookings with realistic distributions
- Varied channels, devices, countries, statuses

## Step 7: Deploy Web Application

Deploy to Vercel (or your hosting platform):

```bash
cd apps/web
npm run build  # Verify build passes
git push origin main  # Triggers Vercel deployment
```

Ensure environment variables are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for Server Actions)

## Step 8: Verification

### Verify Analytics Dashboard

1. Log in to your app
2. Navigate to `/dashboard/reports`
3. Verify:
   - ✅ Primary KPIs display (Revenue, RevPAR, ADR, Occupancy)
   - ✅ Secondary metrics display (6 cards)
   - ✅ Charts render (Revenue trend, Channel mix)
   - ✅ Conversion funnel displays
   - ✅ Property performance table loads
   - ✅ Regional breakdown and seasonality heatmap display
   - ✅ Guest demographics, popular rooms, refunds sections display

### Test Exports

1. Click **Export** dropdown
2. Test **CSV export:**
   - File downloads immediately
   - Opens in Excel/spreadsheet app
   - Contains correct data
3. Test **PDF export:**
   - File downloads
   - Opens in PDF reader
   - Formatted table with header/footer
4. Test **XLSX export:**
   - File downloads
   - Opens in Excel
   - Formatted cells with frozen headers

### Test Scheduled Reports

1. Scroll to **Scheduled Reports** section
2. Click **Create first report** (or **New report**)
3. Fill form:
   - Name: "Monthly Performance Report"
   - Type: Portfolio Summary
   - Schedule: Monthly · 1st · 08:00
   - Format: PDF
   - Recipients: Add your email
4. Click **Create Report**
5. Verify report appears in table with:
   - Status: Active (green badge)
   - Next run date calculated correctly
6. Test actions:
   - Edit (opens form with pre-filled data)
   - Pause (status changes to Paused)
   - Delete (confirmation prompt)

### Test Listing View Tracking (Manual)

Once integrated into listing pages:

1. Visit a listing page (`/listing/[slug]`)
2. Stay for 10+ seconds
3. Navigate away
4. Check database:
   ```sql
   SELECT * FROM listing_view_events
   ORDER BY created_at DESC
   LIMIT 10;
   ```
5. Verify event was recorded with duration

### Monitor Report Scheduler

Wait for the next hour (or trigger manually):

```bash
# Trigger manually via curl
curl -X POST https://zlcivjgvtyeaszikqleu.supabase.co/functions/v1/report-scheduler \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Check execution:
```sql
-- Check report runs
SELECT * FROM report_runs
ORDER BY started_at DESC
LIMIT 10;

-- Check cron job history
SELECT * FROM cron.job_run_details
WHERE jobname = 'scheduled-reports-hourly'
ORDER BY start_time DESC
LIMIT 5;
```

## Troubleshooting

### Migration Fails

**Issue:** Migration contains errors or conflicts

**Solution:**
1. Check migration status: `supabase migration list --linked`
2. Roll back if needed: `supabase db reset --linked` (WARNING: wipes data)
3. Fix migration file
4. Re-apply: `supabase db push --linked`

### Edge Function Deployment Fails

**Issue:** Function deployment errors

**Solution:**
1. Check function logs: `supabase functions logs track-listing-view`
2. Verify Deno syntax (no Node.js-specific APIs)
3. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
4. Redeploy: `supabase functions deploy [function-name]`

### pg_cron Not Running

**Issue:** Reports not generating automatically

**Solution:**
1. Verify job exists: `SELECT * FROM cron.job;`
2. Check job history: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
3. Verify database settings are configured (Step 4)
4. Check Edge Function logs for errors
5. Test manual trigger (curl command above)

### Reports Not Generating

**Issue:** Scheduler runs but reports fail

**Solution:**
1. Check `report_runs` table for error messages:
   ```sql
   SELECT * FROM report_runs
   WHERE status = 'failed'
   ORDER BY started_at DESC;
   ```
2. Check Edge Function logs: `supabase functions logs report-scheduler`
3. Verify Storage bucket exists and has correct permissions
4. Test report generation manually (trigger via curl)

### Export Buttons Don't Work

**Issue:** Export downloads fail or error

**Solution:**
1. Open browser DevTools > Console
2. Look for errors
3. Check Server Actions are working:
   - Verify `SUPABASE_SERVICE_ROLE_KEY` is set in environment
   - Check server logs for errors
4. Test with small date range first
5. Verify data exists in database

## Performance Optimization

For optimal performance with large datasets:

1. **Database Indexes:** All required indexes are created by migrations
2. **Query Optimization:** All analytics queries use PostgreSQL RPCs with optimized joins
3. **Client Caching:** Consider adding React Query or SWR for client-side caching
4. **Pagination:** Property performance table already implements pagination (25 per page)
5. **Image Optimization:** Consider using Next.js Image component for listing thumbnails

## Production Checklist

Before going live:

- [ ] All migrations applied successfully
- [ ] Storage bucket created with correct permissions
- [ ] Both Edge Functions deployed
- [ ] Database settings configured (URL + anon key)
- [ ] pg_cron job verified
- [ ] Demo data seeded (for initial testing)
- [ ] All exports tested (CSV, PDF, XLSX)
- [ ] Scheduled reports UI tested
- [ ] Feature gates verified (Free shows upgrade, Basic+ shows dashboard)
- [ ] Mobile responsive on all breakpoints (375px, 768px, 1024px)
- [ ] Page load < 2s with 100 bookings
- [ ] Error handling tested (network failures, invalid data)
- [ ] Monitoring set up (Edge Function logs, cron job history)

## Monitoring & Maintenance

### Daily Checks

```sql
-- Check failed reports in past 24 hours
SELECT * FROM report_runs
WHERE status = 'failed'
  AND started_at > now() - interval '24 hours'
ORDER BY started_at DESC;

-- Check cron job health
SELECT * FROM cron.job_run_details
WHERE jobname = 'scheduled-reports-hourly'
  AND start_time > now() - interval '24 hours'
ORDER BY start_time DESC;
```

### Weekly Review

- Review Storage usage (Dashboard > Storage > reports bucket)
- Check for stale signed URLs (expire after 7 days)
- Review slow queries (Dashboard > Database > Performance)
- Monitor Edge Function execution time and errors

### Monthly Maintenance

- Archive old report files from Storage (>30 days)
- Vacuum `listing_view_events` table if very large (>1M rows)
- Review and optimize slow analytics queries
- Update demo data for testing environments

## Support

For issues or questions:
- Check logs: `supabase functions logs [function-name]`
- Review database queries: Supabase Dashboard > SQL Editor
- Consult docs: https://supabase.com/docs
- Open issue: GitHub repository issues

---

**Last Updated:** 2026-06-06
**Version:** 1.0.0
**Status:** Production Ready
