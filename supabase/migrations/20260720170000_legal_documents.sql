-- WS-6a — generic legal document store.
--
-- The three platform docs (booking terms, privacy, affiliate terms) live in
-- platform_settings and are wired to /terms + /privacy. This adds a GENERIC,
-- slug-addressable store so the attorney can paste final copy for ANY legal
-- instrument and have it take effect live at /legal/<slug>, version-retained:
-- competition rules (the CPA-required fixed retained URL), Founding Host terms,
-- review disclosure, the Looking-For POPIA notice, etc.
--
-- Mirrors the existing legal pipeline: HTML is sanitised on write AND read, and
-- `version` bumps only when the body actually changes (so any acceptance record
-- referencing a version stays meaningful). Public content, so published rows are
-- world-readable; writes are service_role-only (admin actions run as service_role).

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body_html text,
  version integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_documents_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Published legal docs are public content — anyone may read them. There is no
-- write policy, so INSERT/UPDATE/DELETE are service_role-only (admin actions).
DROP POLICY IF EXISTS "public reads published legal docs" ON public.legal_documents;
CREATE POLICY "public reads published legal docs"
  ON public.legal_documents FOR SELECT
  USING (is_published = true);

-- keep updated_at fresh on every write
CREATE OR REPLACE FUNCTION public.tg_legal_documents_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legal_documents_touch ON public.legal_documents;
CREATE TRIGGER trg_legal_documents_touch
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_legal_documents_touch();

-- Seed the instruments the Founding Programme needs a home for. Published so the
-- routes resolve immediately (the CPA competition-rules URL must be live day one);
-- each carries a clear DRAFT notice until counsel supplies final wording.
INSERT INTO public.legal_documents (slug, title, body_html, is_published, published_at)
VALUES
  ('founding-race-rules', 'Founding Race — Competition Rules',
   '<p><strong>DRAFT — pending final legal copy.</strong> The official rules of the Wielo Founding Race competition will be published here before the competition opens, and retained at this URL for the duration required by the Consumer Protection Act.</p>',
   true, now()),
  ('founding-host-terms', 'Founding Host Terms',
   '<p><strong>DRAFT — pending final legal copy.</strong> The terms of the Wielo Founding Host offer — including the lifetime price-lock — will be published here before any host is enrolled.</p>',
   true, now()),
  ('review-disclosure', 'Review Disclosure',
   '<p><strong>DRAFT — pending final legal copy.</strong> How Wielo collects, verifies and displays guest reviews.</p>',
   true, now()),
  ('looking-for-notice', 'Looking For — Privacy Notice',
   '<p><strong>DRAFT — pending final legal copy.</strong> How Wielo processes the personal information you share when you post a Looking-For request, in line with POPIA.</p>',
   true, now())
ON CONFLICT (slug) DO NOTHING;
