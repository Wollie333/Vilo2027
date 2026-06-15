-- Migration: link a subscription to the exact product the user is on.
--
-- subscriptions.plan stays the plan-key FK (drives existing gating); product_id
-- additionally records WHICH product in the catalog is active on the account, so
-- the admin User Record's Products tab can show the active product precisely and
-- bespoke (non-plan-mapped) products can be activated on a user too.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS product_id uuid
    REFERENCES public.products(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.subscriptions.product_id IS
  'The catalog product currently active on this subscription (nullable). plan stays the gating key.';
