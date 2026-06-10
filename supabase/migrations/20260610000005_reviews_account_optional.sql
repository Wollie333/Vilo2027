-- Migration: let account-less (manual) guests review.
--
-- A review no longer requires a registered guest (user_profiles). It still maps
-- 1:1 to a real booking (booking_id UNIQUE NOT NULL), so reviews stay verified;
-- when there's no account, the guest's name is read from the booking. Same for
-- the review-request queue, so manual guests can be auto-/bulk-emailed too.

ALTER TABLE public.reviews
  ALTER COLUMN guest_id DROP NOT NULL;

ALTER TABLE public.review_request_queue
  ALTER COLUMN guest_id DROP NOT NULL;

COMMENT ON COLUMN public.reviews.guest_id IS
  'Reviewer''s account, or NULL for an account-less (manual-booking) guest. '
  'Display name falls back to bookings.guest_name in that case.';
