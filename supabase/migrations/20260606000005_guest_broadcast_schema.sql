-- Migration: Guests (CRM) — Phase 9 · bulk mailer schema
--
-- guest_marketing  — per-guest, per-host marketing subscription (opt-out model
--                    for booking guests; manual contacts gate on host_contacts
--                    .email_consent). Rows minted lazily (per-guest toggle or at
--                    send time to issue an unsub_token). No row OR is_subscribed
--                    = true ⇒ subscribed.
-- guest_broadcasts — INSERT-only send log; also enforces the once-per-calendar-
--                    month cap (one 'sent' row per host per month).
--
-- See GUEST_RECORD_PLAN.md §3 (6,7) + mailer decisions A–E. POPIA: every send
-- carries a working one-click unsubscribe + List-Unsubscribe header (handled in
-- the send path), recipients are re-resolved server-side, and the cap is checked
-- server-side, not just in the UI.

-- ─── guest_marketing ───────────────────────────────────────────────────────
CREATE TABLE public.guest_marketing (
  host_id         uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  gkey            text NOT NULL,
  email           text NOT NULL,
  is_subscribed   boolean NOT NULL DEFAULT true,
  unsub_token     uuid NOT NULL DEFAULT gen_random_uuid(),
  source          text,                        -- 'booking' | 'manual' | 'import'
  subscribed_at   timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  PRIMARY KEY (host_id, gkey)
);
CREATE UNIQUE INDEX idx_guest_marketing_token ON guest_marketing(unsub_token);

COMMENT ON TABLE guest_marketing IS
  'Per-guest marketing subscription state (opt-out basis). Lazy rows: absent OR is_subscribed=true means subscribed. unsub_token powers the public one-click unsubscribe.';

ALTER TABLE guest_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "host_all_guest_marketing" ON guest_marketing FOR ALL
  USING (host_id = get_my_host_id()) WITH CHECK (host_id = get_my_host_id());
CREATE POLICY "staff_all_guest_marketing" ON guest_marketing FOR ALL
  USING (host_id = get_my_host_id_as_staff()) WITH CHECK (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_read_guest_marketing" ON guest_marketing FOR SELECT
  USING (is_super_admin());
-- The public unsubscribe route + the broadcast sender use the service role,
-- which bypasses RLS — no anon policy needed (and none wanted).

-- ─── guest_broadcasts ──────────────────────────────────────────────────────
CREATE TABLE public.guest_broadcasts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  subject         text NOT NULL,
  body            text NOT NULL,               -- sanitized body (plain/markdown)
  audience        text NOT NULL,               -- 'all' | '<segment>' | '<tag>'
  recipient_count int  NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  created_by      uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  sent_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_guest_broadcasts_host_sent ON guest_broadcasts(host_id, sent_at DESC);

COMMENT ON TABLE guest_broadcasts IS
  'INSERT-only broadcast send log. One sent row per host per calendar month enforces the monthly cap (checked server-side in can_send_broadcast + the send action).';

ALTER TABLE guest_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "host_read_guest_broadcasts" ON guest_broadcasts FOR SELECT
  USING (host_id = get_my_host_id());
CREATE POLICY "staff_read_guest_broadcasts" ON guest_broadcasts FOR SELECT
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_read_guest_broadcasts" ON guest_broadcasts FOR SELECT
  USING (is_super_admin());
-- INSERTs happen via the service-role send action only.
