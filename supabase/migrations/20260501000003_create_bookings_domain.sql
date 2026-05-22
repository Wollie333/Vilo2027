-- Migration: Domain 3 — Bookings
-- Per supabase_database.md §6
-- Tables: bookings, booking_notes, blocked_dates
-- (blocked_dates moved here because it FKs into bookings)

-- ─── bookings ─────────────────────────────────────────────────
CREATE TABLE public.bookings (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),

  listing_id        uuid    NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  host_id           uuid    NOT NULL REFERENCES hosts(id) ON DELETE RESTRICT,
  guest_id          uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,

  reference         text    UNIQUE NOT NULL DEFAULT
    'VILO-' || to_char(now(),'YYYY') || '-' ||
    upper(substring(gen_random_uuid()::text,1,6)),

  status            text    NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                              'pending','pending_eft','pending_eft_review',
                              'confirmed','checked_in','completed',
                              'cancelled_by_host','cancelled_by_guest',
                              'declined','expired','no_show'
                            )),
  previous_status   text,

  check_in          date,
  check_out         date,
  session_date      timestamptz,

  nights            integer GENERATED ALWAYS AS (
    CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL
    THEN (check_out - check_in) ELSE NULL END
  ) STORED,

  guests_count      integer NOT NULL DEFAULT 1,
  guests_breakdown  jsonb,

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

  confirmed_at      timestamptz,
  declined_at       timestamptz,
  cancelled_at      timestamptz,
  checked_in_at     timestamptz,
  checked_out_at    timestamptz,

  cancellation_reason text,
  cancelled_by      text    CHECK (cancelled_by IN ('guest','host','admin','system')),
  special_requests  text,
  internal_notes    text,
  actioned_by       uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,

  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

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

-- ─── booking_notes ────────────────────────────────────────────
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

-- ─── blocked_dates ────────────────────────────────────────────
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
