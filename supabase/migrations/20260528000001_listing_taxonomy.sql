-- Migration: Listing Taxonomy — admin-managed categories, amenities, SEO
--
-- Replaces the hardcoded `accommodation_type` / `experience_type` CHECK
-- enums with a `listing_categories` master table (parent/child nesting +
-- per-category SEO + landing-page content). Introduces a separate
-- `amenity_groups` + `amenity_catalog` pair so amenities are admin-CRUD too.
--
-- Adds permission key `taxonomy.manage` and the matching audit target types.
-- Pre-MVP destructive: drops the existing CHECK on listings.{accommodation,
-- experience}_type and replaces them with a soft FK to listing_categories.
-- Old columns stay in place as nullable read-fallback; a follow-up drops
-- them once nothing reads them.

-- ─── listing_categories ───────────────────────────────────────
CREATE TABLE public.listing_categories (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id        uuid        REFERENCES listing_categories(id) ON DELETE RESTRICT,
  kind             text        NOT NULL CHECK (kind IN ('accommodation', 'experience')),
  slug             text        NOT NULL,
  label            text        NOT NULL,
  description      text,
  icon             text        NOT NULL DEFAULT 'home',
  sort_order       integer     NOT NULL DEFAULT 100,
  is_published     boolean     NOT NULL DEFAULT true,
  -- SEO + landing page content
  hero_image_url   text,
  og_image_url     text,
  meta_title       text,
  meta_description text,
  canonical_url    text,
  intro_markdown   text,
  faq              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CONSTRAINT listing_categories_not_self_parent CHECK (parent_id IS DISTINCT FROM id)
);

