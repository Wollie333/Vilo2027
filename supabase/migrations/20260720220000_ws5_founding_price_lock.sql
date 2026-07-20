-- WS-5 (5a + 5c) — Founding price-lock + per-listing config (all additive).
--
-- MONEY change. The lock makes a subscription's price the SOURCE OF TRUTH: once a
-- host is on Founding pricing, later edits to the product's list price never leak
-- into their charge. Non-Founding hosts keep billing the live product price.
--
-- Prices are ADMIN-EDITABLE CONFIG, never hardcoded (strategy §271): list prices
-- live on the `products` row; the Founding price is captured onto the subscription
-- `locked_*` columns at provisioning (strategy §5c). We seed the documented v4
-- numbers here — R999 list / R599 Founding / R499 Founding-annual, per-listing
-- R299 / R179 (proposed) — but they remain editable in Admin → Products.
--
-- Per-listing rule (strategy §5.6 boundary): the first listing is included in the
-- base; each ADDITIONAL listing adds the per-listing amount. Additional listings
-- are NOT covered by the lifetime lock as "free", but the host's per-listing RATE
-- is locked (locked_per_listing_amount) so it can't be raised on them either.

-- ─── subscriptions: the lock ─────────────────────────────────────
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_founding boolean NOT NULL DEFAULT false,
  -- The locked BASE amount for THIS subscription's billing_cycle (e.g. 599 for a
  -- monthly Founding host, 5988 for an annual one). NULL = not locked → bill the
  -- live product price.
  ADD COLUMN IF NOT EXISTS locked_base_amount numeric,
  -- The locked per-ADDITIONAL-listing amount, stored as a MONTHLY figure (the
  -- resolver annualises it ×12 for annual cycles).
  ADD COLUMN IF NOT EXISTS locked_per_listing_amount numeric,
  ADD COLUMN IF NOT EXISTS locked_currency text,
  ADD COLUMN IF NOT EXISTS price_locked_at timestamptz;

COMMENT ON COLUMN public.subscriptions.locked_base_amount IS
  'WS-5 Founding lock: the frozen base charge for this cycle. When set, billing uses this instead of the live product price. NULL = follow product price.';
COMMENT ON COLUMN public.subscriptions.locked_per_listing_amount IS
  'WS-5 Founding lock: frozen per-additional-listing amount (MONTHLY figure; annualised ×12 for annual subs).';

-- Guard: a currency, if set, must be ZAR (Plane B is always ZAR — MODEL-2).
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_locked_currency_zar;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_locked_currency_zar
  CHECK (locked_currency IS NULL OR locked_currency = 'ZAR');

-- ─── products: list + Founding pricing config ────────────────────
ALTER TABLE public.products
  -- List per-additional-listing amount (monthly figure). 0 = additional listings
  -- are free on this product (back-compat default for non-membership products).
  ADD COLUMN IF NOT EXISTS per_listing_amount numeric NOT NULL DEFAULT 0,
  -- Founding pricing for the one plan (what a Founding host locks in). NULL on a
  -- product with no Founding offer.
  ADD COLUMN IF NOT EXISTS founding_price numeric,
  ADD COLUMN IF NOT EXISTS founding_annual_price numeric,
  ADD COLUMN IF NOT EXISTS founding_per_listing_amount numeric;

COMMENT ON COLUMN public.products.per_listing_amount IS
  'WS-5: list price per ADDITIONAL listing (monthly figure); first listing is included in the base.';
COMMENT ON COLUMN public.products.founding_price IS
  'WS-5: Founding monthly base for this plan (snapshotted onto the subscription lock at provisioning).';

-- ─── Seed the ONE plan (the paid host membership, slug=pro) ───────
-- v4 documented numbers (strategy §5.6). Editable in Admin → Products.
UPDATE public.products
   SET price = 999,
       annual_price = 9990,
       per_listing_amount = 299,
       founding_price = 599,
       founding_annual_price = 5988,
       founding_per_listing_amount = 179,
       updated_at = now()
 WHERE slug = 'pro' AND product_type = 'membership';
