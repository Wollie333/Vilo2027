-- Business web presence: the website + social accounts belong to the BUSINESS
-- entity (the guest-facing legal identity), exactly like its banking, address
-- and logo — not to the host's personal profile. Guests see these on their
-- booking's "Your host" card, resolved via the booking's business.
--
-- website_url: a single external site. social_links: a small key→url/handle map
-- ({ instagram, facebook, x, tiktok, youtube, linkedin }); empty keys omitted.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS website_url  text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.businesses.website_url IS
  'The business''s external website, shown to guests on their booking. Optional.';
COMMENT ON COLUMN public.businesses.social_links IS
  'Business social accounts as a {platform: url_or_handle} map (instagram, facebook, x, tiktok, youtube, linkedin). Empty keys omitted.';
