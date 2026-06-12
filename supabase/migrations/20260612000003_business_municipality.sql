-- Migration: capture the local municipality alongside the town/city.
--
-- In South Africa the OSM geocoder returns the municipality (e.g. "Thaba Chweu
-- Local Municipality") in the city slot. The picker now routes the real town
-- into city and the municipality into its own field — store it so the info
-- isn't lost (useful on records/invoices) without polluting the town.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS municipality text;

ALTER TABLE public.host_personal_details
  ADD COLUMN IF NOT EXISTS municipality text;
