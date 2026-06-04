-- Migration: configurable legal company identity.
--
-- The registered company name + location are placeholders too ("Vilo Platform
-- (Pty) Ltd", "Cape Town, South Africa") until the company is actually
-- registered. Store them in platform_settings so they can be updated from the
-- admin settings screen without a code change — same pattern as brand_name.

INSERT INTO public.platform_settings (key, value, description)
VALUES
  (
    'company_legal_name',
    '"Vilo Platform (Pty) Ltd"'::jsonb,
    'Registered legal entity name, shown in copyright/footers and legal pages. Placeholder until the company is registered.'
  ),
  (
    'company_location',
    '"Cape Town, South Africa"'::jsonb,
    'Company location line shown alongside the legal name (e.g. in footers / contact).'
  )
ON CONFLICT (key) DO NOTHING;
