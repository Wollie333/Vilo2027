-- Migration: fix the booking-confirm invoice trigger's host snapshot source.
--
-- Regression: 20260606000012 + 20260607000006 rewrote
-- on_booking_confirmed_create_invoice() to read host contact via
--   SELECT * INTO v_host FROM hosts ...  →  v_host.contact_email / contact_phone
-- but `hosts` has NO contact_email / contact_phone columns (host contact lives
-- on user_profiles via hosts.user_id; banking + business live in their own
-- settings tables). At runtime the trigger raised
--   42703  record "v_host" has no field "contact_email"
-- on every pending→confirmed flip. Because the success-page / webhook confirm
-- path runs the booking-status UPDATE as its own statement and does not check
-- its error, the throw silently rolled back ONLY the status flip — leaving the
-- payment row 'completed' and the ledger settled, but the booking stuck
-- 'pending' with no invoice, no calendar block, no counter bump. (The matching
-- app-side swallow is fixed separately in confirmHostCardPaymentByReference.)
--
-- This restores the canonical snapshot from 20260525000001 (host contact from
-- user_profiles; banking from eft_banking_details; business from
-- host_business_details; booking_ref for the EFT reference on the PDF) while
-- keeping the post-regression improvements:
--   * invoices.kind = 'booking' + idempotency scoped to the booking invoice
--   * only the original booking add-ons (source = 'quote') on the main invoice
--   * the VAT split (subtotal ex-VAT / vat_amount / VAT-inclusive total)
-- The host_snapshot shape now matches what invoice/[token]/pdf/route.ts and
-- lib/payments/invoicing.ts expect (email, phone, banking, business, booking_ref).

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
  v_banking          jsonb;
  v_business         jsonb;
  v_number           text;
BEGIN
  IF NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    -- Idempotent: skip if the booking invoice already exists.
    IF EXISTS (
      SELECT 1 FROM invoices WHERE booking_id = NEW.id AND kind = 'booking'
    ) THEN
      RETURN NEW;
    END IF;

    -- Host identity + contact. Contact lives on user_profiles (hosts has no
    -- contact_* columns) — this is exactly the bug this migration fixes.
    SELECT h.id, h.handle, h.display_name, up.email, up.phone
      INTO v_host_id, v_host_handle, v_host_display, v_host_email, v_host_phone
      FROM hosts h
      JOIN user_profiles up ON up.id = h.user_id
      WHERE h.id = NEW.host_id;

    SELECT name INTO v_listing_name FROM listings WHERE id = NEW.listing_id;

    SELECT full_name, email, phone
      INTO v_guest_full_name, v_guest_email, v_guest_phone
      FROM user_profiles WHERE id = NEW.guest_id;

    -- Host's default, non-archived banking account (settings). account_number is
    -- ciphertext copied verbatim; the PDF route decrypts on demand. NULL if the
    -- host has not set up banking — invoice still issues, block just hides.
    SELECT jsonb_build_object(
             'label',            label,
             'bank_name',        bank_name,
             'account_holder',   account_holder,
             'account_number',   account_number,
             'account_type',     account_type,
             'branch_code',      branch_code,
             'swift_code',       swift_code,
             'reference_format', reference_format
           )
      INTO v_banking
      FROM eft_banking_details
      WHERE host_id = NEW.host_id
        AND is_default = true
        AND is_archived = false
      LIMIT 1;

    -- Host business / tax details (settings).
    SELECT jsonb_build_object(
             'legal_name',                  legal_name,
             'trading_name',                trading_name,
             'vat_number',                  vat_number,
             'company_registration_number', company_registration_number,
             'billing_address_line1',       billing_address_line1,
             'billing_address_line2',       billing_address_line2,
             'billing_city',                billing_city,
             'billing_postcode',            billing_postcode,
             'billing_country',             billing_country
           )
      INTO v_business
      FROM host_business_details
      WHERE host_id = NEW.host_id;

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
      invoice_number, booking_id, host_id, guest_id, kind,
      host_snapshot, guest_snapshot, line_items,
      subtotal, vat_amount, total_amount, currency,
      status, issued_at, paid_at
    ) VALUES (
      v_number, NEW.id, NEW.host_id, NEW.guest_id, 'booking',
      jsonb_build_object(
        'host_id',      v_host_id,
        'display_name', v_host_display,
        'handle',       v_host_handle,
        'email',        v_host_email,
        'phone',        v_host_phone,
        'banking',      v_banking,
        'business',     v_business,
        'booking_ref',  NEW.reference
      ),
      jsonb_build_object(
        'guest_id', NEW.guest_id,
        'name',     COALESCE(NEW.guest_name,  v_guest_full_name),
        'email',    COALESCE(NEW.guest_email, v_guest_email),
        'phone',    COALESCE(NEW.guest_phone, v_guest_phone)
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
