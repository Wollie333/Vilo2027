-- Migration: Host logo for branded financial documents
--
-- Adds a logo to the host's business details and a public bucket to store it.
-- The logo is rendered on quote / invoice / credit-note PDFs + their public
-- pages. Public-read so @react-pdf and the shareable pages can embed it.

ALTER TABLE public.host_business_details
  ADD COLUMN IF NOT EXISTS logo_path text;

COMMENT ON COLUMN public.host_business_details.logo_path IS
  'Storage path in the host-logos bucket. Rendered on branded financial docs.';

-- ─── Storage bucket: host-logos ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'host-logos', 'host-logos', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Files live under {host_id}/... — the host folder gates ownership.
CREATE POLICY "public_read_host_logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'host-logos');

CREATE POLICY "host_upload_host_logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'host-logos' AND auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = get_my_host_id()::text
  );

CREATE POLICY "host_update_host_logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'host-logos' AND
    (storage.foldername(name))[1] = get_my_host_id()::text
  );

CREATE POLICY "host_delete_host_logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'host-logos' AND
    (storage.foldername(name))[1] = get_my_host_id()::text
  );
