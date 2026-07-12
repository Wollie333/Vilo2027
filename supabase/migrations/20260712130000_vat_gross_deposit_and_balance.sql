-- Migration: make VAT "added at the end" reach EVERY money column on a booking.
--
-- apply_booking_vat only grossed up total_amount, leaving deposit_amount and
-- balance_due at their ex-VAT values. Because those two columns are set by the
-- caller at INSERT from the pre-VAT breakdown (manual booking, quote convert,
-- guest checkout), a VAT-registered booking ended up with deposit_amount /
-- balance_due that excluded VAT until a later recompute or the pay flow healed
-- them — the host board and pay-link showed the guest an ex-VAT "balance due",
-- and a deposit installment that was 15% light. Gross them up in the same
-- trigger so every creation path is correct on insert. Zero stays zero (a
-- fully-paid or reserve booking), and the idempotency guard still short-circuits
-- any caller that set VAT explicitly.
--
-- (NB: there is deliberately NO refund→credit-note VAT change here. Migration
-- 20260607000004 removed auto credit notes on refund — a refund and a credit
-- note are separate accounting events — so no refund-auto credit note exists to
-- correct.)

-- ─── Gross up deposit_amount + balance_due alongside total_amount ───────
CREATE OR REPLACE FUNCTION public.apply_booking_vat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate   numeric;
  v_factor numeric;
BEGIN
  -- Idempotent: if VAT was already computed upstream (a caller set it
  -- explicitly), leave it alone — never double-apply.
  IF COALESCE(NEW.vat_rate, 0) > 0 OR COALESCE(NEW.vat_amount, 0) > 0 THEN
    RETURN NEW;
  END IF;

  v_rate := public.effective_vat_rate(NEW.property_id);

  IF v_rate > 0 AND COALESCE(NEW.total_amount, 0) > 0 THEN
    -- The incoming amounts are the ex-VAT subtotal + its ex-VAT deposit/balance
    -- split; gross them all up by the same rate so total = deposit-owed logic
    -- and the guest-facing balance reconcile to the VAT-inclusive total.
    v_factor := (100.0 + v_rate) / 100.0;
    NEW.vat_rate       := v_rate;
    NEW.vat_amount     := round(NEW.total_amount * v_rate / 100.0, 2);
    NEW.total_amount   := round(NEW.total_amount + NEW.vat_amount, 2);
    NEW.deposit_amount := round(COALESCE(NEW.deposit_amount, 0) * v_factor, 2);
    NEW.balance_due    := round(COALESCE(NEW.balance_due, 0) * v_factor, 2);
  END IF;

  RETURN NEW;
END;
$$;
