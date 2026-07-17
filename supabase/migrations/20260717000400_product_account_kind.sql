-- =============================================================================
-- Which signup a subscription belongs to.
--
-- Host signup and quote-only signup are different front doors, but the plan
-- picker read the same catalogue, so "Wielo Quotes" (a quote-only membership)
-- showed up as a host plan and a host plan could, in principle, show to a
-- quoter. This classifies each subscription by the account kind it is FOR,
-- mirroring hosts.account_kind ('host' | 'quote_only'), so each signup shows
-- only its own plans.
--
-- Default 'host': every existing membership/service is a host plan unless told
-- otherwise. Only Wielo Quotes is quote-only.
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS account_kind text NOT NULL DEFAULT 'host'
    CHECK (account_kind IN ('host', 'quote_only'));

COMMENT ON COLUMN public.products.account_kind IS
  'The signup this subscription is offered in: host (default) or quote_only. Mirrors hosts.account_kind. Only meaningful for membership/service products.';

-- The one quote-only plan today.
UPDATE public.products
   SET account_kind = 'quote_only'
 WHERE slug = 'wielo-quotes';
