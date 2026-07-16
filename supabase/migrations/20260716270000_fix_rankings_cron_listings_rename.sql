-- `recalculate-rankings` has been failing every 15 minutes for ~30 days.
--
--   ERROR: relation "listings" does not exist
--   SELECT recalculate_listing_ranking(id) FROM listings WHERE is_published = true ...
--
-- Last success 2026-06-17 14:00, first failure 2026-06-17 14:15 — i.e. the moment
-- 20260617000200_rename_r2_core_tables.sql renamed listings -> properties. The
-- rename updated tables, columns, views and function bodies, but a pg_cron job's
-- body is just TEXT in cron.job.command: ALTER TABLE ... RENAME cannot reach it,
-- and nothing failed loudly enough to notice. Property rankings have been frozen
-- since.
--
-- 🔑 The lesson for the next rename: `SELECT jobname, command FROM cron.job WHERE
-- command ILIKE '%<old_name>%'` is not optional. A rename silently orphans crons.
--
-- Verified before re-scheduling:
--   * recalculate_listing_ranking(p_listing_id uuid) still EXISTS, and its body
--     contains no `listings` references — only the cron's SQL was stale, so this
--     is the whole fix.
--   * `properties` carries both is_published and deleted_at, so the predicate
--     transfers verbatim.
--
-- The function keeps its `listing_` name deliberately: renaming it is a separate
-- change with its own blast radius, and this migration is about un-breaking a
-- month-dead job, not tidying names.
--
-- NOT fixed here — `alert-missing-policies` (0 10 * * *) is broken by the same
-- rename (`FROM listings l`, `listing_policies lp`, `lp.listing_id`). It is left
-- failing ON PURPOSE: its notification kind `listing_missing_policy` appears
-- NOWHERE in apps/web — not in lib/notifications/registry.ts, not in any
-- migration. Repointing its SQL would silently queue rows of a type nothing
-- renders or sends, which is worse than a job that fails visibly. It needs a
-- decision: build the notification, or unschedule the cron.

SELECT cron.unschedule('recalculate-rankings')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recalculate-rankings');

SELECT cron.schedule('recalculate-rankings', '*/15 * * * *', $cron$
  SELECT recalculate_listing_ranking(id)
  FROM properties
  WHERE is_published = true AND deleted_at IS NULL;
$cron$);
