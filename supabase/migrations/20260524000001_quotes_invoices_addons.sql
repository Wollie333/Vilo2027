-- Migration: Quotes + Invoices + Manual booking + Add-ons
--
-- Adds:
--   * `quotes`, `quote_rooms`, `quote_addons` — host sends a quote to a
--     prospect; the dates soft-hold the calendar via blocked_dates with
--     reason='quote_pending'; on accept+pay the quote converts to a
--     confirmed booking.
--   * `booking_addons` — free-form line items on a booking (extras like
--     breakfast, transfers, etc.). Populated from quote_addons on
--     conversion, or directly when a host creates a manual booking.
--   * `invoices` — 1-to-1 with `bookings`; auto-created the moment a
--     booking transitions to `confirmed`. INSERT once, then only `status`
--     / `paid_at` / `pdf_storage_path` change. Per-host invoice numbers.
--   * `host_counters` — per-host monotonic counters for quote_number /
--     invoice_number. Increment via SECURITY DEFINER function under row
--     lock.
--   * `bookings.origin` (`guest_request` / `host_manual` / `quote_converted`),
--     nullable `bookings.guest_id` + `guest_name / guest_email / guest_phone`
--     so walk-in / phone-in guests don't need a user account, and
--     `bookings.host_payment_note` for host-marked-as-paid manual
--     bookings (cash / EFT / etc).
--   * `blocked_dates.quote_id` to track which quote owns the soft hold.
--
-- Per CLAUDE.md pre-MVP data policy this migration reshapes existing
-- columns (drops the NOT NULL on bookings.guest_id) without a back-compat
-- shim.

-- ─── 1. bookings — origin, manual-booking + walk-in fields ─────
ALTER TABLE public.bookings
  ADD COLUMN origin text NOT NULL DEFAULT 'guest_request'
    CHECK (origin IN ('guest_request', 'host_manual', 'quote_converted')),
  ADD COLUMN host_payment_note text,
  ADD COLUMN guest_name  text,
  ADD COLUMN guest_email text,
  ADD COLUMN guest_phone text;

ALTER TABLE public.bookings ALTER COLUMN guest_id DROP NOT NULL;

-- Either a registered guest (guest_id) OR a captured walk-in identity
-- (guest_name + guest_email) must be present. Host-side validation
-- mirrors this at the action layer.
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_guest_identity_chk
  CHECK (
    guest_id IS NOT NULL
    OR (guest_name IS NOT NULL AND guest_email IS NOT NULL)
  );

CREATE INDEX idx_bookings_origin ON bookings(origin);

COMMENT ON COLUMN bookings.origin IS
  'guest_request = the guest initiated the booking; host_manual = host created (walk-in / phone); quote_converted = converted from an accepted quote.';
COMMENT ON COLUMN bookings.host_payment_note IS
  'Free-form note when host marks a manual booking as paid out-of-band (cash / EFT receipt / etc).';
COMMENT ON COLUMN bookings.guest_name IS
  'Walk-in guest name when there is no guest_id (host-created manual booking).';

