-- Model 2 — seasonal pricing rules inherit their property's settlement currency.
--
-- property_seasonal_pricing.currency was written from the CLIENT (createSeasonal
-- RuleAction / update / copy all pass a value the browser hard-codes to ZAR), so
-- a EUR/GBP host's season rules were stamped ZAR. The rule's NUMBER already
-- applies in the listing currency at booking time, but the stored/displayed
-- currency label was wrong. Make the DB authoritative: always inherit the
-- property's currency on insert/update — the single fix for every write path.

CREATE OR REPLACE FUNCTION public.set_seasonal_currency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ccy text;
BEGIN
  SELECT p.currency INTO v_ccy
  FROM public.properties p
  WHERE p.id = NEW.property_id;
  IF v_ccy IS NOT NULL THEN
    NEW.currency := v_ccy;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seasonal_currency ON public.property_seasonal_pricing;
CREATE TRIGGER trg_seasonal_currency
  BEFORE INSERT OR UPDATE ON public.property_seasonal_pricing
  FOR EACH ROW EXECUTE FUNCTION public.set_seasonal_currency();
