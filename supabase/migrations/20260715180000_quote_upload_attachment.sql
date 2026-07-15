-- =============================================================================
-- Quotes — uploaded-quote attachment (quote_type = 'upload')
-- =============================================================================
-- The 'upload' quote type lets a host attach a finished quote file (PDF/doc)
-- built in a 3rd-party tool instead of building it in the Wielo builder. Store
-- the object path + original filename on the quote; the file lives in a PRIVATE
-- bucket and is served to the host + the guest (via their accept token) through
-- server-generated signed URLs — never a public URL.
-- -----------------------------------------------------------------------------

alter table public.quotes
  add column if not exists attachment_path text,
  add column if not exists attachment_name text;

comment on column public.quotes.attachment_path is
  'Storage object path in the private quote-uploads bucket (upload quotes only).';
comment on column public.quotes.attachment_name is
  'Original filename of the uploaded quote, for display + download.';

-- Private bucket — no public access. Uploads + downloads go through the service
-- role (server actions verify host ownership / guest accept-token first), so no
-- RLS object policies are granted here (the bucket stays fully locked down).
insert into storage.buckets (id, name, public)
values ('quote-uploads', 'quote-uploads', false)
on conflict (id) do update set public = false;
