-- Migration: per-host website Meta Conversions API (server-side).
--
-- The host's browser pixel id lives in settings.analytics.metaPixel (public,
-- client-exposed). The CAPI ACCESS TOKEN is a secret, so it lives in a dedicated
-- column here — read ONLY server-side (the thank-you page fires CAPI), encrypted
-- at rest (app-layer, same as payment secrets), NEVER included in the
-- client-exposed settings.analytics blob.

ALTER TABLE public.host_websites
  ADD COLUMN IF NOT EXISTS meta_capi_access_token text,
  ADD COLUMN IF NOT EXISTS meta_capi_enabled      boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.host_websites.meta_capi_access_token IS
  'Host''s Meta Conversions API access token — encrypted (app-layer), server-only, never sent to the client.';
COMMENT ON COLUMN public.host_websites.meta_capi_enabled IS
  'When true (and a token + settings.analytics.metaPixel are set), the site thank-you sends a server-side Purchase to Meta.';
