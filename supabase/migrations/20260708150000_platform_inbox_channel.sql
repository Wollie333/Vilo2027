-- Migration: host↔Wielo (platform / support) inbox channel.
--
-- Reuses the EXISTING conversations + messages infrastructure rather than a
-- parallel table: a platform conversation is a normal `conversations` row with
-- channel = 'platform', host_id = the host, guest_id = the fixed "Wielo Support"
-- account. It therefore shows up in the host's existing inbox (queried by
-- host_id), renders with the shared chat UI, and the existing unread trigger
-- routes counts correctly (a message from the Wielo/admin side → unread_host; a
-- host reply → unread_guest, which the admin inbox reads). Designed to become the
-- general Support inbox later.
--
-- DOWN: ALTER TABLE conversations DROP COLUMN channel;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'guest'
    CHECK (channel IN ('guest', 'platform'));

-- Fast lookup of a host's platform thread + the admin inbox list.
CREATE INDEX IF NOT EXISTS idx_conversations_platform
  ON public.conversations(host_id)
  WHERE channel = 'platform';

CREATE INDEX IF NOT EXISTS idx_conversations_channel_last
  ON public.conversations(channel, last_message_at DESC);

COMMENT ON COLUMN public.conversations.channel IS
  'guest = host<->guest booking thread; platform = host<->Wielo (admin/support) thread.';
