-- Fix a stale brand name in seeded category SEO titles.
--
-- The taxonomy seed (20260528000001_listing_taxonomy) hard-coded "· Vilo" into
-- the category SEO title (then column seo_title, renamed to meta_title by
-- 20260617000100_rename_r1_leaf_tables). The brand is "Wielo". These meta_title
-- values are used verbatim as the public <title> + OpenGraph title on the
-- /c/[slug] category landing pages (see app/[locale]/c/[slug]/page.tsx
-- generateMetadata), so this is a real SEO leak of the old brand, not cosmetic.
--
-- Idempotent: only rows still containing the old token are touched.
UPDATE public.property_categories
SET meta_title = replace(meta_title, '· Vilo', '· Wielo')
WHERE meta_title LIKE '%· Vilo%';
