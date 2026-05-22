-- Migration: Domain 6 — Inbox & Messaging
-- Per supabase_database.md §9
-- Tables: conversations, messages, message_templates, push_tokens

-- ─── conversations ────────────────────────────────────────────
CREATE TABLE public.conversations (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id              uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  guest_id             uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  listing_id           uuid    REFERENCES listings(id) ON DELETE SET NULL,
  booking_id           uuid    REFERENCES bookings(id) ON DELETE SET NULL,
  status               text    NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open','resolved','archived')),
  is_enquiry           boolean NOT NULL DEFAULT false,
  unread_host          integer NOT NULL DEFAULT 0,
  unread_guest         integer NOT NULL DEFAULT 0,
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_host_id    ON conversations(host_id);
CREATE INDEX idx_conversations_guest_id   ON conversations(guest_id);
CREATE INDEX idx_conversations_booking_id ON conversations(booking_id);
CREATE INDEX idx_conversations_status     ON conversations(host_id, status);
CREATE INDEX idx_conversations_last_msg   ON conversations(host_id, last_message_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN conversations.unread_host IS
  'Denormalised unread count for host. Updated by trigger on message insert.';
COMMENT ON COLUMN conversations.last_message_preview IS
  'First 100 chars of last message body. For inbox list rendering.';

-- ─── messages ─────────────────────────────────────────────────
CREATE TABLE public.messages (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id           uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,

  body                text,
  attachment_url      text,
  attachment_type     text    CHECK (attachment_type IN ('image','pdf','other')),
  attachment_filename text,

  is_system_message   boolean NOT NULL DEFAULT false,
  system_event        text,

  read_by_host        boolean NOT NULL DEFAULT false,
  read_by_guest       boolean NOT NULL DEFAULT false,
  read_at             timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation  ON messages(conversation_id);
CREATE INDEX idx_messages_created_at    ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_messages_sender        ON messages(sender_id);
CREATE INDEX idx_messages_unread_host   ON messages(conversation_id, read_by_host)
  WHERE read_by_host = false AND is_system_message = false;
CREATE INDEX idx_messages_unread_guest  ON messages(conversation_id, read_by_guest)
  WHERE read_by_guest = false AND is_system_message = false;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN messages.is_system_message IS
  'True for automated status-change messages. Styled differently in UI.';
COMMENT ON COLUMN messages.system_event IS
  'Machine-readable event type: booking_confirmed | booking_cancelled | etc.';

-- ─── message_templates ────────────────────────────────────────
CREATE TABLE public.message_templates (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  title       text    NOT NULL,
  body        text    NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_templates_host ON message_templates(host_id, sort_order);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN message_templates.body IS
  'Supports {{guest_name}}, {{listing_name}}, {{check_in}}, {{check_out}} variables.';

-- ─── push_tokens ──────────────────────────────────────────────
CREATE TABLE public.push_tokens (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token        text    NOT NULL UNIQUE,
  platform     text    NOT NULL CHECK (platform IN ('ios','android')),
  device_name  text,
  is_active    boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id) WHERE is_active = true;

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE push_tokens IS
  'Expo push tokens per device. One user can have multiple active devices.';
