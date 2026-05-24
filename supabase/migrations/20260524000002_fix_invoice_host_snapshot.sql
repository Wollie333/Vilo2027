-- Migration: Fix on_booking_confirmed_create_invoice host snapshot
--
-- The previous migration's trigger referenced hosts.contact_email and
-- hosts.contact_phone, which don't exist — host contact details live
-- on user_profiles (via hosts.user_id). Redefine the function with the
-- correct joins.

CREATE OR REPLACE FUNCTION on_booking_confirmed_create_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_host_id          uuid;
  v_host_handle      text;
  v_host_display     text;
  v_host_email       text;
  v_host_phone       text;
  v_listing_name     text;
  v_guest_full_name  text;
  v_guest_email      text;
  v_guest_phone      text;
  v_lines            jsonb;
  v_addons           jsonb;
  v_rooms            jsonb;
  v_number           text;
BEGIN
  IF NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    -- Idempotent: skip if an invoice already exists.
    IF EXISTS (SELECT 1 FROM invoices WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT h.id, h.handle, h.display_name, up.email, up.phone
      INTO v_host_id, v_host_handle, v_host_display, v_host_email, v_host_phone
      FROM hosts h
      JOIN user_profiles up ON up.id = h.user_id
      WHERE h.id = NEW.host_id;

    SELECT name INTO v_listing_name FROM listings WHERE id = NEW.listing_id;

    -- Guest details: prefer the booking's own walk-in fields, fall back to
    -- user_profiles when the booking has a real guest_id.
    SELECT full_name, email, phone
      INTO v_guest_full_name, v_guest_email, v_guest_phone
      FROM user_profiles WHERE id = NEW.guest_id;

    SELECT jsonb_agg(jsonb_build_object(
             'label',      label,
             'quantity',   quantity,
             'unit_price', unit_price,
             'subtotal',   subtotal
           ) ORDER BY sort_order)
      INTO v_addons
      FROM booking_addons WHERE booking_id = NEW.id;

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
      'listing_name',  v_listing_name,
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
      invoice_number, booking_id, host_id, guest_id,
      host_snapshot, guest_snapshot, line_items,
      subtotal, vat_amount, total_amount, currency,
      status, issued_at, paid_at
    ) VALUES (
      v_number, NEW.id, NEW.host_id, NEW.guest_id,
      jsonb_build_object(
        'host_id',        v_host_id,
        'display_name',   v_host_display,
        'handle',         v_host_handle,
        'email',          v_host_email,
        'phone',          v_host_phone
      ),
      jsonb_build_object(
        'guest_id', NEW.guest_id,
        'name',     COALESCE(NEW.guest_name,  v_guest_full_name),
        'email',    COALESCE(NEW.guest_email, v_guest_email),
        'phone',    COALESCE(NEW.guest_phone, v_guest_phone)
      ),
      v_lines,
      NEW.total_amount, 0, NEW.total_amount, NEW.currency,
      CASE WHEN NEW.payment_status = 'completed' THEN 'paid' ELSE 'issued' END,
      now(),
      CASE WHEN NEW.payment_status = 'completed' THEN now() ELSE NULL END
    );
  END IF;
  RETURN NEW;
END;
$$;
