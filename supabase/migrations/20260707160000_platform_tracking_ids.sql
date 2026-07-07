-- Migration: additional platform marketing tracking IDs.
--
-- Extends the platform_integrations singleton (Meta Pixel already there) with the
-- other tracking IDs the founder can paste in the admin — GA4, Google Tag
-- Manager, TikTok Pixel, Google Ads. Presence of an id = active (no separate
-- enabled flag, mirroring the host-site analytics model); the Meta Pixel keeps
-- its explicit enabled toggle. Loaded site-wide on the Wielo app (NOT on host
-- micro-sites, which fire the host's own pixel). Service-role only.

ALTER TABLE public.platform_integrations
  ADD COLUMN IF NOT EXISTS ga4_measurement_id text,
  ADD COLUMN IF NOT EXISTS gtm_container_id   text,
  ADD COLUMN IF NOT EXISTS tiktok_pixel_id    text,
  ADD COLUMN IF NOT EXISTS google_ads_id      text;

COMMENT ON COLUMN public.platform_integrations.ga4_measurement_id IS
  'GA4 Measurement ID (G-XXXXXXXXXX) — active when set.';
COMMENT ON COLUMN public.platform_integrations.gtm_container_id IS
  'Google Tag Manager container ID (GTM-XXXXXXX) — active when set.';
COMMENT ON COLUMN public.platform_integrations.tiktok_pixel_id IS
  'TikTok Pixel ID — active when set.';
COMMENT ON COLUMN public.platform_integrations.google_ads_id IS
  'Google Ads conversion ID (AW-XXXXXXXXX) — active when set.';
