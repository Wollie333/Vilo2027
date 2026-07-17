-- Backstop the refund cap in the DB so total refunds can never exceed the money
-- captured on a payment — even under a concurrent / double-clicked approval race.
--
-- approveRefundAction, hostInitiatedRefundAction and the guest refund request each
-- read remaining = amount - refunded_amount and check approvedAmount <= remaining.
-- But payments.refunded_amount is only bumped LATER, by the completion trigger
-- update_payment_refunded_amount. So two approvals against the same payment both
-- read the pre-increment refunded_amount, both pass the app check, and both
-- complete -> refunded_amount ends up > amount, with no constraint to stop it.
--
-- The trigger increments via a row-locked UPDATE, so with this CHECK the second
-- (overflowing) completion is rejected atomically (23514) and its transaction
-- aborts — the refund simply fails instead of paying out money that was never
-- collected. Normal partial/full refunds are unaffected (they sum to <= amount).
ALTER TABLE public.payments
  ADD CONSTRAINT payments_refunded_le_amount
  CHECK (COALESCE(refunded_amount, 0) <= amount);
