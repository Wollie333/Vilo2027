-- Migration: Seed notification_categories + notification_events.
--
-- These two tables are the canonical taxonomy. The settings UI, bell filter
-- tabs, admin send-history grouping, and dispatcher all read from here —
-- adding a new category / event = INSERT here (no UI code change).
--
-- Pre-MVP (CLAUDE.md + AGENT_RULES.md §3.4):
--   - account_security is is_locked = true → all channels forced on for all roles
--   - admin_broadcasts also implicitly forces critical-severity through
--     (handled at the registry layer; severity='critical' bypasses prefs)
--   - marketing_tips is opt-in (every role defaults to all-off)
--   - every non-locked category defaults to ON per the role's natural fit

-- =========================================================================
-- CATEGORIES (9 rows)
-- =========================================================================

INSERT INTO public.notification_categories
  (id, label, description, icon_name, is_locked, default_for_role, supports_digest, display_order)
VALUES
  ('bookings',
   'Bookings',
   'Booking requests, confirmations, cancellations, and check-in reminders.',
   'Calendar',
   false,
   '{
     "host":  {"email": true,  "push": true,  "in_app": true},
     "guest": {"email": true,  "push": true,  "in_app": true},
     "staff": {"email": true,  "push": true,  "in_app": true},
     "super_admin": {"email": false, "push": false, "in_app": false}
   }'::jsonb,
   false, 10),

  ('payments_refunds',
   'Payments & refunds',
   'Payment confirmations, refund requests, escalations, and EFT updates.',
   'CreditCard',
   false,
   '{
     "host":  {"email": true,  "push": true,  "in_app": true},
     "guest": {"email": true,  "push": true,  "in_app": true},
     "staff": {"email": true,  "push": false, "in_app": true},
     "super_admin": {"email": false, "push": false, "in_app": true}
   }'::jsonb,
   false, 20),

  ('messages',
   'Messages',
   'New inbox messages from guests or hosts. Push on, email off (iMessage pattern).',
   'MessageSquare',
   false,
   '{
     "host":  {"email": false, "push": true, "in_app": true},
     "guest": {"email": false, "push": true, "in_app": true},
     "staff": {"email": false, "push": true, "in_app": true},
     "super_admin": {"email": false, "push": false, "in_app": false}
   }'::jsonb,
   false, 30),

  ('reviews',
   'Reviews',
   'Review requests after stays and notifications when new reviews are published.',
   'Star',
   false,
   '{
     "host":  {"email": true,  "push": false, "in_app": true},
     "guest": {"email": true,  "push": false, "in_app": true},
     "staff": {"email": false, "push": false, "in_app": true},
     "super_admin": {"email": false, "push": false, "in_app": false}
   }'::jsonb,
   true, 40),

  ('calendar_sync',
   'Calendar sync',
   'iCal feed errors and conflict alerts that need your attention.',
   'RefreshCw',
   false,
   '{
     "host":  {"email": true,  "push": true,  "in_app": true},
     "guest": {"email": false, "push": false, "in_app": false},
     "staff": {"email": true,  "push": true,  "in_app": true},
     "super_admin": {"email": false, "push": false, "in_app": false}
   }'::jsonb,
   false, 50),

  ('subscription',
   'Subscription',
   'Plan changes, renewal warnings, payment failures, and account status.',
   'Crown',
   false,
   '{
     "host":  {"email": true,  "push": true,  "in_app": true},
     "guest": {"email": false, "push": false, "in_app": false},
     "staff": {"email": true,  "push": false, "in_app": true},
     "super_admin": {"email": false, "push": false, "in_app": false}
   }'::jsonb,
   false, 60),

  ('account_security',
   'Account & security',
   'Account suspensions, password resets, staff invites, and critical security notices. Always on.',
   'ShieldCheck',
   true,
   '{
     "host":  {"email": true, "push": true, "in_app": true},
     "guest": {"email": true, "push": true, "in_app": true},
     "staff": {"email": true, "push": true, "in_app": true},
     "super_admin": {"email": true, "push": true, "in_app": true}
   }'::jsonb,
   false, 70),

  ('admin_broadcasts',
   'Platform announcements',
   'Site-wide announcements from the Vilo team. Critical notices are always shown.',
   'Megaphone',
   false,
   '{
     "host":  {"email": true, "push": true, "in_app": true},
     "guest": {"email": true, "push": true, "in_app": true},
     "staff": {"email": true, "push": true, "in_app": true},
     "super_admin": {"email": true, "push": true, "in_app": true}
   }'::jsonb,
   false, 80),

  ('marketing_tips',
   'Tips & product updates',
   'New features, tips, and occasional product news. Off by default.',
   'Sparkles',
   false,
   '{
     "host":  {"email": false, "push": false, "in_app": false},
     "guest": {"email": false, "push": false, "in_app": false},
     "staff": {"email": false, "push": false, "in_app": false},
     "super_admin": {"email": false, "push": false, "in_app": false}
   }'::jsonb,
   true, 90);

