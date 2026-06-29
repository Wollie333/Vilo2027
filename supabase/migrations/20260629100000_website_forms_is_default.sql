-- Website CMS — flag the seeded default forms so the dashboard can protect them.
--
-- On site creation we seed four forms (Contact us / Get a quote / Booking request
-- / Newsletter signup) from FORM_TEMPLATES. `is_default` marks those rows so the
-- UI keeps them EDITABLE but NEVER-DELETE (a host can rename/restyle them, but
-- can't remove the building blocks the auto-placed sections depend on). Bespoke
-- forms the host adds later are is_default = false.
--
-- Additive, nullable-free with a safe default — existing rows become false.

ALTER TABLE public.website_forms
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.website_forms.is_default IS
  'True for the forms seeded on site creation (contact/quote/booking/newsletter). The dashboard keeps these editable but never-delete; bespoke host forms are false.';
