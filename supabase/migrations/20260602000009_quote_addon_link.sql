-- Migration: link quote add-on lines back to the catalog.
--
-- quote_addons stored only a label/qty/price snapshot, so the quote detail page
-- couldn't pull the add-on's thumbnail or description for a richer, modern view.
-- Add a nullable addon_id (null = a free-form custom line) so catalog add-ons can
-- join back to `addons` for their image + description, while custom lines still
-- work. Snapshot label/price stay authoritative for the document total.

ALTER TABLE public.quote_addons
  ADD COLUMN IF NOT EXISTS addon_id uuid REFERENCES addons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_addons_addon ON quote_addons (addon_id)
  WHERE addon_id IS NOT NULL;
