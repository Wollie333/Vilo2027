-- Migration: Multi-business foundation (Phase 1)
--
-- Promotes "business" from a 1:1 host extension (host_business_details) to a
-- first-class `businesses` table (1 host -> many businesses). Listings, banking
-- and guests gain a business_id. Two triggers keep the invariant "every host has
-- a default business, and every listing has a business_id" true on ALL code
-- paths, so later phases stay green regardless of build order.
--
-- Pre-MVP data policy (CLAUDE.md): no real users, so destructive reshapes +
-- backfills are allowed. host_business_details is KEPT as the live source until
-- Phase 3 — this migration only backfills FROM it (mapping billing_* -> address_*).
--
-- Integration notes:
--   * businesses.default_currency is the SETTLEMENT/listing default a listing
--     inherits into listings.currency. It does NOT touch the viewer display
--     layer (vilo_display_ccy cookie / displayAmount()). MVP default 'ZAR'.
--   * businesses.default_language is the per-business locale (next-intl list:
--     en/af/fr/de/pt) for that business's guest-facing docs/emails. Stored now;
--     document/email wiring is owned by the currency/i18n effort.

-- ============================================================
-- 1. businesses  (generalizes host_business_details)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.businesses (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id                     uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  legal_name                  text,
  trading_name                text,
  vat_number                  text,
  company_registration_number text,
  -- Address, named the listing way so LocationPicker output maps 1:1.
  address_line1               text,
  address_line2               text,
  city                        text,
  province                    text,
  postal_code                 text,
  country                     text NOT NULL DEFAULT 'ZA',
  latitude                    numeric,
  longitude                   numeric,
  logo_path                   text,
  default_currency            text NOT NULL DEFAULT 'ZAR',
  default_language            text NOT NULL DEFAULT 'en',
  is_default                  boolean NOT NULL DEFAULT false,
  is_archived                 boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.businesses IS
  'Legal entities owned by a host account. Listings + financial documents resolve their company identity (name, VAT, address, banking, currency, language) from here. Generalizes the former 1:1 host_business_details.';

CREATE INDEX IF NOT EXISTS idx_businesses_host_active
  ON public.businesses(host_id) WHERE is_archived = false;

-- Exactly one default business per host (archived excluded). Server actions must
-- clear the previous default in the same txn before promoting a new one.
CREATE UNIQUE INDEX IF NOT EXISTS businesses_one_default_per_host
  ON public.businesses(host_id)
  WHERE is_default = true AND is_archived = false;

CREATE TRIGGER set_updated_at_businesses BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY businesses_owner_all ON public.businesses
  FOR ALL TO authenticated
  USING (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()))
  WITH CHECK (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()));

-- Backfill: one default business per existing host, sourced from
-- host_business_details where present.
INSERT INTO public.businesses (
  host_id, legal_name, trading_name, vat_number, company_registration_number,
  address_line1, address_line2, city, postal_code, country,
  logo_path, default_currency, default_language, is_default
)
SELECT
  h.id,
  bd.legal_name,
  COALESCE(bd.trading_name, h.display_name),
  bd.vat_number,
  bd.company_registration_number,
  bd.billing_address_line1,
  bd.billing_address_line2,
  bd.billing_city,
  bd.billing_postcode,
  COALESCE(bd.billing_country, 'ZA'),
  bd.logo_path,
  COALESCE(h.default_currency, 'ZAR'),
  'en',
  true
FROM public.hosts h
LEFT JOIN public.host_business_details bd ON bd.host_id = h.id
WHERE NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.host_id = h.id);

-- ============================================================
-- 2. listings.business_id
-- ============================================================
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);

UPDATE public.listings l
SET business_id = b.id
FROM public.businesses b
WHERE b.host_id = l.host_id AND b.is_default = true
  AND l.business_id IS NULL;

ALTER TABLE public.listings ALTER COLUMN business_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_business ON public.listings(business_id);

-- ============================================================
-- 3. eft_banking_details.business_id  (per-business banking)
-- ============================================================
ALTER TABLE public.eft_banking_details
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);

