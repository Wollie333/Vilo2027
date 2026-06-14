-- Migration: Vilo revenue ledger (Super-Admin portal Pillar 2)
--
-- Records EVERY transaction between a user and Vilo — subscription charges, paid
-- platform services, refunds, and manual admin adjustments (goodwill credit /
-- write-off). This is NOT the booking ledger (host↔guest, which goes straight to
-- the host and is untouched). It mirrors the host ledger pattern but is scoped to
-- money the user pays Vilo. Auto-populated by the billing webhook (P1.5); the
-- admin can also post manual entries.

CREATE TABLE public.platform_ledger (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who paid Vilo (the host's owner account) + their host row when applicable.
  user_id            uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  host_id            uuid REFERENCES hosts(id) ON DELETE SET NULL,

  -- What the payment was for.
  subscription_id    uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  service_id         uuid,                      -- platform_services (added in P1.2)
  plan               text REFERENCES plans(key) ON UPDATE CASCADE,
  billing_cycle      text,

  type               text NOT NULL CHECK (type IN ('charge','refund','credit','adjustment')),
  status             text NOT NULL DEFAULT 'completed'
                          CHECK (status IN ('pending','completed','failed')),

  amount             numeric NOT NULL,          -- signed: +charge, -refund/credit
  currency           text    NOT NULL DEFAULT 'ZAR',
  vat_amount         numeric,

  provider           text DEFAULT 'paystack',
  provider_reference text UNIQUE,               -- idempotency for webhook writes
  invoice_id         uuid,                      -- the Vilo→host invoice (P1.6)
  coupon_id          uuid,                      -- subscription coupon applied (P1.4)

  reason             text,                      -- manual entries / notes
  created_by         uuid REFERENCES user_profiles(id) ON DELETE SET NULL,  -- admin for manual

  period_start       timestamptz,
  period_end         timestamptz,
  paid_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_ledger_status   ON public.platform_ledger(status);
CREATE INDEX idx_platform_ledger_created  ON public.platform_ledger(created_at DESC);
CREATE INDEX idx_platform_ledger_plan     ON public.platform_ledger(plan);
CREATE INDEX idx_platform_ledger_host     ON public.platform_ledger(host_id);
CREATE INDEX idx_platform_ledger_user     ON public.platform_ledger(user_id);

ALTER TABLE public.platform_ledger ENABLE ROW LEVEL SECURITY;

-- A host/user may read their OWN Vilo-account rows (so the host subscription page
-- can show their billing history). The platform-wide view + all writes go through
-- the service-role admin client (RLS bypassed) from audited admin/webhook code.
CREATE POLICY platform_ledger_own_read ON public.platform_ledger
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE public.platform_ledger IS
  'Vilo revenue ledger: every user→Vilo transaction (subscriptions, services, refunds, manual adjustments). Not the booking ledger.';
COMMENT ON COLUMN public.platform_ledger.amount IS
  'Signed amount: positive = charge (revenue in), negative = refund/credit (out).';
