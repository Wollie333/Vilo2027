-- Migration: paid platform services (Super-Admin portal Pillar 1 / P1.2)
--
-- Vilo's OWN paid add-on services sold to hosts (e.g. Premium Support, Priority
-- Directory, White-label) — distinct from booking add-ons (host→guest). The
-- admin defines/prices them here; purchases flow through the same platform
-- billing rail + land in platform_ledger (service_id already exists there).

CREATE TABLE public.platform_services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  billing_type  text NOT NULL DEFAULT 'one_time'
                     CHECK (billing_type IN ('one_time', 'recurring')),
  price         numeric NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'ZAR',
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'annual')),
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_services_active ON public.platform_services(is_active, sort_order);

ALTER TABLE public.platform_services ENABLE ROW LEVEL SECURITY;

-- Public read of active services (host-facing purchase surface later); writes via
-- the service-role admin client only.
CREATE POLICY platform_services_public_read ON public.platform_services
  FOR SELECT USING (is_active = true);

COMMENT ON TABLE public.platform_services IS
  'Vilo''s own paid add-on services sold to hosts. Not booking add-ons (those are host→guest).';
