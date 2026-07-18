-- Model 2 — per-host settlement currency (currency of record on the HOST side).
--
-- The currency chain is already data-driven: createBooking stamps
-- properties.currency onto bookings/payments/add-ons. The only gap was that a
-- host could never pick a currency other than ZAR. This migration:
--   1. widens the allowed settlement-currency set (curated: ZAR/USD/EUR/GBP),
--   2. makes a NEW listing INHERIT its business's default_currency,
-- so a host who onboards in (say) EUR gets EUR listings → EUR bookings → charged
-- in EUR. Existing ZAR rows are never re-denominated.
--
-- Wielo's OWN revenue (subscriptions/credits) is Flow B and stays ZAR — it does
-- not read these columns.

-- ── 1. Curated settlement-currency set on hosts + businesses ──────────────
-- hosts.default_currency previously CHECK-limited to ('ZAR','USD'). Drop any
-- existing currency CHECK by name-agnostic lookup, then re-add the widened set.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.hosts'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%default_currency%'
  LOOP
    EXECUTE format('ALTER TABLE public.hosts DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.hosts
  ADD CONSTRAINT hosts_default_currency_check
  CHECK (default_currency = ANY (ARRAY['ZAR'::text, 'USD'::text, 'EUR'::text, 'GBP'::text]));

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.businesses'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%default_currency%'
  LOOP
    EXECUTE format('ALTER TABLE public.businesses DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_default_currency_check
  CHECK (default_currency = ANY (ARRAY['ZAR'::text, 'USD'::text, 'EUR'::text, 'GBP'::text]));

-- ── 2. New listings inherit their business's settlement currency ──────────
-- A host's listings are all denominated in the host's (business's) currency —
-- there is no per-listing currency choice — so always inherit on INSERT. Runs
-- BEFORE INSERT; resolves the business the same way trg_listing_default_business
-- does (NEW.business_id, else the host's default business) so it is correct
-- regardless of trigger firing order.
CREATE OR REPLACE FUNCTION public.set_property_currency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_biz uuid;
  v_ccy text;
BEGIN
  v_biz := COALESCE(NEW.business_id, (
    SELECT b.id FROM public.businesses b
    WHERE b.host_id = NEW.host_id AND b.is_default = true AND b.is_archived = false
    LIMIT 1
  ));
  IF v_biz IS NOT NULL THEN
    SELECT b.default_currency INTO v_ccy FROM public.businesses b WHERE b.id = v_biz;
    IF v_ccy IS NOT NULL THEN
      NEW.currency := v_ccy;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Named to sort AFTER trg_listing_default_business so business_id is already set;
-- the COALESCE makes it correct even if that ordering ever changes.
DROP TRIGGER IF EXISTS trg_property_currency ON public.properties;
CREATE TRIGGER trg_property_currency
  BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_property_currency();
