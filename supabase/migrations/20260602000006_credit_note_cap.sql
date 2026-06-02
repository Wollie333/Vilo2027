-- Migration: cap auto credit notes at the invoice total.
--
-- on_refund_completed_create_credit_note() set the credit amount straight from
-- the refund's approved_amount with no ceiling. A refund approved for more than
-- the invoice (e.g. a data-entry slip, or stacked partial refunds) would mint a
-- credit note that EXCEEDS the invoice it credits — which breaks the enterprise
-- rule (and the Help article) that a credit note never exceeds its invoice.
--
-- Fix: clamp the credited amount to LEAST(refund, invoice.total_amount).
-- Idempotent redefinition of the function only; the trigger is unchanged.

CREATE OR REPLACE FUNCTION on_refund_completed_create_credit_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_amount  numeric;
  v_number  text;
  v_label   text;
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    -- Idempotent: one auto credit note per refund.
    IF EXISTS (SELECT 1 FROM credit_notes WHERE refund_request_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_invoice FROM invoices WHERE booking_id = NEW.booking_id;
    IF NOT FOUND THEN
      -- No invoice to credit against (e.g. unconfirmed booking) — skip silently.
      RETURN NEW;
    END IF;

    -- Never credit more than the invoice is worth.
    v_amount := LEAST(
      COALESCE(NEW.approved_amount, NEW.requested_amount, 0),
      v_invoice.total_amount
    );
    v_label  := 'Refund — ' || COALESCE(NEW.reason, 'booking refund');
    v_number := next_credit_note_number(NEW.host_id);

    INSERT INTO credit_notes (
      credit_note_number, invoice_id, booking_id, host_id, guest_id,
      refund_request_id, host_snapshot, guest_snapshot, line_items,
      reason, subtotal, vat_amount, total_amount, currency,
      origin, status, issued_at
    ) VALUES (
      v_number, v_invoice.id, NEW.booking_id, NEW.host_id, NEW.guest_id,
      NEW.id, v_invoice.host_snapshot, v_invoice.guest_snapshot,
      jsonb_build_array(jsonb_build_object('label', v_label, 'amount', v_amount)),
      NEW.reason, v_amount, 0, v_amount, COALESCE(NEW.currency, v_invoice.currency),
      'refund_auto', 'issued', now()
    );
  END IF;
  RETURN NEW;
END;
$$;
