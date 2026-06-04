-- Migration: let a signed-in guest read their OWN quotes from the portal.
--
-- Until now guest access to a quote went exclusively through the public,
-- token-gated route (/q/[id]/[token]) which reads with the service role and so
-- bypasses RLS. The new in-portal Quotes hub (/portal/quotes) reads with the
-- guest's own session (createServerClient → RLS), so the guest needs a SELECT
-- policy scoped to rows they own. Mirrors the existing `guest_read_own_invoices`
-- policy in 20260524000001_quotes_invoices_addons.sql.
--
-- quotes.guest_id is set even for passwordless "leads" created by the enquiry
-- flow (lib/enquiry/create-enquiry.ts); once a lead claims their account the
-- auth.uid() is unchanged, so these pre-claim quotes surface automatically with
-- no backfill.
--
-- READ-ONLY for guests. Accept/decline still goes through a server action that
-- re-verifies ownership and writes with the service role — no guest UPDATE
-- policy is added here.

-- ─── quotes ────────────────────────────────────────────────────
CREATE POLICY "guest_read_own_quotes" ON quotes FOR SELECT
  USING (guest_id = auth.uid());

-- ─── quote_rooms / quote_addons (line-item detail for the quote page) ──
CREATE POLICY "guest_read_own_quote_rooms" ON quote_rooms FOR SELECT
  USING (quote_id IN (SELECT id FROM quotes WHERE guest_id = auth.uid()));

CREATE POLICY "guest_read_own_quote_addons" ON quote_addons FOR SELECT
  USING (quote_id IN (SELECT id FROM quotes WHERE guest_id = auth.uid()));
