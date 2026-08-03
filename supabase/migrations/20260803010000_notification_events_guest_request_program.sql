-- Guest-request program notification catalog rows (pt16–pt17).
--
-- The unified guest-request program added five events that are already wired
-- end-to-end in the app (registry + push/in-app builders + dispatch). The
-- dispatcher writes kind/category_id as free text (no FK), so notifications
-- ALREADY fire without these rows — this seeds their admin-facing
-- notification_events rows so the Communications hub can list, group, and
-- override them, and the guest/host bell-filter tabs resolve their category.
--
-- All five are push + in-app only (no email template) — email_template_key
-- stays NULL. See apps/web/lib/notifications/registry.ts for the source of truth.
--
--   Host-facing (a guest acted on a booking/quote):
--     • booking_change_request_host — guest asked to change dates / add a guest
--     • addon_added_host            — guest attached a paid extra to a booking
--     • quote_response_host         — guest accepted / declined a quote
--   Guest-facing (the host actioned the request):
--     • booking_change_approved_guest — host approved the change request
--     • booking_change_declined_guest — host declined the change request

INSERT INTO public.notification_events
  (kind, category_id, feature, severity, email_template_key,
   push_supported, in_app_supported, human_label, human_description)
VALUES
  ('booking_change_request_host', 'bookings', 'booking', 'high', NULL,
   true, true,
   'Guest requested a booking change',
   'Sent to the host when a guest requests a date change or asks to add a guest to their booking (awaits host approval).'),

  ('addon_added_host', 'bookings', 'booking', 'default', NULL,
   true, true,
   'Guest added an extra',
   'Sent to the host when a guest attaches a paid add-on to their booking — the charge is already on the ledger.'),

  ('quote_response_host', 'quote_requests', 'message', 'high', NULL,
   true, true,
   'Guest responded to a quote',
   'Sent to the host when a guest accepts or declines a quote you sent them.'),

  ('booking_change_approved_guest', 'bookings', 'booking', 'high', NULL,
   true, true,
   'Booking change approved',
   'Sent to the guest when the host approves their date / add-a-guest change request.'),

  ('booking_change_declined_guest', 'bookings', 'booking', 'default', NULL,
   true, true,
   'Booking change not approved',
   'Sent to the guest when the host declines their date / add-a-guest change request.')
ON CONFLICT (kind) DO UPDATE
  SET category_id        = EXCLUDED.category_id,
      feature            = EXCLUDED.feature,
      severity           = EXCLUDED.severity,
      email_template_key = EXCLUDED.email_template_key,
      push_supported     = EXCLUDED.push_supported,
      in_app_supported   = EXCLUDED.in_app_supported,
      human_label        = EXCLUDED.human_label,
      human_description  = EXCLUDED.human_description;
