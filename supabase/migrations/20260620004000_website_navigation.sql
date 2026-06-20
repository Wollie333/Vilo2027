-- Website navigation config: top bar, header CTA + behaviour, footer extras and
-- (later) an explicit menu. Additive JSONB on host_websites; defaults to {}.
-- Decoupled from the booking engine — touches only the website feature.

alter table public.host_websites
  add column if not exists navigation jsonb not null default '{}'::jsonb;

comment on column public.host_websites.navigation is
  'Site navigation config: { topBar, header, footer, menu? } — see SiteNavigation.';
