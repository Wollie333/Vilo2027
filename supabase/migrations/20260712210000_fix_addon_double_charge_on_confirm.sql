-- Fix: add-on added to a PENDING booking is charged twice once the booking is
-- confirmed.
--
-- Repro: a guest/host adds an add-on to a booking that is still pending /
-- pending_eft. The add-on path (addon-actions.ts / payment-actions.ts) does two
-- things: (1) bumps bookings.total_amount by the VAT-inclusive add-on charge, and
-- (2) mints a separate kind='addon' invoice for it. Later the booking is
-- confirmed and on_booking_confirmed_create_invoice → ensure_booking_invoice()
-- mints the kind='booking' invoice with total_amount := bookings.total_amount —
-- which ALREADY includes the add-on. Result: the add-on is invoiced twice
-- (its own add-on invoice + baked into the booking invoice), so
-- Σ(non-voided invoices) = total_amount + add-on, and the Finances ledger charges
-- the guest the add-on amount twice. Observed on BK-0024 (stay 12000 + add-on
-- 7000 → booking invoice 19000 + add-on invoice 7000 = 26000 for a 19000 stay).
--
-- Invariant this restores: Σ(non-voided invoices for a booking) == total_amount.
-- The booking invoice charges the STAY (+ any original quote add-ons already in
-- total_amount that have NO separate invoice); every post-booking add-on stays on
-- its own add-on invoice. We compute the booking invoice as
--   total_amount − Σ(non-voided kind='addon' invoices already issued)
-- which is correct in both orderings:
--   • add-on added BEFORE confirm → subtract its invoice → booking invoice = stay.
--   • add-on added AFTER confirm  → no add-on invoice exists yet at mint time →
--     subtract 0 → booking invoice = stay; the later add-on adds its own invoice.
-- Quote add-ons (source='quote') never get a separate invoice, so they are never
-- subtracted and correctly remain part of the booking invoice.
--
-- Only the three INSERT value expressions (subtotal / vat_amount / total_amount)
-- change; everything else is the current body verbatim.

CREATE OR REPLACE FUNCTION ensure_booking_invoice(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b                  bookings%ROWTYPE;
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
  -- Add-ons already invoiced separately (post-booking) — subtracted from the
  -- booking invoice so the stay charge is not double-counted.
  v_addon_inv_total  numeric;
  v_addon_inv_vat    numeric;
  v_booking_total    numeric;
  v_booking_vat      numeric;
  v_booking_subtotal numeric;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM invoices WHERE booking_id = b.id AND kind = 'booking'
  ) THEN
    RETURN;
  END IF;

  SELECT h.id, h.handle, h.display_name, up.email, up.phone
    INTO v_host_id, v_host_handle, v_host_display, v_host_email, v_host_phone
    FROM hosts h
    JOIN user_profiles up ON up.id = h.user_id
    WHERE h.id = b.host_id;

  -- The business that owns this booking's listing drives the document identity.
  SELECT name, business_id
    INTO v_listing_name, v_business_id
    FROM properties WHERE id = b.property_id;
  IF v_business_id IS NULL THEN
    v_business_id := booking_business_id(b.id);
  END IF;

  SELECT full_name, email, phone
    INTO v_guest_full_name, v_guest_email, v_guest_phone
    FROM user_profiles WHERE id = b.guest_id;

  -- The business's default (non-archived) banking account.
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
    WHERE business_id = v_business_id AND is_default = true AND is_archived = false
    LIMIT 1;

  -- Business identity → same snapshot keys the PDF templates already read.
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

  SELECT jsonb_agg(jsonb_build_object(
           'label',      label,
           'quantity',   quantity,
           'unit_price', unit_price,
           'subtotal',   subtotal
         ) ORDER BY sort_order)
    INTO v_addons
    FROM booking_addons WHERE booking_id = b.id AND source = 'quote';

  SELECT jsonb_agg(jsonb_build_object(
           'room_id',       br.room_id,
           'room_name',     lr.name,
           'base_amount',   br.base_amount,
           'cleaning_fee',  br.cleaning_fee
         ))
    INTO v_rooms
    FROM booking_rooms br
    JOIN property_rooms lr ON lr.id = br.room_id
    WHERE br.booking_id = b.id;

  v_lines := jsonb_build_object(
    'listing_name',  v_listing_name,
    'check_in',      b.check_in,
    'check_out',     b.check_out,
    'nights',        b.nights,
    'scope',         b.scope,
    'base_amount',   b.base_amount,
    'cleaning_fee',  b.cleaning_fee,
    'rooms',         COALESCE(v_rooms, '[]'::jsonb),
    'addons',        COALESCE(v_addons, '[]'::jsonb)
  );

  -- Subtract any add-on invoices already issued for this booking (post-booking
  -- add-ons that were folded into total_amount). Prevents the double charge.
  SELECT COALESCE(SUM(total_amount), 0), COALESCE(SUM(vat_amount), 0)
    INTO v_addon_inv_total, v_addon_inv_vat
    FROM invoices
    WHERE booking_id = b.id AND kind = 'addon' AND voided_at IS NULL;

  v_booking_total    := round(b.total_amount - v_addon_inv_total, 2);
  v_booking_vat      := round(COALESCE(b.vat_amount, 0) - v_addon_inv_vat, 2);
  v_booking_subtotal := round(v_booking_total - v_booking_vat, 2);

  v_number := next_invoice_number(v_business_id);

  INSERT INTO invoices (
    invoice_number, booking_id, host_id, guest_id, kind,
    host_snapshot, guest_snapshot, line_items,
    subtotal, vat_amount, total_amount, currency,
    status, issued_at, paid_at
  ) VALUES (
    v_number, b.id, b.host_id, b.guest_id, 'booking',
    jsonb_build_object(
      'host_id',      v_host_id,
      'display_name', v_host_display,
      'handle',       v_host_handle,
      'email',        v_host_email,
      'phone',        v_host_phone,
      'banking',      v_banking,
      'business',     v_business,
      'booking_ref',  b.reference
    ),
    jsonb_build_object(
      'guest_id', b.guest_id,
      'name',     COALESCE(b.guest_name,  v_guest_full_name),
      'email',    COALESCE(b.guest_email, v_guest_email),
      'phone',    COALESCE(b.guest_phone, v_guest_phone)
    ),
    v_lines,
    v_booking_subtotal,
    v_booking_vat,
    v_booking_total,
    b.currency,
    CASE WHEN b.payment_status = 'completed' THEN 'paid' ELSE 'issued' END,
    now(),
    CASE WHEN b.payment_status = 'completed' THEN now() ELSE NULL END
  );
END;
$$;
