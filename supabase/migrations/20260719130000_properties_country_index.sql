-- The public directory can prioritise/filter listings by country (visitor's
-- country auto-detected, overridable). That adds equality filters + counts on
-- properties.country, which today only participates in the search_vector GIN
-- index. Add a plain btree so the country-bucket counts stay cheap as the
-- directory grows beyond one country.

CREATE INDEX IF NOT EXISTS idx_properties_country
  ON public.properties (country)
  WHERE is_published = true AND deleted_at IS NULL;
