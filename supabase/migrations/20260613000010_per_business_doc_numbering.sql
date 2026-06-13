-- Migration (Phase 3b): per-business document numbering.
--
-- Financial documents (quote / invoice / credit-note / refund / receipt) now
-- number per BUSINESS, not per host. A host that owns two businesses keeps two
-- independent sequences, each stamped with that business's {BIZ} code. This
-- mirrors the prior host-keyed scheme (20260602000010 / 20260607000001-2) but
-- keyed on `businesses` + a new `business_counters` table.
--
-- The next_*_number(uuid) generators keep their single-uuid signature but now
-- interpret the argument as a BUSINESS id (the parameter is renamed, so they are
-- DROP+CREATEd — CREATE OR REPLACE can't rename a parameter). EVERY caller is
-- updated in lockstep: the invoice / credit-note / refund / receipt trigger
-- functions below resolve the business via booking_business_id(); the two app
-- quote callers pass the listing's business id. Booking refs stay per-listing.
--
-- host_counters / host_doc_code / host_business_details are intentionally LEFT
-- in place here (now unused by numbering) — dropping them is a separate cleanup
-- once the remaining app readers are repointed.

-- ── 1. Counters ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_counters (
  business_id             uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  last_quote_number       integer NOT NULL DEFAULT 0,
  last_invoice_number     integer NOT NULL DEFAULT 0,
  last_credit_note_number integer NOT NULL DEFAULT 0,
  last_refund_number      integer NOT NULL DEFAULT 0,
  last_receipt_number     integer NOT NULL DEFAULT 0,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_counters ENABLE ROW LEVEL SECURITY;

-- Owner-only read; all writes are via the SECURITY DEFINER generators below.
DROP POLICY IF EXISTS business_counters_owner_read ON public.business_counters;
CREATE POLICY business_counters_owner_read ON public.business_counters
  FOR SELECT USING (
    business_id IN (
      SELECT b.id FROM businesses b
      JOIN hosts h ON h.id = b.host_id
      WHERE h.user_id = auth.uid()
    )
  );

-- Continue each host's existing sequence on their DEFAULT business rather than
-- resetting to zero (pre-MVP volumes are tiny, but keep numbering monotonic).
INSERT INTO public.business_counters (
  business_id, last_quote_number, last_invoice_number,
  last_credit_note_number, last_refund_number, last_receipt_number
)
SELECT b.id,
       COALESCE(hc.last_quote_number, 0),
       COALESCE(hc.last_invoice_number, 0),
       COALESCE(hc.last_credit_note_number, 0),
       COALESCE(hc.last_refund_number, 0),
       COALESCE(hc.last_receipt_number, 0)
FROM public.businesses b
JOIN public.host_counters hc ON hc.host_id = b.host_id
WHERE b.is_default = true
ON CONFLICT (business_id) DO NOTHING;

-- ── 2. Identifier helpers ─────────────────────────────────────────────────
-- {BIZ}-{BID5}: uppercased trading/legal name (cap 14) + 5 hex of the business
-- id, so two same-named businesses never collide on the global UNIQUE columns.
CREATE OR REPLACE FUNCTION business_doc_code(p_business_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
           NULLIF(left(regexp_replace(upper(
             COALESCE(trading_name, legal_name, 'BIZ')
           ), '[^A-Z0-9]', '', 'g'), 14), ''),
           'BIZ'
         ) || '-' || upper(left(replace(p_business_id::text, '-', ''), 5))
  FROM businesses WHERE id = p_business_id;
$$;

-- The business behind a booking: its listing's business, else the host's default
-- business. The document triggers call this to pass a business id.
CREATE OR REPLACE FUNCTION booking_business_id(p_booking_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT l.business_id
       FROM bookings bk JOIN listings l ON l.id = bk.listing_id
      WHERE bk.id = p_booking_id),
    (SELECT b.id
       FROM bookings bk JOIN businesses b
         ON b.host_id = bk.host_id AND b.is_default = true AND b.is_archived = false
      WHERE bk.id = p_booking_id
      LIMIT 1)
  );
$$;

-- ── 3. Per-business generators (renamed param → DROP+CREATE) ───────────────
DROP FUNCTION IF EXISTS next_quote_number(uuid);
CREATE FUNCTION next_quote_number(p_business_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  INSERT INTO business_counters (business_id, last_quote_number)
  VALUES (p_business_id, 1)
  ON CONFLICT (business_id) DO UPDATE
    SET last_quote_number = business_counters.last_quote_number + 1, updated_at = now()
  RETURNING last_quote_number INTO v_next;
  RETURN 'Q-' || business_doc_code(p_business_id) || '-' || lpad(v_next::text, 6, '0');
END;
$$;

DROP FUNCTION IF EXISTS next_invoice_number(uuid);
CREATE FUNCTION next_invoice_number(p_business_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  INSERT INTO business_counters (business_id, last_invoice_number)
  VALUES (p_business_id, 1)
  ON CONFLICT (business_id) DO UPDATE
    SET last_invoice_number = business_counters.last_invoice_number + 1, updated_at = now()
  RETURNING last_invoice_number INTO v_next;
  RETURN 'INV-' || business_doc_code(p_business_id) || '-' || lpad(v_next::text, 5, '0');
END;
$$;

DROP FUNCTION IF EXISTS next_credit_note_number(uuid);
CREATE FUNCTION next_credit_note_number(p_business_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  INSERT INTO business_counters (business_id, last_credit_note_number)
  VALUES (p_business_id, 1)
  ON CONFLICT (business_id) DO UPDATE
    SET last_credit_note_number = business_counters.last_credit_note_number + 1, updated_at = now()
  RETURNING last_credit_note_number INTO v_next;
  RETURN 'CR-' || business_doc_code(p_business_id) || '-' || lpad(v_next::text, 5, '0');
END;
$$;

DROP FUNCTION IF EXISTS next_refund_number(uuid);
CREATE FUNCTION next_refund_number(p_business_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  INSERT INTO business_counters (business_id, last_refund_number)
  VALUES (p_business_id, 1)
  ON CONFLICT (business_id) DO UPDATE
    SET last_refund_number = business_counters.last_refund_number + 1, updated_at = now()
  RETURNING last_refund_number INTO v_next;
  RETURN business_doc_code(p_business_id) || '-REF' || to_char(now(), 'YYYY') || '-' ||
         lpad(v_next::text, 4, '0');
END;
$$;

DROP FUNCTION IF EXISTS next_receipt_number(uuid);
CREATE FUNCTION next_receipt_number(p_business_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  INSERT INTO business_counters (business_id, last_receipt_number)
  VALUES (p_business_id, 1)
  ON CONFLICT (business_id) DO UPDATE
    SET last_receipt_number = business_counters.last_receipt_number + 1, updated_at = now()
  RETURNING last_receipt_number INTO v_next;
  RETURN business_doc_code(p_business_id) || '-RCT' || to_char(now(), 'YYYY') || '-' ||
         lpad(v_next::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_quote_number(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION next_invoice_number(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION next_credit_note_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION next_refund_number(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION next_receipt_number(uuid)     TO authenticated;

-- ── 4. Repoint every document trigger to pass the business id ──────────────

-- Booking invoice (was 20260612000004) — number via the listing's business.
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
    FROM listings WHERE id = b.listing_id;
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

-- Auto credit note on completed refund (was 20260602000006) — business-numbered.
CREATE OR REPLACE FUNCTION on_refund_completed_create_credit_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_amount  numeric;
  v_number  text;
  v_label   text;
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    IF EXISTS (SELECT 1 FROM credit_notes WHERE refund_request_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_invoice FROM invoices WHERE booking_id = NEW.booking_id;
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    v_amount := LEAST(
      COALESCE(NEW.approved_amount, NEW.requested_amount, 0),
      v_invoice.total_amount
    );
    v_label  := 'Refund — ' || COALESCE(NEW.reason, 'booking refund');
    v_number := next_credit_note_number(booking_business_id(NEW.booking_id));

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

-- Refund reference (was 20260602000010) — business-numbered.
CREATE OR REPLACE FUNCTION gen_refund_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := next_refund_number(booking_business_id(NEW.booking_id));
  END IF;
  RETURN NEW;
END;
$$;

-- Refund document number (was 20260607000002) — business-numbered.
CREATE OR REPLACE FUNCTION assign_refund_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.refund_number IS NULL AND NEW.booking_id IS NOT NULL THEN
    NEW.refund_number := next_refund_number(booking_business_id(NEW.booking_id));
  END IF;
  RETURN NEW;
END;
$$;

-- Payment receipt number (was 20260607000001) — business-numbered.
CREATE OR REPLACE FUNCTION assign_receipt_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.receipt_number IS NULL
     AND NEW.booking_id IS NOT NULL THEN
    NEW.receipt_number := next_receipt_number(booking_business_id(NEW.booking_id));
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON TABLE public.business_counters IS
  'Per-business monotonic document counters (quote/invoice/credit-note/refund/receipt). Bumped under row lock by the next_*_number(business_id) generators.';
