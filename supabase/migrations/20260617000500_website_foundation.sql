-- Migration: Website CMS — Phase 1 data foundation
--
-- Adds the additive table set for the per-business Website CMS (plan §1). A
-- website belongs to a Business (1 site per business; an account with N
-- businesses runs N independent sites). All Website data is a publication
-- CHANNEL on top of the existing Property (`properties`) + booking engine —
-- nothing financial is touched. Book CTAs deep-link the existing engine, which
-- re-prices server-side, so `website_rooms.display_price` is cosmetic only.
--
-- Naming: authored AFTER the listings→properties rename (R0–R4), so the channel
-- membership table is `website_properties(property_id)` per the plan's note.
--
-- RLS model: management is owner (host) + super-admin only. The PUBLIC site
-- renderer reads via the service-role admin client with explicit filters (the
-- force-dynamic public-page pattern) — NOT the anon key — so there are no anon
-- read policies here. That is deliberate: the draft/published split lives in the
-- same rows/columns (twin `*_sections` on pages, `published_snapshot` + draft
-- jsonb on host_websites), so a row-level anon read would leak drafts. Keeping
-- reads service-role-only is both leak-safe and matches the planned renderer.

-- ============================================================
-- 1. host_websites  — one per business (the site root)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.host_websites (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  host_id            uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE, -- denormalised for fast RLS
  subdomain          text NOT NULL UNIQUE
                       CHECK (subdomain = lower(subdomain)
                              AND subdomain ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'),
  custom_domain      text UNIQUE,
  domain_status      text NOT NULL DEFAULT 'none'
                       CHECK (domain_status IN ('none','pending','verifying','active','error')),
  ssl_status         text NOT NULL DEFAULT 'none'
                       CHECK (ssl_status IN ('none','pending','active','error')),
  verification_token text,
  status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','published','unpublished')),
  brand              jsonb NOT NULL DEFAULT '{}',  -- {name,tagline,logo_path,logo_style,favicon_path}
  theme              jsonb NOT NULL DEFAULT '{}',  -- {preset,accent,font,radius}
  seo                jsonb NOT NULL DEFAULT '{}',  -- {title,description,og_image_path,gsc_token,robots_index,sitemap_enabled}
  settings           jsonb NOT NULL DEFAULT '{}',
  published_snapshot jsonb,                        -- {brand,theme,seo,nav,properties,rooms} captured at publish
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

COMMENT ON TABLE public.host_websites IS
  'Per-business hosted micro-site root (1 per business). Chrome (brand/theme/seo/nav) lives here; the draft vs published chrome diff is draft cols vs published_snapshot. Rendered by the service-role admin client only.';
COMMENT ON COLUMN public.host_websites.subdomain IS
  'Lowercase DNS label for <subdomain>.vilo.site. Reserved words are blocked at claim time in app code (shared RESERVED list).';

CREATE INDEX IF NOT EXISTS idx_host_websites_host        ON public.host_websites(host_id);
CREATE INDEX IF NOT EXISTS idx_host_websites_published   ON public.host_websites(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_host_websites_custom_dom  ON public.host_websites(custom_domain) WHERE custom_domain IS NOT NULL;

CREATE TRIGGER set_updated_at_host_websites BEFORE UPDATE ON public.host_websites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.host_websites ENABLE ROW LEVEL SECURITY;

CREATE POLICY host_websites_owner_all ON public.host_websites
  FOR ALL TO authenticated
  USING (host_id = get_my_host_id())
  WITH CHECK (host_id = get_my_host_id());
CREATE POLICY host_websites_admin_all ON public.host_websites
  FOR ALL USING (is_super_admin());

-- ============================================================
-- 2. website_pages  — JSONB sections (draft/published twin columns)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_pages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id         uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  kind               text NOT NULL DEFAULT 'custom'
                       CHECK (kind IN ('home','about','rooms','contact','custom')),
  slug               text NOT NULL,
  title              text,
  nav_label          text,
  nav_order          int  NOT NULL DEFAULT 0,
  show_in_nav        boolean NOT NULL DEFAULT true,
  draft_sections     jsonb NOT NULL DEFAULT '[]',
  published_sections jsonb NOT NULL DEFAULT '[]',
  seo_overrides      jsonb NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_pages_website ON public.website_pages(website_id);

CREATE TRIGGER set_updated_at_website_pages BEFORE UPDATE ON public.website_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_pages_owner_all ON public.website_pages
  FOR ALL TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()))
  WITH CHECK (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_pages_admin_all ON public.website_pages
  FOR ALL USING (is_super_admin());

-- ============================================================
-- 3. website_properties  — channel membership + display overrides
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_properties (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id        uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  property_id       uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  is_visible        boolean NOT NULL DEFAULT true,
  sort_order        int NOT NULL DEFAULT 0,
  display_overrides jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_website_properties_website  ON public.website_properties(website_id);
CREATE INDEX IF NOT EXISTS idx_website_properties_property ON public.website_properties(property_id);

ALTER TABLE public.website_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_properties_owner_all ON public.website_properties
  FOR ALL TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()))
  WITH CHECK (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_properties_admin_all ON public.website_properties
  FOR ALL USING (is_super_admin());

-- ============================================================
-- 4. website_rooms  — per-room visibility + cosmetic display overrides
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_rooms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id       uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  room_id          uuid NOT NULL REFERENCES public.property_rooms(id) ON DELETE CASCADE,
  is_visible       boolean NOT NULL DEFAULT true,
  display_name     text,
  display_price    numeric,   -- cosmetic only; the Book CTA re-prices via the engine
  display_currency text,      -- currency beside the amount (CLAUDE.md convention)
  display_desc     text,
  sort_order       int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, room_id)
);

