-- Migration: Add Looking For notification category and events
--
-- This migration adds the notification infrastructure for the Looking For
-- feature, enabling guests to receive quote notifications and hosts to
-- receive alerts about new posts in their region.

-- =========================================================================
-- CATEGORY (1 row)
-- =========================================================================

INSERT INTO public.notification_categories
  (id, label, description, icon_name, is_locked, default_for_role, supports_digest, display_order)
VALUES
  ('looking_for',
   'Looking For',
   'Guest requests and quote notifications. Hosts receive alerts for new posts in their region.',
   'Search',
   false,
   '{
     "host":  {"email": true,  "push": true,  "in_app": true},
     "guest": {"email": true,  "push": true,  "in_app": true},
     "staff": {"email": false, "push": false, "in_app": true},
     "super_admin": {"email": false, "push": false, "in_app": false}
   }'::jsonb,
   true, 35);

-- =========================================================================
-- EVENTS (4 rows) — mirrors apps/web/lib/notifications/registry.ts
-- =========================================================================

INSERT INTO public.notification_events
  (kind, category_id, feature, severity, email_template_key,
   push_supported, in_app_supported, human_label, human_description)
VALUES
  -- ─── Guest-facing ──────────────────────────────────────────────────────
  ('looking_for_quote_received', 'looking_for', 'looking_for', 'high', 'looking_for_quote_received',
   true, true,
   'New quote received', 'A host has sent you a quote in response to your request.'),

  ('looking_for_post_expiring', 'looking_for', 'looking_for', 'default', NULL,
   true, true,
   'Request expiring soon', 'Your Looking For request is about to expire.'),

  -- ─── Host-facing ───────────────────────────────────────────────────────
  ('looking_for_new_post_region', 'looking_for', 'looking_for', 'info', NULL,
   true, true,
   'New request in your area', 'A guest has posted a request in your region.'),

  ('looking_for_quote_viewed', 'looking_for', 'looking_for', 'info', NULL,
   true, true,
   'Quote viewed', 'A guest has viewed the quote you sent.');
