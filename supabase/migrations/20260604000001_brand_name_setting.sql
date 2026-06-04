-- Migration: configurable brand name.
--
-- "Vilo" is a placeholder until the real brand is chosen. Rather than hardcode
-- it everywhere, the display name lives in platform_settings under `brand_name`
-- and is read at runtime (see apps/web/lib/brand.ts). Admins edit it from the
-- platform settings screen; changing it updates the name across the app.
--
-- platform_settings is key→jsonb; the value is a JSON string.

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'brand_name',
  '"Vilo"'::jsonb,
  'Display brand name shown across the app (nav, titles, emails). Placeholder until the real brand is decided.'
)
ON CONFLICT (key) DO NOTHING;
