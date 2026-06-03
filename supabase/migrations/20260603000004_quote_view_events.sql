-- Migration: per-open tracking for sent quotes.
--
-- quotes.view_count already exists but nothing increments it. The public quote
-- page (app/q/[id]/[token]) runs with the service role (the token is the auth),
-- so on each valid open it bumps view_count and inserts a row here. The host's
-- quote detail page reads these to power the status stepper ("Viewed"), the
-- "opened N times · last seen X" nudge, and the activity timeline.
--
-- Only coarse, non-PII signal is captured (a bucketed device label parsed from
-- the user agent) — no IP, no fingerprinting.
--
-- Pre-MVP data policy (CLAUDE.md): purely additive.

CREATE TABLE IF NOT EXISTS public.quote_view_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id   uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  device     text,
  opened_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_view_events_quote
  ON public.quote_view_events(quote_id, opened_at DESC);

ALTER TABLE public.quote_view_events ENABLE ROW LEVEL SECURITY;

-- Host reads view events for their own quotes. Inserts come from the service
-- role on the public page (bypasses RLS), so there is intentionally no
-- INSERT policy for anon/authenticated.
DROP POLICY IF EXISTS quote_view_events_host_read ON public.quote_view_events;
CREATE POLICY quote_view_events_host_read ON public.quote_view_events
  FOR SELECT TO authenticated
  USING (quote_id IN (SELECT id FROM public.quotes WHERE host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())));

COMMENT ON TABLE public.quote_view_events IS
  'One row per guest open of a sent quote (recorded by the service role on the public quote page). Coarse device label only — no IP/PII. Drives the host quote detail stepper, view nudge and activity log.';
