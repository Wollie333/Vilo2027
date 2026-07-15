-- =============================================================================
-- quote_view_events — add a 'kind' to also record DOWNLOADS (not just opens)
-- =============================================================================
-- The host quote record shows when a guest OPENED the quote. We now also record
-- when the guest DOWNLOADS it (the generated PDF, or the uploaded file for an
-- 'upload' quote) so the host sees a "Downloaded" signal alongside "Viewed".
-- Both are guest-engagement events on the same quote, so they share this table
-- with a 'kind' discriminator. Existing rows are opens → default 'view'.
-- Recorded by the service role on the token-gated guest routes only (never the
-- host's own dashboard download), so no new RLS is needed.
-- -----------------------------------------------------------------------------

alter table public.quote_view_events
  add column if not exists kind text not null default 'view';

alter table public.quote_view_events
  drop constraint if exists quote_view_events_kind_check;
alter table public.quote_view_events
  add constraint quote_view_events_kind_check
  check (kind in ('view', 'download'));

comment on column public.quote_view_events.kind is
  'view = guest opened the quote page · download = guest downloaded the PDF/file.';
