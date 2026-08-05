-- Broadcast banner display controls + editability.
--
-- Before: whether a broadcast showed as a banner was implied by severity
-- (critical/warning = banner, info = bell only). Admins had no explicit control
-- over the banner, where it showed, or how it was dismissed.
--
-- After: severity drives ONLY the colour, the bell notification, and the
-- critical email. Whether a broadcast ALSO appears as a banner — on which
-- surface, and how a viewer closes it — is explicit and independent of severity.
--
-- NOTE: this migration was authored + applied DIRECTLY to the remote on
-- 2026-08-05 ~12:00 UTC (outside this repo, likely a parallel session). The file
-- was reconstructed from the remote's recorded statements so the repo history is
-- complete. It is already applied on the remote (db push skips it); every
-- statement is guarded (if not exists / drop … if exists) so a fresh rebuild is
-- safe.

alter table public.broadcast_announcements
  add column if not exists show_banner boolean not null default false,
  add column if not exists banner_surfaces text[] not null default '{}'::text[],
  add column if not exists banner_dismiss_mode text not null default 'dismissible',
  add column if not exists updated_at timestamptz;

-- Dismiss mode is a small closed set.
--   dismissible → viewer can close it; stays closed for them (dismissed_at).
--   acknowledge → viewer must click to confirm before it closes (acknowledged_at).
--   persistent  → no close control; shows for the whole active window.
alter table public.broadcast_announcements
  drop constraint if exists broadcast_banner_dismiss_mode_check;

alter table public.broadcast_announcements
  add constraint broadcast_banner_dismiss_mode_check
  check (banner_dismiss_mode in ('dismissible', 'acknowledge', 'persistent'));

-- Surfaces must be a subset of the known surfaces, and a banner that is switched
-- on must name at least one surface (can't "show a banner" nowhere).
alter table public.broadcast_announcements
  drop constraint if exists broadcast_banner_surfaces_check;

alter table public.broadcast_announcements
  add constraint broadcast_banner_surfaces_check
  check (
    banner_surfaces <@ array['dashboard', 'public']::text[]
    and (not show_banner or coalesce(array_length(banner_surfaces, 1), 0) >= 1)
  );

-- Preserve existing behaviour: warning/critical broadcasts already rendered as
-- dashboard banners. Mark them show_banner on the dashboard surface, with the
-- dismiss mode that matched their old severity-driven behaviour (critical was
-- must-acknowledge, warning was dismissible). Info stays bell-only.
update public.broadcast_announcements
  set show_banner = true,
      banner_surfaces = '{dashboard}'::text[],
      banner_dismiss_mode = case
        when severity = 'critical' then 'acknowledge'
        else 'dismissible'
      end
  where severity in ('warning', 'critical')
    and show_banner = false;

-- Public-site banner read for anonymous + authenticated visitors. Additive to
-- the existing broadcast_recipients_select (RLS SELECT policies OR together).
-- Only public-surface, active-window banners aimed at everyone/guests are
-- exposed to anon — never staff/super_admin/host-only broadcasts.
drop policy if exists broadcast_public_banner_select on public.broadcast_announcements;

create policy broadcast_public_banner_select
  on public.broadcast_announcements
  for select
  to anon, authenticated
  using (
    show_banner
    and 'public' = any (banner_surfaces)
    and cancelled_at is null
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
    and audience in ('all', 'guests')
  );
