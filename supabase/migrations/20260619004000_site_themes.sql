-- Themes-as-data (Phase 1): a platform catalogue of website themes.
--
-- A theme is a data bundle: a visual `base` (resolved SitePreset — palette/font/
-- radius + element-preset defaults) plus `page_templates` (pre-built pages). The
-- Brand Studio reads these instead of the hardcoded SITE_PRESETS map; when a host
-- applies a theme (Phase 2) its base is COPIED into host_websites.theme so the
-- renderer's pure buildSiteVars() reads it directly (no async lookup in render).
--
-- The 6 built-in presets are seeded here as the initial free themes, so nothing
-- changes visually for existing sites (and the code keeps SITE_PRESETS as a
-- fallback). page_templates is empty for now (seeded in Phase 2).

create table if not exists public.site_themes (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  description        text,
  preview_image_path text,
  -- Visual base: a SitePreset { label, palette{...}, font, radius } + (later)
  -- element-preset defaults (card/image/button/hero/social/icon).
  base               jsonb not null default '{}'::jsonb,
  -- [{ kind, slug, title, nav_label, nav_order, show_in_nav, sections[] }]
  page_templates     jsonb not null default '[]'::jsonb,
  is_active          boolean not null default true,
  is_premium         boolean not null default false,
  price              numeric,
  currency           text not null default 'ZAR',
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists site_themes_active_idx
  on public.site_themes (is_active, sort_order)
  where deleted_at is null;

create trigger site_themes_updated_at
  before update on public.site_themes
  for each row execute function update_updated_at();

alter table public.site_themes enable row level security;

-- Active themes are readable (the host theme gallery + Brand Studio); admin
-- manages them. Admin server actions use the service-role client (bypasses RLS).
create policy site_themes_read ON public.site_themes
  for select using (is_active and deleted_at is null);
create policy site_themes_admin_all ON public.site_themes
  for all using (is_super_admin());

-- Which catalogue theme is currently applied to a site (for "current theme" +
-- re-apply). The live design still lives in host_websites.theme (copied on
-- apply); this is a reference, nullable for legacy/never-applied sites.
alter table public.host_websites
  add column if not exists theme_id uuid references public.site_themes (id) on delete set null;

-- ── Seed the 6 built-in presets as free themes (idempotent) ──
insert into public.site_themes (slug, name, base, sort_order) values
  ('classic', 'Classic',
   '{"label":"Classic","palette":{"bg":"#FBF9F5","surface":"#FFFFFF","ink":"#2A2622","mute":"#7A716A","line":"#E9E2D8","accent":"#1F6F54","accentInk":"#FFFFFF"},"font":"elegant","radius":"md"}'::jsonb,
   1),
  ('modern', 'Modern',
   '{"label":"Modern","palette":{"bg":"#FFFFFF","surface":"#F6F7F9","ink":"#11161C","mute":"#5C6773","line":"#E5E9EE","accent":"#1F6FEB","accentInk":"#FFFFFF"},"font":"sans","radius":"lg"}'::jsonb,
   2),
  ('coastal', 'Coastal',
   '{"label":"Coastal","palette":{"bg":"#F4FAFC","surface":"#FFFFFF","ink":"#0E2A33","mute":"#5A7A82","line":"#D5E8EE","accent":"#0E8FB0","accentInk":"#FFFFFF"},"font":"sans","radius":"xl"}'::jsonb,
   3),
  ('warm', 'Warm',
   '{"label":"Warm","palette":{"bg":"#FCF6F1","surface":"#FFFFFF","ink":"#34201A","mute":"#8A6F63","line":"#EEDFD4","accent":"#C2522E","accentInk":"#FFFFFF"},"font":"serif","radius":"md"}'::jsonb,
   4),
  ('minimal', 'Minimal',
   '{"label":"Minimal","palette":{"bg":"#FFFFFF","surface":"#FAFAFA","ink":"#0A0A0A","mute":"#6B6B6B","line":"#E6E6E6","accent":"#0A0A0A","accentInk":"#FFFFFF"},"font":"sans","radius":"none"}'::jsonb,
   5),
  ('nightfall', 'Nightfall',
   '{"label":"Nightfall","palette":{"bg":"#0E1116","surface":"#171B22","ink":"#F3EEE3","mute":"#A0A7B2","line":"#2A2F38","accent":"#CBA653","accentInk":"#14110D"},"font":"elegant","radius":"md"}'::jsonb,
   6)
on conflict (slug) do nothing;
