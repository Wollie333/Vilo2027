-- Migration: Admin-managed special/deal categories
--
-- Replaces the hardcoded SPECIAL_CATEGORIES array in lib/specials/categories.ts
-- with a database-driven taxonomy that admins can manage. Hosts assign these
-- categories to their deals, and the public filters/browses by them.
--
-- 1. special_categories — the admin-managed category list
-- 2. Seed with the existing hardcoded categories (so the migration is non-breaking)
-- 3. RLS: admin full access, public read active only

-- ─── 1. special_categories ─────────────────────────────────────────────────
CREATE TABLE public.special_categories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- identity
  key           text        NOT NULL UNIQUE,  -- URL-safe slug, used in filters
  label         text        NOT NULL,         -- display name
  description   text,                         -- optional description for admins
  icon          text,                         -- optional icon name (lucide)

  -- SEO (for future /deals/c/[key] landing pages)
  meta_title       text,
  meta_description text,
  og_image_url     text,
  intro_markdown   text,                      -- rich intro for landing page

  -- ordering & visibility
  sort_order    integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,  -- admin can disable

  -- timestamps
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX special_categories_active_idx
  ON public.special_categories (is_active, sort_order)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_special_categories_touch
  BEFORE UPDATE ON public.special_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE public.special_categories IS
  'Admin-managed categories for specials/deals. Hosts assign these to deals, public filters by them.';
COMMENT ON COLUMN public.special_categories.key IS
  'URL-safe slug used in query params and breadcrumbs (e.g., "romantic", "last_minute").';
COMMENT ON COLUMN public.special_categories.is_active IS
  'When false, category is hidden from hosts and public but existing assignments remain.';

-- ─── 2. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.special_categories ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY special_categories_admin_all ON public.special_categories FOR ALL
  USING (is_super_admin());

-- Public/host reads active, non-deleted only
CREATE POLICY special_categories_public_read ON public.special_categories FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);

-- ─── 3. Seed existing hardcoded categories ─────────────────────────────────
-- These match the current SPECIAL_CATEGORIES in lib/specials/categories.ts
-- so the migration is non-breaking.
INSERT INTO public.special_categories (key, label, sort_order, icon) VALUES
  ('romantic',     'Romantic getaway',     10, 'Heart'),
  ('family',       'Family friendly',      20, 'Users'),
  ('last_minute',  'Last minute',          30, 'Clock'),
  ('festive',      'Festive / holiday',    40, 'PartyPopper'),
  ('business',     'Business travel',      50, 'Briefcase'),
  ('wellness',     'Wellness & spa',       60, 'Sparkles'),
  ('adventure',    'Adventure & outdoors', 70, 'Mountain'),
  ('seasonal',     'Seasonal offer',       80, 'Sun')
ON CONFLICT (key) DO NOTHING;
