-- Migration: Add-ons catalog
--
-- Universal, host-owned add-ons (Breakfast, Wild Drive, Snorkeling, etc.)
-- assignable to a listing whole-listing-wide OR scoped per room, with an
-- optional per-listing price override. Guests select them at checkout and
-- they snapshot into booking_addons.
--
-- Pre-MVP data policy (CLAUDE.md): destructive reshape of booking_addons OK.

-- ─── 1. addons (per-host catalog) ────────────────────────────────
CREATE TABLE public.addons (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,

  name            text    NOT NULL,
  description     text,
  image_path      text,

  pricing_model   text    NOT NULL
                          CHECK (pricing_model IN
                            ('per_stay','per_night','per_guest','per_guest_per_night','per_couple')),
  unit_price      numeric NOT NULL CHECK (unit_price >= 0),
  currency        text    NOT NULL DEFAULT 'ZAR',

  min_quantity    integer NOT NULL DEFAULT 1 CHECK (min_quantity >= 0),
  max_quantity    integer          CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),
  is_required     boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  lead_time_days  integer NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),

  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT addon_name_length CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE INDEX idx_addons_host_active ON addons(host_id, is_active);
CREATE INDEX idx_addons_host_sort   ON addons(host_id, sort_order);

ALTER TABLE addons ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE addons IS
  'Host-owned reusable add-ons (breakfast, transfers, activities). Catalog rows. Exposed on a listing via listing_addons.';

-- ─── 2. listing_addons (availability + per-listing overrides) ────
CREATE TABLE public.listing_addons (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          uuid    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  addon_id            uuid    NOT NULL REFERENCES addons(id)   ON DELETE CASCADE,
  room_id             uuid    REFERENCES listing_rooms(id) ON DELETE CASCADE,

  unit_price_override numeric CHECK (unit_price_override IS NULL OR unit_price_override >= 0),

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- NULL-safe uniqueness via partial indexes (mirrors listing_amenities pattern).
CREATE UNIQUE INDEX uq_listing_addons_listingwide
  ON listing_addons(listing_id, addon_id) WHERE room_id IS NULL;
CREATE UNIQUE INDEX uq_listing_addons_room
  ON listing_addons(listing_id, addon_id, room_id) WHERE room_id IS NOT NULL;

CREATE INDEX idx_listing_addons_listing ON listing_addons(listing_id);
CREATE INDEX idx_listing_addons_addon   ON listing_addons(addon_id);
CREATE INDEX idx_listing_addons_room    ON listing_addons(room_id) WHERE room_id IS NOT NULL;

ALTER TABLE listing_addons ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE listing_addons IS
  'Join: which addons are available on which listing/room. NULL room_id = listing-wide. unit_price_override is per-listing.';

-- ─── 3. Reshape booking_addons ───────────────────────────────────
-- The original generated subtotal (quantity * unit_price) is wrong for
-- non-flat pricing models. Drop it and store an explicit snapshot. Add
-- catalog FK + pricing snapshot. Pre-MVP: no data to preserve.
ALTER TABLE public.booking_addons
  ADD COLUMN addon_id      uuid REFERENCES addons(id) ON DELETE SET NULL,
  ADD COLUMN pricing_model text CHECK (pricing_model IN
                            ('per_stay','per_night','per_guest','per_guest_per_night','per_couple')),
  ADD COLUMN currency      text NOT NULL DEFAULT 'ZAR',
  ADD COLUMN is_required   boolean NOT NULL DEFAULT false;

ALTER TABLE public.booking_addons DROP COLUMN subtotal;
ALTER TABLE public.booking_addons ADD COLUMN subtotal numeric NOT NULL DEFAULT 0;

CREATE INDEX idx_booking_addons_addon ON booking_addons(addon_id);

COMMENT ON COLUMN booking_addons.addon_id IS
  'NULL = free-form line (e.g. cloned from quote_addons). Set = guest-selected from the catalog.';
COMMENT ON COLUMN booking_addons.subtotal IS
  'Computed at insert time via compute_addon_subtotal(); snapshotted so future price changes do not retroactively alter the booking.';

-- ─── 4. compute_addon_subtotal (shared math) ─────────────────────
CREATE OR REPLACE FUNCTION compute_addon_subtotal(
  p_pricing_model text,
  p_unit_price    numeric,
  p_quantity      integer,
  p_nights        integer,
  p_guests        integer
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT p_unit_price * p_quantity * CASE p_pricing_model
    WHEN 'per_stay'            THEN 1
    WHEN 'per_night'           THEN p_nights
    WHEN 'per_guest'           THEN p_guests
    WHEN 'per_guest_per_night' THEN p_nights * p_guests
    WHEN 'per_couple'          THEN ceil(p_guests::numeric / 2)
  END;
$$;

COMMENT ON FUNCTION compute_addon_subtotal IS
  'Single source of truth for addon line totals. Mirror this formula in TS for the cart UI; server stays authoritative.';

-- ─── 5. updated_at trigger for addons ────────────────────────────
CREATE OR REPLACE FUNCTION touch_addons_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_addons_touch
  BEFORE UPDATE ON addons
  FOR EACH ROW EXECUTE FUNCTION touch_addons_updated_at();

-- ─── 6. RLS — addons ─────────────────────────────────────────────
CREATE POLICY "host_manage_own_addons" ON addons FOR ALL
  USING (host_id = get_my_host_id());

CREATE POLICY "staff_read_addons" ON addons FOR SELECT
  USING (host_id = get_my_host_id_as_staff());

CREATE POLICY "public_read_active_addons" ON addons FOR SELECT
  USING (is_active = true);

CREATE POLICY "admin_full_addons" ON addons FOR ALL
  USING (is_super_admin());

-- ─── 7. RLS — listing_addons ─────────────────────────────────────
CREATE POLICY "host_manage_own_listing_addons" ON listing_addons FOR ALL
  USING (
    listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id())
  );

CREATE POLICY "staff_read_listing_addons" ON listing_addons FOR SELECT
  USING (
    listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id_as_staff())
  );

-- Public read for guest checkout. Anon can see availability rows for any
-- published listing (the addon row itself is gated by public_read_active_addons).
CREATE POLICY "public_read_listing_addons" ON listing_addons FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE is_published = true
        AND is_suspended = false
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "admin_full_listing_addons" ON listing_addons FOR ALL
  USING (is_super_admin());

-- ─── 8. plan_features — gate add-ons on Pro+ ─────────────────────
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
  ('free',     'addons', false, null, 'Booking add-ons catalog'),
  ('basic',    'addons', false, null, 'Booking add-ons catalog'),
  ('pro',      'addons', true,  null, 'Booking add-ons catalog'),
  ('business', 'addons', true,  null, 'Booking add-ons catalog')
ON CONFLICT (plan, feature_key) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled,
      limit_value = EXCLUDED.limit_value,
      description = EXCLUDED.description;

-- ─── 9. Storage bucket: addon-images ─────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'addon-images', 'addon-images', true, 8388608,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_addon_images" ON storage.objects
  FOR SELECT USING (bucket_id = 'addon-images');

CREATE POLICY "host_upload_addon_images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'addon-images' AND auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM addons WHERE host_id = get_my_host_id()
    )
  );

CREATE POLICY "host_delete_addon_images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'addon-images' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM addons WHERE host_id = get_my_host_id()
    )
  );
