-- ─────────────────────────────────────────────────────────────────────────
-- Pay-now link token for every booking.
--
-- Lets a host send a guest a Vilo-hosted /pay/[token] page to settle an unpaid
-- booking via the host's OWN connected Paystack (funds settle directly to the
-- host; Vilo takes 0%), or by manual EFT when the host hasn't connected card.
-- Unguessable + per-booking, mirroring invoices.hosted_token (gen_url_token()).
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pay_token text;

-- Backfill existing rows (pre-MVP demo/seed data) before the NOT NULL flip.
UPDATE public.bookings
  SET pay_token = gen_url_token()
  WHERE pay_token IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN pay_token SET DEFAULT gen_url_token(),
  ALTER COLUMN pay_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_pay_token
  ON public.bookings(pay_token);

COMMENT ON COLUMN public.bookings.pay_token IS
  'Random 22-char base64url token for the public /pay/[token] payment page (host-shareable pay-now link).';
