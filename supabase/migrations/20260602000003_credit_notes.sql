-- Migration: Credit Notes (Finances)
--
-- A credit note records money credited back to a guest against an invoice —
-- either created manually by the host from an invoice, or auto-generated when
-- a refund completes. Mirrors the invoices model: per-host numbering, frozen
-- host/guest snapshots, jsonb line items, hosted token + (future) PDF.
--
-- Created two ways:
--   * manual      — host opens an invoice → "Create credit note".
--   * refund_auto — trigger fires when a refund_request hits 'completed'.

-- ─── 1. host_counters — credit-note sequence ───────────────────
ALTER TABLE public.host_counters
  ADD COLUMN IF NOT EXISTS last_credit_note_number integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION next_credit_note_number(p_host_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_handle text;
  v_next   integer;
BEGIN
  INSERT INTO host_counters (host_id, last_credit_note_number)
  VALUES (p_host_id, 1)
  ON CONFLICT (host_id) DO UPDATE
    SET last_credit_note_number = host_counters.last_credit_note_number + 1,
        updated_at = now()
  RETURNING last_credit_note_number INTO v_next;

  SELECT handle INTO v_handle FROM hosts WHERE id = p_host_id;
  v_handle := COALESCE(v_handle, 'HOST');

  RETURN upper(v_handle) || '-CN' || to_char(now(), 'YYYY') || '-' ||
         lpad(v_next::text, 4, '0');
END;
$$;

COMMENT ON FUNCTION next_credit_note_number IS
  'Returns the next per-host credit-note number, formatted as {handle}-CNYYYY-NNNN. Increments host_counters under row lock.';

-- ─── 2. credit_notes ───────────────────────────────────────────
CREATE TABLE public.credit_notes (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number  text    UNIQUE NOT NULL,

  invoice_id          uuid    NOT NULL REFERENCES invoices(id)        ON DELETE RESTRICT,
  booking_id          uuid    NOT NULL REFERENCES bookings(id)        ON DELETE RESTRICT,
  host_id             uuid    NOT NULL REFERENCES hosts(id)           ON DELETE RESTRICT,
  guest_id            uuid    REFERENCES user_profiles(id)            ON DELETE SET NULL,
  refund_request_id   uuid    REFERENCES refund_requests(id)          ON DELETE SET NULL,

  -- Frozen at issue time so the document never silently changes.
  host_snapshot       jsonb   NOT NULL,
  guest_snapshot      jsonb   NOT NULL,
  line_items          jsonb   NOT NULL DEFAULT '[]'::jsonb,  -- [{label, amount}]

  reason              text,

  subtotal            numeric NOT NULL,
  vat_amount          numeric NOT NULL DEFAULT 0,
  total_amount        numeric NOT NULL CHECK (total_amount >= 0),
  currency            text    NOT NULL DEFAULT 'ZAR',

  origin              text    NOT NULL DEFAULT 'manual'
                              CHECK (origin IN ('manual', 'refund_auto')),
  status              text    NOT NULL DEFAULT 'issued'
                              CHECK (status IN ('draft', 'issued', 'cancelled')),

  issued_at           timestamptz NOT NULL DEFAULT now(),
  cancelled_at        timestamptz,

  pdf_storage_path    text,
  hosted_token        text    UNIQUE NOT NULL DEFAULT gen_url_token(),

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_notes_host_id      ON credit_notes(host_id);
CREATE INDEX idx_credit_notes_invoice_id   ON credit_notes(invoice_id);
CREATE INDEX idx_credit_notes_booking_id   ON credit_notes(booking_id);
CREATE INDEX idx_credit_notes_guest_id     ON credit_notes(guest_id);
CREATE INDEX idx_credit_notes_status       ON credit_notes(status);
CREATE INDEX idx_credit_notes_issued_at    ON credit_notes(issued_at DESC);
CREATE INDEX idx_credit_notes_hosted_token ON credit_notes(hosted_token);
-- One auto credit note per refund (partial unique → manual ones aren't limited).
CREATE UNIQUE INDEX idx_credit_notes_refund_unique
  ON credit_notes(refund_request_id) WHERE refund_request_id IS NOT NULL;

ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE credit_notes IS
  'Money credited back to a guest against an invoice. origin=manual (host-created) or refund_auto (trigger on refund completion).';
COMMENT ON COLUMN credit_notes.hosted_token IS
  'Random 22-char base64url token for the public /credit-note/[token] page (future).';

-- ─── 3. RLS — mirrors invoices ─────────────────────────────────
CREATE POLICY "host_read_own_credit_notes" ON credit_notes FOR SELECT
  USING (host_id = get_my_host_id());
CREATE POLICY "host_insert_own_credit_notes" ON credit_notes FOR INSERT
  WITH CHECK (host_id = get_my_host_id());
CREATE POLICY "host_update_own_credit_notes" ON credit_notes FOR UPDATE
  USING (host_id = get_my_host_id())
  WITH CHECK (host_id = get_my_host_id());
CREATE POLICY "guest_read_own_credit_notes" ON credit_notes FOR SELECT
  USING (guest_id = auth.uid());
CREATE POLICY "staff_read_credit_notes" ON credit_notes FOR SELECT
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "staff_insert_credit_notes" ON credit_notes FOR INSERT
  WITH CHECK (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_credit_notes" ON credit_notes FOR ALL
  USING (is_super_admin());

-- ─── 4. updated_at trigger ─────────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 5. Auto-create on refund completion ───────────────────────
-- When a refund_request transitions to 'completed', issue a credit note
-- against that booking's invoice (if one exists). Idempotent on refund id.
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

    v_amount := COALESCE(NEW.approved_amount, NEW.requested_amount, 0);
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

CREATE TRIGGER trigger_refund_completed_credit_note
  AFTER UPDATE OF status ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION on_refund_completed_create_credit_note();

-- ─── 6. Storage bucket for credit-note PDFs (parity with invoices) ─
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'credit-note-pdfs', 'credit-note-pdfs', false, 5242880, ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "host_read_own_credit_note_pdfs" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'credit-note-pdfs'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM credit_notes WHERE host_id = get_my_host_id()
    )
  );

CREATE POLICY "guest_read_own_credit_note_pdfs" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'credit-note-pdfs'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM credit_notes WHERE guest_id = auth.uid()
    )
  );
-- Inserts/deletes only via service_role (Edge / Server Action admin client).
