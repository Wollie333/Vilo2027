-- Migration: fix on_booking_confirmed_create_invoice() — read from `businesses`.
--
-- LAUNCH-BLOCKER: confirming ANY booking threw
--   relation "host_business_details" does not exist
-- The trigger function on_booking_confirmed_create_invoice() (last redefined in
-- 20260617000300_rename_r3_columns.sql) still snapshotted the host's business /
-- tax details FROM host_business_details — a table dropped/renamed to
-- `businesses` during the multi-business work (20260612000001). It also still
-- resolved banking and numbering by host_id, but:
--   * `next_invoice_number(uuid)` now interprets its argument as a BUSINESS id
--     (20260613000010) and the counter row FKs to businesses(id) — passing
--     host_id would FK-violate, and
--   * banking + business identity must come from the BUSINESS that owns the
--     booking's property (multi-business hosts), not the host.
--
-- The sibling helper ensure_booking_invoice() was already fixed for all of this
-- (20260612000004 → 20260613000010 → 20260617000300). This brings the
-- confirm-time trigger in line with it: resolve the business via the property's
-- business_id (fallback booking_business_id), snapshot that business + its
-- default banking, and number per-business — while keeping the SAME
-- host_snapshot.business jsonb keys (billing_address_line1, billing_city,
-- billing_postcode, billing_country, …) so the invoice PDF route / consumers
-- need no changes.

CREATE OR REPLACE FUNCTION on_booking_confirmed_create_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_business_id      uuid;
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
    -- contact_* columns).
    SELECT h.id, h.handle, h.display_name, up.email, up.phone
      INTO v_host_id, v_host_handle, v_host_display, v_host_email, v_host_phone
      FROM hosts h
      JOIN user_profiles up ON up.id = h.user_id
      WHERE h.id = NEW.host_id;

    -- The business that owns this booking's property drives the document
    -- identity (banking, business/tax block, document numbering).
    SELECT name, business_id
      INTO v_listing_name, v_business_id
      FROM properties WHERE id = NEW.property_id;
    IF v_business_id IS NULL THEN
      v_business_id := booking_business_id(NEW.id);
    END IF;

    SELECT full_name, email, phone
      INTO v_guest_full_name, v_guest_email, v_guest_phone
      FROM user_profiles WHERE id = NEW.guest_id;

    -- The business's default, non-archived banking account. account_number is
    -- ciphertext copied verbatim; the PDF route decrypts on demand. NULL if the
    -- business has not set up banking — invoice still issues, block just hides.
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
      WHERE business_id = v_business_id
        AND is_default = true
        AND is_archived = false
      LIMIT 1;

    -- Business identity / tax details → same snapshot keys the PDF templates
    -- already read (businesses.address_line1 → billing_address_line1, etc.).
    SELECT jsonb_build_object(
             'legal_name',                  legal_name,
             'trading_name',                trading_name,
             'vat_number',                  vat_number,
             'company_registration_number', company_registration_number,
             'billing_address_line1',       address_line1,
             'billing_address_line2',       address_line2,
             'billing_city',                city,
             'billing_postcode',            postal_code,
             'billing_country',             country
           )
      INTO v_business
      FROM businesses
      WHERE id = v_business_id;

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
      JOIN property_rooms lr ON lr.id = br.room_id
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

    v_number := next_invoice_number(v_business_id);

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
