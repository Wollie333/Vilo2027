-- Model 2 — add-ons inherit the host's settlement currency.
--
-- Add-ons are host-scoped and their currency flows into booking line items
-- (createBooking stamps addon.currency onto the booking add-on rows). They were
-- hard-coded to ZAR at every insert site, so a EUR host's add-ons would appear as
-- ZAR inside a EUR booking. A host prices all add-ons in their own currency, so
-- always inherit the host's DEFAULT business currency on INSERT — the single fix
-- for every insert path (editor, quick-create, templates).

CREATE OR REPLACE FUNCTION public.set_addon_currency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ccy text;
BEGIN
  SELECT b.default_currency INTO v_ccy
  FROM public.businesses b
  WHERE b.host_id = NEW.host_id AND b.is_default = true AND b.is_archived = false
  LIMIT 1;
  IF v_ccy IS NOT NULL THEN
    NEW.currency := v_ccy;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_addon_currency ON public.addons;
CREATE TRIGGER trg_addon_currency
  BEFORE INSERT ON public.addons
  FOR EACH ROW EXECUTE FUNCTION public.set_addon_currency();
