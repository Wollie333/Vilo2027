-- Migration: Website CMS — media library metadata (Phase 0B)
--
-- The reusable Media Library browses everything already in the public
-- `website-assets/{website_id}/` Storage folder (the SSOT for "what files
-- exist", regardless of which uploader put them there — logo, section image,
-- blog cover, OG image). This table holds OPTIONAL per-asset metadata keyed by
-- storage path: alt text (accessibility + SEO) and intrinsic dimensions. The
-- library LEFT-merges it onto the Storage listing, so an asset with no row still
-- shows; a row simply enriches it.
--
-- Owner + super-admin manage their own rows (RLS via host_websites). Not in the
-- "never hard-delete" set — deleting a media object deletes its metadata row.

CREATE TABLE IF NOT EXISTS public.website_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  path        text NOT NULL,         -- storage path within website-assets ({website_id}/...)
  alt         text,                  -- alt text for <img>; drives SEO/accessibility
  width       int,
  height      int,
  size_bytes  bigint,
  mime        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, path)
);

COMMENT ON TABLE public.website_media IS
  'Optional per-asset metadata (alt text, dimensions) for the Website Media Library. Keyed by storage path; the library merges it onto the website-assets folder listing.';

CREATE INDEX IF NOT EXISTS idx_website_media_website ON public.website_media(website_id);

CREATE TRIGGER set_updated_at_website_media BEFORE UPDATE ON public.website_media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.website_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_media_owner_all ON public.website_media
  FOR ALL TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()))
  WITH CHECK (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_media_admin_all ON public.website_media
  FOR ALL USING (is_super_admin());
