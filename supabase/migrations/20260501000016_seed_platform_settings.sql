-- Migration: Seed platform_settings
-- Per supabase_database.md §21 — these values are required for the application to function.

INSERT INTO platform_settings (key, value, description) VALUES
  ('ranking_weights',           '{"rating":0.30,"reviews":0.20,"profile":0.15,"response":0.15,"plan":0.20}',
   'Directory ranking weights. Must sum to 1.0.'),
  ('directory_results_per_page','24',    'Listings per directory search page.'),
  ('free_trial_days',           '14',    'Trial days for new paid subscriptions.'),
  ('grace_period_days',         '5',     'Days after failed payment before restriction.'),
  ('booking_expiry_minutes',    '30',    'Minutes before unpaid booking auto-expires.'),
  ('eft_hold_hours',            '48',    'Hours EFT booking held before expiry.'),
  ('review_moderation_hours',   '48',    'Hours before non-flagged review auto-publishes.'),
  ('host_response_window_hours','24',    'Hours host has to respond to booking request.'),
  ('max_photos_per_listing',    '20',    'Maximum photos per listing.'),
  ('free_inbox_limit',          '10',    'Max active conversations for free tier.')
ON CONFLICT (key) DO NOTHING;
