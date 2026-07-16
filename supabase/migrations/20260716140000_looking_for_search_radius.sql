-- Looking-For posts: optional search radius (km) around the pinned location.
-- The guest create form now drops a map pin (location_lat/location_lng already
-- exist) and picks a radius; hosts see "within N km of <place>". Nullable — a
-- post can still be region-only or anywhere.
alter table public.looking_for_posts
  add column if not exists search_radius_km numeric;

comment on column public.looking_for_posts.search_radius_km is
  'Optional search radius in km around (location_lat, location_lng). NULL = no radius (region/text only).';
