-- Migration: Enterprise notification system — schema, prefs, broadcasts,
-- individual sends, delivery log, push/digest buffers, permission keys, and
-- audit-target extensions. Seed lives in the next migration.
--
-- Builds the coordinating brain on top of existing plumbing
-- (notification_queue + in_app_notifications + push_tokens) and cooperates
-- with the resolver pattern from 8ae439f (apps/web/lib/email/resolvers/*) —
-- the dispatcher enqueues THIN payloads (just reference IDs) into
-- notification_queue and the drain auto-hydrates via RESOLVERS.

-- =========================================================================
-- TAXONOMY
-- =========================================================================

-- ─── notification_categories ──────────────────────────────────────────────
-- Seed table. ~9 user-facing groupings. icon_name pairs with lucide-react
-- so the settings UI auto-renders without a hardcoded list.

CREATE TABLE public.notification_categories (
  id                text         PRIMARY KEY,
  label             text         NOT NULL,
  description       text         NOT NULL,
  icon_name         text         NOT NULL,
  is_locked         boolean      NOT NULL DEFAULT false,
  default_for_role  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  supports_digest   boolean      NOT NULL DEFAULT false,
  display_order     int          NOT NULL DEFAULT 0,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.notification_categories.is_locked IS
  'When true: user cannot disable any channel for this category. Reserved for account_security + critical platform notices.';
COMMENT ON COLUMN public.notification_categories.default_for_role IS
  'Per-role channel defaults. Shape: {"host":{"email":true,"push":true,"in_app":true}, ...}';
COMMENT ON COLUMN public.notification_categories.icon_name IS
  'lucide-react icon name (e.g. "Calendar"). Lets the settings UI render an icon per category without hardcoding the mapping.';

ALTER TABLE public.notification_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_categories_read_authenticated
  ON public.notification_categories FOR SELECT
  TO authenticated USING (true);

-- ─── notification_events ──────────────────────────────────────────────────
-- DB mirror of in-code NOTIFICATION_REGISTRY. The TS registry is the
-- runtime source of truth; this table powers cron jobs, SQL triggers, and
-- the admin test-send UI which want to look up category/severity/locked-ness
-- without round-tripping to TS.
--
-- Two-axis tagging: category_id drives user-facing organisation (settings
-- UI groups, bell filter tabs); feature drives admin-facing organisation
-- (audit-log filters, send-history breakdown).

CREATE TABLE public.notification_events (
  kind                text         PRIMARY KEY,
  category_id         text         NOT NULL REFERENCES public.notification_categories(id),
  feature             text         NOT NULL,
  severity            text         NOT NULL DEFAULT 'default'
                                   CHECK (severity IN ('info','default','high','critical')),
  email_template_key  text,
  push_supported      boolean      NOT NULL DEFAULT true,
  in_app_supported    boolean      NOT NULL DEFAULT true,
  human_label         text         NOT NULL,
  human_description   text,
  created_at          timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_events_category ON public.notification_events(category_id);
CREATE INDEX idx_notification_events_feature  ON public.notification_events(feature);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_events_read_authenticated
  ON public.notification_events FOR SELECT
  TO authenticated USING (true);

-- =========================================================================
-- USER PREFERENCES
-- =========================================================================

CREATE TABLE public.user_notification_preferences (
  user_id         uuid         NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  category_id     text         NOT NULL REFERENCES public.notification_categories(id),
  email_enabled   boolean      NOT NULL DEFAULT true,
  push_enabled    boolean      NOT NULL DEFAULT true,
  in_app_enabled  boolean      NOT NULL DEFAULT true,
  digest_mode     text         NOT NULL DEFAULT 'off'
                               CHECK (digest_mode IN ('off','daily','weekly')),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_id)
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_notification_preferences_owner_all
  ON public.user_notification_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_notification_preferences_service_select
  ON public.user_notification_preferences FOR SELECT
  TO service_role USING (true);

CREATE TABLE public.user_notification_settings (
  user_id               uuid         PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  quiet_hours_enabled   boolean      NOT NULL DEFAULT false,
  quiet_hours_start     time,
  quiet_hours_end       time,
  quiet_hours_timezone  text         NOT NULL DEFAULT 'Africa/Johannesburg',
  dedupe_enabled        boolean      NOT NULL DEFAULT true,
  digest_send_hour      smallint     NOT NULL DEFAULT 9
                                     CHECK (digest_send_hour BETWEEN 0 AND 23),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_notification_settings_owner_all
  ON public.user_notification_settings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =========================================================================
-- ADMIN BROADCASTS (audience-based)
-- =========================================================================

CREATE TABLE public.broadcast_announcements (
  id                         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by                 uuid         NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  severity                   text         NOT NULL CHECK (severity IN ('info','warning','critical')),
  audience                   text         NOT NULL CHECK (audience IN ('all','hosts','guests','staff','super_admins')),
  title                      text         NOT NULL,
  body                       text         NOT NULL,
  link_url                   text,
  link_label                 text,
  requires_ack               boolean      NOT NULL DEFAULT false,
  starts_at                  timestamptz  NOT NULL DEFAULT now(),
  ends_at                    timestamptz,
  cancelled_at               timestamptz,
  email_fanout_completed_at  timestamptz,
  created_at                 timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcast_active
  ON public.broadcast_announcements (starts_at, ends_at)
  WHERE cancelled_at IS NULL;

CREATE INDEX idx_broadcast_audience
  ON public.broadcast_announcements (audience)
  WHERE cancelled_at IS NULL;

ALTER TABLE public.broadcast_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY broadcast_recipients_select
  ON public.broadcast_announcements FOR SELECT
  TO authenticated
  USING (
    cancelled_at IS NULL
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
    AND (
      audience = 'all'
      OR (audience = 'hosts'        AND get_my_role() = 'host')
      OR (audience = 'guests'       AND get_my_role() = 'guest')
      OR (audience = 'staff'        AND get_my_role() = 'staff')
      OR (audience = 'super_admins' AND get_my_role() = 'super_admin')
    )
  );

CREATE POLICY broadcast_admin_all
  ON public.broadcast_announcements FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE TABLE public.broadcast_acknowledgements (
  broadcast_id     uuid         NOT NULL REFERENCES public.broadcast_announcements(id) ON DELETE CASCADE,
  user_id          uuid         NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  dismissed_at     timestamptz,
  acknowledged_at  timestamptz,
  PRIMARY KEY (broadcast_id, user_id)
);

ALTER TABLE public.broadcast_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY broadcast_ack_owner_all
  ON public.broadcast_acknowledgements FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY broadcast_ack_admin_select
  ON public.broadcast_acknowledgements FOR SELECT
  USING (is_super_admin());

-- =========================================================================
-- ADMIN INDIVIDUAL SENDS (NEW in v2)
-- =========================================================================

CREATE TABLE public.admin_message_batches (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       uuid         NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  title            text         NOT NULL,
  body             text         NOT NULL,
  link_url         text,
  link_label       text,
  severity         text         NOT NULL DEFAULT 'default'
                                CHECK (severity IN ('info','default','high')),
  channels         jsonb        NOT NULL DEFAULT '["in_app"]'::jsonb,
  recipient_ids    uuid[]       NOT NULL,
  recipient_count  int          GENERATED ALWAYS AS (COALESCE(array_length(recipient_ids, 1), 0)) STORED,
  created_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_message_batches_recent
  ON public.admin_message_batches (created_at DESC);
CREATE INDEX idx_admin_message_batches_creator
  ON public.admin_message_batches (created_by, created_at DESC);

ALTER TABLE public.admin_message_batches ENABLE ROW LEVEL SECURITY;

-- Read: super_admin always; support_agent if they hold notifications.view_history.
-- We use is_super_admin() + has_admin_permission as belt + braces.
CREATE POLICY admin_message_batches_admin_select
  ON public.admin_message_batches FOR SELECT
  USING (is_super_admin() OR public.has_admin_permission('notifications.view_history'));

-- INSERT: service_role only (server actions hit this via createAdminClient).
-- No public INSERT policy.

-- =========================================================================
-- AUDIT + DEDUP SUBSTRATE
-- =========================================================================

CREATE TABLE public.notification_delivery_log (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid         NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  event_kind   text         NOT NULL,
  category_id  text,
  channel      text         NOT NULL CHECK (channel IN ('email','push','in_app')),
  dedupe_key   text,
  sent_at      timestamptz  NOT NULL DEFAULT now(),
  read_at      timestamptz,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_log_dedupe
  ON public.notification_delivery_log (user_id, dedupe_key, created_at DESC)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX idx_delivery_log_recent
  ON public.notification_delivery_log (user_id, created_at DESC);

ALTER TABLE public.notification_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_delivery_log_owner_select
  ON public.notification_delivery_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY notification_delivery_log_admin_select
  ON public.notification_delivery_log FOR SELECT
  USING (is_super_admin());

COMMENT ON TABLE public.notification_delivery_log IS
  'INSERT-only. Service role inserts only. No UPDATE/DELETE policies — read_at is updated via a dedicated SECURITY DEFINER RPC.';

-- =========================================================================
-- DEFERRED CHANNEL BUFFERS
-- =========================================================================

-- ─── pending_push_queue ───────────────────────────────────────────────────
-- Holds push notifications that are quiet-hours deferred OR awaiting the
-- next minute's worker tick. /api/push-worker drains rows where
-- release_at <= now() AND sent_at IS NULL AND failed_at IS NULL.

CREATE TABLE public.pending_push_queue (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  event_kind  text         NOT NULL,
  payload     jsonb        NOT NULL,
  release_at  timestamptz  NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  failed_at   timestamptz,
  error       text,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_push_due
  ON public.pending_push_queue (release_at)
  WHERE sent_at IS NULL AND failed_at IS NULL;

ALTER TABLE public.pending_push_queue ENABLE ROW LEVEL SECURITY;
-- service_role only (no policies).

-- ─── pending_digest_items ─────────────────────────────────────────────────
-- Hourly drain groups items by (user_id, category_id) and renders one digest
-- email + one bell entry per group when the user's digest_send_hour matches
-- the current local hour.

CREATE TABLE public.pending_digest_items (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid         NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  category_id  text         NOT NULL,
  event_kind   text         NOT NULL,
  title        text         NOT NULL,
  body         text,
  link         text,
  payload      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  sent_at      timestamptz,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_digest_user_unsent
  ON public.pending_digest_items (user_id, created_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.pending_digest_items ENABLE ROW LEVEL SECURITY;
-- service_role only.

-- =========================================================================
-- EXTENSIONS TO EXISTING TABLES
-- =========================================================================

-- notification_queue gets user_id + category_id + dedupe_key so the email
-- drain can re-check user prefs at send time (defense-in-depth) and so the
-- delivery-log dedupe works cross-channel.
ALTER TABLE public.notification_queue
  ADD COLUMN user_id     uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ADD COLUMN category_id text,
  ADD COLUMN dedupe_key  text;

CREATE INDEX idx_notification_queue_user_id ON public.notification_queue(user_id);

-- in_app_notifications gets category_id + severity so the bell can filter
-- by tab and tint by severity. Defaults keep existing rows valid; the table
-- is currently small per pre-MVP policy.
ALTER TABLE public.in_app_notifications
  ADD COLUMN category_id text NOT NULL DEFAULT 'bookings',
  ADD COLUMN severity    text NOT NULL DEFAULT 'default'
    CHECK (severity IN ('info','default','high','critical'));

-- =========================================================================
-- RPC HELPERS
-- =========================================================================

-- Replace the 6-arg enqueue_in_app_notification with an 8-arg variant that
-- carries category + severity. Defaults preserve callers passing fewer args.
DROP FUNCTION IF EXISTS public.enqueue_in_app_notification(uuid, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.enqueue_in_app_notification(
  p_user_id     uuid,
  p_kind        text,
  p_title       text,
  p_body        text  DEFAULT NULL,
  p_link        text  DEFAULT NULL,
  p_payload     jsonb DEFAULT '{}'::jsonb,
  p_category_id text  DEFAULT 'bookings',
  p_severity    text  DEFAULT 'default'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.in_app_notifications
    (user_id, kind, title, body, link, payload, category_id, severity)
  VALUES
    (p_user_id, p_kind, p_title, p_body, p_link,
     COALESCE(p_payload, '{}'::jsonb),
     COALESCE(p_category_id, 'bookings'),
     COALESCE(p_severity, 'default'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_in_app_notification(uuid, text, text, text, text, jsonb, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.enqueue_in_app_notification(uuid, text, text, text, text, jsonb, text, text) TO service_role;

-- ─── resolve_notification_prefs ───────────────────────────────────────────
-- Returns the effective per-channel decisions for a (user, category):
--   1. Unknown category → permissive fallback (true/true/true).
--   2. Locked category → forced (true/true/true, is_locked=true).
--   3. Explicit row in user_notification_preferences → returned.
--   4. Fall back to category.default_for_role for the user's role.

CREATE OR REPLACE FUNCTION public.resolve_notification_prefs(
  p_user_id     uuid,
  p_category_id text
)
RETURNS TABLE (
  email_enabled   boolean,
  push_enabled    boolean,
  in_app_enabled  boolean,
  digest_mode     text,
  is_locked       boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category public.notification_categories%ROWTYPE;
  v_pref     public.user_notification_preferences%ROWTYPE;
  v_role     text;
  v_def      jsonb;
BEGIN
  SELECT * INTO v_category FROM public.notification_categories WHERE id = p_category_id;
  IF NOT FOUND THEN
    email_enabled  := true;
    push_enabled   := true;
    in_app_enabled := true;
    digest_mode    := 'off';
    is_locked      := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_category.is_locked THEN
    email_enabled  := true;
    push_enabled   := true;
    in_app_enabled := true;
    digest_mode    := 'off';
    is_locked      := true;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_pref
  FROM public.user_notification_preferences
  WHERE user_id = p_user_id AND category_id = p_category_id;

  IF FOUND THEN
    email_enabled  := v_pref.email_enabled;
    push_enabled   := v_pref.push_enabled;
    in_app_enabled := v_pref.in_app_enabled;
    digest_mode    := v_pref.digest_mode;
    is_locked      := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE id = p_user_id;
  v_def := v_category.default_for_role -> v_role;

  email_enabled  := COALESCE((v_def ->> 'email')::boolean, true);
  push_enabled   := COALESCE((v_def ->> 'push')::boolean, true);
  in_app_enabled := COALESCE((v_def ->> 'in_app')::boolean, true);
  digest_mode    := 'off';
  is_locked      := false;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_notification_prefs(uuid, text) TO service_role;

-- ─── mark_delivery_read ───────────────────────────────────────────────────
-- Lets the in-app + mobile layers update notification_delivery_log.read_at
-- for their own rows without granting UPDATE on the table.

CREATE OR REPLACE FUNCTION public.mark_delivery_read(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notification_delivery_log
     SET read_at = now()
   WHERE id = p_log_id
     AND user_id = auth.uid()
     AND read_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_delivery_read(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_delivery_read(uuid) TO authenticated;

-- =========================================================================
-- ADMIN AUDIT-LOG EXTENSION + PERMISSION KEYS
-- =========================================================================

-- Extend the target_type CHECK to allow our two new types. Preserves
-- every existing value (most recent list mirrored from 20260525000010).
ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_target_type_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type IN (
    'host','guest','user','booking','listing','review','subscription',
    'feature_override','platform_setting','platform_staff','staff_member',
    'impersonation','permission_denied',
    'help_article','help_video','help_faq','help_category',
    'help_status','help_settings','help_article_suggestion',
    'broadcast','notification_send'
  ));

INSERT INTO public.admin_permissions (key, domain, description) VALUES
  ('notifications.broadcast',       'notifications', 'Create and send site-wide broadcast announcements (info / warning / critical).'),
  ('notifications.send_individual', 'notifications', 'Send notifications to individually selected users.'),
  ('notifications.view_history',    'notifications', 'View broadcast and individual-send history.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key) VALUES
  ('super_admin',   'notifications.broadcast'),
  ('super_admin',   'notifications.send_individual'),
  ('super_admin',   'notifications.view_history'),
  ('support_agent', 'notifications.send_individual'),
  ('support_agent', 'notifications.view_history')
ON CONFLICT (role_id, permission_key) DO NOTHING;
