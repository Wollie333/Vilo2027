-- Migration: add-on editor enrichment
-- Adds the fields the redesigned add-on archive + editor surface:
--   • category   — groups add-ons in the guest's extras list and the archive filters
--   • vat_included — informational flag ("price already includes 15% VAT")
--   • daily_capacity — max units the host can fulfil per day (stored; soft cap)
-- Pre-MVP: additive, nullable/defaulted, safe on an empty DB.
--
-- DOWN: ALTER TABLE public.addons
--         DROP COLUMN category, DROP COLUMN vat_included, DROP COLUMN daily_capacity;

ALTER TABLE public.addons
  ADD COLUMN IF NOT EXISTS category       text
    CHECK (category IS NULL OR category IN
      ('food_drink','comfort','experiences','transport','romance','flexibility')),
  ADD COLUMN IF NOT EXISTS vat_included   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_capacity integer
    CHECK (daily_capacity IS NULL OR daily_capacity >= 0);

COMMENT ON COLUMN public.addons.category IS
  'Optional grouping for the guest extras list + host archive filters.';
COMMENT ON COLUMN public.addons.vat_included IS
  'Whether the unit price already includes VAT (informational; shown to guests).';
COMMENT ON COLUMN public.addons.daily_capacity IS
  'Max units the host can fulfil per day. Soft cap (not yet enforced at booking).';
