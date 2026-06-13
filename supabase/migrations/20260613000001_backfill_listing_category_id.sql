-- Migration: backfill listings.category_id from the legacy accommodation_type.
--
-- Some listings have accommodation_type set (e.g. "guesthouse") but a NULL
-- category_id, so they only surfaced on public category pages via the legacy
-- accommodation_type fallback and were invisible to anything keyed on
-- category_id. Map the type slug to the matching listing_categories row.
-- accommodation_type "other" maps to the "other_stay" category slug.

UPDATE public.listings l
SET category_id = c.id
FROM public.listing_categories c
WHERE l.category_id IS NULL
  AND l.accommodation_type IS NOT NULL
  AND c.slug = CASE
                 WHEN l.accommodation_type = 'other' THEN 'other_stay'
                 ELSE l.accommodation_type
               END;
