-- Migration: guest ↔ Wielo support thread.
--
-- Until now the only "platform" (Wielo Support) conversation was host↔Wielo:
-- host_id = the host, guest_id = the fixed support user. A pure guest had no way
-- to message Wielo. Model a guest support thread as host_id NULL, guest_id = the
-- real guest, channel='platform' — so it shows in the guest's own inbox (RLS
-- guest_manage_conv: guest_id = auth.uid) and the admin inbox (channel='platform').
--
-- Two changes:
--   1. conversations.host_id becomes nullable (a guest support thread has no host).
--   2. on_message_inserted() routes unread correctly for host-less platform
--      threads: the guest is the guest party (unread_guest); "Wielo" is the other
--      party (unread_host). Any sender that isn't the guest counts as the Wielo
--      side, so a guest message bumps unread_host (the admin's badge) and a Wielo
--      reply bumps unread_guest.

ALTER TABLE public.conversations ALTER COLUMN host_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION on_message_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conv      conversations%ROWTYPE;
  v_host_user uuid;
  v_from_host boolean;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;

  IF v_conv.host_id IS NULL THEN
    -- Guest↔Wielo support thread: the guest is guest_id, "Wielo" is everyone
    -- else. A message from anyone other than the guest is the Wielo side, so it
    -- bumps the guest's unread; a guest message bumps the Wielo (unread_host) side.
    v_from_host := (NEW.sender_id IS DISTINCT FROM v_conv.guest_id);
  ELSE
    SELECT user_id INTO v_host_user FROM hosts WHERE id = v_conv.host_id;
    v_from_host := (
      NEW.sender_id IS NULL
      OR NEW.sender_id = v_host_user
      OR EXISTS (
        SELECT 1 FROM staff_members s
        WHERE s.host_id = v_conv.host_id AND s.user_id = NEW.sender_id
      )
    );
  END IF;

  UPDATE conversations SET
    last_message_at      = NEW.created_at,
    last_message_preview = left(NEW.body, 100),
    unread_host  = CASE
      WHEN (NOT v_from_host) AND NOT COALESCE(NEW.read_by_host, false)
      THEN unread_host + 1 ELSE unread_host END,
    unread_guest = CASE
      WHEN v_from_host AND NOT COALESCE(NEW.read_by_guest, false)
      THEN unread_guest + 1 ELSE unread_guest END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;
