-- Capture WHY a guest declined a quote, so the quote sender (host) learns from
-- it. A structured reason (dropdown) + an optional free-text note, recorded on
-- the quote and surfaced on the host's timeline / decline email / thread card.

alter table public.quotes add column if not exists decline_reason text;
alter table public.quotes add column if not exists decline_note text;

comment on column public.quotes.decline_reason is
  'Structured reason the guest chose when declining (e.g. price_too_high).';
comment on column public.quotes.decline_note is
  'Optional free-text message the guest left for the host when declining.';
