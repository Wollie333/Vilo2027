-- Legal docs — per-document VERSION HISTORY.
--
-- legal_documents keeps only the CURRENT version's body; the integer `version`
-- bumps on every content change but old text is not retained there. This adds an
-- append-style history table so every published version's exact text is kept and
-- can be viewed or restored from the admin. Acceptance records (bookings, affiliate
-- signatures, competition entries) reference version NUMBERS — this makes the text
-- behind each of those numbers recoverable.
--
-- Admin-facing only (service_role writes AND reads via the admin client); there is
-- no public read policy. Safe/idempotent to (re-)run.

CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL REFERENCES public.legal_documents(slug) ON DELETE CASCADE,
  version       integer NOT NULL,
  title         text NOT NULL,
  body_html     text,
  published_at  timestamptz,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE INDEX IF NOT EXISTS idx_legal_document_versions_slug
  ON public.legal_document_versions (slug, version DESC);

COMMENT ON TABLE public.legal_document_versions IS
  'Append-style history of every legal_documents version (exact title + body_html per version). Written on each publish; used by the admin to view/restore past versions.';

ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
-- No policies → service_role only (admin actions run as service_role).

-- Backfill: snapshot each document's CURRENT version so history isn't empty for
-- docs that already exist.
INSERT INTO public.legal_document_versions (slug, version, title, body_html, published_at)
SELECT slug, version, title, body_html, published_at
FROM public.legal_documents
ON CONFLICT (slug, version) DO NOTHING;
