-- Migration: platform payment settings (Vilo's own merchant config) + per-product
-- accepted payment methods.
--
-- Vilo collects product/subscription payments via its OWN Paystack and/or EFT
-- (distinct from host booking gateways). The admin manages the platform Paystack
-- keys + EFT bank details here; each product declares which methods it accepts
-- (Paystack for most, EFT for larger once-off purchases).

CREATE TABLE public.platform_payment_settings (
  id                   boolean PRIMARY KEY DEFAULT true CHECK (id),  -- singleton row
  paystack_enabled     boolean NOT NULL DEFAULT false,
  paystack_secret_key  text,
  paystack_public_key  text,
  eft_enabled          boolean NOT NULL DEFAULT false,
  eft_bank_name        text,
  eft_account_name     text,
  eft_account_number   text,
  eft_branch_code      text,
  eft_reference_hint   text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Admin-only (service-role). No RLS policy: nothing reaches it via the anon key.
ALTER TABLE public.platform_payment_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_payment_settings (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

-- Which methods each product accepts.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS payment_methods text[] NOT NULL DEFAULT '{paystack}';

COMMENT ON TABLE public.platform_payment_settings IS
  'Vilo''s own merchant config (platform Paystack keys + EFT bank details). Service-role only — never exposed to the anon client.';
COMMENT ON COLUMN public.products.payment_methods IS
  'Accepted methods for this product: any of paystack, eft.';
