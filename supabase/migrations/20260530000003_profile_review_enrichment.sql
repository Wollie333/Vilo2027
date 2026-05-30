-- Migration: profile + review enrichment for the public-facing host page
-- Adds the data behind the redesigned host profile ("Split host rail / tabs"):
--   • per-category review sub-ratings (aggregated into the rating breakdown bars)
--   • host highlight tags, Superhost badge, and extra verification flags
-- The public room page reuses existing room columns, so no room schema here.
--
-- Pre-MVP: additive, all nullable / defaulted, safe to apply to an empty DB.
--
-- DOWN:
--   ALTER TABLE public.reviews
--     DROP COLUMN rating_cleanliness, DROP COLUMN rating_communication,
--     DROP COLUMN rating_checkin, DROP COLUMN rating_accuracy,
--     DROP COLUMN rating_location, DROP COLUMN rating_value;
--   ALTER TABLE public.hosts
--     DROP COLUMN highlights, DROP COLUMN is_superhost,
--     DROP COLUMN phone_verified, DROP COLUMN payout_verified;

-- ─── reviews: optional per-category sub-ratings (1–5) ─────────────
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS rating_cleanliness   integer CHECK (rating_cleanliness   BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_communication integer CHECK (rating_communication BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_checkin       integer CHECK (rating_checkin       BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_accuracy      integer CHECK (rating_accuracy      BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_location      integer CHECK (rating_location      BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_value         integer CHECK (rating_value         BETWEEN 1 AND 5);

COMMENT ON COLUMN public.reviews.rating_cleanliness IS
  'Optional per-category guest sub-rating (1–5). Averaged across published reviews for the host profile rating breakdown.';

-- ─── hosts: profile enrichment ───────────────────────────────────
ALTER TABLE public.hosts
  ADD COLUMN IF NOT EXISTS highlights      text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_superhost    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hosts.highlights IS
  'Short host highlight tags shown on the public profile (e.g. "Lives on the property"). Host-editable.';
COMMENT ON COLUMN public.hosts.is_superhost IS
  'Superhost badge. Platform-curated; defaults false.';
COMMENT ON COLUMN public.hosts.phone_verified IS
  'Whether the host has confirmed a phone number — shown under "Confirmed information".';
COMMENT ON COLUMN public.hosts.payout_verified IS
  'Whether the host has a verified payout method — shown under "Confirmed information".';