-- ─── 2. host_counters (per-host quote/invoice sequences) ───────
CREATE TABLE public.host_counters (
  host_id              uuid PRIMARY KEY REFERENCES hosts(id) ON DELETE CASCADE,
  last_quote_number    integer NOT NULL DEFAULT 0,
  last_invoice_number  integer NOT NULL DEFAULT 0,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE host_counters ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE host_counters IS
  'Per-host monotonic counters. next_quote_number(host) / next_invoice_number(host) bump these under row lock.';

-- ─── 3. Numbering functions ────────────────────────────────────
CREATE OR REPLACE FUNCTION next_quote_number(p_host_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_handle text;
  v_next   integer;
BEGIN
  INSERT INTO host_counters (host_id, last_quote_number)
  VALUES (p_host_id, 1)
  ON CONFLICT (host_id) DO UPDATE
    SET last_quote_number = host_counters.last_quote_number + 1,
        updated_at = now()
  RETURNING last_quote_number INTO v_next;

  SELECT handle INTO v_handle FROM hosts WHERE id = p_host_id;
  v_handle := COALESCE(v_handle, 'HOST');

  RETURN upper(v_handle) || '-Q' || to_char(now(), 'YYYY') || '-' ||
         lpad(v_next::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_invoice_number(p_host_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_handle text;
  v_next   integer;
BEGIN
  INSERT INTO host_counters (host_id, last_invoice_number)
  VALUES (p_host_id, 1)
  ON CONFLICT (host_id) DO UPDATE
    SET last_invoice_number = host_counters.last_invoice_number + 1,
        updated_at = now()
  RETURNING last_invoice_number INTO v_next;

  SELECT handle INTO v_handle FROM hosts WHERE id = p_host_id;
  v_handle := COALESCE(v_handle, 'HOST');

  RETURN upper(v_handle) || '-INV' || to_char(now(), 'YYYY') || '-' ||
         lpad(v_next::text, 4, '0');
END;
$$;

-- ─── 4. Token helper (HMAC-derived 22-char base64url) ──────────
CREATE OR REPLACE FUNCTION gen_url_token()
RETURNS text LANGUAGE sql AS $$
  SELECT translate(
    substring(encode(extensions.gen_random_bytes(18), 'base64') from 1 for 22),
    '+/=', '-__'
  );
$$;

-- ─── 5. quotes ─────────────────────────────────────────────────
CREATE TABLE public.quotes (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id               uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  listing_id            uuid    NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,

  quote_number          text    UNIQUE NOT NULL,

  guest_name            text    NOT NULL,
  guest_email           text    NOT NULL,
  guest_phone           text,
  guest_id              uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,

  check_in              date    NOT NULL,
  check_out             date    NOT NULL,
  headcount             integer NOT NULL DEFAULT 1,

  scope                 text    NOT NULL DEFAULT 'whole_listing'
                                CHECK (scope IN ('whole_listing', 'rooms')),

  base_amount           numeric NOT NULL,
  cleaning_fee          numeric NOT NULL DEFAULT 0,
  addons_total          numeric NOT NULL DEFAULT 0,
  total_amount          numeric NOT NULL,
  currency              text    NOT NULL DEFAULT 'ZAR',

  notes                 text,
  policy_snapshot       jsonb,

  status                text    NOT NULL DEFAULT 'draft'
                                CHECK (status IN (
                                  'draft','sent','accepted',
                                  'declined','expired','converted'
                                )),
  previous_status       text,

  accept_token          text    UNIQUE NOT NULL DEFAULT gen_url_token(),
  valid_until           timestamptz,

  sent_at               timestamptz,
  accepted_at           timestamptz,
  declined_at           timestamptz,
  converted_at          timestamptz,
  converted_booking_id  uuid REFERENCES bookings(id) ON DELETE SET NULL,

  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quote_dates_chk CHECK (check_out > check_in)
);

CREATE INDEX idx_quotes_host_id      ON quotes(host_id);
CREATE INDEX idx_quotes_listing_id   ON quotes(listing_id);
CREATE INDEX idx_quotes_status       ON quotes(status);
CREATE INDEX idx_quotes_check_in     ON quotes(check_in);
CREATE INDEX idx_quotes_accept_token ON quotes(accept_token);
CREATE INDEX idx_quotes_guest_email  ON quotes(guest_email);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN quotes.scope IS
  'whole_listing = quote is for the whole place; rooms = quote_rooms holds the per-room breakdown.';
COMMENT ON COLUMN quotes.accept_token IS
  'Random 22-char base64url token used by the guest-facing accept URL. Anyone with the token can read/accept this quote.';

-- ─── 6. bookings.quote_id (FK now that quotes exists) ──────────
ALTER TABLE public.bookings
  ADD COLUMN quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_quote_id ON bookings(quote_id);

-- ─── 7. quote_rooms (mirror of booking_rooms for per-room quotes)
CREATE TABLE public.quote_rooms (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      uuid    NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  room_id       uuid    NOT NULL REFERENCES listing_rooms(id) ON DELETE RESTRICT,

  base_amount   numeric NOT NULL,
  cleaning_fee  numeric NOT NULL DEFAULT 0,

  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_quote_room UNIQUE (quote_id, room_id)
);

CREATE INDEX idx_quote_rooms_quote ON quote_rooms(quote_id);
CREATE INDEX idx_quote_rooms_room  ON quote_rooms(room_id);

ALTER TABLE quote_rooms ENABLE ROW LEVEL SECURITY;

-- ─── 8. quote_addons (free-form line items per quote) ──────────
CREATE TABLE public.quote_addons (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid    NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  label       text    NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL,
  subtotal    numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quote_addon_label_length CHECK (char_length(label) BETWEEN 1 AND 200)
);

CREATE INDEX idx_quote_addons_quote ON quote_addons(quote_id, sort_order);

ALTER TABLE quote_addons ENABLE ROW LEVEL SECURITY;

-- ─── 9. booking_addons (cloned from quote_addons on conversion) ─
CREATE TABLE public.booking_addons (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid    NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  label       text    NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL,
  subtotal    numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT booking_addon_label_length CHECK (char_length(label) BETWEEN 1 AND 200)
);

CREATE INDEX idx_booking_addons_booking ON booking_addons(booking_id, sort_order);

ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;

-- ─── 10. invoices (1-to-1 with bookings) ───────────────────────
CREATE TABLE public.invoices (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    text    UNIQUE NOT NULL,

  booking_id        uuid    UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  host_id           uuid    NOT NULL REFERENCES hosts(id) ON DELETE RESTRICT,
  guest_id          uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Snapshots are frozen at issue time so the invoice never silently
  -- changes when the host edits their business name or the guest
  -- updates their profile.
  host_snapshot     jsonb   NOT NULL,
  guest_snapshot    jsonb   NOT NULL,
  line_items        jsonb   NOT NULL,

  subtotal          numeric NOT NULL,
  vat_amount        numeric NOT NULL DEFAULT 0,
  total_amount      numeric NOT NULL,
  currency          text    NOT NULL DEFAULT 'ZAR',

  status            text    NOT NULL DEFAULT 'issued'
                            CHECK (status IN ('draft','issued','paid','cancelled')),
  issued_at         timestamptz NOT NULL DEFAULT now(),
  paid_at           timestamptz,
  cancelled_at      timestamptz,

  pdf_storage_path  text,
  hosted_token      text    UNIQUE NOT NULL DEFAULT gen_url_token(),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_host_id        ON invoices(host_id);
CREATE INDEX idx_invoices_guest_id       ON invoices(guest_id);
CREATE INDEX idx_invoices_status         ON invoices(status);
CREATE INDEX idx_invoices_issued_at      ON invoices(issued_at DESC);
CREATE INDEX idx_invoices_hosted_token   ON invoices(hosted_token);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE invoices IS
  'One row per booking, auto-inserted by on_booking_confirmed_create_invoice trigger. Host + guest snapshots are frozen at issue time.';
COMMENT ON COLUMN invoices.hosted_token IS
  'Random 22-char base64url token for the public /invoice/[token] page.';

-- ─── 11. blocked_dates.quote_id ────────────────────────────────
ALTER TABLE public.blocked_dates
  ADD COLUMN quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE;

CREATE INDEX idx_blocked_dates_quote
  ON blocked_dates(quote_id) WHERE quote_id IS NOT NULL;

COMMENT ON COLUMN blocked_dates.quote_id IS
  'When set, the row is a quote_pending soft hold; cleared when the quote is declined / expired / converted.';

-- ─── 12. RLS — host_counters ───────────────────────────────────
CREATE POLICY "host_read_own_counters" ON host_counters FOR SELECT
  USING (host_id = get_my_host_id());
CREATE POLICY "admin_full_counters"    ON host_counters FOR ALL
  USING (is_super_admin());
-- INSERT / UPDATE only via SECURITY DEFINER functions (no policy → service_role only).

-- ─── 13. RLS — quotes ──────────────────────────────────────────
CREATE POLICY "host_manage_own_quotes"  ON quotes FOR ALL
  USING (host_id = get_my_host_id());
CREATE POLICY "staff_read_quotes"       ON quotes FOR SELECT
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "staff_update_quotes"     ON quotes FOR UPDATE
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_quotes"       ON quotes FOR ALL
  USING (is_super_admin());
-- Guest-facing reads go through the Edge Function gated by accept_token
-- (service_role bypasses RLS).

-- ─── 14. RLS — quote_rooms, quote_addons ───────────────────────
CREATE POLICY "host_manage_own_quote_rooms" ON quote_rooms FOR ALL
  USING (quote_id IN (SELECT id FROM quotes WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_quote_rooms" ON quote_rooms FOR ALL
  USING (is_super_admin());

CREATE POLICY "host_manage_own_quote_addons" ON quote_addons FOR ALL
  USING (quote_id IN (SELECT id FROM quotes WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_quote_addons" ON quote_addons FOR ALL
  USING (is_super_admin());

-- ─── 15. RLS — booking_addons ──────────────────────────────────
CREATE POLICY "guest_read_own_booking_addons" ON booking_addons FOR SELECT
  USING (booking_id IN (SELECT id FROM bookings WHERE guest_id = auth.uid()));
CREATE POLICY "host_manage_own_booking_addons" ON booking_addons FOR ALL
  USING (booking_id IN (SELECT id FROM bookings WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_booking_addons" ON booking_addons FOR ALL
  USING (is_super_admin());

-- ─── 16. RLS — invoices ────────────────────────────────────────
CREATE POLICY "host_read_own_invoices"  ON invoices FOR SELECT
  USING (host_id = get_my_host_id());
CREATE POLICY "host_update_own_invoices" ON invoices FOR UPDATE
  USING (host_id = get_my_host_id())
  WITH CHECK (host_id = get_my_host_id());
CREATE POLICY "guest_read_own_invoices" ON invoices FOR SELECT
  USING (guest_id = auth.uid());
CREATE POLICY "staff_read_invoices"     ON invoices FOR SELECT
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_invoices"     ON invoices FOR ALL
  USING (is_super_admin());
-- Inserts only via the SECURITY DEFINER trigger (service_role on the
-- Edge-function path also bypasses RLS).

-- ─── 17. Quote status change → manage soft holds ───────────────
CREATE OR REPLACE FUNCTION on_quote_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_date date;
  v_room record;
BEGIN
  -- 'sent' transition: lay down per-night holds.
  IF NEW.status = 'sent' AND COALESCE(OLD.status, '') <> 'sent' THEN
    v_date := NEW.check_in;
    WHILE v_date < NEW.check_out LOOP
      IF NEW.scope = 'rooms' THEN
        FOR v_room IN SELECT room_id FROM quote_rooms WHERE quote_id = NEW.id LOOP
          INSERT INTO blocked_dates (listing_id, room_id, date, reason, quote_id)
          VALUES (NEW.listing_id, v_room.room_id, v_date, 'quote_pending', NEW.id)
          ON CONFLICT DO NOTHING;
        END LOOP;
      ELSE
        INSERT INTO blocked_dates (listing_id, room_id, date, reason, quote_id)
        VALUES (NEW.listing_id, NULL, v_date, 'quote_pending', NEW.id)
        ON CONFLICT DO NOTHING;
      END IF;
      v_date := v_date + 1;
    END LOOP;
  END IF;

  -- Terminal transitions: clear the holds.
  IF NEW.status IN ('declined','expired','converted')
     AND COALESCE(OLD.status, '') NOT IN ('declined','expired','converted') THEN
    DELETE FROM blocked_dates WHERE quote_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_quote_status_change
  AFTER UPDATE OF status ON quotes
  FOR EACH ROW EXECUTE FUNCTION on_quote_status_change();

-- ─── 18. Booking confirmed → auto-create invoice ───────────────
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
    -- Idempotent: skip if an invoice already exists.
    IF EXISTS (SELECT 1 FROM invoices WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_host    FROM hosts    WHERE id = NEW.host_id;
    SELECT * INTO v_listing FROM listings WHERE id = NEW.listing_id;

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
      invoice_number, booking_id, host_id, guest_id,
      host_snapshot, guest_snapshot, line_items,
      subtotal, vat_amount, total_amount, currency,
      status, issued_at,
      paid_at
    ) VALUES (
      v_number, NEW.id, NEW.host_id, NEW.guest_id,
      jsonb_build_object(
        'host_id',        v_host.id,
        'display_name',   v_host.display_name,
        'handle',         v_host.handle,
        'email',          v_host.contact_email,
        'phone',          v_host.contact_phone
      ),
      jsonb_build_object(
        'guest_id', NEW.guest_id,
        'name',     COALESCE(NEW.guest_name,  (SELECT full_name FROM user_profiles WHERE id = NEW.guest_id)),
        'email',    COALESCE(NEW.guest_email, (SELECT email     FROM user_profiles WHERE id = NEW.guest_id)),
        'phone',    NEW.guest_phone
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

CREATE TRIGGER trigger_booking_confirmed_invoice
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION on_booking_confirmed_create_invoice();

-- ─── 19. updated_at triggers for new tables ────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON host_counters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 20. Storage bucket for invoice PDFs ───────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-pdfs', 'invoice-pdfs', false, 5242880, ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "host_read_own_invoice_pdfs" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoice-pdfs'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM invoices WHERE host_id = get_my_host_id()
    )
  );

CREATE POLICY "guest_read_own_invoice_pdfs" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoice-pdfs'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM invoices WHERE guest_id = auth.uid()
    )
  );

-- Inserts and deletes only via service_role (Edge Function path).

COMMENT ON FUNCTION next_quote_number IS
  'Returns the next per-host quote number, formatted as {handle}-QYYYY-NNNN. Increments host_counters under row lock.';
COMMENT ON FUNCTION next_invoice_number IS
  'Returns the next per-host invoice number, formatted as {handle}-INVYYYY-NNNN. Increments host_counters under row lock.';
COMMENT ON FUNCTION gen_url_token IS
  'Returns a 22-char base64url token derived from gen_random_bytes(18). Used as the public accept_token / hosted_token.';
