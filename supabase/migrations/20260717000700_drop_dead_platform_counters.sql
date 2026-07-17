-- =============================================================================
-- Drop the dead `platform_counters` table.
--
-- It once backed the invoice / credit-note numbering, but those moved to
-- sequences (seq_invoice_number, …). NOTHING reads or writes it now — proven:
--   SELECT count(*) FROM pg_proc WHERE prosrc ILIKE '%platform_counters%'  -> 0
-- and the only code references are superseded migrations.
--
-- It is also the ONLY table on the platform with no RLS, and `anon` holds full
-- SELECT/INSERT/UPDATE/DELETE on it (proven in the wiring audit: as anon one
-- could rewrite last_invoice_number to 999999 and delete the row). Harmless only
-- because it is dead — so remove the dead thing rather than leave a writable
-- orphan on the public schema.
-- =============================================================================

DROP TABLE IF EXISTS public.platform_counters;
