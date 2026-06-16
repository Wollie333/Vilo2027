-- Migration: Affiliate marketing assets — admin-uploaded banners/images that
-- affiliates download or embed (with their referral link wrapped around them).
--
-- Files live in the public 'marketing-assets' storage bucket (so banners can be
-- hotlinked / embedded on an affiliate's own site). Admin uploads via a
-- service-role server action; affiliates only read active rows.

CREATE TABLE public.marketing_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'banner',  -- banner | social | email | logo | other
  file_path   text NOT NULL,                   -- storage path within the bucket
  file_url    text NOT NULL,                   -- public URL
  mime_type   text,
  width       integer,
  height      integer,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_marketing_assets_active ON public.marketing_assets(is_active, category, sort_order);

ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;
-- Any authenticated user (the affiliate area is universal) can read live assets.
CREATE POLICY marketing_assets_read ON public.marketing_assets
  FOR SELECT USING (is_active = true);

-- Public bucket so embeds/hotlinks work without auth. Admin writes via service role.
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-assets', 'marketing-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_marketing_assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'marketing-assets');

COMMENT ON TABLE public.marketing_assets IS
  'Admin-uploaded affiliate marketing material (banners/images). Affiliates download or embed with their referral link.';
