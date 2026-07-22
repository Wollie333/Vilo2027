-- The offer shown to HOSTS on a partner's landing page.
--
-- The campaign's `competition` jsonb describes what the PARTNER competes for
-- (prizes, ladder, scoring). Nothing in it says what the host is being offered
-- for signing up, and the landing-page design promises one prominently
-- ("4 months free"). That string existed only in a mockup — no table, no
-- setting — so rendering it would have been the platform asserting a commercial
-- offer nobody could edit and nothing could verify.
--
-- Nullable on purpose: with no offer set the landing page says nothing about
-- pricing rather than inventing something. Never default this to a promise.

alter table public.affiliate_campaigns
  add column if not exists host_offer text;

comment on column public.affiliate_campaigns.host_offer is
  'Short host-facing offer for partner landing pages, e.g. "4 months free". NULL = show no offer claim at all. This is a commercial promise — keep it true.';
