-- One booking per quote (sweep finding #6).
--
-- acceptAndConvertQuote had a check-then-insert race: two concurrent accepts of
-- the same 'sent' accommodation quote (double-click, or the portal action and the
-- public-token action firing together) both read converted_booking_id=null and
-- both INSERT a booking — producing two bookings, two pending deposit payments,
-- and an orphaned booking the quote no longer points at. bookings.quote_id had
-- only a plain (non-unique) index, so nothing stopped the second insert.
--
-- This partial UNIQUE index makes a second booking for the same quote fail at the
-- storage layer; the accept helper catches the unique violation and returns the
-- winning booking idempotently.
create unique index if not exists uq_bookings_quote_id
  on public.bookings (quote_id)
  where quote_id is not null;
