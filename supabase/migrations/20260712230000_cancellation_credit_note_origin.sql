-- Cancellation accounting: a cancelled booking is reversed with a CREDIT NOTE,
-- not by voiding the (issued, VAT-bearing) invoice.
--
-- Accounting principle (SARS/IFRS): an issued tax invoice is immutable — you
-- reverse all or part of it with a credit note that carries its own VAT reversal,
-- you do NOT void/delete it. A cancellation keeps the invoice and mints a
-- credit note for the reversed portion `(total − paid) + refund`; whatever remains
-- invoiced (`paid − refund`) is the retained cancellation fee = recognised revenue
-- (VAT included). No-show forfeiture is the same flow with refund = 0.
--
-- This adds a distinct `origin='cancellation'` so these reversal credit notes are
-- told apart from goodwill store-credit ('manual') notes: they reduce the
-- receivable in the ledger but must NOT post spendable store credit to
-- guest_credit_ledger. 'refund_auto' is re-allowed (a completed refund still
-- mints its own note via trigger) alongside the two.

ALTER TABLE credit_notes DROP CONSTRAINT IF EXISTS credit_notes_origin_check;
ALTER TABLE credit_notes
  ADD CONSTRAINT credit_notes_origin_check
  CHECK (origin IN ('manual', 'cancellation', 'refund_auto'));
