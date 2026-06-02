-- Migration: tag quote add-on lines by kind.
--
-- Age/pet charges (children, infants, pets) are persisted as quote_addons so
-- they appear on the PDF + carry to the booking on convert, but they're DERIVED
-- from the party + room rates. Tagging them kind='age' lets the editor exclude
-- them on rehydration (they recompute from the party) instead of double-charging
-- them as custom lines. Existing rows default to 'custom'.

ALTER TABLE public.quote_addons
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'custom'
    CHECK (kind IN ('custom', 'catalog', 'age'));
