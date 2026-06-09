-- Persist the quote's price MODE so a single-total quote round-trips on edit.
-- Without this the editor always reopens in "itemised" mode and the auto-price
-- effect overwrites the host's hand-negotiated single total. Additive + safe.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS price_mode text NOT NULL DEFAULT 'itemised';

ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_price_mode_check;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_price_mode_check
  CHECK (price_mode IN ('itemised', 'single'));

COMMENT ON COLUMN quotes.price_mode IS
  'How the host priced the quote: itemised (line-by-line) or single (one negotiated total, no breakdown shown to the guest).';
