-- Migration: platform marketing integrations (Meta Pixel + Conversions API)
--
-- Admin-managed so the founder can paste a Meta Pixel ID (and later a Conversions
-- API token) without a redeploy. Singleton row, service-role only. The pixel ID
-- is surfaced to the browser by the layout when enabled; the CAPI token is NEVER
-- sent to the client.

CREATE TABLE public.platform_integrations (
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),

  meta_pixel_id          text,
  meta_pixel_enabled     boolean NOT NULL DEFAULT false,

  -- Conversions API (server-side) — plumbed now, sent later. Never client-exposed.
  meta_capi_access_token text,
  meta_capi_enabled      boolean NOT NULL DEFAULT false,
  meta_test_event_code   text,

  updated_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_integrations (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.platform_integrations ENABLE ROW LEVEL SECURITY;
-- Service-role only (admin reads/writes via the audited admin client; the layout
-- reads the pixel id via the service-role client). No anon/auth policy.

COMMENT ON TABLE public.platform_integrations IS
  'Singleton config for marketing pixels. meta_capi_access_token is server-only and never exposed to the client.';
