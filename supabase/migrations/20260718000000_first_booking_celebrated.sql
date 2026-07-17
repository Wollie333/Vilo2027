-- Track whether a guest has already seen the one-time "your first booking"
-- celebration, so it fires exactly once ever (per user), regardless of how many
-- times they revisit or refresh the booking success page.
--
-- The success page atomically claims the celebration by UPDATE ... WHERE
-- first_booking_celebrated_at IS NULL RETURNING id — only the request that
-- flips NULL → now() shows the modal, so refreshes/revisits never re-fire.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS first_booking_celebrated_at timestamptz;

COMMENT ON COLUMN public.user_profiles.first_booking_celebrated_at IS
  'When the guest was shown the one-time first-booking celebration modal. NULL = not yet celebrated. Set atomically by the booking success page.';
