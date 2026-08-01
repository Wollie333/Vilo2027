-- Final correction for the category SEO titles. 20260801140000 replaced the old
-- brand ("· Vilo" → "· Wielo") but LEFT the brand embedded; the root layout
-- template already appends "· {brand}" (app/[locale]/layout.tsx), so an embedded
-- brand renders a double ("… · Wielo · Wielo"). meta_title is meant to be a BARE
-- title. Strip the trailing " · Wielo" so the template supplies the brand once.
-- chr(183) = the U+00B7 middle-dot separator; scoped to rows that still carry it.
UPDATE public.property_categories
SET meta_title = btrim(replace(replace(meta_title, 'Wielo', ''), chr(183), ''))
WHERE meta_title LIKE '%' || chr(183) || ' Wielo';
