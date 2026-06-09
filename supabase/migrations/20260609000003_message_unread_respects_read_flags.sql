-- Make the inbox unread counters respect a message's own read flags.
--
-- on_message_inserted() always bumped the recipient's unread counter, even when
-- the inserted row was already marked read for that side. So a system card the
-- guest's OWN action generated (e.g. the quote_draft card on enquiry, inserted
-- with read_by_guest = true) still inflated their unread by 1. Honour the flags:
-- only increment a side's unread when the new row is NOT already read for it.

CREATE OR REPLACE FUNCTION on_message_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conv      conversations%ROWTYPE;
  v_host_user uuid;
  v_from_host boolean;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
  SELECT user_id INTO v_host_user FROM hosts WHERE id = v_conv.host_id;

  -- Host-side when sent by the host's user, a staff member, or a system card.
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
    -- Bump the OTHER side's unread, but only if the row isn't already read for it.
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
