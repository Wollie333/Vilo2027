-- Migration: Domain 9 — Platform Administration
-- Per supabase_database.md §12
-- Tables: platform_settings, admin_audit_log, impersonation_sessions, notification_queue, review_request_queue

-- ─── platform_settings ────────────────────────────────────────
CREATE TABLE public.platform_settings (
  key         text  PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_by  uuid  REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE platform_settings IS
  'Runtime config. Read by Edge Functions on every call. Never hardcode these values.';

-- ─── admin_audit_log (append-only) ────────────────────────────
CREATE TABLE public.admin_audit_log (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid  NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  impersonating uuid  REFERENCES user_profiles(id) ON DELETE SET NULL,
  action        text  NOT NULL,
  target_type   text  NOT NULL CHECK (target_type IN (
                  'host','guest','booking','listing','review',
                  'subscription','feature_override','platform_setting','impersonation'
                )),
  target_id     uuid,
  payload       jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_admin_id   ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_action     ON admin_audit_log(action);
CREATE INDEX idx_audit_log_target_id  ON admin_audit_log(target_id);
CREATE INDEX idx_audit_log_created_at ON admin_audit_log(created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE admin_audit_log IS
  'Immutable. No UPDATE or DELETE policies. INSERT only via service_role in Edge Functions.';
COMMENT ON COLUMN admin_audit_log.impersonating IS
  'Populated when admin is acting as another user via impersonation.';

-- ─── impersonation_sessions ───────────────────────────────────
CREATE TABLE public.impersonation_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  target_user_id   uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds integer GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (ended_at - started_at))::integer
    ELSE NULL END
  ) STORED
);

CREATE INDEX idx_impersonation_admin  ON impersonation_sessions(admin_id);
CREATE INDEX idx_impersonation_active ON impersonation_sessions(started_at)
  WHERE ended_at IS NULL;

ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- ─── notification_queue ───────────────────────────────────────
CREATE TABLE public.notification_queue (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid    REFERENCES hosts(id) ON DELETE CASCADE,
  guest_id    uuid    REFERENCES user_profiles(id) ON DELETE CASCADE,
  type        text    NOT NULL,
  payload     jsonb   NOT NULL DEFAULT '{}',
  sent_at     timestamptz,
  failed_at   timestamptz,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_queue_unsent ON notification_queue(created_at)
  WHERE sent_at IS NULL AND failed_at IS NULL;

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- ─── review_request_queue ─────────────────────────────────────
CREATE TABLE public.review_request_queue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  guest_id    uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_queue_unsent ON review_request_queue(created_at)
  WHERE sent_at IS NULL;

ALTER TABLE review_request_queue ENABLE ROW LEVEL SECURITY;
