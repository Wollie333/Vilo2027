-- Migration: ALTER existing tables for v1.1 (Refund Manager + Policy Manager)
-- Per supabase_database.md §13.3 and §14.6

-- ─── bookings — refund + policy acknowledgement columns ───────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS refund_total            numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_open_refund         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_acknowledged     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_acknowledged_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_bookings_open_refund
  ON bookings(host_id, has_open_refund) WHERE has_open_refund = true;

-- ─── payments — refunded amount tracking ──────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS refunded_amount numeric DEFAULT 0;

-- ─── listings — denormalised policy display ───────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS cancellation_policy_label text,
  ADD COLUMN IF NOT EXISTS is_non_refundable          boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_listings_non_refundable
  ON listings(is_non_refundable) WHERE is_non_refundable = true;
