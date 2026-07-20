-- WS-4: capture "Do you own accommodation?" at guest signup to turn the guest
-- funnel into a HOST lead source. Nullable: NULL = not asked / skipped, true =
-- self-identified accommodation owner (a host lead), false = pure guest.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS owns_accommodation boolean;

COMMENT ON COLUMN public.user_profiles.owns_accommodation IS
  'Guest self-identified as owning accommodation at signup (WS-4 host-lead capture). NULL = not asked.';
