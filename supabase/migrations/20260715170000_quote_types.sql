-- =============================================================================
-- Quotes — quote types (accommodation / custom / upload)
-- =============================================================================
-- Foundation for the Looking-For quote-types redesign
-- (docs/features/LOOKING_FOR_QUOTE_TYPES_AND_OFFLINE_SYSTEM_PLAN.md).
-- A quote is no longer always an accommodation stay:
--   • 'accommodation' — today's calendar-integrated quote (listing + dates).
--   • 'custom'        — a line-item quote with NO listing/calendar (e.g. an
--                       Experience/safari, or a group arrangement).
--   • 'upload'        — a finished quote file attached off-platform (later phase).
-- So listing + dates become OPTIONAL, and a free-text title carries the headline
-- when there's no listing name. Existing rows default to 'accommodation' and keep
-- their listing/dates, so nothing changes for them. Pre-MVP: reshape freely.
--
-- NB: quotes.property_id/check_in/check_out are the CURRENT names (renamed from
-- listing_id in 20260617000300). The quote_dates_chk (check_out > check_in) is
-- null-safe: NULL > NULL is NULL, which a CHECK treats as satisfied.
-- -----------------------------------------------------------------------------

alter table public.quotes
  add column if not exists quote_type text not null default 'accommodation',
  add column if not exists title text;

alter table public.quotes
  drop constraint if exists quotes_quote_type_check;
alter table public.quotes
  add constraint quotes_quote_type_check
  check (quote_type in ('accommodation', 'custom', 'upload'));

-- Listing + dates are only required for accommodation quotes now.
alter table public.quotes alter column property_id drop not null;
alter table public.quotes alter column check_in   drop not null;
alter table public.quotes alter column check_out  drop not null;

comment on column public.quotes.quote_type is
  'accommodation (listing+dates) | custom (line items, no calendar) | upload (attached file)';
comment on column public.quotes.title is
  'Headline for custom/upload quotes that have no listing name.';
