-- Property publication channels — the three-card "Channels" model on the
-- property editor. Booking management is a distinct channel from the Wielo
-- directory (properties.is_published) and the host website (website_properties
-- membership). This migration adds the per-property booking-management switch
-- plus the external website link used by directory-only listings.
--
--   direct_booking_enabled — whether this property may use the internal booking
--     system / accept direct bookings. Default TRUE so every existing property
--     keeps booking on. The public booking paths enforce this server-side; when
--     it is off the listing offers a quote request + an external "Go to website"
--     link instead of instant checkout.
--   external_website_url — the host's own website link, surfaced as
--     "Go to website" on a directory-only (booking-disabled) listing.

alter table public.properties
  add column if not exists direct_booking_enabled boolean not null default true,
  add column if not exists external_website_url text;

comment on column public.properties.direct_booking_enabled is
  'Booking-management channel: this property may use the internal booking system / accept direct bookings. When false the public listing shows a quote request + external website link instead of instant checkout.';
comment on column public.properties.external_website_url is
  'Host external website URL, shown as "Go to website" on a directory-only (direct_booking_enabled = false) listing.';
