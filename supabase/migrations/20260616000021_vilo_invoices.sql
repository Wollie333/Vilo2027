-- Migration: Vilo-issued invoices (platform_ledger P1.6)
--
-- The Vilo equivalent of the host `invoices` table: every product/subscription
-- purchase a user makes from Vilo mints one invoice, with Vilo as the issuing
-- entity (business details frozen from platform_settings at issue time). Mirrors
-- the host invoice stack: numbering counter + gen_url_token() public link.
-- Booking invoices (host<->guest) stay on `invoices` and are untouched.

-- ─── 1. Per-platform invoice counter (singleton) ───────────────────────
CREATE TABLE public.platform_counters (
  id                   boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_invoice_number  integer NOT NULL DEFAULT 0,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.platform_counters (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION next_vilo_invoice_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO platform_counters (id, last_invoice_number)
  VALUES (true, 1)
  ON CONFLICT (id) DO UPDATE
    SET last_invoice_number = platform_counters.last_invoice_number + 1,
        updated_at = now()
  RETURNING last_invoice_number INTO v_next;

  RETURN 'VILO-INV' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 4, '0');
END;
$$;

-- ─── 2. vilo_invoices ──────────────────────────────────────────────────
CREATE TABLE public.vilo_invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number     text NOT NULL UNIQUE,

  -- What this invoice settles. One of order/subscription will be set.
  ledger_id          uuid REFERENCES platform_ledger(id) ON DELETE SET NULL,
  order_id           uuid REFERENCES product_orders(id) ON DELETE SET NULL,
  subscription_id    uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  user_id            uuid REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Frozen at issue time so historic invoices never change.
  vilo_snapshot      jsonb NOT NULL,   -- Vilo business details (issuer)
  buyer_snapshot     jsonb NOT NULL,   -- the paying user (name, email)
  line_items         jsonb NOT NULL DEFAULT '[]'::jsonb,

  subtotal           numeric NOT NULL DEFAULT 0,
  vat_amount         numeric NOT NULL DEFAULT 0,
  total_amount       numeric NOT NULL DEFAULT 0,
  currency           text NOT NULL DEFAULT 'ZAR',

  status             text NOT NULL DEFAULT 'paid'
                          CHECK (status IN ('issued','paid','cancelled')),
  environment        text NOT NULL DEFAULT 'live'
                          CHECK (environment IN ('test','live')),

  issued_at          timestamptz NOT NULL DEFAULT now(),
  paid_at            timestamptz,
  pdf_storage_path   text,
  hosted_token       text NOT NULL UNIQUE DEFAULT gen_url_token(),

  created_at         timestamptz NOT NULL DEFAULT now()
);

-- One invoice per ledger entry (idempotent settlement).
CREATE UNIQUE INDEX uq_vilo_invoices_ledger ON public.vilo_invoices(ledger_id)
  WHERE ledger_id IS NOT NULL;
CREATE INDEX idx_vilo_invoices_user  ON public.vilo_invoices(user_id);
CREATE INDEX idx_vilo_invoices_order ON public.vilo_invoices(order_id);

ALTER TABLE public.vilo_invoices ENABLE ROW LEVEL SECURITY;

-- The buyer may read their own invoices (Transaction History tab). The public
-- token page + all writes go through the service-role client (RLS bypassed).
CREATE POLICY vilo_invoices_own_read ON public.vilo_invoices
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE public.vilo_invoices IS
  'Vilo-issued invoices for product/subscription purchases. Vilo is the issuer (vilo_snapshot). Not the host booking invoice (see invoices).';
COMMENT ON COLUMN public.vilo_invoices.hosted_token IS
  'Random base64url token for the public /vilo-invoice/[token] page + PDF. Anyone with the token can view.';
