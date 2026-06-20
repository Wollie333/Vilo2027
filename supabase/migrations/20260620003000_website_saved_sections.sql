-- Saved sections ("my blocks") — a host's reusable, customised sections.
-- Stored as JSONB on host_websites (1 site per business, so effectively per
-- host). Each entry: { id: uuid, name: text, section: <WebsiteSection> }.
-- Additive + safe: defaults to an empty array.

alter table public.host_websites
  add column if not exists saved_sections jsonb not null default '[]'::jsonb;

comment on column public.host_websites.saved_sections is
  'Reusable saved sections ("my blocks"): array of { id, name, section }.';
