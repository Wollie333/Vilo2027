-- Migration: guest enquiry → host pipeline inbox (prospects → quote → booking).
--
-- Turns the host inbox into a simple sales pipeline. A website visitor sends a
-- structured quote request from a listing; it lands as a draft-quote card in a
-- conversation flagged is_enquiry, at pipeline stage 'new_quote'. The host
-- completes the host-only fields and sends the quote; the thread advances
-- through pipeline stages. Anonymous leads are real (passwordless) user_profiles
-- flagged is_lead; they can later claim the account by setting a password.
--
-- Additive only (pre-MVP policy). Reuses the existing update_updated_at() trigger
-- and the host-ownership RLS pattern (host_id IN (SELECT id FROM hosts WHERE
-- user_id = auth.uid())).

-- ─── 1. conversations: pipeline + CRM fields ────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pipeline_stage text
    CHECK (pipeline_stage IN ('new_quote','quote_sent','negotiating','accepted','declined','lost')),
  ADD COLUMN IF NOT EXISTS assigned_to   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_at  timestamptz,
  ADD COLUMN IF NOT EXISTS pinned        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lost_reason   text;

CREATE INDEX IF NOT EXISTS idx_conversations_stage
  ON public.conversations(host_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_conversations_pinned
  ON public.conversations(host_id, pinned) WHERE pinned = true;
CREATE INDEX IF NOT EXISTS idx_conversations_followup
  ON public.conversations(host_id, follow_up_at) WHERE follow_up_at IS NOT NULL;

COMMENT ON COLUMN public.conversations.pipeline_stage IS
  'Sales pipeline stage for enquiry threads. Auto-advanced on quote events; host may override. NULL for non-prospect threads (e.g. booking-origin).';

-- ─── 2. quote ↔ conversation link ───────────────────────────────
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_conversation
  ON public.quotes(conversation_id) WHERE conversation_id IS NOT NULL;

-- ─── 3. message can render a quote card ─────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.messages.quote_id IS
  'When set, the message renders as a quote card in the thread. system_event distinguishes quote_draft / quote_sent.';

-- ─── 4. anonymous lead flag ─────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_lead boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.is_lead IS
  'True for a passwordless prospect created from a quote request. Flipped to false when the guest claims the account by setting a password.';

-- ─── 5. host_contacts (CRM list: tags, notes, block) ────────────
CREATE TABLE IF NOT EXISTS public.host_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id      uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  guest_id     uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  email        text NOT NULL,
  name         text,
  phone        text,
  tags         text[] NOT NULL DEFAULT '{}',
  notes        text,
  blocked      boolean NOT NULL DEFAULT false,
  last_stage   text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One contact row per (host, email) — case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS host_contacts_host_email_unique
  ON public.host_contacts(host_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_host_contacts_host ON public.host_contacts(host_id, last_seen_at DESC);

ALTER TABLE public.host_contacts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_host_contacts
  BEFORE UPDATE ON public.host_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS host_contacts_owner_all ON public.host_contacts;
CREATE POLICY host_contacts_owner_all ON public.host_contacts
  FOR ALL TO authenticated
  USING (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()))
  WITH CHECK (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()));

COMMENT ON TABLE public.host_contacts IS
  'Per-host CRM contact list, auto-upserted from enquiries/quotes/bookings (deduped by lower(email)). Holds tags, notes and a block flag; powers the Inbox Contacts tab + CSV export.';

-- ─── 6. conversation_notes (host-only internal notes) ───────────
CREATE TABLE IF NOT EXISTS public.conversation_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  author_id       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_notes_conv
  ON public.conversation_notes(conversation_id, created_at);

ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

-- Host (or their staff) manages notes for their own conversations only. Never
-- visible to the guest.
DROP POLICY IF EXISTS conversation_notes_host_manage ON public.conversation_notes;
CREATE POLICY conversation_notes_host_manage ON public.conversation_notes
  FOR ALL TO authenticated
  USING (conversation_id IN (
    SELECT id FROM public.conversations
    WHERE host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())
  ))
  WITH CHECK (conversation_id IN (
    SELECT id FROM public.conversations
    WHERE host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())
  ));

COMMENT ON TABLE public.conversation_notes IS
  'Host-only internal notes on a conversation (pipeline context). Never shown to the guest.';
