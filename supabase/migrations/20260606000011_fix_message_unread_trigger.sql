-- Fix two-way unread accounting on the inbox.
--
-- conversations.host_id references hosts(id) (the host ROW), but
-- messages.sender_id references user_profiles(id) (the auth user). The original
-- on_message_inserted() compared the two directly — different id spaces that
-- NEVER match — so a HOST reply incremented unread_host (its own side) and left
-- unread_guest untouched: the guest was never flagged, and the host's unread
-- count inflated on its own messages. Guest -> host worked only by accident.
--
-- Resolve the host's user id (and treat staff + system cards as host-side) so
-- the right side's unread counter advances in both directions.

CREATE OR REPLACE FUNCTION on_message_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conv      conversations%ROWTYPE;
  v_host_user uuid;
  v_from_host boolean;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;

  -- hosts.id -> the owning user. NULL-safe (host should always have a user).
  SELECT user_id INTO v_host_user FROM hosts WHERE id = v_conv.host_id;

  -- A message counts as host-side when sent by the host's own user, by a staff
  -- member on that host's team, or as a system card (sender_id NULL — e.g. a
  -- "quote sent" card the guest should see).
  v_from_host := (
    NEW.sender_id IS NULL
    OR NEW.sender_id = v_host_user
    OR EXISTS (
      SELECT 1 FROM staff_members s
      WHERE s.host_id = v_conv.host_id AND s.user_id = NEW.sender_id
    )
  );

  UPDATE conversations SET
    last_message_at      = NEW.created_at,
    last_message_preview = left(NEW.body, 100),
    unread_host  = CASE WHEN v_from_host THEN unread_host      ELSE unread_host + 1  END,
    unread_guest = CASE WHEN v_from_host THEN unread_guest + 1 ELSE unread_guest     END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;
