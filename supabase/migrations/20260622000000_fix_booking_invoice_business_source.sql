-- Fix: confirming a booking throws `relation "host_business_details" does not exist`.
--
-- History: the per-business migration (20260613000010) moved invoice generation
-- onto `businesses`, and 20260613000011 DROPPED the legacy host_business_details
-- table. The later listings→properties rename migrations (20260617000200 /
-- 000300) then recreated on_booking_confirmed_create_invoice() from a STALE,
-- pre-000613 body that still reads host_business_details (and keys banking +
-- numbering by host, not business) — so the AFTER INSERT/UPDATE trigger throws
-- whenever a booking becomes `confirmed`. Booking confirmation is broken
-- everywhere (host accept, on-site checkout, manual EFT).
--
-- ensure_booking_invoice(p_booking_id) already carries the CORRECT business-based
-- logic: it resolves the booking's business, reads `businesses` (mapping
-- address_line1/city/postal_code/country → the same billing_* snapshot keys the
-- PDF templates read), keys banking by business, and numbers per business. Make
-- the trigger function delegate to it so there is a single, correct code path and
-- no chance of the two bodies diverging again. Same firing condition + same
-- host_snapshot.business jsonb keys → no consumer change.

CREATE OR REPLACE FUNCTION on_booking_confirmed_create_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    PERFORM ensure_booking_invoice(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
