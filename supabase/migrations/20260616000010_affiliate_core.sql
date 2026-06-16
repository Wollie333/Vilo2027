-- Migration: Affiliate program — core schema (accounts, clicks, referrals, commissions).
--
-- Vilo's affiliate program lets ANY user (a guest account is the minimum bar —
-- identity is user_profiles.id, NOT a host) promote Vilo's own products and earn
-- the commission the admin set on each product (products.affiliate_*). It is NOT a
-- host-listing affiliate system.
--
-- Money model (locked):
--   * Commission base = NET the referred user paid Vilo: platform_ledger.amount
--     minus vat_amount (coupon already reflected in amount), before payout fees.
--   * Commission accrues 'pending', held a refund window (affiliate_settings.hold_days),
--     then 'cleared' (withdrawable). A refund inside the window voids it; a refund
--     after payout posts a negative 'clawback' offset row.
--   * Append-only ledger (mirrors platform_ledger / subscription_history): status
--     flips on the row; clawback-after-payout adds offsetting signed rows. Balance =
--     sum of signed rows (see lib/affiliate/balance.ts).
--
-- All writes go through the service-role client (RLS bypassed) from audited
-- admin / webhook / server-action code. Affiliates may only READ their own rows.

-- ─── affiliate_accounts ────────────────────────────────────────────────────
-- One per user. Created when the user accepts the affiliate terms.
CREATE TABLE public.affiliate_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  slug                  text NOT NULL UNIQUE,        -- referral code; the public link is /r/<slug>
  status                text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','suspended')),
  terms_version         text NOT NULL,
  accepted_at           timestamptz NOT NULL DEFAULT now(),
  payout_threshold      numeric,                     -- NULL = use affiliate_settings.min_payout_threshold
  currency              text NOT NULL DEFAULT 'ZAR',
  default_payout_method text CHECK (default_payout_method IN ('eft','paystack','paypal')),
  suspended_at          timestamptz,
  suspended_by          uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  suspended_reason      text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_affiliate_accounts_slug_lower ON public.affiliate_accounts(lower(slug));

ALTER TABLE public.affiliate_accounts ENABLE ROW LEVEL SECURITY;
-- Read own only. Slug/status/terms are never client-mutable (service-role writes).
CREATE POLICY affiliate_accounts_own_read ON public.affiliate_accounts
  FOR SELECT USING (user_id = auth.uid());

-- ─── affiliate_clicks ──────────────────────────────────────────────────────
-- High-volume anonymous click log. Hashed visitor id, never raw IP.
CREATE TABLE public.affiliate_clicks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE CASCADE,
  slug         text NOT NULL,
  visitor_hash text,
  landing_path text,
  referer      text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_affiliate_clicks_affiliate ON public.affiliate_clicks(affiliate_id, created_at DESC);

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_clicks_own_read ON public.affiliate_clicks
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliate_accounts WHERE user_id = auth.uid()));

-- ─── affiliate_referrals ───────────────────────────────────────────────────
-- The permanent binding. Written exactly once at signup; UNIQUE(referred_user_id)
-- makes it bind-once-forever and survives the guest→host transition. Keyed on the
-- user (not the host) because accrual matches platform_ledger.user_id.
CREATE TABLE public.affiliate_referrals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id     uuid NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE RESTRICT,
  referred_user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  referred_host_id uuid REFERENCES hosts(id) ON DELETE SET NULL,  -- display only; stamped if/when they host
  source           text,
  click_id         uuid REFERENCES public.affiliate_clicks(id) ON DELETE SET NULL,
  bound_at         timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_referred_user UNIQUE (referred_user_id)
);
CREATE INDEX idx_affiliate_referrals_affiliate ON public.affiliate_referrals(affiliate_id);
CREATE INDEX idx_affiliate_referrals_host ON public.affiliate_referrals(referred_host_id);

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_referrals_own_read ON public.affiliate_referrals
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliate_accounts WHERE user_id = auth.uid()));

-- ─── affiliate_commissions ─────────────────────────────────────────────────
-- Append-only commission ledger. One 'accrual' row per (source platform_ledger
-- charge, kind). Clawback-after-payout adds a negative 'clawback' offset row.
CREATE TABLE public.affiliate_commissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id      uuid NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE RESTRICT,
  referral_id       uuid NOT NULL REFERENCES public.affiliate_referrals(id) ON DELETE RESTRICT,
  referred_host_id  uuid REFERENCES hosts(id) ON DELETE SET NULL,
  product_id        uuid REFERENCES public.products(id) ON DELETE SET NULL,
  source_ledger_id  uuid NOT NULL REFERENCES public.platform_ledger(id) ON DELETE RESTRICT,
  entry_type        text NOT NULL DEFAULT 'accrual'
                        CHECK (entry_type IN ('accrual','clawback')),
  kind              text NOT NULL DEFAULT 'subscription'
                        CHECK (kind IN ('subscription','setup_fee')),
  base_amount       numeric NOT NULL,            -- frozen NET = ledger.amount - vat_amount
  rate_type         text NOT NULL CHECK (rate_type IN ('amount','percent')),
  rate_value        numeric NOT NULL,            -- snapshot of product.affiliate_value
  commission_amount numeric NOT NULL,            -- signed: + accrual, - clawback offset
  currency          text NOT NULL DEFAULT 'ZAR',
  status            text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','cleared','voided','paid')),
  billing_period    integer,                     -- nth charge for this referral×product×kind
  hold_until        timestamptz NOT NULL,
  cleared_at        timestamptz,
  voided_at         timestamptz,
  void_reason       text,
  refund_ledger_id  uuid REFERENCES public.platform_ledger(id) ON DELETE SET NULL,
  payout_id         uuid,                        -- FK added in 20260616000011 (after payouts table)
  paid_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
-- Double-accrual guard: at most one accrual row per source charge per kind.
CREATE UNIQUE INDEX uniq_commission_accrual
  ON public.affiliate_commissions(source_ledger_id, kind)
  WHERE entry_type = 'accrual';
-- Double-clawback guard: at most one offset per refund per kind.
CREATE UNIQUE INDEX uniq_commission_clawback
  ON public.affiliate_commissions(refund_ledger_id, kind)
  WHERE entry_type = 'clawback';
CREATE INDEX idx_aff_comm_affiliate_status ON public.affiliate_commissions(affiliate_id, status);
CREATE INDEX idx_aff_comm_hold ON public.affiliate_commissions(status, hold_until)
  WHERE status = 'pending';
CREATE INDEX idx_aff_comm_payout ON public.affiliate_commissions(payout_id);
CREATE INDEX idx_aff_comm_source ON public.affiliate_commissions(source_ledger_id);

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_commissions_own_read ON public.affiliate_commissions
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliate_accounts WHERE user_id = auth.uid()));

COMMENT ON TABLE public.affiliate_accounts IS
  'One affiliate account per user (user_profiles.id). Created on affiliate-terms acceptance.';
COMMENT ON TABLE public.affiliate_referrals IS
  'Permanent affiliate→referred-user binding. UNIQUE(referred_user_id) = bound once, forever.';
COMMENT ON TABLE public.affiliate_commissions IS
  'Append-only commission ledger. Signed amounts; clawback posts negative offset rows. Balance = sum of signed rows.';
COMMENT ON COLUMN public.affiliate_commissions.base_amount IS
  'Frozen NET base: platform_ledger.amount - vat_amount (commission % applies to this).';
