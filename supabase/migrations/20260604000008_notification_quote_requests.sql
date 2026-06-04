-- Migration: add a dedicated "Quote requests" notification category + event so
-- host quote-request enquiries get their own bell tab instead of landing under
-- "Messages". Mirrors apps/web/lib/notifications/registry.ts (quote_request_host)
-- and types.ts (CategoryId). Idempotent.

-- ─── Category ──────────────────────────────────────────────────────────────
INSERT INTO public.notification_categories
  (id, label, description, icon_name, is_locked, default_for_role, supports_digest, display_order)
VALUES
  ('quote_requests',
   'Quote requests',
   'New quote requests from guests on your listings, awaiting your reply.',
   'FileText',
   false,
   '{
     "host":  {"email": true,  "push": true,  "in_app": true},
     "guest": {"email": false, "push": false, "in_app": false},
     "staff": {"email": false, "push": false, "in_app": true},
     "super_admin": {"email": false, "push": false, "in_app": false}
   }'::jsonb,
   false, 35)
ON CONFLICT (id) DO UPDATE
  SET label = EXCLUDED.label,
      description = EXCLUDED.description,
      icon_name = EXCLUDED.icon_name,
      default_for_role = EXCLUDED.default_for_role,
      display_order = EXCLUDED.display_order;

-- ─── Event ─────────────────────────────────────────────────────────────────
INSERT INTO public.notification_events
  (kind, category_id, feature, severity, email_template_key,
   push_supported, in_app_supported, human_label, human_description)
VALUES
  ('quote_request_host', 'quote_requests', 'message', 'high', NULL,
   true, true,
   'New quote request', 'A guest has requested a custom quote on one of your listings.')
ON CONFLICT (kind) DO UPDATE
  SET category_id = EXCLUDED.category_id,
      feature = EXCLUDED.feature,
      severity = EXCLUDED.severity,
      push_supported = EXCLUDED.push_supported,
      in_app_supported = EXCLUDED.in_app_supported,
      human_label = EXCLUDED.human_label,
      human_description = EXCLUDED.human_description;
