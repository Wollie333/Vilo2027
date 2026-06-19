-- Phase 2.5: design restore points (safety net) + default theme.
--
-- Applying a theme is destructive (replaces pages + resets design), so a host
-- must be able to roll back. A restore point snapshots the live design (theme +
-- brand) + all pages, so switching themes is always reversible and there's a
-- one-click guaranteed-working state. Auto points are captured before every
-- theme switch; manual points are "Save this design".

create table if not exists public.website_restore_points (
  id          uuid primary key default gen_random_uuid(),
  website_id  uuid not null references public.host_websites (id) on delete cascade,
  label       text,
  theme_slug  text,
  -- { theme, brand, pages:[{kind,slug,title,nav_label,nav_order,show_in_nav,sections}] }
  snapshot    jsonb not null,
  kind        text not null default 'manual', -- 'manual' | 'auto_switch'
  created_at  timestamptz not null default now()
);

create index if not exists website_restore_points_site_idx
  on public.website_restore_points (website_id, created_at desc);

alter table public.website_restore_points enable row level security;

create policy website_restore_points_owner_all on public.website_restore_points
  for all
  using (
    website_id in (
      select id from public.host_websites where host_id = get_my_host_id()
    )
  )
  with check (
    website_id in (
      select id from public.host_websites where host_id = get_my_host_id()
    )
  );
create policy website_restore_points_admin_all on public.website_restore_points
  for all using (is_super_admin());

-- One theme is THE default — the guaranteed-working "reset to default" target.
alter table public.site_themes
  add column if not exists is_default boolean not null default false;

-- Until the flagship free themes ship (Phase 6), Classic is the default.
update public.site_themes set is_default = true where slug = 'classic';
