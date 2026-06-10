-- Migration: reconcile historical booking + ledger data for every guest.
--
-- Two correctness holes surfaced on the Guests directory / record:
--
--  1) MISSING CHARGE INVOICE. The booking invoice is created by
--     on_booking_confirmed_create_invoice, a trigger that fired only
--     AFTER UPDATE OF status (pending → confirmed). But the manual-booking
--     action (apps/web/app/dashboard/bookings/new/actions.ts) INSERTs a
--     booking already at status='confirmed' for the paid/unpaid cases — a
--     direct insert never fires an UPDATE trigger, so those bookings got no
--     invoice. The per-guest Finances ledger derives the "charge" from the
--     invoice, so such a booking shows its payments with no offsetting charge
--     → the guest looks overpaid (phantom store credit).
--
--  2) STALE balance_due. bookings.balance_due defaults to 0 and is only
--     re-derived when a payment runs through recomputeBookingPaymentState
--     (lib/payments/ledger.ts). A confirmed-but-unpaid or pending booking
--     therefore kept balance_due = 0, understating what the guest owes on the
--     balance banner and the "… due" badge.
--
-- Fix (pre-MVP, direct reshape allowed):
--   * Extract the invoice insert into ensure_booking_invoice(uuid) — idempotent,
--     reusable — and have the trigger fire on INSERT OR UPDATE OF status so a
--     direct-confirmed insert is covered too. Root-cause closed.
--   * Backfill: create the missing booking invoice for every realised
--     (confirmed/checked_in/completed) booking that lacks one.
--   * Heal balance_due from the payment ledger (SSOT): active bookings →
--     GREATEST(0, total − completed inbound paid); cancelled/declined → 0
--     (a dead booking owes nothing — mirrors the guest-record outstanding rule).
--
-- Logic mirrors the canonical host-snapshot invoice from
-- 20260608000008 verbatim — only the NEW.* refs become a fetched row.

-- ── 1. Reusable, idempotent invoice creator ──────────────────────────────
CREATE OR REPLACE FUNCTION ensure_booking_invoice(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b                  bookings%ROWTYPE;
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
  SELECT * INTO b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Idempotent: skip if the booking invoice already exists.
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

  SELECT name INTO v_listing_name FROM listings WHERE id = b.listing_id;

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
    WHERE host_id = b.host_id AND is_default = true AND is_archived = false
    LIMIT 1;

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
    WHERE host_id = b.host_id;

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
    JOIN listing_rooms lr ON lr.id = br.room_id
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

  v_number := next_invoice_number(b.host_id);

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
    round(b.total_amount - COALESCE(b.vat_amount, 0), 2),
    COALESCE(b.vat_amount, 0),
    b.total_amount,
    b.currency,
    CASE WHEN b.payment_status = 'completed' THEN 'paid' ELSE 'issued' END,
    now(),
    CASE WHEN b.payment_status = 'completed' THEN now() ELSE NULL END
  );
END;
$$;

-- ── 2. Trigger now fires on INSERT too (direct-confirmed manual bookings) ──
CREATE OR REPLACE FUNCTION on_booking_confirmed_create_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Fire when the booking lands 'confirmed' — whether via a direct INSERT
  -- (manual booking action) or a pending → confirmed UPDATE (guest/host flip).
  IF NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status, '') <> 'confirmed') THEN
    PERFORM ensure_booking_invoice(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_booking_confirmed_invoice ON bookings;
CREATE TRIGGER trigger_booking_confirmed_invoice
  AFTER INSERT OR UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION on_booking_confirmed_create_invoice();

-- ── 3. Backfill missing charge invoices for realised bookings ─────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT b.id
    FROM bookings b
    WHERE b.deleted_at IS NULL
      AND b.status IN ('confirmed','checked_in','completed')
      AND NOT EXISTS (
        SELECT 1 FROM invoices i WHERE i.booking_id = b.id AND i.kind = 'booking'
      )
  LOOP
    PERFORM ensure_booking_invoice(r.id);
  END LOOP;
END $$;

-- ── 4. Heal balance_due from the payment ledger (SSOT) ────────────────────
-- Dead bookings owe nothing.
UPDATE bookings
   SET balance_due = 0
 WHERE deleted_at IS NULL
   AND (status LIKE 'cancelled%' OR status IN ('declined','expired','no_show'))
   AND balance_due <> 0;

-- Active bookings: GREATEST(0, total − completed inbound paid).
WITH paid AS (
  SELECT booking_id, COALESCE(sum(amount), 0) AS p
  FROM payments
  WHERE status = 'completed'
    AND voided_at IS NULL
    AND kind IN ('deposit','balance','addon','payment','credit')
  GROUP BY booking_id
)
UPDATE bookings b
   SET balance_due = GREATEST(0, round(b.total_amount - COALESCE(pd.p, 0), 2))
  FROM (SELECT id FROM bookings) ids
  LEFT JOIN paid pd ON pd.booking_id = ids.id
 WHERE b.id = ids.id
   AND b.deleted_at IS NULL
   AND NOT (b.status LIKE 'cancelled%' OR b.status IN ('declined','expired','no_show'))
   AND b.balance_due <> GREATEST(0, round(b.total_amount - COALESCE(pd.p, 0), 2));

COMMENT ON FUNCTION ensure_booking_invoice(uuid) IS
  'Idempotently create the kind=booking invoice for a booking (SSOT for the charge the ledger renders). Called by the confirm trigger (INSERT or UPDATE→confirmed) and by reconciliation backfills.';
