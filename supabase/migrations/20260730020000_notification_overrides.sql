-- Migration: notification_overrides — the admin message-config layer.
--
-- One row PER event kind (global). Holds the admin's control over a system
-- message: master on/off, per-channel enable, and copy overrides (subject +
-- intro). The dispatcher (apps/web/lib/notifications/dispatch.ts) reads this and:
--   • master_enabled = false  → the event is skipped entirely (all channels)
--   • <channel>_enabled = false → that channel is dropped
--   • subject_override / intro_override → merged into the email payload
-- Absent row = default behaviour (everything on, code-default copy). A row only
-- exists once an admin has touched the message; subject/intro non-null = the
-- "Customised" badge in the Communications hub.
--
-- Keyed by event_kind only: the Communications hub and the per-campaign Email
-- tab edit the SAME row ("editing here edits everywhere"). Per-campaign SCHEDULE
-- (cadence / lead time) lives separately on the campaign, not here.

CREATE TABLE IF NOT EXISTS public.notification_overrides (
  event_kind      text PRIMARY KEY
                    REFERENCES public.notification_events(kind) ON DELETE CASCADE,
  master_enabled  boolean NOT NULL DEFAULT true,
  email_enabled   boolean NOT NULL DEFAULT true,
  push_enabled    boolean NOT NULL DEFAULT true,
  in_app_enabled  boolean NOT NULL DEFAULT true,
  subject_override text,
  intro_override   text,
  updated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_overrides IS
  'Admin control over each system message (Communications hub): master on/off, per-channel enable, subject/intro copy overrides. Read by the dispatcher; absent row = all-on with code-default copy.';

-- Admin/service only. The dispatcher uses the service role (bypasses RLS); the
-- admin server actions use the service client behind requirePermission. No anon
-- or authenticated access.
ALTER TABLE public.notification_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_overrides FROM anon, authenticated;
