-- Event-sourced quote thread cards + revision reasons.
--
-- The conversation thread should show ONE immutable card per quote lifecycle
-- event (request → sent → revised → accepted → declined → converted) rather than
-- a single card that mutates. To render an older "sent"/"revised" card as the
-- snapshot it was at the time, each quote-card message is pinned to the quote
-- version it represents.
--
-- quote_versions.reason captures WHY a sent quote was revised — the standard
-- estimate-revision audit trail. Quotes remain non-posting documents: nothing
-- here touches the ledger, which only engages on accept → booking → invoice.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS quote_version_no integer;

ALTER TABLE quote_versions
  ADD COLUMN IF NOT EXISTS reason text;

COMMENT ON COLUMN messages.quote_version_no IS
  'For a quote-card system message: the quotes.version this card represents. Lets the thread render an older sent/revised card from its quote_versions snapshot and grey it as superseded once a newer version exists.';
COMMENT ON COLUMN quote_versions.reason IS
  'Why the host revised the sent quote that this snapshot was the prior version of. Shown on the revised-quote card in the thread.';
