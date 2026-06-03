-- Migration: host-only internal notes thread on a quote.
--
-- Powers the "Internal notes (host-only)" card on the quote detail page — a
-- running thread the host/staff use to track the deal (e.g. "held dates loosely,
-- follow up by WhatsApp if no reply by Fri"). NEVER shown to the guest. This is
-- separate from quotes.notes, which is the guest-facing message on the quote.
--
-- Pre-MVP data policy (CLAUDE.md): purely additive.

CREATE TABLE IF NOT EXISTS public.quote_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_notes_quote
  ON public.quote_notes(quote_id, created_at);

ALTER TABLE public.quote_notes ENABLE ROW LEVEL SECURITY;

-- Host manages notes for their own quotes only. No guest/anon access at all.
DROP POLICY IF EXISTS quote_notes_host_manage ON public.quote_notes;
CREATE POLICY quote_notes_host_manage ON public.quote_notes
  FOR ALL TO authenticated
  USING (quote_id IN (SELECT id FROM public.quotes WHERE host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())))
  WITH CHECK (quote_id IN (SELECT id FROM public.quotes WHERE host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())));

COMMENT ON TABLE public.quote_notes IS
  'Host-only internal notes thread on a quote. Never visible to the guest (distinct from quotes.notes, the guest-facing message).';
