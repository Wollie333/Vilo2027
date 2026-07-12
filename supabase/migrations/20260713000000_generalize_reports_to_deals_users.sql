-- Generalize the report/flag feature (was listing-only, F1) so guests can report
-- a LISTING, a DEAL (special) or a USER with the same modal — each categorised by
-- where it was clicked. All reports still land in listing_reports and are triaged
-- in the admin Moderation area, now tabbed by category.
--
-- Polymorphic target: target_type + target_id (+ a frozen target_label snapshot).
-- property_id is kept (nullable) so listing reports retain their FK cascade and
-- the existing admin "open listing" link keeps working.

ALTER TABLE public.listing_reports
  ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'listing'
    CHECK (target_type IN ('listing', 'deal', 'user')),
  ADD COLUMN IF NOT EXISTS target_id uuid,
  ADD COLUMN IF NOT EXISTS target_label text;

-- Backfill existing rows (all are listings) onto the polymorphic columns.
UPDATE public.listing_reports
  SET target_id = COALESCE(target_id, property_id),
      target_label = COALESCE(target_label, listing_name)
  WHERE target_id IS NULL;

-- Deals/users have no property, so property_id is now optional; target_id is the
-- single required pointer.
ALTER TABLE public.listing_reports ALTER COLUMN property_id DROP NOT NULL;
ALTER TABLE public.listing_reports ALTER COLUMN target_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listing_reports_target
  ON public.listing_reports(target_type, target_id);
