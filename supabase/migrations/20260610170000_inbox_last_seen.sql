-- Migration: per-side "last seen" on conversations, to power WhatsApp-style
-- DELIVERED receipts (the middle state between sent and read).
--
-- A message I sent is:
--   • sent      — the other party hasn't been online since I sent it
--   • delivered — the other party's inbox has loaded at/after the message time
--                 (their `*_last_seen_at` >= message.created_at)
--   • read      — the other party opened the thread (read_by_host/read_by_guest)
--
-- We track it per side on the conversation (not per message) because quote /
-- access-detail cards are system messages with sender_id = NULL, so direction
-- can't be derived from the sender — but the *recipient* is always the opposite
-- participant, whose online-ness the side timestamp captures cleanly.

alter table public.conversations
  add column if not exists host_last_seen_at timestamptz,
  add column if not exists guest_last_seen_at timestamptz;

comment on column public.conversations.host_last_seen_at is
  'When the host last loaded their inbox while this conversation was live. Drives delivered ticks on the guest''s outgoing messages.';
comment on column public.conversations.guest_last_seen_at is
  'When the guest last loaded their inbox. Drives delivered ticks on the host''s outgoing messages.';

-- Backfill (pre-MVP, no real data to preserve): treat history as delivered so
-- existing threads don't render every old message as a single "sent" tick.
update public.conversations
  set host_last_seen_at = coalesce(host_last_seen_at, now()),
      guest_last_seen_at = coalesce(guest_last_seen_at, now());
