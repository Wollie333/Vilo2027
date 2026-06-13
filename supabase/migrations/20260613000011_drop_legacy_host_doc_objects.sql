-- Migration (Phase 3b cleanup): drop the now-unused host-level document objects.
--
-- After Phase 3a (documents snapshot the listing's BUSINESS) and Phase 3b
-- (per-business numbering via business_counters / business_doc_code), nothing
-- live reads these any more:
--   • host_doc_code(uuid)   — superseded by business_doc_code(uuid)
--   • host_counters         — superseded by business_counters
--   • host_business_details — superseded by the businesses table; the two logo
--                             actions + the demo seed were repointed to
--                             businesses.logo_path / the default business.
--
-- host_doc_code is the only live object that referenced host_business_details,
-- so it is dropped first. No CASCADE — if anything unexpectedly still depends on
-- these, the migration fails loudly rather than dropping collateral.

DROP FUNCTION IF EXISTS host_doc_code(uuid);
DROP TABLE IF EXISTS public.host_business_details;
DROP TABLE IF EXISTS public.host_counters;
