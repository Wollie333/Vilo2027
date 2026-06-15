-- Migration: product orders + pay-links (Vilo platform checkout)
--
-- Mirrors the host booking pay-link, but for Vilo's own products. The admin
-- generates a pay-link for a user; the user pays Vilo via Paystack (card) or EFT.
-- On payment the order is marked paid and a platform_ledger row is posted.

CREATE TABLE public.product_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name       text NOT NULL,
  payer_email        text NOT NULL,
  payer_user_id      uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  amount             numeric NOT NULL,
  currency           text NOT NULL DEFAULT 'ZAR',
  status             text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','paid','cancelled','expired')),
  method             text CHECK (method IN ('paystack','eft')),
  pay_token          text NOT NULL UNIQUE,
  provider_reference text UNIQUE,
  created_by         uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  paid_at            timestamptz
);

CREATE INDEX idx_product_orders_status ON public.product_orders(status, created_at DESC);
CREATE INDEX idx_product_orders_payer ON public.product_orders(payer_user_id);

ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;
-- Admin/service-role + the public pay page (server, service role) only. No anon
-- policy: the token-gated pay page reads via the service-role client.

COMMENT ON TABLE public.product_orders IS
  'A user''s order for a Vilo product, paid via a tokenised pay-link (Paystack or EFT).';
