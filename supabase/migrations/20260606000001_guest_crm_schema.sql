-- Migration: Guests (CRM) — Phase 1 schema  [REUSE & EXTEND]
--
-- The app ALREADY has the CRM building blocks the Guest feature needs, so this
-- migration extends them rather than creating parallel tables:
--   * host_contacts    — per-host contact list (guest_id, email, name, phone,
--                        tags[], notes, blocked, last_stage, last_seen_at),
--                        deduped by lower(email). Created in
--                        20260603000006_enquiry_pipeline_inbox.sql. This is the
--                        single CRM overlay for tags / block / contact fields.
--   * message_templates — already has full CRUD (inbox/actions.ts) + the
--                        {{guest_name}}/{{listing_name}}/{{check_in}}/{{check_out}}
--                        variable convention. Reused as-is; only seeded here.
--
-- A guest is keyed everywhere by a canonical `gkey` (a URL / resolution scheme,
-- NOT a stored column):
--   * u_<user_profiles.id>          — registered guest (resolve host_contacts by guest_id)
--   * e_<base64url(lower(email))>   — email-only booking contact / manual contact
--                                     (resolve host_contacts by lower(email))
-- host_contacts is addressable by either, so no gkey column is needed there.
-- host_contacts rows are minted lazily by the Server Actions (tag/block/add-guest)
-- for booking guests that don't have one yet — no backfill, no triggers.
--
-- ONLY genuinely-new table: guest_notes (a multi/pinned/authored notes timeline
-- for the Guest Record's Notes tab — host_contacts.notes is a single quick-note
-- field and conversation_notes is per-conversation, so neither fits). It is keyed
-- by gkey so ANY guest can have notes, even without a host_contacts row.
--
-- See GUEST_RECORD_PLAN.md §3 (Phase 1; guest_marketing + guest_broadcasts land
-- in Phase 9). Pre-MVP policy permits additive changes (CLAUDE.md).

-- ─── 1. Extend host_contacts for the Guests feature ────────────────────────
-- country     : captured by the "Add guest" form (host_contacts had no country).
-- email_consent: decision A — host attests consent before a manual contact is
--                emailable (booking guests use the opt-out basis instead).
-- blocked_*   : reason + timestamp alongside the existing `blocked` boolean
--                (the plan's guest_flags collapses into host_contacts).
ALTER TABLE public.host_contacts
  ADD COLUMN IF NOT EXISTS country        text,
  ADD COLUMN IF NOT EXISTS email_consent  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_at     timestamptz;

COMMENT ON COLUMN public.host_contacts.email_consent IS
  'POPIA: host attests they have consent to email this manually-added contact (decision A). Booking guests use the opt-out basis instead.';
COMMENT ON COLUMN public.host_contacts.blocked_reason IS
  'Optional reason captured when a host blocks a guest (display-only for v1, decision 2).';

-- ─── 2. guest_notes — Notes-tab timeline (genuinely new; keyed by gkey) ─────
CREATE TABLE public.guest_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  gkey        text NOT NULL,
  author_id   uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  body        text NOT NULL,
  is_pinned   boolean NOT NULL DEFAULT false,   -- powers the Overview "Pinned note"
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_guest_notes_host_gkey ON guest_notes(host_id, gkey);

COMMENT ON TABLE guest_notes IS
  'Internal host-only notes on a guest (timeline, pinnable, authored), keyed by the canonical gkey so any guest can have notes even without a host_contacts row.';

-- RLS — mirrors the credit_notes pattern (host / staff / admin). The
-- SECURITY DEFINER helpers return NULL for non-hosts, so a NULL host_id match
-- yields no rows for anon/guest callers.
ALTER TABLE guest_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "host_all_guest_notes" ON guest_notes FOR ALL
  USING (host_id = get_my_host_id()) WITH CHECK (host_id = get_my_host_id());
CREATE POLICY "staff_all_guest_notes" ON guest_notes FOR ALL
  USING (host_id = get_my_host_id_as_staff()) WITH CHECK (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_read_guest_notes" ON guest_notes FOR SELECT
  USING (is_super_admin());

-- ─── 3. user_profiles verification columns (additive, nullable) ────────────
-- Display-ready for later KYC. Email-confirmed is implied by a registered
-- account; phone/ID chips show only when these are set (never a red "unverified").
-- (country already exists from 20260526000001_user_profiles_guest_fields.sql.)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS id_verified_at    timestamptz;

COMMENT ON COLUMN user_profiles.phone_verified_at IS 'When the phone number was verified (display-only chip on the Guest Record). No KYC flow yet.';
COMMENT ON COLUMN user_profiles.id_verified_at IS 'When government ID was verified (display-only chip on the Guest Record). No KYC flow yet.';

-- ─── 4. Seed starter message templates per existing host ───────────────────
-- Reuses the existing message_templates table + its {{guest_name}} convention so
-- the reply/broadcast pickers are useful on day one. Idempotent on (host_id,
-- title) — no unique constraint by design (hosts may rename/duplicate freely).
INSERT INTO message_templates (host_id, title, body, sort_order)
SELECT h.id, t.title, t.body, t.sort_order
FROM hosts h
CROSS JOIN (
  VALUES
    ('Check-in details', E'Hi {{guest_name}},\n\nWe''re looking forward to hosting you at {{listing_name}}! Your check-in is on {{check_in}}. Please let us know your estimated arrival time so we can have everything ready.\n\nSee you soon.', 0),
    ('Thank you for staying', E'Hi {{guest_name}},\n\nThank you so much for staying with us — it was a pleasure to host you. We hope you had a wonderful time and would love to welcome you back any time.', 1),
    ('Review request', E'Hi {{guest_name}},\n\nWe hope you enjoyed your stay at {{listing_name}}! If you have a moment, we''d really appreciate a quick review — it helps us a lot and helps future guests know what to expect.\n\nThank you!', 2),
    ('Come back soon (special offer)', E'Hi {{guest_name}},\n\nWe''d love to have you back! As a returning guest, get in touch directly for our best available rate — booking direct means no extra fees for you.\n\nHope to see you again soon.', 3)
) AS t(title, body, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM message_templates m WHERE m.host_id = h.id AND m.title = t.title
);
