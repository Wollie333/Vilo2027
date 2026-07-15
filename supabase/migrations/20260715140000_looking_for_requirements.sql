-- =============================================================================
-- Looking-For — admin-managed accommodation requirements
-- =============================================================================
-- An admin-managed taxonomy (like amenities): admin defines GROUPS (Property
-- type, Bedrooms, Bathrooms, Size, Facilities…) each with a select mode, and the
-- OPTIONS within them. Guests SELECT from these on their request (a new
-- "Requirements" step) but can never add their own. Mirrors the amenity_groups /
-- amenity_catalog / property_amenities pattern (20260528000001_listing_taxonomy).
-- -----------------------------------------------------------------------------

-- 1. GROUPS ------------------------------------------------------------------
CREATE TABLE looking_for_requirement_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL,
  label        TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT 'list-checks',
  -- 'single' → radio (e.g. Property type); 'multi' → checkboxes (e.g. Facilities)
  select_mode  TEXT NOT NULL DEFAULT 'multi' CHECK (select_mode IN ('single', 'multi')),
  sort_order   INTEGER NOT NULL DEFAULT 100,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_lf_req_groups_slug_alive
  ON looking_for_requirement_groups (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_lf_req_groups_sort
  ON looking_for_requirement_groups (sort_order, label) WHERE deleted_at IS NULL;
CREATE TRIGGER lf_req_groups_updated_at
  BEFORE UPDATE ON looking_for_requirement_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. OPTIONS -----------------------------------------------------------------
CREATE TABLE looking_for_requirement_options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES looking_for_requirement_groups(id) ON DELETE RESTRICT,
  slug         TEXT NOT NULL,
  label        TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT 'check',
  sort_order   INTEGER NOT NULL DEFAULT 100,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_lf_req_options_slug_alive
  ON looking_for_requirement_options (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_lf_req_options_group
  ON looking_for_requirement_options (group_id, sort_order) WHERE deleted_at IS NULL;
CREATE TRIGGER lf_req_options_updated_at
  BEFORE UPDATE ON looking_for_requirement_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. POST ↔ OPTION join (loose slug coupling, like property_amenities) -------
CREATE TABLE looking_for_post_requirements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  option_key   TEXT NOT NULL,                 -- = looking_for_requirement_options.slug
  option_label TEXT,                          -- denormalised snapshot
  group_slug   TEXT,                          -- denormalised for grouped display
  option_id    UUID REFERENCES looking_for_requirement_options(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, option_key)
);
CREATE INDEX idx_lf_post_req_post ON looking_for_post_requirements (post_id);

-- 4. RLS ---------------------------------------------------------------------
ALTER TABLE looking_for_requirement_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_requirement_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_post_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_lf_req_groups" ON looking_for_requirement_groups FOR SELECT
  USING (is_published = TRUE AND deleted_at IS NULL);
CREATE POLICY "admin_full_lf_req_groups" ON looking_for_requirement_groups FOR ALL
  USING (is_super_admin() OR has_admin_permission('taxonomy.manage'));

CREATE POLICY "public_read_lf_req_options" ON looking_for_requirement_options FOR SELECT
  USING (is_published = TRUE AND deleted_at IS NULL);
CREATE POLICY "admin_full_lf_req_options" ON looking_for_requirement_options FOR ALL
  USING (is_super_admin() OR has_admin_permission('taxonomy.manage'));

-- Guests manage their own post's requirements; anyone may read those attached to
-- a public active post (so browsing hosts see what the guest needs).
CREATE POLICY "Guests manage own post requirements" ON looking_for_post_requirements FOR ALL
  USING (post_id IN (SELECT id FROM looking_for_posts WHERE guest_id = auth.uid()));
CREATE POLICY "Public read requirements of public posts" ON looking_for_post_requirements FOR SELECT
  USING (post_id IN (SELECT id FROM looking_for_posts WHERE is_public = TRUE AND status = 'active'));

-- 5. Audit target types (reuse taxonomy.manage) ------------------------------
ALTER TABLE admin_audit_log DROP CONSTRAINT admin_audit_log_target_type_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type IN (
    'host','guest','user','booking','listing','business','addon','policy',
    'review','subscription','plan','plan_feature','platform_service','product',
    'product_feature','platform_ledger','feature_override','platform_setting',
    'platform_staff','staff_member','impersonation','permission_denied',
    'help_article','help_video','help_faq','help_category','help_status',
    'help_settings','help_article_suggestion','broadcast','notification_send',
    'listing_category','amenity_group','amenity_catalog','special_category',
    'affiliate','affiliate_payout','affiliate_settings','marketing_asset',
    'looking_for_requirement_group','looking_for_requirement_option'
  ));