-- =========================================================================
-- EVENTS (mirrors apps/web/lib/notifications/registry.ts)
-- =========================================================================
-- The `feature` axis exists so the admin-side history / audit views can
-- group by feature (booking / refund / subscription / etc.) independently
-- of the user-facing category. Keep both axes in sync when adding an event.

INSERT INTO public.notification_events
  (kind, category_id, feature, severity, email_template_key,
   push_supported, in_app_supported, human_label, human_description)
VALUES
  -- ─── Onboarding ──────────────────────────────────────────────────────
  ('welcome_host', 'account_security', 'account', 'default', 'welcome_host',
   false, false,
   'Welcome email', 'Sent once when a host completes onboarding.'),

  -- ─── Bookings — host-facing ──────────────────────────────────────────
  ('booking_request_host', 'bookings', 'booking', 'high', 'booking_request_host',
   true, true,
   'New booking request', 'A guest has submitted a booking request awaiting your approval.'),
  ('booking_confirmed_host', 'bookings', 'booking', 'high', 'booking_confirmed_host',
   true, true,
   'Booking confirmed (instant)', 'A guest just instant-booked one of your listings.'),
  ('booking_cancelled_host', 'bookings', 'booking', 'default', 'booking_cancelled_host',
   true, true,
   'Guest cancelled a booking', 'A confirmed booking has been cancelled by the guest.'),
  ('check_in_reminder_host', 'bookings', 'booking', 'default', NULL,
   true, true,
   'Check-in reminder (host)', 'A guest arrives tomorrow.'),

  -- ─── Bookings — guest-facing ────────────────────────────────────────
  ('booking_confirmed_guest', 'bookings', 'booking', 'high', 'booking_confirmed_guest',
   true, true,
   'Your booking is confirmed', 'A host has confirmed your booking.'),
  ('booking_declined_guest', 'bookings', 'booking', 'default', 'booking_declined_guest',
   true, true,
   'Booking declined', 'A host has declined your booking request.'),
  ('booking_cancelled_guest', 'bookings', 'booking', 'high', 'booking_cancelled_guest',
   true, true,
   'Host cancelled your booking', 'A host has cancelled your confirmed booking.'),
  ('check_in_reminder_guest', 'bookings', 'booking', 'default', NULL,
   true, true,
   'Check-in reminder', 'Your check-in is tomorrow.'),

  -- ─── Payments / EFT ─────────────────────────────────────────────────
  ('eft_instructions_guest', 'payments_refunds', 'booking', 'high', 'eft_instructions_guest',
   false, true,
   'EFT payment instructions', 'Bank transfer details for your pending booking.'),
  ('eft_proof_received_host', 'payments_refunds', 'booking', 'high', 'eft_proof_received_host',
   true, true,
   'EFT proof of payment received', 'A guest has uploaded EFT proof. Please verify and confirm.'),
  ('eft_refund_sent_guest', 'payments_refunds', 'refund', 'default', 'eft_refund_sent_guest',
   true, true,
   'EFT refund sent', 'The host marked your EFT refund as sent.'),

  -- ─── Refunds ────────────────────────────────────────────────────────
  ('refund_request_host', 'payments_refunds', 'refund', 'high', 'refund_request_host',
   true, true,
   'Refund request received', 'A guest has requested a refund.'),
  ('refund_approved_guest', 'payments_refunds', 'refund', 'default', 'refund_approved_guest',
   true, true,
   'Refund approved', 'Your refund has been approved.'),
  ('refund_declined_guest', 'payments_refunds', 'refund', 'default', 'refund_declined_guest',
   true, true,
   'Refund declined', 'Your refund has been declined. You may dispute within 14 days.'),
  ('refund_completed_guest', 'account_security', 'refund', 'default', 'refund_completed_guest',
   true, true,
   'Refund completed', 'Your refund has been processed and is on its way.'),
  ('refund_admin_override_host', 'payments_refunds', 'refund', 'high', 'refund_admin_override_host',
   false, true,
   'Refund override applied', 'Vilo support issued a refund on a disputed booking.'),
  ('refund_escalated_admin', 'admin_broadcasts', 'refund', 'high', 'refund_escalated_admin',
   false, false,
   'Refund escalation (admin)', 'A disputed refund has been escalated for admin review.'),

  -- ─── Reviews ────────────────────────────────────────────────────────
  ('review_request_guest', 'reviews', 'review', 'info', 'review_request_guest',
   true, false,
   'How was your stay?', '24 hours after check-out — a gentle nudge to leave a review.'),
  ('new_review_host', 'reviews', 'review', 'default', 'new_review_host',
   true, true,
   'New review published', 'A guest left you a review.'),

  -- ─── Subscription ───────────────────────────────────────────────────
  ('subscription_welcome', 'subscription', 'subscription', 'default', 'subscription_welcome',
   false, true,
   'Welcome to your new plan', 'A subscription was just activated.'),
  ('subscription_expiring', 'subscription', 'subscription', 'default', 'subscription_expiring',
   true, true,
   'Subscription renews soon', '7-day renewal heads-up.'),
  ('subscription_failed', 'account_security', 'subscription', 'high', 'subscription_failed',
   true, true,
   'Subscription payment failed', 'A payment attempt failed. Update your method within the grace period.'),
  ('subscription_restricted', 'account_security', 'subscription', 'critical', 'subscription_restricted',
   true, true,
   'Account restricted', 'Your subscription is past the grace period — features on hold.'),

  -- ─── Account / security ────────────────────────────────────────────
  ('account_suspended', 'account_security', 'account', 'critical', 'account_suspended',
   false, true,
   'Account suspended', 'Your account has been suspended by Vilo.'),
  ('staff_invite', 'account_security', 'account', 'default', 'staff_invite',
   false, false,
   'Staff invitation', 'You have been invited to manage a property on Vilo.'),

  -- ─── Messages ──────────────────────────────────────────────────────
  ('new_message', 'messages', 'message', 'high', NULL,
   true, true,
   'New message', 'You have a new message in your inbox.'),

  -- ─── Calendar sync ─────────────────────────────────────────────────
  ('ical_sync_error', 'calendar_sync', 'calendar', 'default', NULL,
   true, true,
   'Calendar sync issue', 'One of your iCal feeds has been failing for over an hour.'),

  -- ─── Admin-originated ──────────────────────────────────────────────
  ('broadcast_critical', 'admin_broadcasts', 'admin', 'critical', 'broadcast_critical',
   true, true,
   'Critical platform announcement', 'A critical announcement from the Vilo team.'),

  ('admin_individual_message', 'admin_broadcasts', 'admin', 'default', 'admin_message_generic',
   true, true,
   'Message from Vilo', 'A direct message from the Vilo team.'),

  ('notification_digest', 'reviews', 'admin', 'info', 'notification_digest',
   false, true,
   'Notification digest', 'Daily / weekly bundle of low-priority notifications.');
