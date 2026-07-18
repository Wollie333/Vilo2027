-- Harden messages RLS: the original `participant_access_msg` was
-- `FOR ALL USING (<conversation membership>)` with NO `WITH CHECK`, so the same
-- membership test was the only gate on INSERT/UPDATE/DELETE and it constrained
-- ONLY conversation_id — not sender_id or is_system_message. Guests are real
-- authenticated users, so within their OWN thread a guest could (via PostgREST):
--   • INSERT a forged system card (is_system_message=true, system_event=
--     'payment_link', attacker attachment_url) → rendered to the host as a
--     "Payment request from Wielo · Pay now" button = in-thread phishing;
--   • spoof sender_id to impersonate the host;
--   • UPDATE/DELETE the host's messages (tamper / delete evidence).
-- Not cross-tenant IDOR (the subquery scopes to participant rows), but a real
-- write-authorization gap.
--
-- Fix: SELECT stays membership-scoped; INSERT additionally requires the row be
-- authored by the caller as a NON-system message; clients get no UPDATE/DELETE.
-- Server-written system cards use the service-role client (bypasses RLS) so they
-- keep working, and the read-marking actions are moved to the service role in
-- the same change (they can no longer UPDATE messages as the user).

DROP POLICY IF EXISTS "participant_access_msg" ON messages;

CREATE POLICY "msg_select" ON messages FOR SELECT USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE host_id = get_my_host_id()
       OR host_id = get_my_host_id_as_staff()
       OR guest_id = auth.uid()
  )
);

CREATE POLICY "msg_insert" ON messages FOR INSERT WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE host_id = get_my_host_id()
       OR host_id = get_my_host_id_as_staff()
       OR guest_id = auth.uid()
  )
  AND sender_id = auth.uid()
  AND is_system_message = false
);

-- No client UPDATE/DELETE policy: only the service role (read-marking, system
-- cards, moderation) may mutate existing message rows. `admin_full_messages`
-- (super_admin) remains for the admin console.