COMMENT ON COLUMN public.website_rooms.display_price IS
  'Cosmetic display price for the marketing site only. Booking always re-prices server-side via the existing engine — never trust this for money.';

CREATE INDEX IF NOT EXISTS idx_website_rooms_website ON public.website_rooms(website_id);
CREATE INDEX IF NOT EXISTS idx_website_rooms_room    ON public.website_rooms(room_id);

ALTER TABLE public.website_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_rooms_owner_all ON public.website_rooms
  FOR ALL TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()))
  WITH CHECK (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_rooms_admin_all ON public.website_rooms
  FOR ALL USING (is_super_admin());

-- ============================================================
-- 5. website_blog_categories + website_blog_posts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_blog_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  name       text NOT NULL,
  slug       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_blog_cats_website ON public.website_blog_categories(website_id);

ALTER TABLE public.website_blog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_blog_cats_owner_all ON public.website_blog_categories
  FOR ALL TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()))
  WITH CHECK (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_blog_cats_admin_all ON public.website_blog_categories
  FOR ALL USING (is_super_admin());

CREATE TABLE IF NOT EXISTS public.website_blog_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.website_blog_categories(id) ON DELETE SET NULL,
  title       text NOT NULL,
  slug        text NOT NULL,
  status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','published','scheduled')),
  publish_at  timestamptz,
  cover_path  text,
  excerpt     text,
  body_html   text,   -- sanitised at render time (reuse sanitiseListingHtml)
  seo         jsonb NOT NULL DEFAULT '{}',
  author_name text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (website_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_blog_posts_website ON public.website_blog_posts(website_id);
CREATE INDEX IF NOT EXISTS idx_website_blog_posts_status  ON public.website_blog_posts(website_id, status);

CREATE TRIGGER set_updated_at_website_blog_posts BEFORE UPDATE ON public.website_blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.website_blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_blog_posts_owner_all ON public.website_blog_posts
  FOR ALL TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()))
  WITH CHECK (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_blog_posts_admin_all ON public.website_blog_posts
  FOR ALL USING (is_super_admin());

-- ============================================================
-- 6. website_domain_events  — INSERT-only domain ops audit
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_domain_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  event      text NOT NULL
               CHECK (event IN ('domain_added','verified','ssl_issued','verify_failed','removed')),
  detail     jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.website_domain_events IS
  'INSERT-only audit of custom-domain operations. Written by the website-domain-poll Edge Function (service role). No UPDATE/DELETE.';

CREATE INDEX IF NOT EXISTS idx_website_domain_events_website ON public.website_domain_events(website_id, created_at DESC);

ALTER TABLE public.website_domain_events ENABLE ROW LEVEL SECURITY;

-- Read-only for the owner + admin; inserts are service-role (bypass RLS). No
-- UPDATE/DELETE policies → append-only for everyone but the service role.
CREATE POLICY website_domain_events_owner_read ON public.website_domain_events
  FOR SELECT TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_domain_events_admin_read ON public.website_domain_events
  FOR SELECT USING (is_super_admin());

-- ============================================================
-- 7. Storage: public website-assets bucket + host-scoped object policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('website-assets', 'website-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Path layout: website-assets/{website_id}/...  (folder[1] = website id)
CREATE POLICY "public_read_website_assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'website-assets');

CREATE POLICY "host_upload_website_assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'website-assets' AND auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.host_websites WHERE host_id = get_my_host_id()
    )
  );

CREATE POLICY "host_delete_website_assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'website-assets' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.host_websites WHERE host_id = get_my_host_id()
    )
  );

-- ============================================================
-- 8. plan_features seed — new channel/website keys (plan §7)
-- ============================================================
-- Pre-MVP policy (CLAUDE.md / AGENT_RULES §3.4): every new gated feature is OPEN
-- on every plan so the founder can smoke-test. The product editor unions these
-- keys from CANONICAL_PRODUCT_FEATURES, and the action-layer gate short-circuits
-- to true pre-MVP; this seed keeps the plan_features fallback consistent.
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
('free','website_builder',       true, null, 'Build a hosted website'),
('free','website_blog',          true, null, 'Website blog'),
('free','website_custom_domain', true, null, 'Connect a custom domain'),
('free','custom_website_design', true, null, 'Done-for-you website design'),
('basic','website_builder',       true, null, 'Build a hosted website'),
('basic','website_blog',          true, null, 'Website blog'),
('basic','website_custom_domain', true, null, 'Connect a custom domain'),
('basic','custom_website_design', true, null, 'Done-for-you website design'),
('pro','website_builder',       true, null, 'Build a hosted website'),
('pro','website_blog',          true, null, 'Website blog'),
('pro','website_custom_domain', true, null, 'Connect a custom domain'),
('pro','custom_website_design', true, null, 'Done-for-you website design'),
('business','website_builder',       true, null, 'Build a hosted website'),
('business','website_blog',          true, null, 'Website blog'),
('business','website_custom_domain', true, null, 'Connect a custom domain'),
('business','custom_website_design', true, null, 'Done-for-you website design')
ON CONFLICT (plan, feature_key) DO NOTHING;
