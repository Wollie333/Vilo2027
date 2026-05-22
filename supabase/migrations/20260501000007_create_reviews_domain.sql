-- Migration: Domain 7 — Reviews
-- Per supabase_database.md §10
-- Tables: reviews, review_flags

-- ─── reviews ──────────────────────────────────────────────────
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

  review_token       text    UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
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

-- ─── review_flags ─────────────────────────────────────────────
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
