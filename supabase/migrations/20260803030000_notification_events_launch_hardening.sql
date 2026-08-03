-- Launch-hardening notification catalog changes (host booking loop).
--
-- Two events were firing NOTHING to the guest and are now wired end-to-end in the
-- app (registry + template + resolver + dispatch); this seeds their admin-facing
-- notification_events rows so the Communications hub can list + override them:
--   • booking_dates_changed_guest — the host moved a booking's dates
--     (changeBookingDatesAction) and the guest was never told.
--   • review_response_guest — the host replied to a guest's review
--     (replyToReviewAction) and the guest was never told.
--
-- One event is removed: refund_admin_override_host is moot in Model 2 — the
-- platform has no refund authority, so an admin-forced-refund event can never
-- fire. Its registry/template/resolver/catalog code is deleted; this drops the DB
-- row (and any stray admin override for it) so the hub stops listing a dead event.
--
-- The dispatcher writes category_id/event_kind as free text (no FK), so the app
-- code already works without these rows — this only keeps the admin surface honest.

-- ─── 1. Seed the two new guest events ──────────────────────────────────
INSERT INTO public.notification_events
  (kind, category_id, feature, severity, email_template_key,
   push_supported, in_app_supported, human_label, human_description)
VALUES
  ('booking_dates_changed_guest', 'bookings', 'booking', 'high',
   'booking_dates_changed_guest', true, true,
   'Booking dates changed',
   'Sent to the guest when the host moves the stay dates (change-dates action) — old → new dates, updated total.'),

  ('review_response_guest', 'reviews', 'review', 'default',
   'review_response_guest', true, true,
   'Host replied to review',
   'Sent to the guest the first time the host responds to their review.')
ON CONFLICT (kind) DO UPDATE
  SET category_id        = EXCLUDED.category_id,
      feature            = EXCLUDED.feature,
      severity           = EXCLUDED.severity,
      email_template_key = EXCLUDED.email_template_key,
      push_supported     = EXCLUDED.push_supported,
      in_app_supported   = EXCLUDED.in_app_supported,
      human_label        = EXCLUDED.human_label,
      human_description  = EXCLUDED.human_description;

-- ─── 2. Retire the dead refund-override event ──────────────────────────
DELETE FROM public.notification_overrides WHERE event_kind = 'refund_admin_override_host';
DELETE FROM public.notification_events    WHERE kind       = 'refund_admin_override_host';