-- Only one live row per slug; soft-deleted rows keep their slug for audit.
CREATE UNIQUE INDEX uq_listing_categories_slug_alive
  ON listing_categories(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_listing_categories_parent
  ON listing_categories(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listing_categories_kind_sort
  ON listing_categories(kind, sort_order, label) WHERE deleted_at IS NULL;
CREATE INDEX idx_listing_categories_published
  ON listing_categories(is_published) WHERE deleted_at IS NULL AND is_published = true;

ALTER TABLE listing_categories ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_listing_categories_updated_at
  BEFORE UPDATE ON listing_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE listing_categories IS
  'Admin-managed taxonomy for listings. Two roots (Accommodation, Experiences); arbitrary depth supported, 2-level used in UI. Carries per-category SEO + landing-page content for /c/[slug].';
COMMENT ON COLUMN listing_categories.faq IS
  'Array of {"q": string, "a": string} rendered as FAQPage JSON-LD on /c/[slug].';

-- ─── amenity_groups ───────────────────────────────────────────
CREATE TABLE public.amenity_groups (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        NOT NULL,
  label        text        NOT NULL,
  icon         text        NOT NULL DEFAULT 'sparkles',
  sort_order   integer     NOT NULL DEFAULT 100,
  is_published boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE UNIQUE INDEX uq_amenity_groups_slug_alive
  ON amenity_groups(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_amenity_groups_sort
  ON amenity_groups(sort_order, label) WHERE deleted_at IS NULL;

ALTER TABLE amenity_groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_amenity_groups_updated_at
  BEFORE UPDATE ON amenity_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── amenity_catalog ──────────────────────────────────────────
CREATE TABLE public.amenity_catalog (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid        NOT NULL REFERENCES amenity_groups(id) ON DELETE RESTRICT,
  slug         text        NOT NULL,
  label        text        NOT NULL,
  icon         text        NOT NULL DEFAULT 'check-circle-2',
  sort_order   integer     NOT NULL DEFAULT 100,
  is_published boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE UNIQUE INDEX uq_amenity_catalog_slug_alive
  ON amenity_catalog(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_amenity_catalog_group
  ON amenity_catalog(group_id, sort_order) WHERE deleted_at IS NULL;

ALTER TABLE amenity_catalog ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_amenity_catalog_updated_at
  BEFORE UPDATE ON amenity_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON COLUMN amenity_catalog.slug IS
  'Stable key — matches listing_amenities.amenity_key. Renaming a slug breaks per-listing rows; deactivate instead.';

-- ─── listings: drop CHECK constraints, add category_id ────────
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_accommodation_type_check;
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_experience_type_check;

ALTER TABLE public.listings
  ADD COLUMN category_id uuid REFERENCES listing_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_listings_category
  ON listings(category_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN listings.category_id IS
  'FK to listing_categories (the new admin-managed taxonomy). The legacy accommodation_type / experience_type columns stay as nullable read-fallback for one cycle.';

-- ─── listing_amenities: link to catalog ───────────────────────
ALTER TABLE public.listing_amenities
  ADD COLUMN catalog_id uuid REFERENCES amenity_catalog(id) ON DELETE SET NULL;

CREATE INDEX idx_listing_amenities_catalog ON listing_amenities(catalog_id);

COMMENT ON COLUMN listing_amenities.catalog_id IS
  'Optional FK to amenity_catalog. Kept loose so per-listing rows survive a catalog row being unpublished or soft-deleted.';

-- ─── RLS policies ─────────────────────────────────────────────
CREATE POLICY "public_read_listing_categories" ON listing_categories FOR SELECT
  USING (is_published = true AND deleted_at IS NULL);
CREATE POLICY "admin_full_listing_categories" ON listing_categories FOR ALL
  USING (is_super_admin() OR has_admin_permission('taxonomy.manage'));

CREATE POLICY "public_read_amenity_groups" ON amenity_groups FOR SELECT
  USING (is_published = true AND deleted_at IS NULL);
CREATE POLICY "admin_full_amenity_groups" ON amenity_groups FOR ALL
  USING (is_super_admin() OR has_admin_permission('taxonomy.manage'));

CREATE POLICY "public_read_amenity_catalog" ON amenity_catalog FOR SELECT
  USING (is_published = true AND deleted_at IS NULL);
CREATE POLICY "admin_full_amenity_catalog" ON amenity_catalog FOR ALL
  USING (is_super_admin() OR has_admin_permission('taxonomy.manage'));

-- ─── extend admin_audit_log.target_type ──────────────────────
ALTER TABLE admin_audit_log DROP CONSTRAINT admin_audit_log_target_type_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type IN (
    'host','guest','user','booking','listing','review','subscription',
    'feature_override','platform_setting','platform_staff','staff_member',
    'impersonation','permission_denied',
    'help_article','help_video','help_faq','help_category',
    'help_status','help_settings','help_article_suggestion',
    'listing_category','amenity_group','amenity_catalog'
  ));

-- ─── permission key + role grants ────────────────────────────
INSERT INTO admin_permissions (key, domain, description) VALUES
  ('taxonomy.manage', 'platform', 'Create, edit, publish, and delete listing categories, amenity groups, amenities, and per-category SEO content.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_key) VALUES
  ('super_admin', 'taxonomy.manage'),
  ('content_mod', 'taxonomy.manage')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- ─── seed: roots ─────────────────────────────────────────────
INSERT INTO listing_categories (id, parent_id, kind, slug, label, description, icon, sort_order, meta_title, meta_description) VALUES
  ('11111111-1111-4111-8111-000000000001', NULL, 'accommodation', 'accommodation', 'Accommodation',
   'Hand-picked places to stay across South Africa — villas, lodges, guesthouses and more.',
   'building-2', 10,
   'Accommodation in South Africa · Vilo',
   'Direct-book the best villas, lodges, B&Bs, guesthouses and cottages in South Africa. No middleman fees, instant confirmation, talk to your host.'),
  ('11111111-1111-4111-8111-000000000002', NULL, 'experience', 'experiences', 'Experiences',
   'Tours, activities, workshops and transfers run by independent South African operators.',
   'sparkles', 20,
   'Experiences in South Africa · Vilo',
   'Book authentic tours, activities, workshops and transfers run by independent South African operators. Pay direct, skip the markup.');

-- ─── seed: accommodation leaves ──────────────────────────────
INSERT INTO listing_categories (parent_id, kind, slug, label, description, icon, sort_order, meta_title, meta_description) VALUES
  ('11111111-1111-4111-8111-000000000001', 'accommodation', 'villa',         'Villa',                    'Standalone villas — private pools, full kitchens, room to spread out.',  'home',           110, 'Villas to rent in South Africa · Vilo',         'Direct-book private villas across South Africa. Pool, full kitchen, sleeps a crowd. Talk to the host, no booking fees.'),
  ('11111111-1111-4111-8111-000000000001', 'accommodation', 'cottage',       'Cottage',                  'Cosy cottages — perfect for couples and small families.',                'house',          120, 'Cottages to rent in South Africa · Vilo',       'Charming cottages across South Africa. Karoo, Garden Route, Drakensberg — book direct with the owner.'),
  ('11111111-1111-4111-8111-000000000001', 'accommodation', 'self_catering', 'Self-catering',            'Self-catering apartments and houses with full kitchens.',                'utensils',       130, 'Self-catering accommodation · Vilo',            'Self-catering apartments, houses and cottages across South Africa. Cook your own meals, set your own schedule.'),
  ('11111111-1111-4111-8111-000000000001', 'accommodation', 'bb',            'B&B',                      'Bed and breakfast — owner-hosted, breakfast included.',                  'coffee',         140, 'B&Bs in South Africa · Vilo',                   'Find owner-hosted B&Bs across South Africa. Home-cooked breakfast, local knowledge, direct booking.'),
  ('11111111-1111-4111-8111-000000000001', 'accommodation', 'guesthouse',    'Guesthouse',               'Owner-run guesthouses with several rooms.',                              'door-open',      150, 'Guesthouses in South Africa · Vilo',            'Owner-run guesthouses across South Africa. Personal welcome, hands-on hosts, fair prices.'),
  ('11111111-1111-4111-8111-000000000001', 'accommodation', 'lodge',         'Lodge',                    'Bush and wilderness lodges, often with game viewing or hiking.',         'tent',           160, 'Bush & wilderness lodges · Vilo',               'Bush lodges, wilderness camps and safari accommodation across Southern Africa. Direct-booking, no markup.'),
  ('11111111-1111-4111-8111-000000000001', 'accommodation', 'hotel',         'Hotel',                    'Independent hotels and boutique stays.',                                 'hotel',          170, 'Independent hotels · Vilo',                     'Boutique and independent hotels across South Africa. Skip the OTAs — book direct.'),
  ('11111111-1111-4111-8111-000000000001', 'accommodation', 'other_stay',    'Other',                    'Anything that does not fit the categories above.',                       'more-horizontal',900, 'Other places to stay · Vilo',                   'Unique South African stays that defy categorisation. Book direct with the host.');

-- ─── seed: experience leaves ─────────────────────────────────
INSERT INTO listing_categories (parent_id, kind, slug, label, description, icon, sort_order, meta_title, meta_description) VALUES
  ('11111111-1111-4111-8111-000000000002', 'experience', 'tour',          'Tour',                       'Guided tours — city, wine, wildlife, cultural.',                         'map',            210, 'Tours in South Africa · Vilo',                  'Find guided tours across South Africa run by independent operators. Wine routes, township tours, wildlife safaris.'),
  ('11111111-1111-4111-8111-000000000002', 'experience', 'activity',      'Activity',                   'Outdoor activities — surfing, hiking, climbing, diving.',                'mountain',       220, 'Activities & adventure · Vilo',                 'Surf lessons, hikes, climbing, diving, and outdoor adventures across South Africa. Book direct with the operator.'),
  ('11111111-1111-4111-8111-000000000002', 'experience', 'workshop',      'Workshop',                   'Hands-on workshops and classes — cooking, craft, art.',                  'palette',        230, 'Workshops & classes · Vilo',                    'Cooking, craft, art and creative workshops across South Africa. Learn from a local — book direct.'),
  ('11111111-1111-4111-8111-000000000002', 'experience', 'transfer',      'Transfer',                   'Private and shared transfers — airport, intercity, day trips.',          'car',            240, 'Private transfers · Vilo',                      'Airport transfers, intercity drives and day-trip transport across South Africa. Pre-book direct.'),
  ('11111111-1111-4111-8111-000000000002', 'experience', 'other_xp',      'Other',                      'Experiences that do not fit elsewhere.',                                 'more-horizontal',910, 'Other experiences · Vilo',                      'Unique South African experiences. Book direct with the host.');

-- ─── seed: amenity groups + amenities ────────────────────────
WITH g AS (
  INSERT INTO amenity_groups (slug, label, icon, sort_order) VALUES
    ('essentials',    'Essentials',          'check-circle-2', 10),
    ('outdoor',       'Outdoor & view',      'tree-pine',      20),
    ('family',        'Family-friendly',     'baby',           30),
    ('safety',        'Safety',              'shield-check',   40),
    ('accessibility', 'Accessibility',       'accessibility',  50)
  RETURNING id, slug
)
INSERT INTO amenity_catalog (group_id, slug, label, icon, sort_order)
SELECT g.id, v.slug, v.label, v.icon, v.sort_order
FROM (VALUES
  -- Essentials
  ('essentials', 'wifi',            'WiFi',                'wifi',             110),
  ('essentials', 'kitchen',         'Kitchen',             'utensils',         120),
  ('essentials', 'parking',         'Free parking',        'square-parking',   130),
  ('essentials', 'aircon',          'Air conditioning',    'wind',             140),
  ('essentials', 'heating',         'Heating',             'flame',            150),
  ('essentials', 'tv',              'TV',                  'tv',               160),
  ('essentials', 'washer',          'Washing machine',     'shirt',            170),
  ('essentials', 'dryer',           'Tumble dryer',        'shirt',            180),
  ('essentials', 'workspace',       'Workspace',           'laptop',           190),
  ('essentials', 'self_checkin',    'Self check-in',       'key-round',        200),
  ('essentials', 'host_onsite',     'Host on-site',        'user-check',       210),
  -- Outdoor & view
  ('outdoor',    'pool',            'Pool',                'waves',            310),
  ('outdoor',    'hot_tub',         'Hot tub',             'bath',             320),
  ('outdoor',    'fireplace',       'Fireplace',           'flame',            330),
  ('outdoor',    'braai',           'Braai / BBQ',         'utensils-crossed', 340),
  -- Family-friendly
  ('family',     'family_friendly', 'Family friendly',     'users',            410),
  ('family',     'pet_friendly',    'Pet friendly',        'paw-print',        420),
  -- Safety
  ('safety',     'smoke_alarm',     'Smoke alarm',         'bell-ring',        510),
  ('safety',     'first_aid',       'First-aid kit',       'cross',            520),
  -- Accessibility
  ('accessibility','wheelchair',    'Wheelchair accessible','accessibility',   610)
) AS v(group_slug, slug, label, icon, sort_order)
JOIN g ON g.slug = v.group_slug;

-- ─── backfill: link existing listings to their seeded category ─
-- Pre-MVP DB may have a handful of smoke-test rows; safe no-op if empty.
UPDATE public.listings l
   SET category_id = c.id
  FROM public.listing_categories c
 WHERE l.category_id IS NULL
   AND l.listing_type = 'accommodation'
   AND c.parent_id IS NOT NULL
   AND c.kind = 'accommodation'
   AND c.slug = CASE
     WHEN l.accommodation_type = 'other' THEN 'other_stay'
     ELSE l.accommodation_type
   END;

UPDATE public.listings l
   SET category_id = c.id
  FROM public.listing_categories c
 WHERE l.category_id IS NULL
   AND l.listing_type = 'experience'
   AND c.parent_id IS NOT NULL
   AND c.kind = 'experience'
   AND c.slug = CASE
     WHEN l.experience_type = 'other' THEN 'other_xp'
     ELSE l.experience_type
   END;

-- ─── backfill: link existing listing_amenities to catalog ─────
UPDATE public.listing_amenities la
   SET catalog_id = ac.id
  FROM public.amenity_catalog ac
 WHERE la.catalog_id IS NULL
   AND la.amenity_key = ac.slug;
