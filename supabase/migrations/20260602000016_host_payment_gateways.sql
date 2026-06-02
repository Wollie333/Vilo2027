-- Migration: Host payment gateways (BYO Paystack + PayPal) + default currency + FX cache
--
-- Lets each host connect THEIR OWN Paystack and PayPal credentials so guest
-- booking payments settle directly into the host's own account — Vilo takes
-- 0% (the platform monetises via subscription only; that billing is a
-- separate, later flow using Vilo's own platform keys in env, NOT touched
-- here). Two money flows, kept deliberately separate:
--   * guest -> host (booking payments)  ... host_payment_gateways (this table)
--   * host  -> Vilo (subscription)      ... global env keys, untouched
--
-- Secrets are encrypted at the application layer (AES-256-GCM, PAYMENT_CIPHER_
-- KEY) using the same envelope format as eft_banking_details.account_number
-- (v1.<nonce>.<ct>.<tag>). The ciphertext lives in secret_cipher and is NEVER
-- returned to a client — the UI only ever shows secret_last4.
--
-- Pre-MVP data policy (CLAUDE.md): no real users yet, so destructive reshapes
-- are fine; this migration is purely additive regardless.

-- ─── 1. host_payment_gateways ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.host_payment_gateways (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id              uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  gateway              text NOT NULL CHECK (gateway IN ('paystack','paypal')),
  environment          text NOT NULL DEFAULT 'live'
                          CHECK (environment IN ('test','live')),
  -- Public, non-secret identifier: Paystack public key (pk_…) / PayPal client-id.
  public_identifier    text NOT NULL,
  -- Encrypted secret (Paystack secret key / PayPal client secret). Stored as
  -- v1.<nonce>.<ct>.<tag> when PAYMENT_CIPHER_KEY is set, else plain text.
  -- NEVER selected into a client payload.
  secret_cipher        text NOT NULL,
  secret_last4         text NOT NULL,
  -- Paystack only: the word/phrase a host wants shown on the guest's bank
  -- statement for payments to them. NULL for PayPal.
  statement_descriptor text,
  is_enabled           boolean NOT NULL DEFAULT true,
  last_validated_at    timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- One row per (host, gateway) — a host has at most one Paystack + one PayPal.
CREATE UNIQUE INDEX IF NOT EXISTS host_payment_gateway_one_per_kind
  ON public.host_payment_gateways(host_id, gateway);

CREATE INDEX IF NOT EXISTS idx_host_payment_gateways_host
  ON public.host_payment_gateways(host_id);

ALTER TABLE public.host_payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_host_payment_gateways
  BEFORE UPDATE ON public.host_payment_gateways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.host_payment_gateways IS
  'Per-host Paystack / PayPal credentials for direct (0% commission) guest->host booking payments. secret_cipher is app-layer encrypted and never returned to a client.';
COMMENT ON COLUMN public.host_payment_gateways.statement_descriptor IS
  'Paystack only: the word/phrase a host wants shown on the guest bank statement for payments to them. Passed through on transaction init (final display subject to Paystack/issuer support).';

-- RLS: host manages own rows only. The secret never leaves the server (page +
-- action select lists exclude secret_cipher from client payloads), but RLS
-- still scopes every row to its owner.
DROP POLICY IF EXISTS host_payment_gateways_owner_all ON public.host_payment_gateways;
CREATE POLICY host_payment_gateways_owner_all ON public.host_payment_gateways
  FOR ALL TO authenticated
  USING (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()))
  WITH CHECK (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()));

-- ─── 2. hosts.default_currency ───────────────────────────────
-- Drives which gateway is the default at checkout: ZAR -> Paystack,
-- USD -> PayPal. Guests can switch among the host's enabled gateways later.
ALTER TABLE public.hosts
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'ZAR'
    CHECK (default_currency IN ('ZAR','USD'));

COMMENT ON COLUMN public.hosts.default_currency IS
  'Host default settlement currency. ZAR -> Paystack, USD -> PayPal. Pre-selects the checkout gateway; guests may switch among enabled gateways.';

-- ─── 3. fx_rates (daily cache for ZAR<->USD checkout conversion) ──
CREATE TABLE IF NOT EXISTS public.fx_rates (
  base_currency      text NOT NULL,
  quote_currency     text NOT NULL,
  rate               numeric(18,8) NOT NULL CHECK (rate > 0),
  source             text NOT NULL DEFAULT 'auto',
  is_manual_override boolean NOT NULL DEFAULT false,
  fetched_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, quote_currency)
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_fx_rates
  BEFORE UPDATE ON public.fx_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- FX rates are non-sensitive reference data — readable by anyone (guest
-- checkout needs them too). Writes happen via the service role only, so there
-- is deliberately no INSERT/UPDATE policy for anon/authenticated.
DROP POLICY IF EXISTS fx_rates_read ON public.fx_rates;
CREATE POLICY fx_rates_read ON public.fx_rates
  FOR SELECT TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.fx_rates IS
  'Daily-cached FX rates for checkout currency conversion (ZAR base). Auto-refreshed from a free FX API by lib/fx.ts; is_manual_override rows are admin-pinned and never auto-overwritten.';

-- Seed a ZAR->USD placeholder so checkout has a rate before the first auto
-- refresh. lib/fx.ts replaces it on first read. ~0.053 USD per ZAR.
INSERT INTO public.fx_rates (base_currency, quote_currency, rate, source, fetched_at)
VALUES ('ZAR', 'USD', 0.053, 'seed', now())
ON CONFLICT (base_currency, quote_currency) DO NOTHING;

-- ─── 4. plan_features — payment_gateways key (open on every plan) ──
-- AGENT_RULES.md §3.4: open on free during pre-MVP so the founder can smoke-
-- test. Gate wiring stays in place for Phase 3 to narrow per-plan.
INSERT INTO public.plan_features (plan, feature_key, is_enabled, limit_value, description)
SELECT DISTINCT plan, 'payment_gateways', true, NULL::integer,
       'Connect your own Paystack / PayPal accounts to accept booking payments directly'
FROM public.plan_features
ON CONFLICT (plan, feature_key) DO UPDATE
  SET is_enabled = true,
      limit_value = NULL::integer;
