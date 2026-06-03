-- Migration: auto-archive dead enquiry threads to keep the pipeline tidy.
-- Lost/Declined enquiry conversations with no activity for 30 days are archived
-- automatically (they drop out of the active folders but stay in Archived).
-- Runs daily at 02:30. Mirrors the existing pg_cron pattern (…000014).

SELECT cron.schedule('auto-archive-dead-enquiries', '30 2 * * *', $$
  UPDATE public.conversations SET status = 'archived'
  WHERE status <> 'archived'
    AND pipeline_stage IN ('lost','declined')
    AND COALESCE(last_message_at, created_at) < now() - interval '30 days';
$$);
