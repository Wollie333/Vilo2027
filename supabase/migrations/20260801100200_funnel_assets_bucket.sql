-- Funnel Manager — Phase 1c: funnel-assets public storage bucket.
--
-- Funnel brochures are PUBLIC marketing collateral (a lead downloads the PDF from
-- the thank-you page), so a public-read bucket with a deterministic URL is fine —
-- no signing, unlike the private host-brochures bucket. Uploads are admin-only via
-- the service-role client, so there is no untrusted write path; but per
-- 20260722184137 we still constrain mime + size AT THE BUCKET so even a
-- service-role upload can't put the wrong thing on the public storage domain.
--
-- Model for the admin upload/picker: the affiliate marketing-assets surface
-- (marketing_assets), NOT the website image library (image-only, website-scoped).
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   DROP POLICY IF EXISTS "public_read_funnel_assets" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'funnel-assets';

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'funnel-assets',
  'funnel-assets',
  true,
  ARRAY['application/pdf'],
  20971520          -- 20 MB
)
ON CONFLICT (id) DO NOTHING;

-- Public read (brochure download from the public thank-you page). Writes are
-- service-role only (admin upload), which bypasses RLS — no insert policy needed.
DROP POLICY IF EXISTS "public_read_funnel_assets" ON storage.objects;
CREATE POLICY "public_read_funnel_assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'funnel-assets');
