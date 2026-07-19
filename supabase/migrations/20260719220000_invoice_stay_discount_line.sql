-- Itemize the NON-coupon discount on the booking invoice too.
--
-- line_items.discount_amount only ever carried the COUPON discount
-- (bookings.coupon_discount). But a booking can also carry bookings.discount_amount:
--   • regular bookings — the stay/length-of-stay discount (whole-property / weekly /
--     monthly %), which is NOT baked into base_amount (base_amount is pre-discount);
--   • quote-converted bookings — the host's manual quote discount.
-- Neither was ever surfaced, so the invoice showed a pre-discount line item, a
-- post-discount total, and no discount line between them → it did not foot and the
-- reduction was invisible. Add a separate `stay_discount` key so the renderers can
-- itemize it alongside (and independently of) the coupon discount. Idempotent /
-- additive — the coupon fields (discount_amount + coupon_code) are unchanged, so
-- coupon-only invoices render exactly as before.

CREATE OR REPLACE FUNCTION public.ensure_booking_invoice(p_booking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  SELECT name, business_id
    INTO v_listing_name, v_business_id
    FROM properties WHERE id = b.property_id;
  IF v_business_id IS NULL THEN
    v_business_id := booking_business_id(b.id);
  END IF;

  SELECT full_name, email, phone
    INTO v_guest_full_name, v_guest_email, v_guest_phone
    FROM user_profiles WHERE id = b.guest_id;

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
    'addons',        COALESCE(v_addons, '[]'::jsonb),
    -- Coupon discount (unchanged) + the NON-coupon (stay / manual-quote) discount.
    'discount_amount', COALESCE(b.coupon_discount, 0),
    'coupon_code',   (SELECT code FROM coupons WHERE id = b.coupon_id),
    'stay_discount', COALESCE(b.discount_amount, 0)
  );

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
$function$;
