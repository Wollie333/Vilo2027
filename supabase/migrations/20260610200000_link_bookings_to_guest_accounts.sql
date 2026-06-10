-- Migration: link existing bookings to their guest account by email.
--
-- Symptom: a quote converted to a booking 404'd on /portal/trips/[id]. The
-- portal trip page is RLS-scoped to guest_id = auth.uid(), but a quote carries
-- only an email (no guest_id), so the converted booking landed with guest_id
-- NULL and the guest could never open it — even though they have an account.
--
-- The convert paths (convertQuoteAction + acceptAndConvertQuote) now resolve
-- guest_id by email at create time. This backfills the bookings already made:
-- any booking with a NULL guest_id whose guest_email matches a registered
-- account is linked to it. Email is the canonical guest identity
-- (BUSINESS_PRINCIPLES #1), so this is safe — it never invents a link, it only
-- attaches a booking to the real account that already owns that email.
--
-- Account-less guests (no user_profiles row for the email) are left NULL — they
-- have no portal login to view a trip with anyway.

WITH acct AS (
  -- One account per lowercased email (oldest wins on the rare dup).
  SELECT DISTINCT ON (lower(email)) lower(email) AS lemail, id
  FROM user_profiles
  WHERE email IS NOT NULL AND trim(email) <> ''
  ORDER BY lower(email), created_at
)
UPDATE bookings b
   SET guest_id = acct.id
  FROM acct
 WHERE b.guest_id IS NULL
   AND b.guest_email IS NOT NULL
   AND lower(b.guest_email) = acct.lemail
   AND b.deleted_at IS NULL;
