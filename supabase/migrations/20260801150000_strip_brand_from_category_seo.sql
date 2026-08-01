-- Correct fix for the seeded category SEO titles (supersedes 20260801140000,
-- which no-op'd: the middle-dot in its LIKE pattern didn't byte-match the stored
-- separator, so 0 rows changed).
--
-- Two problems with the seed value "… · Vilo":
--   1. "Vilo" is the old brand (now "Wielo").
--   2. meta_title is meant to be a BARE title — the root layout applies a
--      `%s · {brand}` template (app/[locale]/layout.tsx), so any embedded brand
--      is redundant and would double up ("… · Wielo · Wielo").
-- Fix: strip the trailing separator + "Vilo" so the template supplies the brand
-- exactly once. The `.` matches the middle-dot regardless of its byte encoding,
-- avoiding the earlier mismatch. "Vilo" never occurs except as this token
-- ("Villas" shares no "Vilo" substring), so the match is precise.
UPDATE public.property_categories
SET meta_title = regexp_replace(meta_title, '\s*.\s*Vilo\s*$', '')
WHERE meta_title LIKE '%Vilo%';
