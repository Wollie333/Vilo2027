-- Migration: Booking invoices carry the VAT breakdown.
--
-- The booking-confirm invoice trigger previously stored subtotal = total and
-- vat_amount = 0, so a tax invoice couldn't show its VAT portion. Now that
-- bookings store a VAT-inclusive total_amount + a vat_amount (apply_booking_vat),
-- mint the invoice with the proper split:
--   subtotal   = ex-VAT (total_amount − vat_amount)
--   vat_amount = the VAT portion
--   total      = VAT-inclusive total
-- so the on-screen invoice and the PDF both reconcile to a TAX INVOICE.
--
-- Full function reproduced from 20260606000012 with only the VALUES line changed.

CREATE OR REPLACE FUNCTION on_booking_confirmed_create_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_host       hosts%ROWTYPE;
  v_listing    listings%ROWTYPE;
  v_lines      jsonb;
  v_addons     jsonb;
  v_rooms      jsonb;
  v_number     text;
BEGIN
  IF NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    IF EXISTS (
      SELECT 1 FROM invoices WHERE booking_id = NEW.id AND kind = 'booking'
    ) THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_host    FROM hosts    WHERE id = NEW.host_id;
    SELECT * INTO v_listing FROM listings WHERE id = NEW.listing_id;

    -- Only the add-ons that came with the original booking belong on the main
    -- invoice; post-booking add-ons get their own supplementary invoices.
    SELECT jsonb_agg(jsonb_build_object(
             'label',      label,
             'quantity',   quantity,
             'unit_price', unit_price,
             'subtotal',   subtotal
           ) ORDER BY sort_order)
      INTO v_addons
      FROM booking_addons WHERE booking_id = NEW.id AND source = 'quote';

    SELECT jsonb_agg(jsonb_build_object(
             'room_id',       br.room_id,
             'room_name',     lr.name,
             'base_amount',   br.base_amount,
             'cleaning_fee',  br.cleaning_fee
           ))
      INTO v_rooms
      FROM booking_rooms br
      JOIN listing_rooms lr ON lr.id = br.room_id
      WHERE br.booking_id = NEW.id;

    v_lines := jsonb_build_object(
      'listing_name',  v_listing.name,
      'check_in',      NEW.check_in,
      'check_out',     NEW.check_out,
      'nights',        NEW.nights,
      'scope',         NEW.scope,
      'base_amount',   NEW.base_amount,
      'cleaning_fee',  NEW.cleaning_fee,
      'rooms',         COALESCE(v_rooms, '[]'::jsonb),
      'addons',        COALESCE(v_addons, '[]'::jsonb)
    );

    v_number := next_invoice_number(NEW.host_id);

    INSERT INTO invoices (
      invoice_number, booking_id, host_id, guest_id, kind,
      host_snapshot, guest_snapshot, line_items,
      subtotal, vat_amount, total_amount, currency,
      status, issued_at, paid_at
    ) VALUES (
      v_number, NEW.id, NEW.host_id, NEW.guest_id, 'booking',
      jsonb_build_object(
        'host_id',      v_host.id,
        'display_name', v_host.display_name,
        'handle',       v_host.handle,
        'email',        v_host.contact_email,
        'phone',        v_host.contact_phone
      ),
      jsonb_build_object(
        'guest_id', NEW.guest_id,
        'name',     COALESCE(NEW.guest_name,  (SELECT full_name FROM user_profiles WHERE id = NEW.guest_id)),
        'email',    COALESCE(NEW.guest_email, (SELECT email     FROM user_profiles WHERE id = NEW.guest_id)),
        'phone',    NEW.guest_phone
      ),
      v_lines,
      -- subtotal (ex-VAT), vat_amount, total (VAT-inclusive)
      round(NEW.total_amount - COALESCE(NEW.vat_amount, 0), 2),
      COALESCE(NEW.vat_amount, 0),
      NEW.total_amount,
      NEW.currency,
      CASE WHEN NEW.payment_status = 'completed' THEN 'paid' ELSE 'issued' END,
      now(),
      CASE WHEN NEW.payment_status = 'completed' THEN now() ELSE NULL END
    );
  END IF;
  RETURN NEW;
END;
$$;
