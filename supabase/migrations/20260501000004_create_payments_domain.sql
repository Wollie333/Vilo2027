-- Migration: Domain 4 — Payments
-- Per supabase_database.md §7
-- Tables: payments, refunds, eft_banking_details

-- ─── payments ─────────────────────────────────────────────────
CREATE TABLE public.payments (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid    NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,

  amount             numeric NOT NULL,
  currency           text    NOT NULL DEFAULT 'ZAR',
  method             text    NOT NULL CHECK (method IN ('paystack','paypal','eft')),
  status             text    NOT NULL DEFAULT 'pending'
                             CHECK (status IN (
                               'pending','authorised','completed',
                               'failed','refunded','partially_refunded','voided'
                             )),

  provider_reference text,
  provider_response  jsonb,

  eft_proof_url      text,

  authorised_at      timestamptz,
  captured_at        timestamptz,
  failed_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_provider_reference UNIQUE (provider_reference)
);

CREATE INDEX idx_payments_booking_id   ON payments(booking_id);
CREATE INDEX idx_payments_status       ON payments(status);
CREATE INDEX idx_payments_method       ON payments(method);
CREATE INDEX idx_payments_created_at   ON payments(created_at DESC);
CREATE INDEX idx_payments_provider_ref ON payments(provider_reference);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN payments.provider_response IS
  'Full raw webhook payload for audit and debugging.';
COMMENT ON COLUMN payments.provider_reference IS
  'Unique per provider. Used for idempotency checks on webhooks.';

-- ─── refunds ──────────────────────────────────────────────────
CREATE TABLE public.refunds (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id         uuid    NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  booking_id         uuid    NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,

  amount             numeric NOT NULL,
  currency           text    NOT NULL DEFAULT 'ZAR',
  reason             text,
  status             text    NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','processing','completed','failed')),

  provider_reference text,
  provider_response  jsonb,

  is_manual          boolean NOT NULL DEFAULT false,
  manual_note        text,
  processed_by       uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX idx_refunds_booking_id ON refunds(booking_id);
CREATE INDEX idx_refunds_status     ON refunds(status);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN refunds.is_manual IS
  'True for EFT refunds — processed outside the platform by the host.';

-- ─── eft_banking_details ──────────────────────────────────────
CREATE TABLE public.eft_banking_details (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          uuid UNIQUE NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  bank_name        text NOT NULL,
  account_holder   text NOT NULL,
  account_number   text NOT NULL,
  branch_code      text NOT NULL,
  swift_code       text,
  reference_format text NOT NULL DEFAULT 'VILO-{booking_ref}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eft_banking_details ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN eft_banking_details.account_number IS
  'Encrypted at application layer before storage. Never stored in plain text.';
COMMENT ON COLUMN eft_banking_details.reference_format IS
  '{booking_ref} is replaced with the booking reference number at display time.';