UPDATE public.eft_banking_details e
SET business_id = b.id
FROM public.businesses b
WHERE b.host_id = e.host_id AND b.is_default = true
  AND e.business_id IS NULL;

ALTER TABLE public.eft_banking_details ALTER COLUMN business_id SET NOT NULL;

-- Replace the per-host default index with a per-business one.
DROP INDEX IF EXISTS public.eft_banking_one_default_per_host;
CREATE UNIQUE INDEX IF NOT EXISTS eft_banking_one_default_per_business
  ON public.eft_banking_details(business_id)
  WHERE is_default = true AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_eft_banking_business
  ON public.eft_banking_details(business_id) WHERE is_archived = false;

-- ============================================================
-- 4. host_personal_details  (private, internal-only address)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.host_personal_details (
  host_id        uuid PRIMARY KEY REFERENCES public.hosts(id) ON DELETE CASCADE,
  address_line1  text,
  address_line2  text,
  city           text,
  province       text,
  postal_code    text,
  country        text NOT NULL DEFAULT 'ZA',
  latitude       numeric,
  longitude      numeric,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.host_personal_details IS
  'Private physical address of the account holder. Internal use only — NEVER exposed to guests or any public/guest-facing select.';

CREATE TRIGGER set_updated_at_host_personal BEFORE UPDATE ON public.host_personal_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.host_personal_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY host_personal_owner_all ON public.host_personal_details
  FOR ALL TO authenticated
  USING (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()))
  WITH CHECK (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()));

-- ============================================================
-- 5. guest_business_links  (M:N guests <-> businesses)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guest_business_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id           uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  contact_id        uuid NOT NULL REFERENCES public.host_contacts(id) ON DELETE CASCADE,
  business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  source_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  first_linked_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, business_id)
);

COMMENT ON TABLE public.guest_business_links IS
  'Many-to-many: which businesses a guest (host_contact) has engaged. The canonical guest record stays single per host (host_contacts); this tags business association without duplicating guests.';

CREATE INDEX IF NOT EXISTS idx_gbl_host ON public.guest_business_links(host_id);
CREATE INDEX IF NOT EXISTS idx_gbl_business ON public.guest_business_links(business_id);
CREATE INDEX IF NOT EXISTS idx_gbl_contact ON public.guest_business_links(contact_id);

ALTER TABLE public.guest_business_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY gbl_owner_all ON public.guest_business_links
  FOR ALL TO authenticated
  USING (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()))
  WITH CHECK (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()));

-- Backfill from existing bookings: link each contact to the business of the
-- listings they've booked (earliest booking per contact+business as source).
INSERT INTO public.guest_business_links (host_id, contact_id, business_id, source_booking_id, first_linked_at)
SELECT DISTINCT ON (hc.id, l.business_id)
  hc.host_id, hc.id, l.business_id, bk.id, COALESCE(bk.created_at, now())
FROM public.bookings bk
JOIN public.listings l ON l.id = bk.listing_id
JOIN public.host_contacts hc
  ON hc.host_id = bk.host_id
 AND lower(hc.email) = lower(bk.guest_email)
WHERE bk.guest_email IS NOT NULL
ORDER BY hc.id, l.business_id, bk.created_at
ON CONFLICT (contact_id, business_id) DO NOTHING;

-- ============================================================
-- 6. Invariant triggers
-- ============================================================

-- Every new host gets a default business immediately on creation.
CREATE OR REPLACE FUNCTION on_host_created_default_business()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.businesses (host_id, trading_name, default_currency, is_default)
  VALUES (NEW.id, NEW.display_name, COALESCE(NEW.default_currency, 'ZAR'), true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_host_default_business
  AFTER INSERT ON public.hosts
  FOR EACH ROW EXECUTE FUNCTION on_host_created_default_business();

-- Every listing without an explicit business falls back to the host's default.
CREATE OR REPLACE FUNCTION set_listing_default_business()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.business_id IS NULL THEN
    SELECT b.id INTO NEW.business_id
    FROM public.businesses b
    WHERE b.host_id = NEW.host_id AND b.is_default = true AND b.is_archived = false
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_listing_default_business
  BEFORE INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION set_listing_default_business();
