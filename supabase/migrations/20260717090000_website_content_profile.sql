-- Content Profile — the host's theme-agnostic website content (canonical slots).
-- Stored as JSONB on host_websites (1 site per business, so effectively per host).
-- The setup wizard writes the host's answers here ONCE; a theme's blueprint binds
-- these slots into its sections at seed/hydrate time, so switching themes re-skins
-- WITHOUT losing content. Shape mirrors lib/website/contentProfile.schema.ts
-- (ContentProfile). Additive + safe: defaults to an empty object, in which case
-- the theme's own demo copy shows through unchanged.

alter table public.host_websites
  add column if not exists content_profile jsonb not null default '{}'::jsonb;

comment on column public.host_websites.content_profile is
  'Theme-agnostic website content (canonical slots) filled by the setup wizard; bound into theme sections at hydrate. See lib/website/contentProfile.schema.ts.';
