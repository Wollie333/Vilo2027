-- Migration: payment ledger upgrade + per-host guest credit.
--
-- A booking now carries MANY payment rows (a ledger) instead of a single
-- record: a 'deposit' entry seeded at quote-accept, then 'balance' / 'addon' /
-- generic 'payment' entries the host applies by hand (manual EFT first; Paystack
-- / PayPal webhooks write their own rows later). Overpayment never sits on the
-- booking — the excess is posted as store credit held PER-HOST against the guest
-- (matching the per-host guest isolation the CRM already enforces).

-- ── payments: label each ledger entry + record who/why ─────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'payment'
    CHECK (kind IN ('deposit','balance','addon','payment','refund','credit')),
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid
    REFERENCES public.user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.payments.kind IS
  'What this ledger entry represents: deposit | balance | addon | payment (generic) | refund | credit (store credit applied to the balance).';
COMMENT ON COLUMN public.payments.recorded_by IS
  'Host/staff user who manually recorded this payment. NULL for provider webhooks.';

-- Allow a 'credit' method so applying store credit to a balance reads as a real
-- ledger entry (kind 'credit', method 'credit') rather than faking an EFT.
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_method_check
  CHECK (method IN ('paystack','paypal','eft','credit'));

-- ── bookings.payment_status: allow a partial (deposit-paid) state ───
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check CHECK (payment_status IN (
    'pending','partial','authorised','completed',
    'failed','refunded','partially_refunded','voided'
  ));

COMMENT ON COLUMN public.bookings.payment_status IS
  'Money state derived from the payment ledger: pending (nothing in) -> partial (deposit/part paid) -> completed (paid in full or more). Maintained by lib/payments/ledger.ts.';

-- ── guest_credit_ledger: per-(host, guest) store credit ────────────
CREATE TABLE IF NOT EXISTS public.guest_credit_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  gkey        text NOT NULL,
  guest_id    uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  guest_email text,
  amount      numeric NOT NULL,            -- +credit earned, -credit spent
  currency    text    NOT NULL DEFAULT 'ZAR',
  reason      text    NOT NULL,
  booking_id  uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  payment_id  uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_by  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_credit_host_gkey
  ON public.guest_credit_ledger(host_id, gkey);
CREATE INDEX IF NOT EXISTS idx_guest_credit_booking
  ON public.guest_credit_ledger(booking_id);

ALTER TABLE public.guest_credit_ledger ENABLE ROW LEVEL SECURITY;

-- Host/staff read their own guests' credit; all writes go through the service
-- role (server actions) after an ownership check, so no host-write policy.
CREATE POLICY "host_read_own_guest_credit" ON public.guest_credit_ledger
  FOR SELECT USING (
    host_id = get_my_host_id() OR host_id = get_my_host_id_as_staff()
  );
CREATE POLICY "admin_full_guest_credit" ON public.guest_credit_ledger
  FOR ALL USING (is_super_admin());

COMMENT ON TABLE public.guest_credit_ledger IS
  'Per-host store credit for a guest, keyed by the CRM gkey. Overpayment auto-posts a +entry; applying credit to a booking balance posts a -entry. Balance = sum(amount) for (host_id, gkey).';
