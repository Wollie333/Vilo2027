-- Migration: Affiliate program — payouts + payout methods.
--
-- A payout settles a batch of CLEARED commission rows. The affiliate earns gross;
-- the payout processor fee (per affiliate_payout_fees) is DEDUCTED so they receive
-- net. The commission rows themselves are the line items — settling a payout stamps
-- payout_id on them and flips status cleared→paid (one transaction, in the RPC).
--
-- Payouts are MANUAL-first: the admin executes the transfer out-of-band (EFT /
-- Paystack transfer / PayPal payout) and then marks the payout paid. Automated
-- transfers are a later enhancement — provider / provider_reference are ready.

-- ─── affiliate_payout_methods ──────────────────────────────────────────────
-- The affiliate's destination details (sensitive PII). The ONE affiliate-facing
-- table they write directly (like editing their own banking). Server actions mask
-- account_number on read-back; details are snapshotted onto the payout at request.
CREATE TABLE public.affiliate_payout_methods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id  uuid NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE CASCADE,
  method        text NOT NULL CHECK (method IN ('eft','paystack','paypal')),
  is_default    boolean NOT NULL DEFAULT false,
  -- EFT
  bank_name      text,
  account_name   text,
  account_number text,
  branch_code    text,
  -- Paystack transfer
  paystack_recipient_code text,
  -- PayPal payout
  paypal_email   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_aff_payout_methods_affiliate ON public.affiliate_payout_methods(affiliate_id);
-- At most one default per affiliate.
CREATE UNIQUE INDEX uniq_aff_payout_method_default
  ON public.affiliate_payout_methods(affiliate_id) WHERE is_default;

ALTER TABLE public.affiliate_payout_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_payout_methods_own_all ON public.affiliate_payout_methods
  FOR ALL
  USING (affiliate_id IN (SELECT id FROM public.affiliate_accounts WHERE user_id = auth.uid()))
  WITH CHECK (affiliate_id IN (SELECT id FROM public.affiliate_accounts WHERE user_id = auth.uid()));

-- ─── affiliate_payouts ─────────────────────────────────────────────────────
CREATE TABLE public.affiliate_payouts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id         uuid NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE RESTRICT,
  method               text NOT NULL CHECK (method IN ('eft','paystack','paypal')),
  status               text NOT NULL DEFAULT 'requested'
                           CHECK (status IN ('requested','approved','processing','paid','failed','rejected')),
  gross_amount         numeric NOT NULL,
  fee_amount           numeric NOT NULL DEFAULT 0,   -- deducted from the affiliate
  net_amount           numeric NOT NULL,             -- gross - fee (what they receive)
  currency             text NOT NULL DEFAULT 'ZAR',
  fee_config_snapshot  jsonb,                         -- frozen {fixed, percent, cap}
  destination_snapshot jsonb,                         -- frozen bank / recipient / paypal details
  provider             text,                          -- 'manual' | 'paystack' | 'paypal'
  provider_reference   text UNIQUE,                   -- idempotency for automated transfers
  requested_at         timestamptz NOT NULL DEFAULT now(),
  processed_by         uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  processed_at         timestamptz,
  failure_reason       text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_aff_payouts_affiliate ON public.affiliate_payouts(affiliate_id, requested_at DESC);
CREATE INDEX idx_aff_payouts_status ON public.affiliate_payouts(status);

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_payouts_own_read ON public.affiliate_payouts
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliate_accounts WHERE user_id = auth.uid()));

-- Now that the payouts table exists, wire the commission → payout FK.
ALTER TABLE public.affiliate_commissions
  ADD CONSTRAINT affiliate_commissions_payout_fkey
  FOREIGN KEY (payout_id) REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL;

COMMENT ON TABLE public.affiliate_payouts IS
  'Affiliate payout requests. Settles a batch of cleared commissions; fee deducted from the affiliate (earns gross, receives net).';
COMMENT ON TABLE public.affiliate_payout_methods IS
  'Affiliate payout destinations (EFT / Paystack / PayPal). Sensitive PII; snapshotted onto the payout at request time.';
