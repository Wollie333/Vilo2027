-- Migration: Vilo Products (Product Manager) — Super-Admin portal
--
-- A unified catalog of what Vilo sells to users (subscriptions + once-off
-- products), consolidating the earlier plans + platform_services concepts. Each
-- product carries: name, details, price, type, duration, feature permissions
-- (product_features) and an affiliate amount (fixed or %). The Vilo ledger keys
-- to products instead of bookings (Phase B).

CREATE TABLE public.products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  type           text NOT NULL DEFAULT 'subscription'
                      CHECK (type IN ('subscription', 'one_off')),
  price          numeric NOT NULL DEFAULT 0,
  currency       text NOT NULL DEFAULT 'ZAR',
  -- Duration for subscriptions; NULL for one-off.
  billing_cycle  text CHECK (billing_cycle IN
                      ('weekly','monthly','quarterly','biannual','annual')),
  is_active      boolean NOT NULL DEFAULT true,
  is_recommended boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  -- Affiliate payout when sold via an affiliate.
  affiliate_type  text NOT NULL DEFAULT 'none'
                       CHECK (affiliate_type IN ('none', 'amount', 'percent')),
  affiliate_value numeric NOT NULL DEFAULT 0,
  bullets        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_active ON public.products(is_active, sort_order);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_public_read ON public.products
  FOR SELECT USING (is_active = true);

-- Feature permissions granted by a product (mirrors plan_features, per product).
CREATE TABLE public.product_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_enabled  boolean NOT NULL DEFAULT true,
  limit_value integer,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_product_feature UNIQUE (product_id, feature_key)
);

CREATE INDEX idx_product_features_product ON public.product_features(product_id);

ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_features_public_read ON public.product_features
  FOR SELECT USING (true);

-- The Vilo revenue ledger can reference a product directly.
ALTER TABLE public.platform_ledger
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

COMMENT ON TABLE public.products IS
  'Vilo''s sellable catalog (subscriptions + once-off). Unifies plans + services; the Vilo ledger keys to these.';
