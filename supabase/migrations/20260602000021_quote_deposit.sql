-- Migration: quote deposit terms + booking balance tracking.
--
-- A host can set how a guest secures the quote: pay a deposit (a %), the full
-- amount, or reserve only. The quote stores the chosen terms + the computed
-- deposit / balance. On convert the booking carries the deposit_amount, the
-- outstanding balance_due and a balance_due_date so the host can collect the
-- rest before check-in. The invoice/payment triggers are untouched — balance_due
-- is informational tracking on top of the existing total.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS deposit_type text NOT NULL DEFAULT 'full'
    CHECK (deposit_type IN ('deposit', 'full', 'reserve')),
  ADD COLUMN IF NOT EXISTS deposit_pct numeric NOT NULL DEFAULT 50
    CHECK (deposit_pct >= 0 AND deposit_pct <= 100),
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  ADD COLUMN IF NOT EXISTS balance_amount numeric NOT NULL DEFAULT 0 CHECK (balance_amount >= 0),
  ADD COLUMN IF NOT EXISTS balance_due_days integer NOT NULL DEFAULT 7 CHECK (balance_due_days >= 0);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_amount  numeric NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  ADD COLUMN IF NOT EXISTS balance_due     numeric NOT NULL DEFAULT 0 CHECK (balance_due >= 0),
  ADD COLUMN IF NOT EXISTS balance_due_date date;
