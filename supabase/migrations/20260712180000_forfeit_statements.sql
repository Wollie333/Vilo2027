-- Migration: Forfeit statements (guest vanished / no-show — partial payment kept)
--
-- Founder decision 2026-07-12 (NEXT_STEPS §F3): when a guest partially pays then
-- disappears, the host must be able to cancel the booking WITHOUT the platform
-- wrongly recording a refund the host owes. The host force-forfeits: keeps what
-- was paid (recognised as revenue), the outstanding balance is written off, and
-- an immutable "Forfeit statement" (FRF-####) is the paper trail. NO refund
-- request, NO credit note.
--
-- Accounting (host ledger is derived in lib/finance/transactions.ts):
--   • The booking's invoice is VOIDED (superseded by the forfeit statement) so
--     its +total charge drops from the ledger.
--   • The forfeit_statement emits ONE ledger row: "Forfeited (retained)" =
--     amount_forfeited (owedEffect +1), which nets against the deposit payment
--     (owedEffect -1) → the guest's balance for the booking is exactly 0.
--   • The paid deposit stays a completed payment → still counted as collected
--     revenue. amount_written_off (= total - paid) is documented, not charged.
--   • booking.status → no_show; booking.payment_status → forfeited (terminal).

-- ─── 1. FRF- document number generator ─────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.seq_forfeit_number;

CREATE OR REPLACE FUNCTION public.next_forfeit_number(p_business_id uuid DEFAULT NULL)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'FRF-' || lpad(nextval('public.seq_forfeit_number')::text, 4, '0');
$$;

COMMENT ON FUNCTION public.next_forfeit_number IS
  'Next global Forfeit-statement number (FRF-0001). Same global-sequence scheme as INV/CN/REF; business arg ignored.';

-- ─── 2. bookings.payment_status: add terminal 'forfeited' ──────────
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check CHECK (payment_status IN (
    'pending','partial','authorised','completed',
    'failed','refunded','partially_refunded','voided','forfeited'
  ));

-- ─── 3. forfeit_statements — immutable paper trail + ledger source ─
CREATE TABLE public.forfeit_statements (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_number   text    UNIQUE NOT NULL,

  booking_id         uuid    NOT NULL REFERENCES bookings(id)     ON DELETE RESTRICT,
  host_id            uuid    NOT NULL REFERENCES hosts(id)        ON DELETE RESTRICT,
  guest_id           uuid    REFERENCES user_profiles(id)         ON DELETE SET NULL,
  -- The invoice voided when this statement was issued (null if the booking was
  -- never invoiced). Kept for the audit trail.
  invoice_id         uuid    REFERENCES invoices(id)              ON DELETE SET NULL,

  -- Frozen at issue time so the document never silently changes.
  host_snapshot      jsonb   NOT NULL,
  guest_snapshot     jsonb   NOT NULL,

  currency           text    NOT NULL DEFAULT 'ZAR',
  booking_total      numeric NOT NULL,                 -- original booking total
  amount_paid        numeric NOT NULL,                 -- completed inbound at forfeit time
  amount_forfeited   numeric NOT NULL,                 -- paid retained by host (revenue)
  amount_refunded    numeric NOT NULL DEFAULT 0,       -- refunded per policy (0 when force-forfeit)
  amount_written_off numeric NOT NULL,                 -- outstanding reversed (bad debt)

  policy_applied     text,                             -- cancellation policy name/summary
  reason             text,                             -- host note (why forfeited)

  hosted_token       text    UNIQUE NOT NULL DEFAULT gen_url_token(),
  pdf_storage_path   text,

  created_by         uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_forfeit_statements_host_id      ON forfeit_statements(host_id);
CREATE INDEX idx_forfeit_statements_booking_id   ON forfeit_statements(booking_id);
CREATE INDEX idx_forfeit_statements_guest_id     ON forfeit_statements(guest_id);
CREATE INDEX idx_forfeit_statements_created_at   ON forfeit_statements(created_at DESC);
CREATE INDEX idx_forfeit_statements_hosted_token ON forfeit_statements(hosted_token);
-- One forfeit statement per booking.
CREATE UNIQUE INDEX uq_forfeit_statements_booking ON forfeit_statements(booking_id);

COMMENT ON TABLE public.forfeit_statements IS
  'Immutable record of a forfeited (no-show/abandoned) booking: amount paid+retained, outstanding written off, policy applied. Doubles as the host-ledger source for the "Forfeited (retained)" row. INSERT-only.';

-- ─── 4. RLS (mirror credit_notes) ─────────────────────────────────
ALTER TABLE public.forfeit_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "host_read_own_forfeit_statements" ON forfeit_statements FOR SELECT
  USING (host_id = get_my_host_id());
CREATE POLICY "host_insert_own_forfeit_statements" ON forfeit_statements FOR INSERT
  WITH CHECK (host_id = get_my_host_id());
CREATE POLICY "guest_read_own_forfeit_statements" ON forfeit_statements FOR SELECT
  USING (guest_id = auth.uid());
CREATE POLICY "staff_read_forfeit_statements" ON forfeit_statements FOR SELECT
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "staff_insert_forfeit_statements" ON forfeit_statements FOR INSERT
  WITH CHECK (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_forfeit_statements" ON forfeit_statements FOR ALL
  USING (is_super_admin());

-- ─── 5. Immutability — INSERT-only (block UPDATE + DELETE) ─────────
-- Mirrors policy_snapshots (20260712150000). The GDPR purge signals intent with
-- a txn-local GUC; TRUNCATE ("clean wipe") doesn't fire row triggers.
CREATE OR REPLACE FUNCTION forbid_forfeit_statement_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'forfeit_statements is immutable: statement % cannot be altered.',
      OLD.statement_number
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF current_setting('app.allow_forfeit_statement_purge', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION
      'forfeit_statements rows cannot be deleted outside the GDPR account purge (%).',
      OLD.statement_number
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_forfeit_statements_immutable ON forfeit_statements;
CREATE TRIGGER trg_forfeit_statements_immutable
  BEFORE UPDATE OR DELETE ON forfeit_statements
  FOR EACH ROW EXECUTE FUNCTION forbid_forfeit_statement_mutation();

-- ─── 6. Guest notification event for a forfeited booking ──────────
-- The generic booking_cancelled_guest copy says "a refund is on its way" — wrong
-- for a forfeiture. Register a dedicated event (email + in-app, no push default).
INSERT INTO public.notification_events
  (kind, category_id, feature, severity, email_template_key,
   push_supported, in_app_supported, human_label, human_description)
VALUES
  ('booking_forfeited_guest', 'bookings', 'booking', 'high',
   'booking_forfeited_guest', true, true,
   'Booking cancelled — no refund (forfeited)',
   'Sent to the guest when a host cancels a no-show/abandoned booking and the amount paid is forfeited per the cancellation policy.')
ON CONFLICT (kind) DO UPDATE
  SET email_template_key = EXCLUDED.email_template_key,
      human_label        = EXCLUDED.human_label,
      human_description  = EXCLUDED.human_description;
