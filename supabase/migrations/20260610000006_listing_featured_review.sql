-- Migration: host-chosen featured review per listing.
--
-- The listing page highlights one "featured" review. The host can pick it; if
-- they don't, the app falls back to the latest highest-rated published review.
-- Lives on listings (not reviews) so it sits outside the review-content lock
-- and the host edits it via their own listing.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS featured_review_id uuid
    REFERENCES reviews(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.listings.featured_review_id IS
  'Host-pinned featured review for the listing page. NULL = fall back to the '
  'latest highest-rated published review.';
