-- =============================================================================
-- Host brochure — upload once, reuse across quotes
-- =============================================================================
-- A host uploads a brochure PDF ONCE; it's saved on their account
-- (host_business_details, next to the logo) and can be optionally attached to
-- any quote. When attached, the path/name are SNAPSHOT onto the quote so the
-- guest download route stays self-contained + token-gated (mirrors the
-- quote_type='upload' attachment). The file lives in a PRIVATE bucket served via
-- server-generated signed URLs — never a public URL.
-- -----------------------------------------------------------------------------

-- The host's reusable brochure (one per account — stored on the host row so it's
-- unambiguously account-level, independent of how many businesses a host has).
alter table public.hosts
  add column if not exists brochure_path text,
  add column if not exists brochure_name text;

comment on column public.hosts.brochure_path is
  'Storage object path in the private host-brochures bucket. NULL = none uploaded.';
comment on column public.hosts.brochure_name is
  'Original filename of the host brochure, for display + download.';

-- Snapshot of the brochure attached to a specific quote (guest-visible download).
alter table public.quotes
  add column if not exists brochure_path text,
  add column if not exists brochure_name text;

comment on column public.quotes.brochure_path is
  'Snapshot of the host brochure attached to this quote (private host-brochures bucket).';
comment on column public.quotes.brochure_name is
  'Original filename of the attached brochure, for display + download.';

-- Private bucket — no public access. Uploads + downloads go through the service
-- role (server actions verify host ownership / guest accept-token first), so no
-- RLS object policies are granted here (the bucket stays fully locked down).
insert into storage.buckets (id, name, public)
values ('host-brochures', 'host-brochures', false)
on conflict (id) do update set public = false;
