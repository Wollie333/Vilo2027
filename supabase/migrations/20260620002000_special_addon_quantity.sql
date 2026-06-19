-- Migration: Add quantity to special_addons
--
-- Allows hosts to set a compulsory quantity for add-ons bundled onto a special.
-- For example: "2x Breakfast included" means the guest always gets 2 breakfasts.
-- When is_required = true + quantity = N, N units are auto-included in the package.
-- When is_required = false, quantity is the default offered (guest can adjust).

ALTER TABLE public.special_addons
  ADD COLUMN quantity integer NOT NULL DEFAULT 1
    CHECK (quantity >= 1 AND quantity <= 100);

COMMENT ON COLUMN public.special_addons.quantity IS
  'Number of units bundled. For compulsory add-ons: always included in the package. For optional: default quantity offered at checkout.';
