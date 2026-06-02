-- Migration: quote version history.
--
-- Hosts can now edit a quote after it's been sent (the guest asked to change
-- something). Each edit snapshots the PRE-edit state into quote_versions so the
-- previously-issued quote — and the PDF that can be regenerated from it — is
-- never lost. The live quote is always the newest version; older versions are
-- read-only history.

CREATE TABLE public.quote_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version_no  integer NOT NULL,
  -- Full render-ready snapshot: quote fields + line items + rooms as they were.
  snapshot    jsonb NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  currency    text NOT NULL DEFAULT 'ZAR',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_quote_version UNIQUE (quote_id, version_no)
);

CREATE INDEX idx_quote_versions_quote ON quote_versions (quote_id, version_no DESC);

-- Track the current version number on the quote (starts at 1 on create).
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

-- Host reads versions of their own quotes; writes go through the Server Action
-- (which runs as the authenticated host and is gated by quote ownership).
CREATE POLICY "host_read_own_quote_versions" ON quote_versions FOR SELECT
  USING (
    quote_id IN (SELECT id FROM quotes WHERE host_id = get_my_host_id())
  );

CREATE POLICY "host_insert_own_quote_versions" ON quote_versions FOR INSERT
  WITH CHECK (
    quote_id IN (SELECT id FROM quotes WHERE host_id = get_my_host_id())
  );

CREATE POLICY "staff_read_quote_versions" ON quote_versions FOR SELECT
  USING (
    quote_id IN (SELECT id FROM quotes WHERE host_id = get_my_host_id_as_staff())
  );
