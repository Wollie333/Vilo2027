# Report Scheduler Edge Function

Automated scheduled report generation system. Runs hourly via pg_cron to check for due reports, generate files, upload to Storage, and email recipients.

## Setup

### 1. Deploy Edge Function

```bash
supabase functions deploy report-scheduler
```

### 2. Create Storage Bucket

Via Supabase Dashboard:
1. Go to **Storage** > **Create Bucket**
2. Bucket name: `reports`
3. Settings:
   - **Public:** No (Private)
   - **File size limit:** 10MB
   - **Allowed MIME types:**
     - `application/pdf`
     - `text/csv`
     - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### 3. Apply Migration

```bash
supabase db push --linked
```

This creates:
- Storage RLS policies for the `reports` bucket
- pg_cron job (runs hourly)

### 4. Configure Database Settings

Run in Supabase SQL Editor:

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://zlcivjgvtyeaszikqleu.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key-here';
```

Replace with your actual project URL and anon key.

## How It Works

### Execution Flow

1. **pg_cron job** runs every hour (at minute 0)
2. Calls the `report-scheduler` Edge Function
3. Function queries `scheduled_reports` table for due reports (`next_run_at <= now()`)
4. For each due report:
   - Creates `report_runs` entry (status: `processing`)
   - Generates report data based on `report_type`
   - Uploads file to Storage (`reports` bucket)
   - Generates 7-day signed URL
   - Sends email to recipients (TODO: implement)
   - Updates `report_runs` (status: `completed`)
   - Updates `scheduled_reports` (sets `last_run_at` and `next_run_at`)

### Report Types

- `portfolio_summary` - All KPIs + revenue trend
- `revenue_detail` - Revenue breakdown by listing/channel/month
- `channel_mix` - Direct vs OTA performance
- `guest_satisfaction` - Ratings, reviews, NPS
- `refunds_cancellations` - Risk analysis
- `occupancy_forecast` - Predictive occupancy (future)

### Storage Structure

```
reports/
└── {host_id}/
    └── {report_run_id}_{filename}.{format}
```

Example: `reports/550e8400-e29b-41d4-a716-446655440000/abc123_revenue_detail_2026-06-05.pdf`

## Manual Testing

Test the function manually:

```bash
curl -X POST https://zlcivjgvtyeaszikqleu.supabase.co/functions/v1/report-scheduler \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Monitoring

### View scheduled cron jobs:
```sql
SELECT * FROM cron.job;
```

### View cron job execution history:
```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### View report run history:
```sql
SELECT * FROM report_runs
ORDER BY started_at DESC
LIMIT 20;
```

## TODO

- [ ] Implement actual report generation logic (integrate with web app's PDF/XLSX generators)
- [ ] Integrate Resend email sending
- [ ] Implement proper cron expression parsing for `next_run_at` calculation
- [ ] Add retry logic for failed reports
- [ ] Add report generation timeout (max 5 minutes)
- [ ] Add email template for scheduled reports
- [ ] Add rate limiting (max reports per hour per host)
