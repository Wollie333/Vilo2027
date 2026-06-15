-- Migration: Products as the single hub — trial period, display controls, slug.
--
-- - trial_days: free trial length for subscription products.
-- - is_visible: show on the pricing page / signup flow (independent of access).
-- - is_active (existing): whether users can actually buy/access it.
--   → visible+active = live; visible+inactive = shown but disabled;
--     hidden+active = reachable only via its direct link; hidden+inactive = draft.
-- - slug: stable key for each product's standalone payment page (/p/[slug]).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.products.is_visible IS
  'Show on pricing page / signup. Independent of is_active (purchasable).';
COMMENT ON COLUMN public.products.slug IS
  'Stable key for the product''s standalone payment page at /p/[slug].';
