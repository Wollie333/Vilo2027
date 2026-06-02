-- Migration: quote-level discount.
--
-- A host can knock a percentage or a flat amount off a quote (e.g. a
-- returning-guest thank-you), shown as its own line on the quote/PDF. The
-- computed rand value is stored in discount_amount and subtracted from the
-- total; it carries onto the booking's discount_amount on convert.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS discount_type   text
    CHECK (discount_type IS NULL OR discount_type IN ('percent', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value  numeric NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);
