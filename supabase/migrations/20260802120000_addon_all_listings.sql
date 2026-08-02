-- Host-global add-ons. A host can mark an add-on as offered on EVERY one of
-- their listings (current and future) without attaching it per-listing via
-- property_addons. The booking page unions these in listing-wide.
--
-- Idempotent (IF NOT EXISTS): this column is applied to the live linked DB
-- ahead of the batched host-hardening migration push so the feature can be
-- verified; the batched push then re-runs this file harmlessly.
ALTER TABLE public.addons
  ADD COLUMN IF NOT EXISTS applies_to_all_listings boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.addons.applies_to_all_listings IS
  'When true, this add-on is offered listing-wide on EVERY one of the host''s current and future listings, in addition to any explicit property_addons rows.';
