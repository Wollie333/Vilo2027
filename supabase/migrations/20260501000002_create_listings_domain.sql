-- Migration: Domain 2 — Listings & Availability
-- Per supabase_database.md §5
-- Tables: listings, listing_amenities, listing_photos, listing_seasonal_pricing, listing_rankings
-- (blocked_dates lives in 000003 — it FKs into bookings)

-- ─── listings ─────────────────────────────────────────────────
CREATE TABLE public.listings (
  id                  uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id             uuid      NOT NULL REFERENCES hosts(id) ON DELETE RESTRICT,

  listing_type        text      NOT NULL CHECK (listing_type IN ('accommodation','experience')),
  accommodation_type  text      CHECK (accommodation_type IN
                                  ('hotel','guesthouse','bb','self_catering','lodge','other')),
  experience_type     text      CHECK (experience_type IN
                                  ('tour','activity','workshop','transfer','other')),
  name                text      NOT NULL,
  slug                text      UNIQUE,

  description         text,
  house_rules         text,
  what_to_bring       text,

  address_line1       text,
  address_line2       text,
  city                text,
  province            text,
  country             text      NOT NULL DEFAULT 'ZA',
  postal_code         text,
  latitude            numeric,
  longitude           numeric,
  location            geometry(Point, 4326),

  bedrooms            integer,
  bathrooms           integer,
  max_guests          integer,
  room_config         jsonb,
  check_in_time       time,
  check_out_time      time,
  min_nights          integer   DEFAULT 1,
  max_nights          integer,

  duration_minutes    integer,
  max_participants    integer,
  min_participants    integer   DEFAULT 1,
  meeting_point       text,
  schedule            jsonb,

  base_price          numeric,
  weekend_price       numeric,
  cleaning_fee        numeric,
  private_group_price numeric,
  currency            text      NOT NULL DEFAULT 'ZAR',

  cancellation_policy text      NOT NULL DEFAULT 'moderate'
                                CHECK (cancellation_policy IN ('flexible','moderate','strict')),
  instant_booking     boolean   NOT NULL DEFAULT false,

  accepts_paystack    boolean   NOT NULL DEFAULT false,
  accepts_paypal      boolean   NOT NULL DEFAULT false,
  accepts_eft         boolean   NOT NULL DEFAULT false,

  is_published        boolean   NOT NULL DEFAULT false,
  is_featured         boolean   NOT NULL DEFAULT false,
  is_suspended        boolean   NOT NULL DEFAULT false,
  published_at        timestamptz,

  search_vector       tsvector  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name,'')        || ' ' ||
      coalesce(description,'') || ' ' ||
      coalesce(city,'')        || ' ' ||
      coalesce(province,'')    || ' ' ||
      coalesce(country,'')
    )
  ) STORED,

  total_bookings      integer   NOT NULL DEFAULT 0,
  total_reviews       integer   NOT NULL DEFAULT 0,
  avg_rating          numeric   DEFAULT 0,

  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_listings_search_vector ON listings USING GIN(search_vector);
CREATE INDEX idx_listings_location      ON listings USING GIST(location);
CREATE INDEX idx_listings_host_id       ON listings(host_id);
CREATE INDEX idx_listings_type          ON listings(listing_type);
CREATE INDEX idx_listings_published     ON listings(is_published) WHERE is_published = true;
CREATE INDEX idx_listings_city          ON listings(city);
CREATE INDEX idx_listings_base_price    ON listings(base_price);
CREATE INDEX idx_listings_avg_rating    ON listings(avg_rating DESC);
CREATE INDEX idx_listings_name_trgm     ON listings USING GIN(name gin_trgm_ops);
CREATE INDEX idx_listings_city_trgm     ON listings USING GIN(city gin_trgm_ops);
CREATE INDEX idx_listings_deleted       ON listings(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN listings.slug IS
  'Auto-generated URL slug from name. Unique. Used in /listing/[slug]';
COMMENT ON COLUMN listings.location IS
  'PostGIS Point. Populated from latitude/longitude via trigger.';
COMMENT ON COLUMN listings.search_vector IS
  'Generated tsvector for full-text search. Never write directly.';
COMMENT ON COLUMN listings.is_suspended IS
  'Set by super admin only. Hides listing even if is_published = true.';

-- Trigger to sync PostGIS location from lat/lng
CREATE OR REPLACE FUNCTION sync_listing_location()
RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_listing_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON listings
  FOR EACH ROW EXECUTE FUNCTION sync_listing_location();

-- ─── listing_amenities ────────────────────────────────────────
CREATE TABLE public.listing_amenities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  amenity_key   text NOT NULL,
  amenity_label text,

  CONSTRAINT unique_amenity_per_listing UNIQUE (listing_id, amenity_key)
);

CREATE INDEX idx_listing_amenities_listing ON listing_amenities(listing_id);
CREATE INDEX idx_listing_amenities_key     ON listing_amenities(amenity_key);

ALTER TABLE listing_amenities ENABLE ROW LEVEL SECURITY;

-- ─── listing_photos ───────────────────────────────────────────
CREATE TABLE public.listing_photos (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  storage_path  text    NOT NULL,
  url           text    NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  caption       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_photos_listing ON listing_photos(listing_id);
CREATE INDEX idx_listing_photos_sort    ON listing_photos(listing_id, sort_order);

ALTER TABLE listing_photos ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN listing_photos.sort_order IS '0 = cover photo. Host can reorder.';
COMMENT ON COLUMN listing_photos.storage_path IS
  'Supabase Storage path. Format: listing-photos/{listing_id}/{uuid}.{ext}';

-- ─── listing_seasonal_pricing ─────────────────────────────────
CREATE TABLE public.listing_seasonal_pricing (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  label       text    NOT NULL,
  start_date  date    NOT NULL,
  end_date    date    NOT NULL,
  price       numeric NOT NULL,
  currency    text    NOT NULL DEFAULT 'ZAR',
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_date_range  CHECK (end_date >= start_date),
  CONSTRAINT positive_price    CHECK (price > 0)
);

CREATE INDEX idx_seasonal_pricing_listing ON listing_seasonal_pricing(listing_id);
CREATE INDEX idx_seasonal_pricing_dates   ON
  listing_seasonal_pricing(listing_id, start_date, end_date);

ALTER TABLE listing_seasonal_pricing ENABLE ROW LEVEL SECURITY;

-- ─── listing_rankings ─────────────────────────────────────────
CREATE TABLE public.listing_rankings (
  listing_id              uuid    PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  ranking_score           numeric NOT NULL DEFAULT 0,
  component_rating        numeric NOT NULL DEFAULT 0,
  component_reviews       numeric NOT NULL DEFAULT 0,
  component_profile       numeric NOT NULL DEFAULT 0,
  component_response_rate numeric NOT NULL DEFAULT 0,
  component_plan_boost    numeric NOT NULL DEFAULT 0,
  last_calculated         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_rankings_score ON listing_rankings(ranking_score DESC);

ALTER TABLE listing_rankings ENABLE ROW LEVEL SECURITY;
