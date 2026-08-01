-- 20260801140000 and 20260801150000 both no-op'd — their patterns failed to
-- match the U+00B7 middle-dot separator (bytes c2 b7). Do it explicitly with
-- chr(183): drop the "Vilo" token and the middle-dot(s), then trim. meta_title
-- is a bare title (the layout template appends "· {brand}"), so the result is
-- e.g. "Villas to rent in South Africa" → rendered "… · Wielo".
UPDATE public.property_categories
SET meta_title = btrim(replace(replace(meta_title, 'Vilo', ''), chr(183), ''))
WHERE position('Vilo' in meta_title) > 0;
