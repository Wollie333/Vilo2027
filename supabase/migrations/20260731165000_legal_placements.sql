-- Legal docs — single source of truth: PLACEMENTS binding layer (Phase 1).
--
-- `legal_documents` (20260720170000) is already the slug-addressable store. This
-- adds a tiny binding table so a well-known app "slot" (Terms, Privacy, Cookies,
-- Affiliate program terms, Founding Host, Review disclosure, Looking-For) points
-- at whichever published legal_documents row fills it. Consumers resolve
-- slot → doc through this table, so the admin/lawyer publishes once and every
-- surface updates — and a slot can be re-pointed at a different doc with no
-- deploy. Competitions keep their own binding (affiliate_campaigns.rules_doc_slug).
--
-- Phase 1 is deliberately NON-DESTRUCTIVE and stays off the money path:
--   * it does NOT change how bookings stamp accepted_terms_version /
--     accepted_privacy_version (that re-point is Phase 2), and
--   * it does NOT touch the affiliate terms source (affiliate_settings) — that
--     rewire is a later phase to avoid colliding with in-flight affiliate work.
-- Only the Cookies page is wired to the store in this phase (see the app code);
-- until a doc is PUBLISHED into a slot, consumers fall back to their built-in
-- static copy, so nothing changes visually on day one.

-- ─── 1. The binding table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legal_placements (
  slot        text PRIMARY KEY,
  doc_slug    text REFERENCES public.legal_documents(slug) ON DELETE SET NULL,
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Slots are stable machine keys (lowercase + underscores). The *catalog* of
  -- known slots is enforced in the app; the DB only guards the format so a typo
  -- can't create a junk slot.
  CONSTRAINT legal_placements_slot_format CHECK (slot ~ '^[a-z0-9]+(_[a-z0-9]+)*$')
);

COMMENT ON TABLE public.legal_placements IS
  'Binds a well-known app slot to the legal_documents row that fills it. Consumers resolve slot → doc; re-pointing a slot changes the live doc with no deploy.';

ALTER TABLE public.legal_placements ENABLE ROW LEVEL SECURITY;

-- The slot → doc mapping is not sensitive (it just names which public doc fills a
-- slot), so it is world-readable. There is no write policy, so INSERT/UPDATE/
-- DELETE are service_role-only (admin actions run as service_role).
DROP POLICY IF EXISTS "public reads legal placements" ON public.legal_placements;
CREATE POLICY "public reads legal placements"
  ON public.legal_placements FOR SELECT
  USING (true);

-- keep updated_at fresh on every write
CREATE OR REPLACE FUNCTION public.tg_legal_placements_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legal_placements_touch ON public.legal_placements;
CREATE TRIGGER trg_legal_placements_touch
  BEFORE UPDATE ON public.legal_placements
  FOR EACH ROW EXECUTE FUNCTION public.tg_legal_placements_touch();

-- ─── 2. Seed the documents the new slots need ────────────────────────
-- terms / privacy / cookies / affiliate-program-terms don't exist in
-- legal_documents yet (terms+privacy live in platform_settings; affiliate terms
-- in affiliate_settings; cookies was static-only). Seed them UNPUBLISHED with a
-- short DRAFT note so:
--   * the FK from legal_placements holds, and
--   * public pages keep their richer built-in static copy until the lawyer
--     pastes final wording in Admin → Legal Docs and hits Publish.
-- The full working drafts for counsel live in docs/legal/*.md.
INSERT INTO public.legal_documents (slug, title, body_html, is_published, published_at)
VALUES
  ('terms', 'Terms of Service',
   '<p><strong>DRAFT — not yet published.</strong> Paste the finalised Terms of Service here and publish. A full working draft is in <code>docs/legal/TERMS_OF_SERVICE.md</code> (incl. Schedule A — Host Data-Processing terms). Until published, the site shows the built-in Terms copy.</p>',
   false, NULL),
  ('privacy', 'Privacy Policy',
   '<p><strong>DRAFT — not yet published.</strong> Paste the finalised Privacy Policy (POPIA) here and publish. Full working draft: <code>docs/legal/PRIVACY_POLICY.md</code>. Until published, the site shows the built-in Privacy copy.</p>',
   false, NULL),
  ('cookies', 'Cookies Policy',
   '<p><strong>DRAFT — not yet published.</strong> Paste the finalised Cookies Policy here and publish. This slot now drives the public Cookies page. Until published, the site shows the built-in Cookies copy.</p>',
   false, NULL),
  ('affiliate-program-terms', 'Affiliate Program Terms',
   '<p><strong>DRAFT — not yet published.</strong> Paste the finalised Affiliate Program Terms here and publish. Full working draft: <code>docs/legal/AFFILIATE_PROGRAM_TERMS.md</code>. Wiring the affiliate gate to this slot is a later phase.</p>',
   false, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ─── 3. Seed the slot catalog ────────────────────────────────────────
-- The 7 launch slots (founder choice: core four + Founding Host / Review /
-- Looking-For). founding-host-terms, review-disclosure and looking-for-notice
-- were seeded by 20260720170000. Re-pointing any slot is done in the admin.
INSERT INTO public.legal_placements (slot, doc_slug)
VALUES
  ('terms',                   'terms'),
  ('privacy',                 'privacy'),
  ('cookies',                 'cookies'),
  ('affiliate_program_terms', 'affiliate-program-terms'),
  ('founding_host_terms',     'founding-host-terms'),
  ('review_disclosure',       'review-disclosure'),
  ('looking_for',             'looking-for-notice')
ON CONFLICT (slot) DO NOTHING;
