# Vilo Platform — Supabase Database Architecture

**Version:** 1.1  
**Status:** Final Draft  
**Last Updated:** May 2026  
**Companion Documents:** `vilo-platform-mvp.md` (v1.2), `customer_journey.md` (v1.0)
**Changelog v1.1:** Added Domain 10 — Refund Manager, Domain 11 — Policy Manager. Updated schema overview, index strategy, RLS, functions, triggers, cron jobs, storage, and migration list.  
**Database:** PostgreSQL 15 via Supabase  
**Extensions Required:** `uuid-ossp`, `pgcrypto`, `pg_trgm`, `postgis`, `pg_cron`

---

## Table of Contents

1. [Architecture Principles](#1-architecture-principles)
2. [Extension Setup](#2-extension-setup)
3. [Schema Overview — Entity Relationship Summary](#3-schema-overview)
4. [Domain 1 — Identity & Access](#4-domain-1--identity--access)
5. [Domain 2 — Listings & Availability](#5-domain-2--listings--availability)
6. [Domain 3 — Bookings](#6-domain-3--bookings)
7. [Domain 4 — Payments](#7-domain-4--payments)
8. [Domain 5 — Subscriptions & Feature Control](#8-domain-5--subscriptions--feature-control)
9. [Domain 6 — Inbox & Messaging](#9-domain-6--inbox--messaging)
10. [Domain 7 — Reviews](#10-domain-7--reviews)
11. [Domain 8 — Directory & Discovery](#11-domain-8--directory--discovery)
12. [Domain 9 — Platform Administration](#12-domain-9--platform-administration)
13. [Domain 10 — Refund Manager](#13-domain-10--refund-manager)
14. [Domain 11 — Policy Manager](#14-domain-11--policy-manager)
15. [Enumerated Types](#13-enumerated-types)
16. [Full Index Strategy](#14-full-index-strategy)
17. [Row Level Security Policies](#15-row-level-security-rls-policies)
18. [Database Functions & RPCs](#16-database-functions--rpcs)
19. [Triggers & Automation](#17-triggers--automation)
20. [pg_cron Scheduled Jobs](#18-pg_cron-scheduled-jobs)
21. [Supabase Realtime Configuration](#19-supabase-realtime-configuration)
22. [Supabase Storage Buckets](#20-supabase-storage-buckets)
23. [Seed Data](#21-seed-data)
24. [Migration Strategy](#22-migration-strategy)
25. [Performance & Scaling Notes](#23-performance--scaling-notes)

---

## 1. Architecture Principles

These rules govern every decision in this schema. Developers must read and follow them before writing any query or migration.

**1. UUID everywhere.** All primary keys are `uuid` using `gen_random_uuid()`. Never use serial integers — they leak row counts and are non-portable.

**2. Soft deletes on critical tables.** Bookings, listings, hosts, and users are never hard-deleted in production. They are marked `deleted_at timestamptz`. Hard deletes are only allowed by the super admin in response to a POPIA/GDPR deletion request, and are logged first.

**3. RLS is the security layer — never trust the client.** Every table has RLS enabled. The `anon` key can only read publicly-accessible data. The `service_role` key is used only inside Edge Functions. No client-side query can bypass RLS.

**4. JSONB for schema-flexible data.** Fields that vary by subtype (accommodation vs experience settings, address formats, pricing overrides) are stored as `jsonb`. Always validate structure in the application layer or with check constraints.

**5. Timestamps on everything.** Every table has at minimum `created_at timestamptz DEFAULT now()`. Tables with mutable records also have `updated_at timestamptz DEFAULT now()`, maintained by a trigger.

**6. Foreign keys with ON DELETE behaviour explicitly set.** Every FK declares either `ON DELETE CASCADE`, `ON DELETE SET NULL`, or `ON DELETE RESTRICT`. Nothing is left to default.

**7. Denormalise strategically.** `host_id` is stored on `bookings` even though it can be derived via `listings.host_id`. This is intentional — it enables fast RLS checks and query performance without joins.

**8. Never store secrets in the database.** Payment provider API keys live in environment variables only. Banking details are encrypted at the application layer before storage.

**9. Audit everything that matters.** The `admin_audit_log` captures all super-admin mutations. Subscription state changes are append-only in `subscription_history`.

**10. Currency is always stored with the amount.** Never store a bare `amount numeric` without a `currency text` column beside it.

---

## 2. Extension Setup

Run once on the Supabase project before any migrations:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
```

Enable Realtime publication after tables are created:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
```

---

## 3. Schema Overview

```
auth.users (Supabase managed)
    │
    └──► user_profiles  ◄────────── staff_members ──────► hosts
              │                                               │
              │◄── guest_id ──── bookings ──── host_id ──────┤
              │                     │                        │
              │              payments / refunds              │
              │                                              │
              │◄── guest_id ── conversations ── host_id ─────┤
              │                     │                        │
              │                  messages                    │
              │                                              │
              │◄── guest_id ──── reviews                    │
                                    │                        │
                               listings ◄── host_id ─────────┘
                                    │
                     ┌──────────────┼──────────────────────┐
                     │              │                      │
             blocked_dates   listing_photos   listing_seasonal_pricing
                                    │
                            listing_rankings
                            featured_listings

subscriptions ──► hosts
plan_features (global, per plan)
host_feature_overrides ──► hosts
push_tokens ──► user_profiles
message_templates ──► hosts
staff_invites ──► hosts
admin_audit_log ──► user_profiles (admin)
platform_settings (singleton key-value store)

refund_requests ──► bookings / payments / hosts / user_profiles
  (Domain 10 — Refund Manager)

policies ──► hosts
  ├── policy_cancellation_rules ──► policies
  ├── policy_content ──► policies
  ├── listing_policies ──► listings × policies
  └── policy_snapshots ──► bookings × policies
  (Domain 11 — Policy Manager)
```

---

## 4. Domain 1 — Identity & Access

### 4.1 `auth.users` — Supabase Managed

Owned by Supabase Auth. Do not write migrations against it. Reference only via foreign keys.

Key columns (reference only):
- `id uuid` — referenced by `user_profiles.id`
- `email text`
- `email_confirmed_at timestamptz`
- `raw_user_meta_data jsonb` — stores `{ full_name, avatar_url }` from OAuth

---

### 4.2 `user_profiles`

One row per user. Auto-created by trigger on `auth.users` insert.

```sql
CREATE TABLE public.user_profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'guest'
                          CHECK (role IN ('guest','host','staff','super_admin')),
  full_name   text,
  avatar_url  text,
  phone       text,
  email       text,
  is_active   boolean     NOT NULL DEFAULT true,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_role    ON user_profiles(role);
CREATE INDEX idx_user_profiles_email   ON user_profiles(email);
CREATE INDEX idx_user_profiles_deleted ON user_profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN user_profiles.role IS 'guest | host | staff | super_admin';
COMMENT ON COLUMN user_profiles.deleted_at IS 'Soft delete. Set by admin on POPIA/GDPR deletion request.';
```

**Auto-create profile trigger:**
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

### 4.3 `hosts`

One row per host organisation. Created when a user completes host onboarding.

```sql
CREATE TABLE public.hosts (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  handle              text    UNIQUE NOT NULL,
  display_name        text    NOT NULL,
  bio                 text,
  cover_photo_url     text,
  avatar_url          text,
  website_url         text,
  languages_spoken    text[]  DEFAULT '{}',
  social_links        jsonb   DEFAULT '{}',
  is_active           boolean NOT NULL DEFAULT true,
  is_verified         boolean NOT NULL DEFAULT false,
  banking_details     jsonb,
  response_rate       numeric DEFAULT 0,
  avg_response_hours  numeric DEFAULT 0,
  total_bookings      integer NOT NULL DEFAULT 0,
  total_reviews       integer NOT NULL DEFAULT 0,
  avg_rating          numeric DEFAULT 0,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT handle_format CHECK (handle ~ '^[a-z0-9-]+$'),
  CONSTRAINT handle_length CHECK (char_length(handle) BETWEEN 3 AND 60)
);

CREATE INDEX idx_hosts_user_id     ON hosts(user_id);
CREATE INDEX idx_hosts_handle      ON hosts(handle);
CREATE INDEX idx_hosts_is_active   ON hosts(is_active) WHERE is_active = true;
CREATE INDEX idx_hosts_is_verified ON hosts(is_verified);
CREATE INDEX idx_hosts_deleted     ON hosts(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN hosts.handle IS 'URL slug. Regex: ^[a-z0-9-]+$. Used in viloplatform.com/[handle]';
COMMENT ON COLUMN hosts.banking_details IS
  'Encrypted jsonb: { bank_name, account_holder, account_number, branch_code, reference_format }';
COMMENT ON COLUMN hosts.is_verified IS 'Manually awarded by super admin after identity verification.';
COMMENT ON COLUMN hosts.response_rate IS '0.00 to 1.00. Fraction of requests responded to within 24h.';
```

---

### 4.4 `staff_members`

Links a user to a host organisation as a staff member.

```sql
CREATE TABLE public.staff_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_staff_per_host UNIQUE (host_id, user_id)
);

CREATE INDEX idx_staff_members_host_id ON staff_members(host_id);
CREATE INDEX idx_staff_members_user_id ON staff_members(user_id);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
```

---

### 4.5 `staff_invites`

Pending invitations sent by hosts. Deleted after acceptance or expiry.

```sql
CREATE TABLE public.staff_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  email       text NOT NULL,
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_invites_token   ON staff_invites(token);
CREATE INDEX idx_staff_invites_host_id ON staff_invites(host_id);
CREATE INDEX idx_staff_invites_email   ON staff_invites(email);

ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN staff_invites.token IS
  'Secure random hex token sent in invite email. Expires in 7 days.';
```

---

## 5. Domain 2 — Listings & Availability

### 5.1 `listings`

Central table for all bookable items — accommodations and experiences.

```sql
CREATE TABLE public.listings (
  id                  uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id             uuid      NOT NULL REFERENCES hosts(id) ON DELETE RESTRICT,

  -- Type & identity
  listing_type        text      NOT NULL CHECK (listing_type IN ('accommodation','experience')),
  accommodation_type  text      CHECK (accommodation_type IN
                                  ('hotel','guesthouse','bb','self_catering','lodge','other')),
  experience_type     text      CHECK (experience_type IN
                                  ('tour','activity','workshop','transfer','other')),
  name                text      NOT NULL,
  slug                text      UNIQUE,

  -- Content
  description         text,
  house_rules         text,
  what_to_bring       text,

  -- Location
  address_line1       text,
  address_line2       text,
  city                text,
  province            text,
  country             text      NOT NULL DEFAULT 'ZA',
  postal_code         text,
  latitude            numeric,
  longitude           numeric,
  location            geometry(Point, 4326),

  -- Accommodation-specific
  bedrooms            integer,
  bathrooms           integer,
  max_guests          integer,
  room_config         jsonb,
  check_in_time       time,
  check_out_time      time,
  min_nights          integer   DEFAULT 1,
  max_nights          integer,

  -- Experience-specific
  duration_minutes    integer,
  max_participants    integer,
  min_participants    integer   DEFAULT 1,
  meeting_point       text,
  schedule            jsonb,

  -- Pricing
  base_price          numeric,
  weekend_price       numeric,
  cleaning_fee        numeric,
  private_group_price numeric,
  currency            text      NOT NULL DEFAULT 'ZAR',

  -- Policies
  cancellation_policy text      NOT NULL DEFAULT 'moderate'
                                CHECK (cancellation_policy IN ('flexible','moderate','strict')),
  instant_booking     boolean   NOT NULL DEFAULT false,

  -- Payment methods accepted (denormalised from feature flags for query performance)
  accepts_paystack    boolean   NOT NULL DEFAULT false,
  accepts_paypal      boolean   NOT NULL DEFAULT false,
  accepts_eft         boolean   NOT NULL DEFAULT false,

  -- Visibility
  is_published        boolean   NOT NULL DEFAULT false,
  is_featured         boolean   NOT NULL DEFAULT false,
  is_suspended        boolean   NOT NULL DEFAULT false,
  published_at        timestamptz,

  -- Full-text search (auto-generated)
  search_vector       tsvector  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name,'')        || ' ' ||
      coalesce(description,'') || ' ' ||
      coalesce(city,'')        || ' ' ||
      coalesce(province,'')    || ' ' ||
      coalesce(country,'')
    )
  ) STORED,

  -- Denormalised stats (updated by triggers)
  total_bookings      integer   NOT NULL DEFAULT 0,
  total_reviews       integer   NOT NULL DEFAULT 0,
  avg_rating          numeric   DEFAULT 0,

  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
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
```

**Trigger to sync PostGIS location column from lat/lng:**
```sql
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
```

---

### 5.2 `listing_amenities`

Normalised amenity tags. Enables efficient filter queries.

```sql
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
```

**Canonical amenity keys:** `wifi`, `pool`, `parking`, `pet_friendly`, `braai_bbq`, `air_conditioning`, `kitchen`, `garden`, `fireplace`, `spa`, `gym`, `laundry`, `tv`, `wheelchair_accessible`, `breakfast_included`, `airport_shuttle`, `beach_access`, `mountain_view`, `sea_view`, `private_entrance`, `baby_cot`, `hot_tub`, `solar_power`, `generator`, `borehole_water`, `hiking_trails`, `game_drives`

---

### 5.3 `listing_photos`

Ordered photo storage. `sort_order = 0` is the cover image.

```sql
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
```

---

### 5.4 `listing_seasonal_pricing`

Date-range price overrides applied on top of `base_price`.

```sql
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
```

---

### 5.5 `blocked_dates`

Explicitly blocked dates. Confirmed bookings also insert rows here via trigger.

```sql
CREATE TABLE public.blocked_dates (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid  NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  date        date  NOT NULL,
  reason      text,
  booking_id  uuid  REFERENCES bookings(id) ON DELETE SET NULL,
  created_by  uuid  REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_blocked_date UNIQUE (listing_id, date)
);

CREATE INDEX idx_blocked_dates_listing ON blocked_dates(listing_id);
CREATE INDEX idx_blocked_dates_date    ON blocked_dates(listing_id, date);

ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN blocked_dates.booking_id IS
  'Populated when this block was created by a confirmed booking.';
```

---

### 5.6 `listing_rankings`

Cached directory ranking scores. Recalculated every 15 minutes by `pg_cron`.

```sql
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
```

---

## 6. Domain 3 — Bookings

### 6.1 `bookings`

The core transactional record for every booking on the platform.

```sql
CREATE TABLE public.bookings (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships (host_id denormalised for RLS performance)
  listing_id        uuid    NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  host_id           uuid    NOT NULL REFERENCES hosts(id) ON DELETE RESTRICT,
  guest_id          uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,

  -- Human-readable reference
  reference         text    UNIQUE NOT NULL DEFAULT
    'VILO-' || to_char(now(),'YYYY') || '-' ||
    upper(substring(gen_random_uuid()::text,1,6)),

  -- State machine
  status            text    NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                              'pending','pending_eft','pending_eft_review',
                              'confirmed','checked_in','completed',
                              'cancelled_by_host','cancelled_by_guest',
                              'declined','expired','no_show'
                            )),
  previous_status   text,

  -- Dates
  check_in          date,
  check_out         date,
  session_date      timestamptz,

  -- Computed: nights stayed (NULL for experiences)
  nights            integer GENERATED ALWAYS AS (
    CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL
    THEN (check_out - check_in) ELSE NULL END
  ) STORED,

  -- Guests
  guests_count      integer NOT NULL DEFAULT 1,
  guests_breakdown  jsonb,

  -- Financials
  base_amount       numeric NOT NULL,
  cleaning_fee      numeric NOT NULL DEFAULT 0,
  total_amount      numeric NOT NULL,
  currency          text    NOT NULL DEFAULT 'ZAR',
  payment_method    text    CHECK (payment_method IN ('paystack','paypal','eft')),
  payment_status    text    NOT NULL DEFAULT 'pending'
                            CHECK (payment_status IN (
                              'pending','authorised','completed',
                              'failed','refunded','partially_refunded','voided'
                            )),
  eft_proof_url     text,

  -- State transition timestamps
  confirmed_at      timestamptz,
  declined_at       timestamptz,
  cancelled_at      timestamptz,
  checked_in_at     timestamptz,
  checked_out_at    timestamptz,

  -- Metadata
  cancellation_reason text,
  cancelled_by      text    CHECK (cancelled_by IN ('guest','host','admin','system')),
  special_requests  text,
  internal_notes    text,
  actioned_by       uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,

  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bookings_listing_id     ON bookings(listing_id);
CREATE INDEX idx_bookings_host_id        ON bookings(host_id);
CREATE INDEX idx_bookings_guest_id       ON bookings(guest_id);
CREATE INDEX idx_bookings_status         ON bookings(status);
CREATE INDEX idx_bookings_reference      ON bookings(reference);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_check_in       ON bookings(check_in);
CREATE INDEX idx_bookings_session_date   ON bookings(session_date);
CREATE INDEX idx_bookings_created_at     ON bookings(created_at DESC);
CREATE INDEX idx_bookings_host_status    ON bookings(host_id, status);
CREATE INDEX idx_bookings_host_checkin   ON bookings(host_id, check_in);
CREATE INDEX idx_bookings_pending_expiry ON bookings(status, created_at)
  WHERE status IN ('pending','pending_eft');

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN bookings.reference IS
  'Human-readable ref shown in UI and emails. Format: VILO-YYYY-XXXXXX';
COMMENT ON COLUMN bookings.nights IS
  'Computed column. check_out - check_in. NULL for experiences.';
COMMENT ON COLUMN bookings.host_id IS
  'Denormalised from listings.host_id for RLS and query performance.';
COMMENT ON COLUMN bookings.actioned_by IS
  'The user who last confirmed/declined the booking (host or staff member).';
```

**Booking Status State Machine:**
```
pending            → confirmed | declined | cancelled_by_guest | expired
pending_eft        → pending_eft_review | cancelled_by_guest | expired
pending_eft_review → confirmed | pending_eft
confirmed          → checked_in | cancelled_by_host | cancelled_by_guest | no_show
checked_in         → completed
completed          → (terminal)
cancelled_by_host  → (terminal)
cancelled_by_guest → (terminal)
declined           → (terminal)
expired            → (terminal)
no_show            → (terminal)
```

---

### 6.2 `booking_notes`

Append-only private notes on a booking. Visible to host and staff only — guests never see these.

```sql
CREATE TABLE public.booking_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_notes_booking ON booking_notes(booking_id);

ALTER TABLE booking_notes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE booking_notes IS
  'Private notes on a booking. Host and staff only. Guests never see these.';
```

---

## 7. Domain 4 — Payments

### 7.1 `payments`

One record per payment attempt. Multiple records can exist per booking (retry after failure).

```sql
CREATE TABLE public.payments (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid    NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,

  amount             numeric NOT NULL,
  currency           text    NOT NULL DEFAULT 'ZAR',
  method             text    NOT NULL CHECK (method IN ('paystack','paypal','eft')),
  status             text    NOT NULL DEFAULT 'pending'
                             CHECK (status IN (
                               'pending','authorised','completed',
                               'failed','refunded','partially_refunded','voided'
                             )),

  -- Provider
  provider_reference text,
  provider_response  jsonb,

  -- EFT
  eft_proof_url      text,

  -- Timestamps
  authorised_at      timestamptz,
  captured_at        timestamptz,
  failed_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- Idempotency guard
  CONSTRAINT unique_provider_reference UNIQUE (provider_reference)
);

CREATE INDEX idx_payments_booking_id   ON payments(booking_id);
CREATE INDEX idx_payments_status       ON payments(status);
CREATE INDEX idx_payments_method       ON payments(method);
CREATE INDEX idx_payments_created_at   ON payments(created_at DESC);
CREATE INDEX idx_payments_provider_ref ON payments(provider_reference);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN payments.provider_response IS
  'Full raw webhook payload for audit and debugging.';
COMMENT ON COLUMN payments.provider_reference IS
  'Unique per provider. Used for idempotency checks on webhooks.';
```

---

### 7.2 `refunds`

One row per refund attempt. Linked to both the original payment and booking.

```sql
CREATE TABLE public.refunds (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id         uuid    NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  booking_id         uuid    NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,

  amount             numeric NOT NULL,
  currency           text    NOT NULL DEFAULT 'ZAR',
  reason             text,
  status             text    NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','processing','completed','failed')),

  provider_reference text,
  provider_response  jsonb,

  -- EFT refunds are manual
  is_manual          boolean NOT NULL DEFAULT false,
  manual_note        text,
  processed_by       uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX idx_refunds_booking_id ON refunds(booking_id);
CREATE INDEX idx_refunds_status     ON refunds(status);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN refunds.is_manual IS
  'True for EFT refunds — processed outside the platform by the host.';
```

---

### 7.3 `eft_banking_details`

Separated from `hosts` for a cleaner encryption boundary. One row per host.

```sql
CREATE TABLE public.eft_banking_details (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          uuid UNIQUE NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  bank_name        text NOT NULL,
  account_holder   text NOT NULL,
  account_number   text NOT NULL,   -- encrypted at application layer
  branch_code      text NOT NULL,
  swift_code       text,
  reference_format text NOT NULL DEFAULT 'VILO-{booking_ref}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eft_banking_details ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN eft_banking_details.account_number IS
  'Encrypted at application layer before storage. Never stored in plain text.';
COMMENT ON COLUMN eft_banking_details.reference_format IS
  '{booking_ref} is replaced with the booking reference number at display time.';
```

---

## 8. Domain 5 — Subscriptions & Feature Control

### 8.1 `subscriptions`

One active subscription per host at any time.

```sql
CREATE TABLE public.subscriptions (
  id                         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id                    uuid    UNIQUE NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,

  plan                       text    NOT NULL DEFAULT 'free'
                                     CHECK (plan IN ('free','basic','pro','business')),
  billing_cycle              text    CHECK (billing_cycle IN ('monthly','annual')),
  status                     text    NOT NULL DEFAULT 'active'
                                     CHECK (status IN (
                                       'trialing','active','past_due',
                                       'restricted','cancelled','expired'
                                     )),

  -- Trial
  trial_ends_at              timestamptz,

  -- Billing period
  current_period_start       timestamptz,
  current_period_end         timestamptz,

  -- Grace period
  grace_period_ends_at       timestamptz,
  failed_payment_count       integer NOT NULL DEFAULT 0,

  -- Provider references
  paystack_customer_code     text,
  paystack_subscription_code text,
  paypal_subscription_id     text,
  paypal_plan_id             text,

  -- Cancellation
  cancel_at_period_end       boolean NOT NULL DEFAULT false,
  cancelled_at               timestamptz,
  cancellation_reason        text,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_host_id ON subscriptions(host_id);
CREATE INDEX idx_subscriptions_status  ON subscriptions(status);
CREATE INDEX idx_subscriptions_plan    ON subscriptions(plan);
CREATE INDEX idx_subscriptions_period  ON subscriptions(current_period_end)
  WHERE status IN ('active','trialing','past_due');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN subscriptions.grace_period_ends_at IS
  'Set to now() + 5 days when payment fails. Account restricted after this timestamp.';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS
  'If true, active until current_period_end then downgrades to free plan.';
```

---

### 8.2 `subscription_history`

Append-only log of all subscription state changes. Never update — only insert.

```sql
CREATE TABLE public.subscription_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  host_id         uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  event           text NOT NULL,
  from_plan       text,
  to_plan         text,
  from_status     text,
  to_status       text,
  amount_charged  numeric,
  currency        text,
  notes           text,
  performed_by    uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_history_subscription ON subscription_history(subscription_id);
CREATE INDEX idx_sub_history_host_id      ON subscription_history(host_id);
CREATE INDEX idx_sub_history_created_at   ON subscription_history(created_at DESC);

ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE subscription_history IS
  'Immutable append-only audit log of all subscription changes. No UPDATE or DELETE.';
```

---

### 8.3 `plan_features`

Global feature flag definitions per plan. Super admin edits at runtime — no deploy needed.

```sql
CREATE TABLE public.plan_features (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  plan         text    NOT NULL CHECK (plan IN ('free','basic','pro','business')),
  feature_key  text    NOT NULL,
  is_enabled   boolean NOT NULL DEFAULT false,
  limit_value  integer,
  description  text,
  updated_by   uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_plan_feature UNIQUE (plan, feature_key)
);

CREATE INDEX idx_plan_features_plan ON plan_features(plan);
CREATE INDEX idx_plan_features_key  ON plan_features(feature_key);

ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN plan_features.limit_value IS
  'NULL = unlimited. Integer = cap. Used for inbox_limit, listings_limit, staff_seats.';
```

---

### 8.4 `host_feature_overrides`

Per-host exceptions to plan defaults. Checked before `plan_features` in all permission lookups.

```sql
CREATE TABLE public.host_feature_overrides (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  feature_key   text    NOT NULL,
  is_enabled    boolean NOT NULL,
  limit_value   integer,
  reason        text    NOT NULL,
  overridden_by uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_host_feature_override UNIQUE (host_id, feature_key)
);

CREATE INDEX idx_host_overrides_host_id ON host_feature_overrides(host_id);
CREATE INDEX idx_host_overrides_expires ON host_feature_overrides(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE host_feature_overrides ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN host_feature_overrides.expires_at IS
  'NULL = permanent. Integer = temporary courtesy override.';
COMMENT ON COLUMN host_feature_overrides.reason IS
  'Required. Admin must provide reasoning for audit trail.';
```

---

## 9. Domain 6 — Inbox & Messaging

### 9.1 `conversations`

One thread per booking or pre-booking enquiry.

```sql
CREATE TABLE public.conversations (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id              uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  guest_id             uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  listing_id           uuid    REFERENCES listings(id) ON DELETE SET NULL,
  booking_id           uuid    REFERENCES bookings(id) ON DELETE SET NULL,
  status               text    NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open','resolved','archived')),
  is_enquiry           boolean NOT NULL DEFAULT false,
  unread_host          integer NOT NULL DEFAULT 0,
  unread_guest         integer NOT NULL DEFAULT 0,
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_host_id    ON conversations(host_id);
CREATE INDEX idx_conversations_guest_id   ON conversations(guest_id);
CREATE INDEX idx_conversations_booking_id ON conversations(booking_id);
CREATE INDEX idx_conversations_status     ON conversations(host_id, status);
CREATE INDEX idx_conversations_last_msg   ON conversations(host_id, last_message_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN conversations.unread_host IS
  'Denormalised unread count for host. Updated by trigger on message insert.';
COMMENT ON COLUMN conversations.last_message_preview IS
  'First 100 chars of last message body. For inbox list rendering.';
```

---

### 9.2 `messages`

Individual messages within a conversation thread.

```sql
CREATE TABLE public.messages (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id           uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,

  body                text,
  attachment_url      text,
  attachment_type     text    CHECK (attachment_type IN ('image','pdf','other')),
  attachment_filename text,

  is_system_message   boolean NOT NULL DEFAULT false,
  system_event        text,

  read_by_host        boolean NOT NULL DEFAULT false,
  read_by_guest       boolean NOT NULL DEFAULT false,
  read_at             timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation  ON messages(conversation_id);
CREATE INDEX idx_messages_created_at    ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_messages_sender        ON messages(sender_id);
CREATE INDEX idx_messages_unread_host   ON messages(conversation_id, read_by_host)
  WHERE read_by_host = false AND is_system_message = false;
CREATE INDEX idx_messages_unread_guest  ON messages(conversation_id, read_by_guest)
  WHERE read_by_guest = false AND is_system_message = false;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN messages.is_system_message IS
  'True for automated status-change messages. Styled differently in UI.';
COMMENT ON COLUMN messages.system_event IS
  'Machine-readable event type: booking_confirmed | booking_cancelled | etc.';
```

---

### 9.3 `message_templates`

Saved canned reply templates per host. Pro+ feature only.

```sql
CREATE TABLE public.message_templates (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  title       text    NOT NULL,
  body        text    NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_templates_host ON message_templates(host_id, sort_order);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN message_templates.body IS
  'Supports {{guest_name}}, {{listing_name}}, {{check_in}}, {{check_out}} variables.';
```

---

### 9.4 `push_tokens`

Device push notification tokens. Multiple rows per user (one per device).

```sql
CREATE TABLE public.push_tokens (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token        text    NOT NULL UNIQUE,
  platform     text    NOT NULL CHECK (platform IN ('ios','android')),
  device_name  text,
  is_active    boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id) WHERE is_active = true;

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE push_tokens IS
  'Expo push tokens per device. One user can have multiple active devices.';
```

---

## 10. Domain 7 — Reviews

### 10.1 `reviews`

One review per booking. Guest-written, host-respondable.

```sql
CREATE TABLE public.reviews (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid    UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  listing_id         uuid    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  host_id            uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  guest_id           uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,

  rating             integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body               text,
  host_response      text,
  host_responded_at  timestamptz,

  is_published       boolean NOT NULL DEFAULT false,
  publish_at         timestamptz,
  flagged            boolean NOT NULL DEFAULT false,
  flagged_at         timestamptz,
  flagged_reason     text,
  admin_decision     text    CHECK (admin_decision IN ('upheld','rejected')),
  admin_actioned_by  uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,

  review_token       text    UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  token_expires_at   timestamptz DEFAULT (now() + interval '30 days'),

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_listing_id   ON reviews(listing_id);
CREATE INDEX idx_reviews_host_id      ON reviews(host_id);
CREATE INDEX idx_reviews_guest_id     ON reviews(guest_id);
CREATE INDEX idx_reviews_published    ON reviews(listing_id, is_published)
  WHERE is_published = true;
CREATE INDEX idx_reviews_flagged      ON reviews(flagged) WHERE flagged = true;
CREATE INDEX idx_reviews_publish_at   ON reviews(publish_at) WHERE is_published = false;
CREATE INDEX idx_reviews_rating       ON reviews(listing_id, rating);
CREATE INDEX idx_reviews_token        ON reviews(review_token);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN reviews.review_token IS
  'Secure token in review request email link. Expires in 30 days.';
COMMENT ON COLUMN reviews.publish_at IS
  'Set at submission (now() + 48h). pg_cron publishes at this time if not flagged.';
```

---

### 10.2 `review_flags`

Detailed flag records when a host flags a review.

```sql
CREATE TABLE public.review_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  flagged_by  uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason      text NOT NULL CHECK (reason IN (
                'false_information','personal_attack',
                'booking_never_occurred','other'
              )),
  details     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_flags_review ON review_flags(review_id);

ALTER TABLE review_flags ENABLE ROW LEVEL SECURITY;
```

---

## 11. Domain 8 — Directory & Discovery

### 11.1 `featured_listings`

Editorial picks set by super admin. Override ranking and appear at top of results.

```sql
CREATE TABLE public.featured_listings (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid    UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  featured_by uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  reason      text,
  sort_order  integer NOT NULL DEFAULT 0,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_featured_listings_sort    ON featured_listings(sort_order);
CREATE INDEX idx_featured_listings_expires ON featured_listings(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE featured_listings ENABLE ROW LEVEL SECURITY;
```

---

### 11.2 `directory_search_logs`

Anonymised search analytics for the admin dashboard.

```sql
CREATE TABLE public.directory_search_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query           text,
  filters         jsonb,
  result_count    integer,
  clicked_listing uuid REFERENCES listings(id) ON DELETE SET NULL,
  session_id      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_logs_query      ON directory_search_logs(query)
  WHERE query IS NOT NULL;
CREATE INDEX idx_search_logs_created_at ON directory_search_logs(created_at DESC);
CREATE INDEX idx_search_logs_zero       ON directory_search_logs(query)
  WHERE result_count = 0;

ALTER TABLE directory_search_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE directory_search_logs IS
  'Anonymised. No PII stored. session_id is a random UUID per browser session.';
```

---

## 12. Domain 9 — Platform Administration

### 12.1 `platform_settings`

Runtime-configurable key-value store. Super admin edits via admin panel without deploys.

```sql
CREATE TABLE public.platform_settings (
  key         text  PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_by  uuid  REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE platform_settings IS
  'Runtime config. Read by Edge Functions on every call. Never hardcode these values.';
```

---

### 12.2 `admin_audit_log`

Immutable append-only log of all super admin actions.

```sql
CREATE TABLE public.admin_audit_log (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid  NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  impersonating uuid  REFERENCES user_profiles(id) ON DELETE SET NULL,
  action        text  NOT NULL,
  target_type   text  NOT NULL CHECK (target_type IN (
                  'host','guest','booking','listing','review',
                  'subscription','feature_override','platform_setting','impersonation'
                )),
  target_id     uuid,
  payload       jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_admin_id   ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_action     ON admin_audit_log(action);
CREATE INDEX idx_audit_log_target_id  ON admin_audit_log(target_id);
CREATE INDEX idx_audit_log_created_at ON admin_audit_log(created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE admin_audit_log IS
  'Immutable. No UPDATE or DELETE policies. INSERT only via service_role in Edge Functions.';
COMMENT ON COLUMN admin_audit_log.impersonating IS
  'Populated when admin is acting as another user via impersonation.';
```

---

### 12.3 `impersonation_sessions`

Tracks active and completed impersonation sessions.

```sql
CREATE TABLE public.impersonation_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  target_user_id   uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds integer GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (ended_at - started_at))::integer
    ELSE NULL END
  ) STORED
);

CREATE INDEX idx_impersonation_admin  ON impersonation_sessions(admin_id);
CREATE INDEX idx_impersonation_active ON impersonation_sessions(started_at)
  WHERE ended_at IS NULL;

ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;
```

---

### 12.4 `notification_queue`

Staging table for async notifications dispatched by Edge Functions via `pg_cron`.

```sql
CREATE TABLE public.notification_queue (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid    REFERENCES hosts(id) ON DELETE CASCADE,
  guest_id    uuid    REFERENCES user_profiles(id) ON DELETE CASCADE,
  type        text    NOT NULL,
  payload     jsonb   NOT NULL DEFAULT '{}',
  sent_at     timestamptz,
  failed_at   timestamptz,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_queue_unsent ON notification_queue(created_at)
  WHERE sent_at IS NULL AND failed_at IS NULL;

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
```

---

### 12.5 `review_request_queue`

Staging table for pending review request emails. Populated by `pg_cron`, drained by Edge Function.

```sql
CREATE TABLE public.review_request_queue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  guest_id    uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_queue_unsent ON review_request_queue(created_at)
  WHERE sent_at IS NULL;

ALTER TABLE review_request_queue ENABLE ROW LEVEL SECURITY;
```

---

## 13. Enumerated Types

Define all check constraint values before creating dependent tables. For PostgreSQL 15 with Supabase, `text` columns with `CHECK` constraints are preferred over `CREATE TYPE ... AS ENUM` to allow adding values without table rewrites.

```sql
-- Documented here as reference for all valid values per column --

-- user_profiles.role
-- 'guest' | 'host' | 'staff' | 'super_admin'

-- listings.listing_type
-- 'accommodation' | 'experience'

-- listings.accommodation_type
-- 'hotel' | 'guesthouse' | 'bb' | 'self_catering' | 'lodge' | 'other'

-- listings.experience_type
-- 'tour' | 'activity' | 'workshop' | 'transfer' | 'other'

-- listings.cancellation_policy
-- 'flexible' | 'moderate' | 'strict'
-- flexible : full refund if cancelled 24h+ before check-in
-- moderate : full refund if cancelled 5+ days before
-- strict   : 50% refund if cancelled 7+ days before; no refund after

-- bookings.status
-- 'pending' | 'pending_eft' | 'pending_eft_review' | 'confirmed'
-- 'checked_in' | 'completed' | 'cancelled_by_host' | 'cancelled_by_guest'
-- 'declined' | 'expired' | 'no_show'

-- bookings.payment_method / payments.method
-- 'paystack' | 'paypal' | 'eft'

-- bookings.payment_status / payments.status
-- 'pending' | 'authorised' | 'completed' | 'failed'
-- 'refunded' | 'partially_refunded' | 'voided'

-- refunds.status
-- 'pending' | 'processing' | 'completed' | 'failed'

-- subscriptions.plan / plan_features.plan
-- 'free' | 'basic' | 'pro' | 'business'

-- subscriptions.billing_cycle
-- 'monthly' | 'annual'

-- subscriptions.status
-- 'trialing' | 'active' | 'past_due' | 'restricted' | 'cancelled' | 'expired'

-- conversations.status
-- 'open' | 'resolved' | 'archived'

-- messages.attachment_type
-- 'image' | 'pdf' | 'other'

-- reviews.admin_decision
-- 'upheld' | 'rejected'

-- review_flags.reason
-- 'false_information' | 'personal_attack' | 'booking_never_occurred' | 'other'

-- admin_audit_log.target_type
-- 'host' | 'guest' | 'booking' | 'listing' | 'review'
-- 'subscription' | 'feature_override' | 'platform_setting' | 'impersonation'

-- push_tokens.platform
-- 'ios' | 'android'

-- bookings.cancelled_by
-- 'guest' | 'host' | 'admin' | 'system'
```

---

## 14. Full Index Strategy

| Table | Index Type | Column(s) | Purpose |
|---|---|---|---|
| user_profiles | BTREE | role | Role-based filtering |
| user_profiles | BTREE | email | Login lookups |
| hosts | BTREE | user_id | Profile → host join |
| hosts | BTREE | handle | URL slug lookup |
| hosts | BTREE (partial) | is_active = true | Active hosts only |
| listings | GIN | search_vector | Full-text search |
| listings | GIST | location | Geo proximity |
| listings | GIN | name gin_trgm_ops | Autocomplete |
| listings | GIN | city gin_trgm_ops | City autocomplete |
| listings | BTREE | host_id | Host's listings |
| listings | BTREE (partial) | is_published = true | Public directory |
| listings | BTREE | base_price | Price filter |
| listings | BTREE | avg_rating DESC | Rating sort |
| listing_amenities | BTREE | amenity_key | Amenity filter |
| listing_seasonal_pricing | BTREE | listing_id, start_date, end_date | Date range pricing |
| blocked_dates | BTREE | listing_id, date | Availability check |
| listing_rankings | BTREE | ranking_score DESC | Directory sort |
| bookings | BTREE | listing_id | Bookings per listing |
| bookings | BTREE | host_id, status | Host dashboard |
| bookings | BTREE | guest_id | Guest bookings |
| bookings | BTREE | reference | Ref number lookup |
| bookings | BTREE (partial) | status, created_at | Expiry cron jobs |
| bookings | BTREE | host_id, check_in | Calendar view |
| payments | BTREE | booking_id | Payment per booking |
| payments | BTREE | provider_reference | Webhook idempotency |
| subscriptions | BTREE | host_id | Host → subscription |
| subscriptions | BTREE | status | Billing cron jobs |
| subscriptions | BTREE (partial) | current_period_end | Renewal detection |
| plan_features | BTREE | plan | Feature lookup |
| conversations | BTREE | host_id, last_message_at DESC | Inbox sort |
| conversations | BTREE | guest_id | Guest inbox |
| messages | BTREE | conversation_id, created_at ASC | Thread order |
| messages | BTREE (partial) | unread host/guest | Unread counts |
| reviews | BTREE (partial) | listing_id, is_published | Public reviews |
| reviews | BTREE (partial) | flagged = true | Moderation queue |
| reviews | BTREE (partial) | publish_at, not published | Auto-publish job |
| admin_audit_log | BTREE | admin_id | Admin history |
| admin_audit_log | BTREE | created_at DESC | Chronological log |
| push_tokens | BTREE (partial) | user_id, is_active | Push delivery |
| directory_search_logs | BTREE | created_at DESC | Analytics |
| directory_search_logs | BTREE (partial) | result_count = 0 | Zero-result terms |

---

## 15. Row Level Security (RLS) Policies

### Helper Functions

```sql
-- Returns the current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Returns the host_id the current user owns
CREATE OR REPLACE FUNCTION get_my_host_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM hosts WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns the host_id the current user belongs to as staff
CREATE OR REPLACE FUNCTION get_my_host_id_as_staff()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT host_id FROM staff_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns true if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;
```

---

### `user_profiles`
```sql
CREATE POLICY "users_read_own"        ON user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "admin_read_all"        ON user_profiles FOR SELECT USING (is_super_admin());
CREATE POLICY "users_update_own"      ON user_profiles FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "admin_update_any"      ON user_profiles FOR UPDATE USING (is_super_admin());
CREATE POLICY "system_insert_profile" ON user_profiles FOR INSERT WITH CHECK (id = auth.uid());
```

### `hosts`
```sql
CREATE POLICY "public_read_active_hosts"  ON hosts FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);
CREATE POLICY "host_manage_own"           ON hosts FOR ALL
  USING (user_id = auth.uid());
CREATE POLICY "staff_read_host"           ON hosts FOR SELECT
  USING (id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_access_hosts"   ON hosts FOR ALL
  USING (is_super_admin());
```

### `staff_members`
```sql
CREATE POLICY "host_manage_staff"     ON staff_members FOR ALL
  USING (host_id = get_my_host_id());
CREATE POLICY "staff_read_own"        ON staff_members FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "admin_full_access"     ON staff_members FOR ALL
  USING (is_super_admin());
```

### `listings`
```sql
CREATE POLICY "public_read_published" ON listings FOR SELECT
  USING (is_published = true AND is_suspended = false AND deleted_at IS NULL);
CREATE POLICY "host_manage_own"       ON listings FOR ALL
  USING (host_id = get_my_host_id());
CREATE POLICY "staff_read"            ON listings FOR SELECT
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "staff_update"          ON listings FOR UPDATE
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_access"     ON listings FOR ALL
  USING (is_super_admin());
```

### `blocked_dates`
```sql
CREATE POLICY "public_read_blocked"   ON blocked_dates FOR SELECT
  USING (listing_id IN (SELECT id FROM listings WHERE is_published = true));
CREATE POLICY "host_manage_own"       ON blocked_dates FOR ALL
  USING (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id()));
CREATE POLICY "staff_manage"          ON blocked_dates FOR ALL
  USING (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id_as_staff()));
CREATE POLICY "admin_full_access"     ON blocked_dates FOR ALL
  USING (is_super_admin());
```

### `bookings`
```sql
CREATE POLICY "guest_read_own"    ON bookings FOR SELECT USING (guest_id = auth.uid());
CREATE POLICY "guest_update_own"  ON bookings FOR UPDATE USING (guest_id = auth.uid())
  WITH CHECK (guest_id = auth.uid());
CREATE POLICY "host_manage_own"   ON bookings FOR ALL USING (host_id = get_my_host_id());
CREATE POLICY "staff_read"        ON bookings FOR SELECT
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "staff_update"      ON bookings FOR UPDATE
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_access" ON bookings FOR ALL USING (is_super_admin());
```

### `payments`
```sql
CREATE POLICY "guest_read_own"    ON payments FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE guest_id = auth.uid()));
CREATE POLICY "host_read_own"     ON payments FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_access" ON payments FOR ALL USING (is_super_admin());
```

### `subscriptions`
```sql
CREATE POLICY "host_manage_own"   ON subscriptions FOR ALL USING (host_id = get_my_host_id());
CREATE POLICY "admin_full_access" ON subscriptions FOR ALL USING (is_super_admin());
```

### `plan_features`
```sql
CREATE POLICY "authenticated_read" ON plan_features FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "admin_manage"       ON plan_features FOR ALL USING (is_super_admin());
```

### `host_feature_overrides`
```sql
CREATE POLICY "host_read_own"    ON host_feature_overrides FOR SELECT
  USING (host_id = get_my_host_id());
CREATE POLICY "admin_manage"     ON host_feature_overrides FOR ALL USING (is_super_admin());
```

### `conversations`
```sql
CREATE POLICY "host_manage"       ON conversations FOR ALL USING (host_id = get_my_host_id());
CREATE POLICY "staff_manage"      ON conversations FOR ALL
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "guest_manage"      ON conversations FOR ALL USING (guest_id = auth.uid());
CREATE POLICY "admin_full_access" ON conversations FOR ALL USING (is_super_admin());
```

### `messages`
```sql
CREATE POLICY "participant_access" ON messages FOR ALL USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE host_id = get_my_host_id()
       OR host_id = get_my_host_id_as_staff()
       OR guest_id = auth.uid()
  )
);
CREATE POLICY "admin_full_access" ON messages FOR ALL USING (is_super_admin());
```

### `reviews`
```sql
CREATE POLICY "public_read_published" ON reviews FOR SELECT
  USING (is_published = true AND flagged = false);
CREATE POLICY "guest_read_own"        ON reviews FOR SELECT USING (guest_id = auth.uid());
CREATE POLICY "host_read_own"         ON reviews FOR SELECT USING (host_id = get_my_host_id());
CREATE POLICY "host_respond"          ON reviews FOR UPDATE USING (host_id = get_my_host_id())
  WITH CHECK (host_id = get_my_host_id());
CREATE POLICY "admin_full_access"     ON reviews FOR ALL USING (is_super_admin());
```

### `platform_settings`
```sql
CREATE POLICY "anyone_can_read" ON platform_settings FOR SELECT
  USING (auth.role() IN ('authenticated','anon'));
CREATE POLICY "admin_write"     ON platform_settings FOR ALL USING (is_super_admin());
```

### `admin_audit_log`
```sql
CREATE POLICY "admin_read_only" ON admin_audit_log FOR SELECT USING (is_super_admin());
-- INSERT only via service_role in Edge Functions. No UPDATE or DELETE policies.
```

### `eft_banking_details`
```sql
-- Only shown to guests with a confirmed EFT booking — enforced via Edge Function
CREATE POLICY "host_manage_own"   ON eft_banking_details FOR ALL
  USING (host_id = get_my_host_id());
CREATE POLICY "admin_full_access" ON eft_banking_details FOR ALL USING (is_super_admin());
```

---

## 16. Database Functions & RPCs

### `check_feature_permission`
The central permission check. Called everywhere features are gated.

```sql
CREATE OR REPLACE FUNCTION check_feature_permission(
  p_host_id     uuid,
  p_feature_key text
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  -- 1. Per-host override (most specific, checked first)
  SELECT jsonb_build_object(
    'is_enabled', hfo.is_enabled,
    'limit_value', hfo.limit_value,
    'source', 'override'
  ) INTO v_result
  FROM host_feature_overrides hfo
  WHERE hfo.host_id = p_host_id
    AND hfo.feature_key = p_feature_key
    AND (hfo.expires_at IS NULL OR hfo.expires_at > now())
  LIMIT 1;

  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  -- 2. Plan-level feature (fallback)
  SELECT jsonb_build_object(
    'is_enabled', pf.is_enabled,
    'limit_value', pf.limit_value,
    'source', 'plan'
  ) INTO v_result
  FROM plan_features pf
  JOIN subscriptions s ON s.plan = pf.plan
  WHERE s.host_id = p_host_id
    AND s.status IN ('trialing','active')
    AND pf.feature_key = p_feature_key
  LIMIT 1;

  -- 3. Default: disabled
  RETURN COALESCE(v_result,
    jsonb_build_object('is_enabled', false, 'limit_value', null, 'source', 'default'));
END;
$$;
```

---

### `get_listing_availability`
Returns blocked dates for a listing within a given month.

```sql
CREATE OR REPLACE FUNCTION get_listing_availability(
  p_listing_id uuid,
  p_year       integer,
  p_month      integer
)
RETURNS date[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY_AGG(date ORDER BY date)
  FROM blocked_dates
  WHERE listing_id = p_listing_id
    AND EXTRACT(YEAR  FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month;
$$;
```

---

### `calculate_booking_price`
Server-side price calculation. Called before charging to validate amount.

```sql
CREATE OR REPLACE FUNCTION calculate_booking_price(
  p_listing_id uuid,
  p_check_in   date,
  p_check_out  date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_listing      listings%ROWTYPE;
  v_current_date date;
  v_night_price  numeric;
  v_base_total   numeric := 0;
  v_nights       integer;
  v_dow          integer;
BEGIN
  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
  v_nights := p_check_out - p_check_in;
  v_current_date := p_check_in;

  WHILE v_current_date < p_check_out LOOP
    -- Check seasonal override
    SELECT price INTO v_night_price
    FROM listing_seasonal_pricing
    WHERE listing_id = p_listing_id
      AND v_current_date BETWEEN start_date AND end_date
    ORDER BY start_date DESC LIMIT 1;

    IF v_night_price IS NULL THEN
      v_dow := EXTRACT(DOW FROM v_current_date);
      IF v_dow IN (0, 6) AND v_listing.weekend_price IS NOT NULL THEN
        v_night_price := v_listing.weekend_price;
      ELSE
        v_night_price := v_listing.base_price;
      END IF;
    END IF;

    v_base_total := v_base_total + v_night_price;
    v_current_date := v_current_date + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'nights',       v_nights,
    'base_total',   v_base_total,
    'cleaning_fee', COALESCE(v_listing.cleaning_fee, 0),
    'total',        v_base_total + COALESCE(v_listing.cleaning_fee, 0),
    'currency',     v_listing.currency
  );
END;
$$;
```

---

### `recalculate_listing_ranking`
Called by `pg_cron` every 15 minutes to refresh ranking scores.

```sql
CREATE OR REPLACE FUNCTION recalculate_listing_ranking(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_weights      jsonb;
  v_avg_rating   numeric;
  v_review_count integer;
  v_review_norm  numeric;
  v_profile      numeric;
  v_response     numeric;
  v_plan_boost   numeric;
  v_score        numeric;
BEGIN
  SELECT value INTO v_weights FROM platform_settings WHERE key = 'ranking_weights';

  SELECT avg_rating, total_reviews INTO v_avg_rating, v_review_count
  FROM listings WHERE id = p_listing_id;

  v_review_norm := LEAST(1.0, ln(1 + v_review_count) / ln(101));

  SELECT (
    CASE WHEN l.description   IS NOT NULL THEN 0.20 ELSE 0 END +
    CASE WHEN l.city          IS NOT NULL THEN 0.20 ELSE 0 END +
    CASE WHEN (SELECT COUNT(*) FROM listing_photos  WHERE listing_id = l.id) >= 5 THEN 0.30 ELSE 0 END +
    CASE WHEN l.check_in_time IS NOT NULL THEN 0.15 ELSE 0 END +
    CASE WHEN (SELECT COUNT(*) FROM listing_amenities WHERE listing_id = l.id) >= 3 THEN 0.15 ELSE 0 END
  ) INTO v_profile FROM listings l WHERE l.id = p_listing_id;

  SELECT h.response_rate INTO v_response
  FROM listings l JOIN hosts h ON h.id = l.host_id WHERE l.id = p_listing_id;

  SELECT CASE s.plan
    WHEN 'free'     THEN 0.0 WHEN 'basic'    THEN 0.3
    WHEN 'pro'      THEN 0.6 WHEN 'business' THEN 1.0 ELSE 0.0 END
  INTO v_plan_boost
  FROM listings l
  JOIN hosts h ON h.id = l.host_id
  JOIN subscriptions s ON s.host_id = h.id AND s.status IN ('trialing','active')
  WHERE l.id = p_listing_id;

  v_score :=
    (COALESCE(v_avg_rating / 5.0, 0) * (v_weights->>'rating')::numeric)   +
    (COALESCE(v_review_norm, 0)       * (v_weights->>'reviews')::numeric)  +
    (COALESCE(v_profile, 0)           * (v_weights->>'profile')::numeric)  +
    (COALESCE(v_response, 0)          * (v_weights->>'response')::numeric) +
    (COALESCE(v_plan_boost, 0)        * (v_weights->>'plan')::numeric);

  INSERT INTO listing_rankings (
    listing_id, ranking_score, component_rating, component_reviews,
    component_profile, component_response_rate, component_plan_boost, last_calculated
  ) VALUES (
    p_listing_id, v_score,
    COALESCE(v_avg_rating / 5.0, 0), v_review_norm, v_profile,
    COALESCE(v_response, 0), COALESCE(v_plan_boost, 0), now()
  )
  ON CONFLICT (listing_id) DO UPDATE SET
    ranking_score           = EXCLUDED.ranking_score,
    component_rating        = EXCLUDED.component_rating,
    component_reviews       = EXCLUDED.component_reviews,
    component_profile       = EXCLUDED.component_profile,
    component_response_rate = EXCLUDED.component_response_rate,
    component_plan_boost    = EXCLUDED.component_plan_boost,
    last_calculated         = now();
END;
$$;
```

---

### `get_host_inbox_stats`
Returns unread counts and open thread totals for the host dashboard badge.

```sql
CREATE OR REPLACE FUNCTION get_host_inbox_stats(p_host_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'total_unread', SUM(unread_host),
    'open_threads', COUNT(*) FILTER (WHERE status = 'open'),
    'enquiries',    COUNT(*) FILTER (WHERE is_enquiry = true AND status = 'open')
  )
  FROM conversations WHERE host_id = p_host_id;
$$;
```

---

## 17. Triggers & Automation

### `updated_at` Auto-Update (applied to all mutable tables)

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON hosts              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON listings           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON bookings           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payments           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON refunds            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON subscriptions      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reviews            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON message_templates  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON eft_banking_details FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### Booking Confirmed → Block Dates + Update Counters

```sql
CREATE OR REPLACE FUNCTION on_booking_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_date date;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
      v_date := NEW.check_in;
      WHILE v_date < NEW.check_out LOOP
        INSERT INTO blocked_dates (listing_id, date, reason, booking_id)
        VALUES (NEW.listing_id, v_date, 'booking', NEW.id)
        ON CONFLICT (listing_id, date) DO NOTHING;
        v_date := v_date + 1;
      END LOOP;
    END IF;
    UPDATE hosts    SET total_bookings = total_bookings + 1 WHERE id = NEW.host_id;
    UPDATE listings SET total_bookings = total_bookings + 1 WHERE id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_booking_confirmed
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION on_booking_confirmed();
```

---

### Booking Cancelled → Unblock Dates

```sql
CREATE OR REPLACE FUNCTION on_booking_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IN ('cancelled_by_host','cancelled_by_guest','expired','declined')
     AND OLD.status NOT IN ('cancelled_by_host','cancelled_by_guest','expired','declined') THEN
    DELETE FROM blocked_dates WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_booking_cancelled
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION on_booking_cancelled();
```

---

### Review Published → Update Aggregate Ratings

```sql
CREATE OR REPLACE FUNCTION on_review_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_published = true AND COALESCE(OLD.is_published, false) = false THEN
    UPDATE listings SET
      avg_rating    = (SELECT AVG(rating) FROM reviews WHERE listing_id = NEW.listing_id AND is_published = true),
      total_reviews = (SELECT COUNT(*)    FROM reviews WHERE listing_id = NEW.listing_id AND is_published = true)
    WHERE id = NEW.listing_id;

    UPDATE hosts SET
      avg_rating    = (SELECT AVG(r.rating) FROM reviews r JOIN listings l ON l.id = r.listing_id WHERE l.host_id = NEW.host_id AND r.is_published = true),
      total_reviews = (SELECT COUNT(*)      FROM reviews r JOIN listings l ON l.id = r.listing_id WHERE l.host_id = NEW.host_id AND r.is_published = true)
    WHERE id = NEW.host_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_review_published
  AFTER UPDATE OF is_published ON reviews
  FOR EACH ROW EXECUTE FUNCTION on_review_published();
```

---

### Message Inserted → Update Conversation Unread + Preview

```sql
CREATE OR REPLACE FUNCTION on_message_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_conv conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
  UPDATE conversations SET
    last_message_at      = NEW.created_at,
    last_message_preview = left(NEW.body, 100),
    unread_host  = CASE WHEN NEW.sender_id != v_conv.host_id THEN unread_host + 1  ELSE unread_host  END,
    unread_guest = CASE WHEN NEW.sender_id  = v_conv.host_id THEN unread_guest + 1 ELSE unread_guest END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION on_message_inserted();
```

---

### Auto-Generate Listing Slug

```sql
CREATE OR REPLACE FUNCTION generate_listing_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_base text; v_slug text; v_n integer := 0;
BEGIN
  IF NEW.slug IS NULL THEN
    v_base := lower(regexp_replace(regexp_replace(NEW.name,'[^a-zA-Z0-9\s]','','g'),'\s+','-','g'));
    v_slug := v_base;
    WHILE EXISTS (SELECT 1 FROM listings WHERE slug = v_slug AND id != NEW.id) LOOP
      v_n := v_n + 1; v_slug := v_base || '-' || v_n;
    END LOOP;
    NEW.slug := v_slug;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_listing_slug
  BEFORE INSERT OR UPDATE OF name ON listings
  FOR EACH ROW EXECUTE FUNCTION generate_listing_slug();
```

---

### Auto-Generate Host Handle

```sql
CREATE OR REPLACE FUNCTION generate_host_handle()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_base text; v_handle text; v_n integer := 0;
BEGIN
  IF NEW.handle IS NULL OR NEW.handle = '' THEN
    v_base := lower(regexp_replace(regexp_replace(NEW.display_name,'[^a-zA-Z0-9\s]','','g'),'\s+','-','g'));
    v_handle := v_base;
    WHILE EXISTS (SELECT 1 FROM hosts WHERE handle = v_handle AND id != NEW.id) LOOP
      v_n := v_n + 1; v_handle := v_base || '-' || v_n;
    END LOOP;
    NEW.handle := v_handle;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_host_handle
  BEFORE INSERT ON hosts
  FOR EACH ROW EXECUTE FUNCTION generate_host_handle();
```

---

## 18. pg_cron Scheduled Jobs

```sql
-- 1. Expire unpaid pending bookings (30 min timeout)
SELECT cron.schedule('expire-pending-bookings', '*/5 * * * *', $$
  UPDATE bookings SET status = 'expired', cancelled_by = 'system'
  WHERE status = 'pending' AND payment_method IN ('paystack','paypal')
    AND created_at < now() - interval '30 minutes';
$$);

-- 2. Expire EFT bookings with no proof (48 hours)
SELECT cron.schedule('expire-eft-bookings', '0 * * * *', $$
  UPDATE bookings SET status = 'expired', cancelled_by = 'system',
    cancellation_reason = 'eft_proof_not_uploaded'
  WHERE status = 'pending_eft' AND created_at < now() - interval '48 hours';
$$);

-- 3. Auto-cancel booking requests with no host response (24 hours)
SELECT cron.schedule('cancel-unresponded-requests', '0 * * * *', $$
  UPDATE bookings SET status = 'cancelled_by_host', cancelled_by = 'system',
    cancellation_reason = 'host_no_response'
  WHERE status = 'pending' AND payment_method IN ('paystack','paypal')
    AND created_at < now() - interval '24 hours';
$$);

-- 4. Auto-publish reviews after 48-hour moderation window
SELECT cron.schedule('auto-publish-reviews', '*/15 * * * *', $$
  UPDATE reviews SET is_published = true
  WHERE is_published = false AND flagged = false
    AND publish_at IS NOT NULL AND publish_at <= now();
$$);

-- 5. Queue review request emails (24h after check-out, once per booking)
SELECT cron.schedule('queue-review-requests', '0 9 * * *', $$
  INSERT INTO review_request_queue (booking_id, guest_id)
  SELECT b.id, b.guest_id FROM bookings b
  LEFT JOIN reviews r ON r.booking_id = b.id
  LEFT JOIN review_request_queue q ON q.booking_id = b.id
  WHERE b.status = 'completed'
    AND b.checked_out_at < now() - interval '24 hours'
    AND r.id IS NULL AND q.booking_id IS NULL;
$$);

-- 6. Restrict accounts after grace period expires
SELECT cron.schedule('restrict-overdue-subscriptions', '0 * * * *', $$
  UPDATE subscriptions SET status = 'restricted'
  WHERE status = 'past_due'
    AND grace_period_ends_at IS NOT NULL
    AND grace_period_ends_at < now();
$$);

-- 7. Remove expired host feature overrides
SELECT cron.schedule('expire-host-overrides', '0 * * * *', $$
  DELETE FROM host_feature_overrides
  WHERE expires_at IS NOT NULL AND expires_at < now();
$$);

-- 8. Recalculate directory ranking scores (all published listings)
SELECT cron.schedule('recalculate-rankings', '*/15 * * * *', $$
  SELECT recalculate_listing_ranking(id)
  FROM listings WHERE is_published = true AND deleted_at IS NULL;
$$);

-- 9. Queue subscription expiry warnings (7 days before renewal)
SELECT cron.schedule('subscription-expiry-warnings', '0 8 * * *', $$
  INSERT INTO notification_queue (host_id, type, payload)
  SELECT host_id, 'subscription_expiring', jsonb_build_object('days_remaining', 7)
  FROM subscriptions
  WHERE status = 'active'
    AND current_period_end BETWEEN now() AND now() + interval '7 days'
    AND cancel_at_period_end = false;
$$);

-- 10. Recalculate host response rates (daily, rolling 90 days)
SELECT cron.schedule('update-response-rates', '0 3 * * *', $$
  UPDATE hosts h SET response_rate = stats.rate
  FROM (
    SELECT host_id,
      COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL OR declined_at IS NOT NULL)::numeric /
      NULLIF(COUNT(*), 0) AS rate
    FROM bookings
    WHERE created_at > now() - interval '90 days' AND status != 'expired'
    GROUP BY host_id
  ) stats
  WHERE h.id = stats.host_id;
$$);

-- 11. Clean up expired staff invites (daily)
SELECT cron.schedule('clean-expired-invites', '0 2 * * *', $$
  DELETE FROM staff_invites WHERE expires_at < now() AND accepted_at IS NULL;
$$);

-- 12. Clean up old search logs (retain 90 days)
SELECT cron.schedule('clean-search-logs', '0 1 * * *', $$
  DELETE FROM directory_search_logs WHERE created_at < now() - interval '90 days';
$$);
```

---

## 19. Supabase Realtime Configuration

Enable Realtime for tables requiring live updates:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
```

**Client subscription patterns:**

```typescript
// New messages in a conversation thread (inbox)
supabase.channel(`conversation:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => { /* append to thread */ })
  .subscribe();

// Booking status updates (host dashboard)
supabase.channel(`bookings:${hostId}`)
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'bookings',
    filter: `host_id=eq.${hostId}`
  }, (payload) => { /* update status badge */ })
  .subscribe();

// Inbox unread badge (conversations)
supabase.channel(`inbox:${hostId}`)
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'conversations',
    filter: `host_id=eq.${hostId}`
  }, (payload) => { /* update badge count */ })
  .subscribe();
```

---

## 20. Supabase Storage Buckets

| Bucket | Access | Max Size | Allowed Types | Path Pattern |
|---|---|---|---|---|
| `listing-photos` | Public | 10 MB | image/jpeg, image/png, image/webp | `listing-photos/{listing_id}/{uuid}.{ext}` |
| `host-avatars` | Public | 5 MB | image/jpeg, image/png, image/webp | `host-avatars/{host_id}/{uuid}.{ext}` |
| `host-covers` | Public | 10 MB | image/jpeg, image/png, image/webp | `host-covers/{host_id}/{uuid}.{ext}` |
| `eft-proofs` | Private | 10 MB | image/jpeg, image/png, application/pdf | `eft-proofs/{booking_id}/{uuid}.{ext}` |
| `message-attachments` | Private | 20 MB | image/*, application/pdf | `message-attachments/{conversation_id}/{uuid}.{ext}` |

**Storage RLS policies:**

```sql
-- listing-photos: public read, host write
CREATE POLICY "public_read_listing_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'listing-photos');

CREATE POLICY "host_upload_listing_photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'listing-photos' AND auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM listings WHERE host_id = get_my_host_id()
    )
  );

CREATE POLICY "host_delete_listing_photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'listing-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM listings WHERE host_id = get_my_host_id()
    )
  );

-- eft-proofs: booking participants only
CREATE POLICY "eft_proof_participant_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'eft-proofs' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM bookings
      WHERE guest_id = auth.uid() OR host_id = get_my_host_id()
    )
  );

CREATE POLICY "guest_upload_eft_proof" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'eft-proofs' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM bookings WHERE guest_id = auth.uid()
    )
  );

-- message-attachments: conversation participants only
CREATE POLICY "participant_read_attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'message-attachments' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM conversations
      WHERE host_id = get_my_host_id()
         OR host_id = get_my_host_id_as_staff()
         OR guest_id = auth.uid()
    )
  );
```

---

## 21. Seed Data

Run after all migrations complete. Required for the application to function.

```sql
-- ============================================================
-- PLATFORM SETTINGS
-- ============================================================
INSERT INTO platform_settings (key, value, description) VALUES
  ('ranking_weights',          '{"rating":0.30,"reviews":0.20,"profile":0.15,"response":0.15,"plan":0.20}',
   'Directory ranking weights. Must sum to 1.0.'),
  ('directory_results_per_page','24',    'Listings per directory search page.'),
  ('free_trial_days',          '14',    'Trial days for new paid subscriptions.'),
  ('grace_period_days',        '5',     'Days after failed payment before restriction.'),
  ('booking_expiry_minutes',   '30',    'Minutes before unpaid booking auto-expires.'),
  ('eft_hold_hours',           '48',    'Hours EFT booking held before expiry.'),
  ('review_moderation_hours',  '48',    'Hours before non-flagged review auto-publishes.'),
  ('host_response_window_hours','24',   'Hours host has to respond to booking request.'),
  ('max_photos_per_listing',   '20',    'Maximum photos per listing.'),
  ('free_inbox_limit',         '10',    'Max active conversations for free tier.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- PLAN FEATURES — FREE
-- ============================================================
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
('free','directory_listing',   true,  null,'Appear in Vilo Directory'),
('free','directory_priority',  false, null,'Boosted directory placement'),
('free','direct_booking',      false, null,'Full booking flow'),
('free','enquiry_only',        true,  null,'Enquiry flow only'),
('free','inbox_messages',      true,  null,'Access to inbox'),
('free','inbox_limit',         true,  10,  'Max 10 active conversations'),
('free','payment_paystack',    false, null,'Paystack payments'),
('free','payment_paypal',      false, null,'PayPal payments'),
('free','payment_eft',         false, null,'Manual EFT'),
('free','listings_limit',      true,  1,   'Max 1 listing'),
('free','staff_seats',         true,  0,   'No staff seats'),
('free','reviews_respond',     false, null,'Respond to reviews'),
('free','calendar_management', false, null,'Block dates'),
('free','instant_booking',     false, null,'Instant booking'),
('free','analytics_basic',     false, null,'Basic stats'),
('free','analytics_advanced',  false, null,'Full analytics'),
('free','custom_profile_url',  false, null,'Custom handle'),
('free','export_bookings',     false, null,'CSV export'),
('free','canned_replies',      false, null,'Message templates')
ON CONFLICT (plan, feature_key) DO NOTHING;

-- ============================================================
-- PLAN FEATURES — BASIC
-- ============================================================
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
('basic','directory_listing',   true,  null,'Appear in Vilo Directory'),
('basic','directory_priority',  false, null,'Boosted directory placement'),
('basic','direct_booking',      true,  null,'Full booking flow'),
('basic','enquiry_only',        true,  null,'Enquiry flow'),
('basic','inbox_messages',      true,  null,'Full inbox'),
('basic','inbox_limit',         false, null,'Unlimited conversations'),
('basic','payment_paystack',    true,  null,'Paystack payments'),
('basic','payment_paypal',      true,  null,'PayPal payments'),
('basic','payment_eft',         true,  null,'Manual EFT'),
('basic','listings_limit',      true,  1,   'Max 1 listing'),
('basic','staff_seats',         true,  1,   'Max 1 staff seat'),
('basic','reviews_respond',     true,  null,'Respond to reviews'),
('basic','calendar_management', true,  null,'Block dates'),
('basic','instant_booking',     true,  null,'Instant booking'),
('basic','analytics_basic',     true,  null,'Basic stats'),
('basic','analytics_advanced',  false, null,'Full analytics'),
('basic','custom_profile_url',  true,  null,'Custom handle'),
('basic','export_bookings',     false, null,'CSV export'),
('basic','canned_replies',      false, null,'Message templates')
ON CONFLICT (plan, feature_key) DO NOTHING;

-- ============================================================
-- PLAN FEATURES — PRO
-- ============================================================
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
('pro','directory_listing',   true,  null,'Appear in Vilo Directory'),
('pro','directory_priority',  true,  null,'Priority directory placement'),
('pro','direct_booking',      true,  null,'Full booking flow'),
('pro','enquiry_only',        true,  null,'Enquiry flow'),
('pro','inbox_messages',      true,  null,'Full inbox'),
('pro','inbox_limit',         false, null,'Unlimited conversations'),
('pro','payment_paystack',    true,  null,'Paystack payments'),
('pro','payment_paypal',      true,  null,'PayPal payments'),
('pro','payment_eft',         true,  null,'Manual EFT'),
('pro','listings_limit',      true,  5,   'Max 5 listings'),
('pro','staff_seats',         true,  3,   'Max 3 staff seats'),
('pro','reviews_respond',     true,  null,'Respond to reviews'),
('pro','calendar_management', true,  null,'Block dates'),
('pro','instant_booking',     true,  null,'Instant booking'),
('pro','analytics_basic',     true,  null,'Basic stats'),
('pro','analytics_advanced',  true,  null,'Full analytics'),
('pro','custom_profile_url',  true,  null,'Custom handle'),
('pro','export_bookings',     true,  null,'CSV export'),
('pro','canned_replies',      true,  null,'Message templates')
ON CONFLICT (plan, feature_key) DO NOTHING;

-- ============================================================
-- PLAN FEATURES — BUSINESS
-- ============================================================
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
('business','directory_listing',   true,  null,'Appear in Vilo Directory'),
('business','directory_priority',  true,  null,'Top directory placement'),
('business','direct_booking',      true,  null,'Full booking flow'),
('business','enquiry_only',        true,  null,'Enquiry flow'),
('business','inbox_messages',      true,  null,'Full inbox'),
('business','inbox_limit',         false, null,'Unlimited conversations'),
('business','payment_paystack',    true,  null,'Paystack payments'),
('business','payment_paypal',      true,  null,'PayPal payments'),
('business','payment_eft',         true,  null,'Manual EFT'),
('business','listings_limit',      false, null,'Unlimited listings'),
('business','staff_seats',         true,  10,  'Max 10 staff seats'),
('business','reviews_respond',     true,  null,'Respond to reviews'),
('business','calendar_management', true,  null,'Block dates'),
('business','instant_booking',     true,  null,'Instant booking'),
('business','analytics_basic',     true,  null,'Basic stats'),
('business','analytics_advanced',  true,  null,'Full analytics'),
('business','custom_profile_url',  true,  null,'Custom handle'),
('business','export_bookings',     true,  null,'CSV export'),
('business','canned_replies',      true,  null,'Message templates')
ON CONFLICT (plan, feature_key) DO NOTHING;
```

---

## 22. Migration Strategy

### File Naming Convention

```
supabase/migrations/
  20260501000000_create_extensions.sql
  20260501000001_create_identity_domain.sql
  20260501000002_create_listings_domain.sql
  20260501000003_create_bookings_domain.sql
  20260501000004_create_payments_domain.sql
  20260501000005_create_subscriptions_domain.sql
  20260501000006_create_inbox_domain.sql
  20260501000007_create_reviews_domain.sql
  20260501000008_create_directory_domain.sql
  20260501000009_create_admin_domain.sql
  20260501000010_create_indexes.sql
  20260501000011_create_rls_helpers.sql
  20260501000012_create_rls_policies.sql
  20260501000013_create_functions.sql
  20260501000014_create_triggers.sql
  20260501000015_create_cron_jobs.sql
  20260501000016_seed_platform_settings.sql
  20260501000017_seed_plan_features.sql
```

### Rules

1. **Never edit a committed migration.** Always create a new file for changes.
2. **Run migrations in timestamp order.** The naming convention enforces this.
3. **Test in staging first.** Staging database mirrors production exactly.
4. **Every migration should be reversible.** Include a `-- DOWN:` comment section.
5. **No data migrations in schema migrations.** Keep them in separate `_data` files.
6. **Use `IF NOT EXISTS` guards** on indexes and policies to make migrations idempotent.

---

## 23. Performance & Scaling Notes

### Query Patterns to Watch

**Directory search** — most expensive read path:
- `search_vector` GIN index handles full-text; `listing_rankings` cache avoids real-time score calculations.
- PostGIS GIST index handles geo proximity queries.
- Results paginated at 24/page. Read replica recommended at 1,000+ DAU.

**Availability check** — called on every listing page view:
- Composite index on `blocked_dates(listing_id, date)` makes this O(log n).
- `get_listing_availability` returns the full blocked array in a single round-trip.

**Inbox Realtime** — Supabase Realtime uses PostgreSQL logical replication:
- Only `messages`, `conversations`, `bookings` are in the Realtime publication.
- Always filter by `conversation_id` or `host_id` on the client to avoid over-broadcasting.

**Permission checks** — `check_feature_permission` is called on every gated action:
- Marked `STABLE` — PostgreSQL caches results within a transaction.
- `host_feature_overrides` index on `(host_id, feature_key)` ensures O(1) lookup.

### Connection Pooling

```toml
# supabase/config.toml
[db.pooler]
enabled = true
pool_mode = "transaction"
default_pool_size = 20
max_client_conn = 100
```

Use PgBouncer in `transaction` mode for all application connections. Direct connections for migrations only.

### Recommended Supabase Plan by Stage

| Stage | Plan | Rationale |
|---|---|---|
| Development | Free | Local or hosted free tier |
| Staging | Pro | Dedicated compute, mirrors production |
| Launch (0–1k bookings/mo) | Pro | Sufficient for MVP scale |
| Growth (1k–10k bookings/mo) | Team | Read replica + higher compute |
| Scale (10k+ bookings/mo) | Enterprise | Custom compute + support SLA |

### Database Region

- **Primary:** `af-south-1` (Cape Town) — lowest latency for South African hosts and guests.
- **Read replica:** `eu-west-1` (Ireland) — for international guests browsing the directory.



---

## 13. Domain 10 — Refund Manager

The Refund Manager introduces structured, host-controlled refund workflows. It integrates directly with Domain 3 (Bookings), Domain 4 (Payments), Domain 11 (Policy Manager via snapshots), and the admin audit infrastructure. All refund state transitions are logged and traceable.

---

### 13.1 `refund_requests`

Central table for all refund requests regardless of origin — automatic, guest-initiated, or host-initiated. One row per refund request per booking.

```sql
CREATE TABLE public.refund_requests (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core relationships
  booking_id          uuid    NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  payment_id          uuid    NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  host_id             uuid    NOT NULL REFERENCES hosts(id)    ON DELETE RESTRICT,
  guest_id            uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,

  -- Amounts
  requested_amount    numeric NOT NULL CHECK (requested_amount >= 0),
  approved_amount     numeric          CHECK (approved_amount >= 0),
  currency            text    NOT NULL DEFAULT 'ZAR',

  -- Request context
  reason              text    NOT NULL,
  reason_detail       text,
  supporting_doc_url  text,             -- Supabase Storage: refund-requests/{booking_id}/

  -- Origin
  initiated_by        text    NOT NULL DEFAULT 'guest'
                              CHECK (initiated_by IN ('guest','host','system','admin')),
  is_auto_refund      boolean NOT NULL DEFAULT false,
  auto_refund_rule    text,             -- label of policy rule that triggered auto-refund

  -- Policy context (denormalised from snapshot for quick display)
  policy_snapshot_id  uuid    REFERENCES policy_snapshots(id) ON DELETE SET NULL,
  policy_entitlement  numeric,          -- calculated refund amount per policy at request time
  policy_name         text,             -- snapshot label for display

  -- Status machine
  status              text    NOT NULL DEFAULT 'pending'
                              CHECK (status IN (
                                'pending',
                                'approved',
                                'declined',
                                'processing',
                                'completed',
                                'failed',
                                'escalated',
                                'disputed',
                                'cancelled'
                              )),

  -- Provider tracking
  provider_refund_id  text,             -- Paystack refund ID or PayPal refund ID
  provider_response   jsonb,            -- raw provider response for audit

  -- EFT manual refund
  is_manual           boolean NOT NULL DEFAULT false,
  manual_sent_at      timestamptz,
  manual_note         text,
  guest_banking_details jsonb,          -- captured at refund time; encrypted at app layer

  -- Host decision
  host_note           text,
  decline_reason      text
                      CHECK (decline_reason IN (
                        'outside_policy','no_show','terms_violated',
                        'services_rendered','other'
                      )),
  actioned_by         uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,
  actioned_at         timestamptz,

  -- Admin escalation
  escalated_at        timestamptz,
  escalation_note     text,
  admin_decision      text
                      CHECK (admin_decision IN ('force_refund','uphold_decline')),
  admin_actioned_by   uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,
  admin_note          text,
  admin_actioned_at   timestamptz,

  -- Soft lifecycle
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Lookup indexes
CREATE INDEX idx_refund_req_booking    ON refund_requests(booking_id);
CREATE INDEX idx_refund_req_payment    ON refund_requests(payment_id);
CREATE INDEX idx_refund_req_host       ON refund_requests(host_id);
CREATE INDEX idx_refund_req_guest      ON refund_requests(guest_id);
CREATE INDEX idx_refund_req_status     ON refund_requests(status);
CREATE INDEX idx_refund_req_created    ON refund_requests(created_at DESC);

-- Dashboard-optimised indexes
CREATE INDEX idx_refund_req_host_pending   ON refund_requests(host_id, status)
  WHERE status = 'pending';
CREATE INDEX idx_refund_req_escalated      ON refund_requests(escalated_at DESC)
  WHERE status = 'escalated';
CREATE INDEX idx_refund_req_auto           ON refund_requests(is_auto_refund)
  WHERE is_auto_refund = true;
CREATE INDEX idx_refund_req_provider       ON refund_requests(provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;

ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE refund_requests IS
  'All refund requests across all payment methods and origins. Central table for the Refund Manager.';
COMMENT ON COLUMN refund_requests.initiated_by IS
  'guest = guest submitted | host = host-initiated on cancellation | system = auto-refund by policy | admin = forced by admin';
COMMENT ON COLUMN refund_requests.is_auto_refund IS
  'True when the booking-cancel Edge Function triggered this refund automatically based on policy rules.';
COMMENT ON COLUMN refund_requests.policy_entitlement IS
  'The calculated refund amount the guest is entitled to per their booking policy snapshot. Stored for auditing.';
COMMENT ON COLUMN refund_requests.guest_banking_details IS
  'Encrypted jsonb. Captured once when guest submits EFT refund request. Never updated.';
COMMENT ON COLUMN refund_requests.provider_refund_id IS
  'Paystack refund ID or PayPal refund transaction ID. Used for idempotency and webhook matching.';
```

**Refund Request Status State Machine:**
```
pending       → approved | declined | cancelled
approved      → processing → completed | failed
declined      → disputed → escalated
escalated     → force_refund (admin) → processing → completed
              → uphold_decline (admin) → (terminal)
processing    → completed | failed
failed        → pending (retry allowed by host)
completed     → (terminal)
cancelled     → (terminal)
```

---

### 13.2 `refund_status_history`

Append-only log of every status transition on a refund request. Provides a complete timeline for admin dispute resolution and audit.

```sql
CREATE TABLE public.refund_status_history (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id uuid    NOT NULL REFERENCES refund_requests(id) ON DELETE CASCADE,
  from_status       text,
  to_status         text    NOT NULL,
  changed_by        uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,
  changed_by_role   text,             -- 'guest' | 'host' | 'staff' | 'system' | 'admin'
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refund_history_request ON refund_status_history(refund_request_id);
CREATE INDEX idx_refund_history_created ON refund_status_history(created_at DESC);

ALTER TABLE refund_status_history ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE refund_status_history IS
  'Immutable append-only log. One row per status transition on a refund_request. Never UPDATE or DELETE.';
```

---

### 13.3 Modifications to Existing Tables

The following columns are added to existing tables to support the Refund Manager without breaking existing structure.

**`bookings` table — add columns:**
```sql
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS refund_total    numeric DEFAULT 0,    -- sum of all completed refunds
  ADD COLUMN IF NOT EXISTS has_open_refund boolean DEFAULT false; -- quick flag for dashboard badge
```

**`payments` table — add column:**
```sql
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS refunded_amount numeric DEFAULT 0;    -- total refunded against this payment
```

**Index for new booking columns:**
```sql
CREATE INDEX idx_bookings_open_refund ON bookings(host_id, has_open_refund)
  WHERE has_open_refund = true;
```

---

### 13.4 Domain 10 — RLS Policies

```sql
-- Guests can view and create their own refund requests
CREATE POLICY "guest_own_refunds" ON refund_requests
  FOR SELECT USING (guest_id = auth.uid());

CREATE POLICY "guest_create_refund" ON refund_requests
  FOR INSERT WITH CHECK (guest_id = auth.uid());

-- Guests can update their own pending requests (add supporting docs, cancel)
CREATE POLICY "guest_update_pending_refund" ON refund_requests
  FOR UPDATE USING (
    guest_id = auth.uid() AND status IN ('pending','disputed')
  );

-- Hosts can view and action refund requests for their bookings
CREATE POLICY "host_view_refunds" ON refund_requests
  FOR SELECT USING (host_id = get_my_host_id());

CREATE POLICY "host_action_refunds" ON refund_requests
  FOR UPDATE USING (
    host_id = get_my_host_id() AND status IN ('pending','failed')
  );

-- Staff can view and action refunds (cannot escalate or delete)
CREATE POLICY "staff_view_refunds" ON refund_requests
  FOR SELECT USING (host_id = get_my_host_id_as_staff());

CREATE POLICY "staff_action_refunds" ON refund_requests
  FOR UPDATE USING (
    host_id = get_my_host_id_as_staff() AND status IN ('pending','failed')
  );

-- Admin full access
CREATE POLICY "admin_full_access_refunds" ON refund_requests
  FOR ALL USING (is_super_admin());

-- Status history: participants can read, system/admin inserts only
CREATE POLICY "participant_read_refund_history" ON refund_status_history
  FOR SELECT USING (
    refund_request_id IN (
      SELECT id FROM refund_requests
      WHERE guest_id = auth.uid()
         OR host_id = get_my_host_id()
         OR host_id = get_my_host_id_as_staff()
    )
  );
CREATE POLICY "admin_read_refund_history" ON refund_status_history
  FOR SELECT USING (is_super_admin());
```

---

### 13.5 Domain 10 — Database Functions

**`calculate_policy_refund_amount`**

Called by `booking-cancel` Edge Function to compute the automatic refund before processing.

```sql
CREATE OR REPLACE FUNCTION calculate_policy_refund_amount(
  p_booking_id  uuid,
  p_cancelled_at timestamptz DEFAULT now()
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_booking         bookings%ROWTYPE;
  v_snapshot        jsonb;
  v_rules           jsonb;
  v_rule            jsonb;
  v_days_before     integer;
  v_refund_percent  integer := 0;
  v_refund_amount   numeric := 0;
  v_matched_rule    text;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  -- Get the cancellation policy snapshot for this booking
  SELECT snapshot_data INTO v_snapshot
  FROM policy_snapshots
  WHERE booking_id = p_booking_id
    AND policy_type = 'cancellation'
  LIMIT 1;

  IF v_snapshot IS NULL THEN
    -- No policy snapshot found — default to no refund
    RETURN jsonb_build_object(
      'refund_amount', 0,
      'refund_percent', 0,
      'rule_applied', 'no_policy_snapshot',
      'days_before_checkin', NULL
    );
  END IF;

  -- Is it non-refundable?
  IF (v_snapshot->>'is_non_refundable')::boolean = true THEN
    RETURN jsonb_build_object(
      'refund_amount', 0,
      'refund_percent', 0,
      'rule_applied', 'non_refundable',
      'days_before_checkin', NULL
    );
  END IF;

  -- Calculate days before check-in
  v_days_before := (v_booking.check_in::date - p_cancelled_at::date)::integer;

  -- Walk rules sorted by days_before DESC — first matching rule wins
  v_rules := v_snapshot->'rules';
  FOR v_rule IN
    SELECT value FROM jsonb_array_elements(v_rules)
    ORDER BY (value->>'days_before')::integer DESC
  LOOP
    IF v_days_before >= (v_rule->>'days_before')::integer THEN
      v_refund_percent := (v_rule->>'refund_percent')::integer;
      v_matched_rule   := v_rule->>'label';
      EXIT;
    END IF;
  END LOOP;

  v_refund_amount := ROUND((v_booking.total_amount * v_refund_percent) / 100.0, 2);

  RETURN jsonb_build_object(
    'refund_amount',      v_refund_amount,
    'refund_percent',     v_refund_percent,
    'rule_applied',       v_matched_rule,
    'days_before_checkin', v_days_before,
    'total_paid',         v_booking.total_amount
  );
END;
$$;
```

**`get_host_refund_stats`**

Called by the host dashboard to populate the Refunds section header stats.

```sql
CREATE OR REPLACE FUNCTION get_host_refund_stats(p_host_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'pending_count',    COUNT(*) FILTER (WHERE status = 'pending'),
    'escalated_count',  COUNT(*) FILTER (WHERE status = 'escalated'),
    'completed_this_month', COUNT(*) FILTER (
      WHERE status = 'completed'
        AND created_at >= date_trunc('month', now())
    ),
    'total_refunded_this_month', COALESCE(SUM(approved_amount) FILTER (
      WHERE status = 'completed'
        AND created_at >= date_trunc('month', now())
    ), 0)
  )
  FROM refund_requests
  WHERE host_id = p_host_id;
$$;
```

---

### 13.6 Domain 10 — Triggers

**Auto-update `bookings.has_open_refund` when a refund request is created or resolved:**

```sql
CREATE OR REPLACE FUNCTION sync_booking_refund_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE bookings
  SET has_open_refund = EXISTS (
    SELECT 1 FROM refund_requests
    WHERE booking_id = COALESCE(NEW.booking_id, OLD.booking_id)
      AND status IN ('pending', 'approved', 'processing', 'disputed', 'escalated')
  )
  WHERE id = COALESCE(NEW.booking_id, OLD.booking_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_sync_booking_refund_flag
  AFTER INSERT OR UPDATE OF status ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION sync_booking_refund_flag();
```

**Auto-insert refund status history on every status change:**

```sql
CREATE OR REPLACE FUNCTION log_refund_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO refund_status_history (
      refund_request_id, from_status, to_status,
      changed_by, changed_by_role, note
    ) VALUES (
      NEW.id, OLD.status, NEW.status,
      NEW.actioned_by,
      COALESCE(
        (SELECT role FROM user_profiles WHERE id = NEW.actioned_by),
        'system'
      ),
      NEW.host_note
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_refund_status_change
  AFTER UPDATE OF status ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION log_refund_status_change();
```

**Update `payments.refunded_amount` when a refund completes:**

```sql
CREATE OR REPLACE FUNCTION update_payment_refunded_amount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE payments
    SET refunded_amount = COALESCE(refunded_amount, 0) + COALESCE(NEW.approved_amount, 0)
    WHERE id = NEW.payment_id;

    -- Sync payment.status based on full vs partial refund
    UPDATE payments
    SET status = CASE
      WHEN refunded_amount >= amount THEN 'refunded'
      ELSE 'partially_refunded'
    END
    WHERE id = NEW.payment_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_payment_refunded
  AFTER UPDATE OF status ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION update_payment_refunded_amount();
```

---

### 13.7 Domain 10 — Storage Bucket

```sql
-- Bucket: refund-requests (private)
-- Path:   refund-requests/{booking_id}/{uuid}.{ext}
-- Types:  image/jpeg, image/png, application/pdf
-- Max:    10 MB per file

CREATE POLICY "guest_upload_refund_doc" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'refund-requests' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM bookings WHERE guest_id = auth.uid()
    )
  );

CREATE POLICY "participant_read_refund_doc" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'refund-requests' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM bookings
      WHERE guest_id = auth.uid()
         OR host_id = get_my_host_id()
         OR host_id = get_my_host_id_as_staff()
    )
  );

CREATE POLICY "admin_read_refund_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'refund-requests' AND is_super_admin()
  );
```

---

### 13.8 Domain 10 — pg_cron Jobs

```sql
-- Alert host about refund requests pending > 24 hours without action
SELECT cron.schedule('alert-pending-refunds', '0 9 * * *', $$
  INSERT INTO notification_queue (host_id, type, payload)
  SELECT host_id,
    'refund_awaiting_action',
    jsonb_build_object(
      'count', COUNT(*),
      'oldest_request', MIN(created_at)
    )
  FROM refund_requests
  WHERE status = 'pending'
    AND created_at < now() - interval '24 hours'
  GROUP BY host_id;
$$);

-- Auto-escalate refund requests not actioned within 72 hours
SELECT cron.schedule('auto-escalate-refunds', '0 10 * * *', $$
  UPDATE refund_requests
  SET status = 'escalated',
      escalated_at = now(),
      escalation_note = 'Auto-escalated: no host response within 72 hours'
  WHERE status = 'pending'
    AND initiated_by = 'guest'
    AND created_at < now() - interval '72 hours';
$$);
```

---

## 14. Domain 11 — Policy Manager

The Policy Manager introduces a structured, versioned policy system. It integrates with Domain 2 (Listings via `listing_policies`), Domain 3 (Bookings via `policy_snapshots` and the `policy_acknowledged` flag), and Domain 10 (Refund Manager via `calculate_policy_refund_amount`).

---

### 14.1 `policies`

Parent record for every policy document in a host's library.

```sql
CREATE TABLE public.policies (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id           uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  name              text    NOT NULL,
  type              text    NOT NULL
                            CHECK (type IN ('cancellation','booking_terms','privacy')),
  status            text    NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','draft','archived')),

  -- Cancellation-specific flags
  is_non_refundable boolean NOT NULL DEFAULT false,
  preset            text
                    CHECK (preset IN ('flexible','moderate','strict','non_refundable','custom')),

  -- Versioning
  version           integer NOT NULL DEFAULT 1,
  parent_policy_id  uuid    REFERENCES policies(id) ON DELETE SET NULL,

  -- Soft lifecycle
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_policies_host_id    ON policies(host_id);
CREATE INDEX idx_policies_type       ON policies(host_id, type);
CREATE INDEX idx_policies_status     ON policies(host_id, status) WHERE status = 'active';
CREATE INDEX idx_policies_parent     ON policies(parent_policy_id)
  WHERE parent_policy_id IS NOT NULL;

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN policies.version IS
  'Incremented when host edits. Previous version record is archived, new record created.';
COMMENT ON COLUMN policies.parent_policy_id IS
  'Points to the previous version of this policy. Allows version history chain.';
COMMENT ON COLUMN policies.preset IS
  'The built-in preset this policy was derived from. NULL if fully custom.';
```

---

### 14.2 `policy_cancellation_rules`

Individual refund rules for cancellation-type policies. Read by the Refund Manager's `calculate_policy_refund_amount` function via the snapshot.

```sql
CREATE TABLE public.policy_cancellation_rules (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       uuid    NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  days_before     integer NOT NULL CHECK (days_before >= 0),
  refund_percent  integer NOT NULL CHECK (refund_percent BETWEEN 0 AND 100),
  label           text    NOT NULL,        -- e.g. "Full refund", "50% refund", "No refund"
  sort_order      integer NOT NULL DEFAULT 0,

  CONSTRAINT unique_days_per_policy UNIQUE (policy_id, days_before)
);

CREATE INDEX idx_policy_rules_policy    ON policy_cancellation_rules(policy_id);
CREATE INDEX idx_policy_rules_sorted    ON policy_cancellation_rules(policy_id, days_before DESC);

ALTER TABLE policy_cancellation_rules ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN policy_cancellation_rules.days_before IS
  'Minimum days before check-in for this rule to apply. Rule with highest matching days_before wins.';
COMMENT ON COLUMN policy_cancellation_rules.refund_percent IS
  '0 = no refund. 100 = full refund. Any integer in between for partial.';
```

---

### 14.3 `policy_content`

Rich text body for booking_terms and privacy policy types. Supports multiple locales (en default for MVP).

```sql
CREATE TABLE public.policy_content (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id   uuid  NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  body_html   text  NOT NULL,         -- Tiptap HTML output
  body_plain  text,                   -- plain text strip for emails
  locale      text  NOT NULL DEFAULT 'en',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_locale_per_policy UNIQUE (policy_id, locale)
);

CREATE INDEX idx_policy_content_policy ON policy_content(policy_id);

ALTER TABLE policy_content ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN policy_content.body_html IS
  'Tiptap rich text output. Stored as HTML. Sanitised by application layer before storage.';
COMMENT ON COLUMN policy_content.body_plain IS
  'Auto-generated plain text version for email inclusion. Generated by Edge Function on save.';
```

---

### 14.4 `listing_policies`

Join table linking listings to their assigned policies. One policy of each type per listing.

```sql
CREATE TABLE public.listing_policies (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid  NOT NULL REFERENCES listings(id)  ON DELETE CASCADE,
  policy_id   uuid  NOT NULL REFERENCES policies(id)  ON DELETE RESTRICT,
  policy_type text  NOT NULL
              CHECK (policy_type IN ('cancellation','booking_terms','privacy')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid  REFERENCES user_profiles(id) ON DELETE SET NULL,

  CONSTRAINT unique_policy_type_per_listing UNIQUE (listing_id, policy_type)
);

CREATE INDEX idx_listing_policies_listing ON listing_policies(listing_id);
CREATE INDEX idx_listing_policies_policy  ON listing_policies(policy_id);
CREATE INDEX idx_listing_policies_type    ON listing_policies(listing_id, policy_type);

ALTER TABLE listing_policies ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE listing_policies IS
  'One row per policy type per listing. UNIQUE constraint prevents duplicate types per listing.';
COMMENT ON COLUMN listing_policies.policy_type IS
  'Denormalised from policies.type for query performance without joining policies table.';
```

---

### 14.5 `policy_snapshots`

**The most critical Policy Manager table.** Immutable copy of a policy's complete data at the moment a booking was created. Never updated. Governs all refund calculations and legal obligations for that booking forever.

```sql
CREATE TABLE public.policy_snapshots (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid    NOT NULL REFERENCES bookings(id)  ON DELETE RESTRICT,
  policy_id       uuid    NOT NULL REFERENCES policies(id)  ON DELETE RESTRICT,
  policy_type     text    NOT NULL
                          CHECK (policy_type IN ('cancellation','booking_terms','privacy')),
  policy_version  integer NOT NULL,       -- captured from policies.version at snapshot time
  policy_name     text    NOT NULL,       -- captured from policies.name at snapshot time
  snapshot_data   jsonb   NOT NULL,       -- complete policy record including rules/content
  snapshotted_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_snapshot_per_booking_type UNIQUE (booking_id, policy_type)
);

CREATE INDEX idx_policy_snapshots_booking      ON policy_snapshots(booking_id);
CREATE INDEX idx_policy_snapshots_booking_type ON policy_snapshots(booking_id, policy_type);
CREATE INDEX idx_policy_snapshots_policy_id    ON policy_snapshots(policy_id);

ALTER TABLE policy_snapshots ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE policy_snapshots IS
  'Immutable. One row per policy type per booking. Created by booking-create Edge Function. NEVER update or delete.';
COMMENT ON COLUMN policy_snapshots.snapshot_data IS
  'Full jsonb copy of the policy at booking time. Includes all rules/content. Governs refunds forever.';
COMMENT ON COLUMN policy_snapshots.policy_version IS
  'Captured at snapshot time. Allows audit of which version the guest agreed to.';
```

**`snapshot_data` jsonb structure (cancellation type):**
```json
{
  "id": "uuid",
  "name": "Standard Moderate Policy",
  "type": "cancellation",
  "is_non_refundable": false,
  "preset": "moderate",
  "version": 2,
  "rules": [
    { "days_before": 5,  "refund_percent": 100, "label": "Full refund" },
    { "days_before": 1,  "refund_percent": 50,  "label": "50% refund" },
    { "days_before": 0,  "refund_percent": 0,   "label": "No refund"  }
  ]
}
```

**`snapshot_data` jsonb structure (booking_terms type):**
```json
{
  "id": "uuid",
  "name": "Garden Cottage House Rules",
  "type": "booking_terms",
  "version": 1,
  "content": {
    "body_html": "<p>Check-in from 14:00...</p>",
    "body_plain": "Check-in from 14:00...",
    "locale": "en"
  }
}
```

---

### 14.6 Modifications to Existing Tables

**`bookings` table — add policy acknowledgement columns:**

```sql
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS policy_acknowledged     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_acknowledged_at  timestamptz;
```

**`listings` table — add denormalised cancellation policy label for directory display:**

```sql
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS cancellation_policy_label text,
  ADD COLUMN IF NOT EXISTS is_non_refundable          boolean NOT NULL DEFAULT false;
```

This label (e.g., "Moderate", "Non-refundable") is updated by a trigger whenever `listing_policies` is updated. It is used in directory search results and listing cards without joining 3 tables.

**Index for non-refundable filter in directory:**
```sql
CREATE INDEX idx_listings_non_refundable ON listings(is_non_refundable)
  WHERE is_non_refundable = true;
```

---

### 14.7 Domain 11 — RLS Policies

```sql
-- PUBLIC: anyone can read active policies assigned to published listings
-- (needed for listing detail page policy display without auth)
CREATE POLICY "public_read_listing_policies" ON listing_policies
  FOR SELECT USING (
    listing_id IN (SELECT id FROM listings WHERE is_published = true)
  );

CREATE POLICY "public_read_active_policies" ON policies
  FOR SELECT USING (
    status = 'active' AND deleted_at IS NULL AND
    host_id IN (SELECT id FROM hosts WHERE is_active = true)
  );

CREATE POLICY "public_read_cancellation_rules" ON policy_cancellation_rules
  FOR SELECT USING (
    policy_id IN (SELECT id FROM policies WHERE status = 'active')
  );

CREATE POLICY "public_read_policy_content" ON policy_content
  FOR SELECT USING (
    policy_id IN (SELECT id FROM policies WHERE status = 'active')
  );

-- HOSTS: full control over their own policies
CREATE POLICY "host_manage_policies" ON policies
  FOR ALL USING (host_id = get_my_host_id());

CREATE POLICY "host_manage_cancellation_rules" ON policy_cancellation_rules
  FOR ALL USING (
    policy_id IN (SELECT id FROM policies WHERE host_id = get_my_host_id())
  );

CREATE POLICY "host_manage_policy_content" ON policy_content
  FOR ALL USING (
    policy_id IN (SELECT id FROM policies WHERE host_id = get_my_host_id())
  );

CREATE POLICY "host_manage_listing_policies" ON listing_policies
  FOR ALL USING (
    listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id())
  );

-- STAFF: read-only access to policies
CREATE POLICY "staff_read_policies" ON policies
  FOR SELECT USING (host_id = get_my_host_id_as_staff());

CREATE POLICY "staff_read_listing_policies" ON listing_policies
  FOR SELECT USING (
    listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id_as_staff())
  );

-- GUESTS: can read their own booking snapshots
CREATE POLICY "guest_read_own_snapshots" ON policy_snapshots
  FOR SELECT USING (
    booking_id IN (SELECT id FROM bookings WHERE guest_id = auth.uid())
  );

-- HOSTS: can read snapshots for their bookings
CREATE POLICY "host_read_booking_snapshots" ON policy_snapshots
  FOR SELECT USING (
    booking_id IN (SELECT id FROM bookings WHERE host_id = get_my_host_id())
  );

-- ADMIN: full access to all policy tables
CREATE POLICY "admin_full_access_policies"          ON policies           FOR ALL USING (is_super_admin());
CREATE POLICY "admin_full_access_rules"             ON policy_cancellation_rules FOR ALL USING (is_super_admin());
CREATE POLICY "admin_full_access_content"           ON policy_content     FOR ALL USING (is_super_admin());
CREATE POLICY "admin_full_access_listing_policies"  ON listing_policies   FOR ALL USING (is_super_admin());
CREATE POLICY "admin_full_access_snapshots"         ON policy_snapshots   FOR ALL USING (is_super_admin());
```

---

### 14.8 Domain 11 — Database Functions

**`snapshot_booking_policies`**

Called inside `booking-create` Edge Function immediately before the booking is confirmed. Takes a complete snapshot of all policies assigned to the listing.

```sql
CREATE OR REPLACE FUNCTION snapshot_booking_policies(
  p_booking_id  uuid,
  p_listing_id  uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lp    record;
  v_pol   policies%ROWTYPE;
  v_data  jsonb;
  v_rules jsonb;
  v_cont  jsonb;
BEGIN
  FOR v_lp IN
    SELECT policy_id, policy_type
    FROM listing_policies
    WHERE listing_id = p_listing_id
  LOOP
    SELECT * INTO v_pol FROM policies WHERE id = v_lp.policy_id;

    -- Build rules array for cancellation policies
    IF v_pol.type = 'cancellation' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'days_before',    days_before,
          'refund_percent', refund_percent,
          'label',          label
        ) ORDER BY days_before DESC
      )
      INTO v_rules
      FROM policy_cancellation_rules
      WHERE policy_id = v_pol.id;

      v_data := jsonb_build_object(
        'id',               v_pol.id,
        'name',             v_pol.name,
        'type',             v_pol.type,
        'is_non_refundable',v_pol.is_non_refundable,
        'preset',           v_pol.preset,
        'version',          v_pol.version,
        'rules',            COALESCE(v_rules, '[]'::jsonb)
      );

    ELSE
      -- booking_terms or privacy: capture content
      SELECT jsonb_build_object(
        'body_html',  body_html,
        'body_plain', body_plain,
        'locale',     locale
      )
      INTO v_cont
      FROM policy_content
      WHERE policy_id = v_pol.id AND locale = 'en'
      LIMIT 1;

      v_data := jsonb_build_object(
        'id',      v_pol.id,
        'name',    v_pol.name,
        'type',    v_pol.type,
        'version', v_pol.version,
        'content', COALESCE(v_cont, '{}'::jsonb)
      );
    END IF;

    INSERT INTO policy_snapshots (
      booking_id, policy_id, policy_type,
      policy_version, policy_name, snapshot_data
    ) VALUES (
      p_booking_id, v_pol.id, v_pol.type,
      v_pol.version, v_pol.name, v_data
    )
    ON CONFLICT (booking_id, policy_type) DO NOTHING;

  END LOOP;
END;
$$;
```

**`get_listing_policy_summary`**

Returns a compact policy summary for listing detail pages and booking summary screens. Called publicly — no auth required.

```sql
CREATE OR REPLACE FUNCTION get_listing_policy_summary(p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb := '{}';
  v_lp     record;
  v_rules  jsonb;
BEGIN
  FOR v_lp IN
    SELECT lp.policy_type, p.name, p.is_non_refundable, p.preset, p.id as policy_id
    FROM listing_policies lp
    JOIN policies p ON p.id = lp.policy_id
    WHERE lp.listing_id = p_listing_id AND p.status = 'active'
  LOOP
    IF v_lp.policy_type = 'cancellation' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'days_before',    days_before,
          'refund_percent', refund_percent,
          'label',          label
        ) ORDER BY days_before DESC
      )
      INTO v_rules
      FROM policy_cancellation_rules
      WHERE policy_id = v_lp.policy_id;

      v_result := v_result || jsonb_build_object(
        'cancellation', jsonb_build_object(
          'name',             v_lp.name,
          'is_non_refundable',v_lp.is_non_refundable,
          'preset',           v_lp.preset,
          'rules',            COALESCE(v_rules, '[]'::jsonb)
        )
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        v_lp.policy_type, jsonb_build_object('name', v_lp.name)
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;
```

---

### 14.9 Domain 11 — Triggers

**Sync `listings.cancellation_policy_label` and `listings.is_non_refundable` when a cancellation policy is assigned or changed:**

```sql
CREATE OR REPLACE FUNCTION sync_listing_policy_label()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pol policies%ROWTYPE;
BEGIN
  IF NEW.policy_type = 'cancellation' THEN
    SELECT * INTO v_pol FROM policies WHERE id = NEW.policy_id;
    UPDATE listings SET
      cancellation_policy_label = v_pol.name,
      is_non_refundable          = v_pol.is_non_refundable
    WHERE id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_listing_policy_label
  AFTER INSERT OR UPDATE ON listing_policies
  FOR EACH ROW EXECUTE FUNCTION sync_listing_policy_label();
```

**Increment policy version and create version chain on update:**

```sql
CREATE OR REPLACE FUNCTION version_policy_on_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- When a policy's name, rules, or content changes, bump the version
  IF NEW.name IS DISTINCT FROM OLD.name OR
     NEW.is_non_refundable IS DISTINCT FROM OLD.is_non_refundable OR
     NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_version_policy
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION version_policy_on_update();
```

**Auto-generate plain text version of policy content on save:**

```sql
CREATE OR REPLACE FUNCTION generate_policy_plain_text()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Strip HTML tags for plain text version (used in emails)
  -- In production, the Edge Function handles richer HTML stripping;
  -- this is a safe fallback for direct DB inserts
  IF NEW.body_plain IS NULL OR NEW.body_plain = '' THEN
    NEW.body_plain := regexp_replace(NEW.body_html, '<[^>]+>', ' ', 'g');
    NEW.body_plain := regexp_replace(trim(NEW.body_plain), '\s+', ' ', 'g');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_policy_plain_text
  BEFORE INSERT OR UPDATE OF body_html ON policy_content
  FOR EACH ROW EXECUTE FUNCTION generate_policy_plain_text();
```

---

### 14.10 Domain 11 — pg_cron Jobs

```sql
-- Daily: alert hosts who have published listings with no cancellation policy assigned
SELECT cron.schedule('alert-missing-policies', '0 10 * * *', $$
  INSERT INTO notification_queue (host_id, type, payload)
  SELECT DISTINCT l.host_id,
    'listing_missing_policy',
    jsonb_build_object(
      'listing_id',   l.id,
      'listing_name', l.name,
      'missing_type', 'cancellation'
    )
  FROM listings l
  WHERE l.is_published = true
    AND l.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM listing_policies lp
      WHERE lp.listing_id = l.id AND lp.policy_type = 'cancellation'
    );
$$);
```

---

## Updated Index Strategy (Domains 10 & 11)

The following rows are **added** to the full index table from Section 16 (formerly Section 14):

| Table | Index Type | Column(s) | Purpose |
|---|---|---|---|
| refund_requests | BTREE | booking_id | Refund per booking |
| refund_requests | BTREE | host_id, status | Host refund dashboard |
| refund_requests | BTREE | guest_id | Guest refund history |
| refund_requests | BTREE | status | Platform-wide filtering |
| refund_requests | BTREE (partial) | host_id, status = pending | Pending queue badge |
| refund_requests | BTREE (partial) | escalated_at DESC | Admin escalation queue |
| refund_requests | BTREE (partial) | provider_refund_id | Webhook idempotency |
| refund_status_history | BTREE | refund_request_id | Status timeline |
| refund_status_history | BTREE | created_at DESC | Chronological audit |
| policies | BTREE | host_id | Host policy library |
| policies | BTREE | host_id, type | Filter by type |
| policies | BTREE (partial) | host_id, status = active | Active policies only |
| policies | BTREE | parent_policy_id | Version chain |
| policy_cancellation_rules | BTREE | policy_id | Rules per policy |
| policy_cancellation_rules | BTREE | policy_id, days_before DESC | Refund calculation |
| policy_content | BTREE | policy_id | Content per policy |
| listing_policies | BTREE | listing_id | Policies per listing |
| listing_policies | BTREE | listing_id, policy_type | Single-type lookup |
| listing_policies | BTREE | policy_id | Listings using a policy |
| policy_snapshots | BTREE | booking_id | Snapshot per booking |
| policy_snapshots | BTREE | booking_id, policy_type | Direct type lookup |
| policy_snapshots | BTREE | policy_id | Usage audit |
| bookings (updated) | BTREE (partial) | host_id, has_open_refund | Refund badge |
| listings (updated) | BTREE (partial) | is_non_refundable = true | Directory filter |

---

## Updated `updated_at` Trigger Applications (Domains 10 & 11)

```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON refund_requests       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON policies               FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON policy_content         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Updated Storage Buckets Table (v1.1)

The following bucket is **added** to the storage configuration from Section 22 (formerly Section 20):

| Bucket | Access | Max Size | Allowed Types | Path Pattern |
|---|---|---|---|---|
| `refund-requests` | Private | 10 MB | image/jpeg, image/png, application/pdf | `refund-requests/{booking_id}/{uuid}.{ext}` |

---

## Updated Migration File List (v1.1)

The following migration files are **added** to the migration strategy from Section 24 (formerly Section 22):

```
supabase/migrations/
  ...existing migrations 000000–000017...
  20260502000000_create_refund_manager_domain.sql
  20260502000001_create_policy_manager_domain.sql
  20260502000002_alter_bookings_refund_columns.sql
  20260502000003_alter_bookings_policy_columns.sql
  20260502000004_alter_payments_refunded_amount.sql
  20260502000005_alter_listings_policy_columns.sql
  20260502000006_create_refund_indexes.sql
  20260502000007_create_policy_indexes.sql
  20260502000008_create_refund_rls_policies.sql
  20260502000009_create_policy_rls_policies.sql
  20260502000010_create_refund_functions.sql
  20260502000011_create_policy_functions.sql
  20260502000012_create_refund_triggers.sql
  20260502000013_create_policy_triggers.sql
  20260502000014_create_refund_cron_jobs.sql
  20260502000015_create_policy_cron_jobs.sql
  20260502000016_add_refund_requests_storage_bucket.sql
  20260502000017_seed_default_policy_templates.sql
```

---

## Updated Seed Data (v1.1)

Default policy templates are seeded into `platform_settings` so new hosts have a starting point during onboarding:

```sql
INSERT INTO platform_settings (key, value, description)
VALUES (
  'default_policy_templates',
  jsonb_build_object(
    'cancellation_flexible', jsonb_build_object(
      'name',   'Flexible Cancellation',
      'preset', 'flexible',
      'rules',  '[
        {"days_before": 1,  "refund_percent": 100, "label": "Full refund"},
        {"days_before": 0,  "refund_percent": 0,   "label": "No refund"}
      ]'::jsonb
    ),
    'cancellation_moderate', jsonb_build_object(
      'name',   'Moderate Cancellation',
      'preset', 'moderate',
      'rules',  '[
        {"days_before": 5,  "refund_percent": 100, "label": "Full refund"},
        {"days_before": 1,  "refund_percent": 50,  "label": "50% refund"},
        {"days_before": 0,  "refund_percent": 0,   "label": "No refund"}
      ]'::jsonb
    ),
    'cancellation_strict', jsonb_build_object(
      'name',   'Strict Cancellation',
      'preset', 'strict',
      'rules',  '[
        {"days_before": 7,  "refund_percent": 50,  "label": "50% refund"},
        {"days_before": 0,  "refund_percent": 0,   "label": "No refund"}
      ]'::jsonb
    ),
    'cancellation_non_refundable', jsonb_build_object(
      'name',             'Non-Refundable',
      'preset',           'non_refundable',
      'is_non_refundable', true,
      'rules',            '[
        {"days_before": 0, "refund_percent": 0, "label": "No refund"}
      ]'::jsonb
    ),
    'booking_terms_template', jsonb_build_object(
      'name',       'Standard Booking Terms',
      'body_html',  '<h2>Check-In & Check-Out</h2><p>Check-in from 14:00. Check-out by 10:00. Early/late arrangements subject to availability.</p><h2>House Rules</h2><ul><li>No smoking indoors.</li><li>No parties or events.</li><li>Pets by prior arrangement only.</li><li>Please treat the property with respect.</li></ul><h2>Guest Responsibilities</h2><p>Guests are responsible for any damage caused during their stay. Please report any issues immediately.</p>',
      'body_plain',  'Check-in from 14:00. Check-out by 10:00. No smoking. No parties. Pets by arrangement. Guests are responsible for damages.'
    ),
    'privacy_template', jsonb_build_object(
      'name',      'Guest Privacy Notice',
      'body_html', '<p>By making a booking, you consent to this property storing your name, email, and phone number for the purpose of managing your reservation. Your details will not be shared with third parties and will be deleted within 12 months of your last stay. To request deletion, contact the host directly.</p>',
      'body_plain', 'Your contact details are stored for booking management only, not shared with third parties, and deleted within 12 months of your last stay.'
    )
  ),
  'Default policy templates pre-loaded into new host accounts during onboarding.'
)
ON CONFLICT (key) DO NOTHING;
```

---

*This document is the single source of truth for the Vilo database architecture. All schema changes must be reflected here before implementation. Reference alongside `vilo-platform-mvp.md` (v1.2) and `customer_journey.md` (v1.0).*
