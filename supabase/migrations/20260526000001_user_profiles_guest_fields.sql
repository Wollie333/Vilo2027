-- ─────────────────────────────────────────────────────────────────
-- Extend user_profiles with guest-onboarding fields.
--
-- Today user_profiles only stores full_name/phone/email/avatar/role.
-- The host onboarding parks bio/languages on the hosts row, but guests
-- have no equivalent table, so we add the columns directly to
-- user_profiles. Pre-MVP policy (CLAUDE.md) permits additive changes.
--
-- These columns are also surfaced on the /portal/settings page so guests
-- can edit any of them after onboarding.
-- ─────────────────────────────────────────────────────────────────

alter table public.user_profiles
  add column country          text,
  add column bio              text,
  add column languages        text[] default '{}'::text[] not null,
  add column preferred_cities text[] default '{}'::text[] not null,
  add column marketing_opt_in boolean default false not null;

comment on column public.user_profiles.country is
  'Country name (free text for MVP). Set at guest onboarding, editable from /portal/settings.';
comment on column public.user_profiles.bio is
  'Short self-introduction. Optional. Capped at 240 chars at the app layer.';
comment on column public.user_profiles.languages is
  'Languages the user speaks. Captured for both guests and hosts.';
comment on column public.user_profiles.preferred_cities is
  'Cities the guest wants recommendations for. Powers home + portal personalisation.';
comment on column public.user_profiles.marketing_opt_in is
  'True if the user opted into product/marketing emails at signup.';

-- Storage bucket for avatars (guest onboarding uploads land here).
-- public = readable by anyone with the URL; writes are still gated by RLS.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Owner-only write/read on storage.objects scoped to the avatars bucket.
-- Path convention: <user_id>/<filename>. Policies key off the first path
-- segment matching auth.uid().

drop policy if exists "avatars: owner can read"   on storage.objects;
drop policy if exists "avatars: owner can write"  on storage.objects;
drop policy if exists "avatars: owner can update" on storage.objects;
drop policy if exists "avatars: owner can delete" on storage.objects;
drop policy if exists "avatars: public read"      on storage.objects;

-- Public read so <img src=publicUrl> works without a signed URL.
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: owner can write"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: owner can update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: owner can delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