-- 6. Seed initial groups + options -------------------------------------------
WITH g AS (
  INSERT INTO looking_for_requirement_groups (slug, label, icon, select_mode, sort_order) VALUES
    ('property_type', 'Property type', 'home',         'single', 10),
    ('bedrooms',      'Bedrooms',      'bed-double',    'single', 20),
    ('bathrooms',     'Bathrooms',     'bath',          'single', 30),
    ('size',          'Size of place', 'ruler',         'single', 40),
    ('facilities',    'Facilities',    'sparkles',      'multi',  50)
  RETURNING id, slug
)
INSERT INTO looking_for_requirement_options (group_id, slug, label, icon, sort_order)
SELECT g.id, v.slug, v.label, v.icon, v.sort_order
FROM (VALUES
  -- Property type
  ('property_type', 'type_lodge',        'Lodge',         'tent',        110),
  ('property_type', 'type_bb',           'B&B',           'coffee',      120),
  ('property_type', 'type_self_catering','Self-catering', 'utensils',    130),
  ('property_type', 'type_guesthouse',   'Guesthouse',    'door-open',   140),
  ('property_type', 'type_hotel',        'Hotel',         'hotel',       150),
  ('property_type', 'type_villa',        'Villa',         'home',        160),
  ('property_type', 'type_cottage',      'Cottage',       'house',       170),
  ('property_type', 'type_apartment',    'Apartment',     'building',    180),
  -- Bedrooms
  ('bedrooms', 'bed_1', '1+ bedroom',  'bed', 210),
  ('bedrooms', 'bed_2', '2+ bedrooms', 'bed', 220),
  ('bedrooms', 'bed_3', '3+ bedrooms', 'bed', 230),
  ('bedrooms', 'bed_4', '4+ bedrooms', 'bed', 240),
  ('bedrooms', 'bed_5', '5+ bedrooms', 'bed', 250),
  -- Bathrooms
  ('bathrooms', 'bath_1', '1+ bathroom',  'bath', 310),
  ('bathrooms', 'bath_2', '2+ bathrooms', 'bath', 320),
  ('bathrooms', 'bath_3', '3+ bathrooms', 'bath', 330),
  -- Size of place
  ('size', 'size_studio', 'Studio',           'square',      410),
  ('size', 'size_small',  'Small',            'square',      420),
  ('size', 'size_medium', 'Medium',           'square',      430),
  ('size', 'size_large',  'Large',            'square',      440),
  ('size', 'size_whole',  'Whole property',   'home',        450),
  -- Facilities
  ('facilities', 'fac_pool',      'Swimming pool',   'waves',            510),
  ('facilities', 'fac_jacuzzi',   'Jacuzzi / hot tub','bath',            520),
  ('facilities', 'fac_wifi',      'Wi-Fi',           'wifi',             530),
  ('facilities', 'fac_braai',     'Braai / BBQ',     'utensils-crossed', 540),
  ('facilities', 'fac_parking',   'Parking',         'square-parking',   550),
  ('facilities', 'fac_aircon',    'Air conditioning','wind',             560),
  ('facilities', 'fac_fireplace', 'Fireplace',       'flame',            570),
  ('facilities', 'fac_kitchen',   'Full kitchen',    'utensils',         580),
  ('facilities', 'fac_pet',       'Pet friendly',    'paw-print',        590),
  ('facilities', 'fac_wheelchair','Wheelchair access','accessibility',   600),
  ('facilities', 'fac_generator', 'Backup power',    'zap',              610)
) AS v(group_slug, slug, label, icon, sort_order)
JOIN g ON g.slug = v.group_slug;
