-- Per-room detail overrides — the host's OPTIONAL customization for a single
-- room, layered over the shared `room_detail` template (sections layer; see
-- apps/web/lib/website/roomDetailOverride.ts). Empty/absent = the room renders
-- the pure template, so the template keeps driving the design and its edits
-- propagate to every room; a room only diverges where the host edits it.
--
-- Additive + nullable (pre-MVP additive policy): existing rooms are unaffected
-- and render the pure template until the host customizes them.
alter table public.website_rooms
  add column if not exists detail_overrides jsonb;

comment on column public.website_rooms.detail_overrides is
  'Per-room overrides layered over the room_detail template: { hidden: string[], replaced: Record<sectionId, Section>, extras: Section[] }. Null/empty = pure template.';
