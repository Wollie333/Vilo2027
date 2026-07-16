-- Project-owned, non-trigger DB functions (RPC candidates) + every cron command.
-- Consumed by scripts/audit-wiring.mjs sweep 2 to find functions nothing calls.
-- Extension-owned functions (PostGIS, pg_trgm) are excluded — they are noise.
SELECT jsonb_build_object(
  'fns', (
    SELECT jsonb_agg(p.proname ORDER BY p.proname)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prorettype <> 'trigger'::regtype
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  ),
  'crons', (SELECT jsonb_agg(command) FROM cron.job)
) AS doc;
