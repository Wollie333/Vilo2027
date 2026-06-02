-- Migration: record how each refund is paid out.
--
-- When a host processes a refund they now choose the payout rail —
-- Paystack (card, automatic), PayPal (automatic), EFT (bank transfer, manual),
-- or Manual (cash / other, manual). Paystack/PayPal are provider-automated;
-- EFT/Manual are sent by the host outside the platform (is_manual = true).
--
-- Pre-MVP: provider calls aren't wired yet, so every method still completes
-- optimistically — but the chosen rail is recorded for the audit trail and the
-- guest-facing notification, and it drives is_manual.

ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS refund_method text
    CHECK (refund_method IN ('paystack', 'paypal', 'eft', 'manual'));

COMMENT ON COLUMN refund_requests.refund_method IS
  'Payout rail the host chose when processing: paystack/paypal (provider-automated) or eft/manual (host-sent, is_manual = true). Null until actioned.';
