-- Migration: Affiliate program — global settings (singleton) + per-method payout fees.
--
-- Admin-tunable knobs for the whole program (cookie window, refund hold window,
-- minimum payout threshold, current terms version, attribution model) and the
-- processor fee charged per payout method. Service-role only — read by the
-- accrual / clearing / payout engines and the admin settings UI.

CREATE TABLE public.affiliate_settings (
  id                    boolean PRIMARY KEY DEFAULT true CHECK (id),  -- singleton row
  cookie_days           integer NOT NULL DEFAULT 30,
  hold_days             integer NOT NULL DEFAULT 30,
  min_payout_threshold  numeric NOT NULL DEFAULT 250,
  currency              text NOT NULL DEFAULT 'ZAR',
  terms_version         text NOT NULL DEFAULT 'v1',
  self_referral_blocked boolean NOT NULL DEFAULT true,
  attribution_model     text NOT NULL DEFAULT 'last_click'
                            CHECK (attribution_model IN ('first_click','last_click')),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;  -- service-role only
INSERT INTO public.affiliate_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- Per-method payout fee: fee = min(cap, fixed_fee + gross * percent_fee/100).
CREATE TABLE public.affiliate_payout_fees (
  method      text PRIMARY KEY CHECK (method IN ('eft','paystack','paypal')),
  fixed_fee   numeric NOT NULL DEFAULT 0,
  percent_fee numeric NOT NULL DEFAULT 0,   -- e.g. 2.9 = 2.9%
  cap_fee     numeric,                       -- optional max fee
  currency    text NOT NULL DEFAULT 'ZAR',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliate_payout_fees ENABLE ROW LEVEL SECURITY;  -- service-role only

-- Seed sane SA defaults (EFT ~free, Paystack ~1% + R1, PayPal heavier). Admin tunable.
INSERT INTO public.affiliate_payout_fees (method, fixed_fee, percent_fee, cap_fee) VALUES
  ('eft',       0,    0,    NULL),
  ('paystack',  1,    1.0,  NULL),
  ('paypal',    0,    5.0,  NULL)
ON CONFLICT (method) DO NOTHING;

COMMENT ON TABLE public.affiliate_settings IS
  'Singleton affiliate-program settings: cookie window, refund hold window, min payout, terms version, attribution model.';
COMMENT ON TABLE public.affiliate_payout_fees IS
  'Per-method payout processor fee, deducted from the affiliate at payout. fee = min(cap, fixed + gross*percent/100).';
