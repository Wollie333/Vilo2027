-- Migration: payment gateways → per-business
--
-- host_payment_gateways was host-level (one Paystack + one PayPal per host). A
-- host can own several businesses, each with its own listings + EFT banking, so
-- card gateways must be per-business too — a Business 2 booking's card must
-- settle into Business 2's Paystack, not the host's single account. Mirrors the
-- per-business EFT precedent (eft_banking_details.business_id).
--
-- Resolution stays derived (booking → listing → business_id); business_id here
-- just stores WHICH business a connected gateway belongs to.
--
-- Platform subscription billing (PAYSTACK_SECRET_KEY env) and the platform
-- paystack-webhook are NOT affected — they never touch this table.

-- 1. Add the business column (nullable first, backfilled below).
ALTER TABLE public.host_payment_gateways
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;

-- 2. Backfill every existing gateway to the host's default business (else any
--    non-archived business). Each host has a default business via the
--    on_host_created_default_business trigger, so this always resolves.
UPDATE public.host_payment_gateways hpg
SET business_id = COALESCE(
  (SELECT b.id FROM public.businesses b
     WHERE b.host_id = hpg.host_id AND b.is_default = true AND b.is_archived = false
     LIMIT 1),
  (SELECT b.id FROM public.businesses b
     WHERE b.host_id = hpg.host_id AND b.is_archived = false
     ORDER BY b.created_at
     LIMIT 1)
)
WHERE hpg.business_id IS NULL;

ALTER TABLE public.host_payment_gateways
  ALTER COLUMN business_id SET NOT NULL;

-- 3. One gateway per (business, provider) — replaces the per-(host, provider) rule.
DROP INDEX IF EXISTS host_payment_gateway_one_per_kind;
CREATE UNIQUE INDEX IF NOT EXISTS host_payment_gateway_one_per_kind
  ON public.host_payment_gateways(business_id, gateway);

-- 4. Index for per-business lookups (the resolver filters by business_id).
DROP INDEX IF EXISTS idx_host_payment_gateways_host;
CREATE INDEX IF NOT EXISTS idx_host_payment_gateways_host_business
  ON public.host_payment_gateways(host_id, business_id);

COMMENT ON TABLE public.host_payment_gateways IS
  'Per-BUSINESS Paystack / PayPal credentials for direct (0% commission) guest->host booking payments. One row per (business, gateway). secret_cipher is app-layer encrypted and never returned to a client. Resolved per booking via booking->listing->business_id.';
COMMENT ON COLUMN public.host_payment_gateways.business_id IS
  'The business this gateway belongs to (mirrors eft_banking_details.business_id). A booking charges the gateway of its listing''s business.';
