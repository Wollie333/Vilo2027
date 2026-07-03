-- Looking-For posts: let a guest attach one image to their request.
-- Adds an optional image_url column + a public bucket to hold the uploads,
-- with a 5 MB size cap enforced at the storage layer and owner-scoped writes.

alter table looking_for_posts
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'looking-for-images',
  'looking-for-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Path convention: <user_id>/<filename>. Policies key off the first path
-- segment matching auth.uid().
drop policy if exists "lf-images: public read"  on storage.objects;
drop policy if exists "lf-images: owner write"  on storage.objects;
drop policy if exists "lf-images: owner update" on storage.objects;
drop policy if exists "lf-images: owner delete" on storage.objects;

-- Public read so <img src=publicUrl> works without a signed URL.
create policy "lf-images: public read"
  on storage.objects for select
  using (bucket_id = 'looking-for-images');

create policy "lf-images: owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'looking-for-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "lf-images: owner update"
  on storage.objects for update
  using (
    bucket_id = 'looking-for-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "lf-images: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'looking-for-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
