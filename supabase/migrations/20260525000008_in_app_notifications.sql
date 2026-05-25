-- Migration: In-app notifications (separate from email notification_queue).
--
-- The bell icon and dropdown panel in the host dashboard read from this
-- table. notification_queue stays an email-only buffer; this is the
-- in-product surface — toasts and alert pills will pull from here too
-- once those land.
--
-- Per NOTIFICATIONS.md §4 the in-app surface needs:
--   - per-user list scoped via RLS
--   - unread badge count from a cheap WHERE read_at IS NULL query
--   - realtime subscription (postgres_changes) so the bell updates live
--   - mark-as-read + mark-all-as-read actions

CREATE TABLE public.in_app_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_in_app_notifications_user_unread
  ON public.in_app_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_in_app_notifications_user_recent
  ON public.in_app_notifications (user_id, created_at DESC);

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Users see only their own.
CREATE POLICY in_app_notifications_owner_select
  ON public.in_app_notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can mark their own as read.
CREATE POLICY in_app_notifications_owner_update
  ON public.in_app_notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT is service-role only (server actions + Edge Functions enqueue).
-- No public.in_app_notifications INSERT policy needed — RLS denies by default.

-- Realtime publication so the bell can subscribe.
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;

-- Enqueue helper for server actions (so they don't repeat the insert shape).
CREATE OR REPLACE FUNCTION public.enqueue_in_app_notification(
  p_user_id uuid,
  p_kind    text,
  p_title   text,
  p_body    text DEFAULT NULL,
  p_link    text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.in_app_notifications (user_id, kind, title, body, link, payload)
  VALUES (p_user_id, p_kind, p_title, p_body, p_link, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_in_app_notification(uuid, text, text, text, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.enqueue_in_app_notification(uuid, text, text, text, text, jsonb) TO service_role;
