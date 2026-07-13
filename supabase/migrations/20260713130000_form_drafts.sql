-- Auto-save drafts (Layer B — durable, cross-device).
--
-- A generic recovery store for in-progress editor work. When a host is mid-way
-- through creating/editing an entity (add-on, special, room, coupon, …) and
-- leaves without saving, the editor persists the live form state here so it can
-- be resumed later on any device. This is a RECOVERY layer, distinct from an
-- entity's own intentional `draft` status.
--
-- One live draft per (user, entity_type, entity_id, scope_id) target. entity_id
-- is null for a brand-new create; scope_id disambiguates (e.g. two "new room"
-- drafts under different properties). NULLS NOT DISTINCT (PG15) makes the unique
-- target work even when entity_id / scope_id are null, so upserts are stable.

create table if not exists public.form_drafts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id   uuid,
  scope_id    uuid,
  payload     jsonb not null,
  updated_at  timestamptz not null default now(),
  constraint form_drafts_target_uniq
    unique nulls not distinct (user_id, entity_type, entity_id, scope_id)
);

comment on table public.form_drafts is
  'Auto-save recovery store for in-progress editor forms (Layer B). One live draft per (user, entity_type, entity_id, scope_id).';

create index if not exists form_drafts_user_type_idx
  on public.form_drafts (user_id, entity_type);

-- RLS: a user can only ever see or touch their own drafts.
alter table public.form_drafts enable row level security;

drop policy if exists form_drafts_owner_select on public.form_drafts;
create policy form_drafts_owner_select on public.form_drafts
  for select using (auth.uid() = user_id);

drop policy if exists form_drafts_owner_insert on public.form_drafts;
create policy form_drafts_owner_insert on public.form_drafts
  for insert with check (auth.uid() = user_id);

drop policy if exists form_drafts_owner_update on public.form_drafts;
create policy form_drafts_owner_update on public.form_drafts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists form_drafts_owner_delete on public.form_drafts;
create policy form_drafts_owner_delete on public.form_drafts
  for delete using (auth.uid() = user_id);
