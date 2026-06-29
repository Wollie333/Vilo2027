-- Website CMS — log on-site bookings into the Forms submissions area.
--
-- The room booking dock and the on-site checkout create real bookings but never
-- a website_form_submissions row, so the host can't see those leads alongside
-- their form responses. This reshapes the table so a submission can represent a
-- booking that has no form behind it:
--
--   1. form_id becomes NULLABLE  — a dock/checkout booking has no source form.
--   2. source                    — distinguishes a form submission from a
--                                   booking-dock / checkout entry.
--   3. booking_id                — links the entry to the booking it created
--                                   (SET NULL if that booking is later removed),
--                                   so the submissions viewer can deep-link.
--
-- Pre-MVP reshape (CLAUDE.md): the table holds no production data, so dropping
-- the NOT NULL is safe. Existing rows keep source = 'form', booking_id = null.

ALTER TABLE public.website_form_submissions
  ALTER COLUMN form_id DROP NOT NULL;

ALTER TABLE public.website_form_submissions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'form'
    CHECK (source IN ('form', 'dock', 'checkout')),
  ADD COLUMN IF NOT EXISTS booking_id uuid
    REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_website_form_subs_booking
  ON public.website_form_submissions(booking_id);

COMMENT ON COLUMN public.website_form_submissions.source IS
  'Where the entry came from: form (a website_forms submission), dock (the room booking dock) or checkout (the on-site checkout). dock/checkout rows have a null form_id and a booking_id.';
COMMENT ON COLUMN public.website_form_submissions.booking_id IS
  'The booking this entry created, for dock/checkout sources (null for form submissions).';
