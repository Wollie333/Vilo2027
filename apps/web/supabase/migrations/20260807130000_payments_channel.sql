-- Record the underlying rail a gateway used for a payment. Two payments can both
-- arrive via the `paystack` method yet be a CARD vs an instant EFT (e.g. Ozow) —
-- hosts need to see and report on what guests actually pay with. Sourced from the
-- Paystack transaction-verify `data.channel` (card | eft | bank | bank_transfer |
-- ussd | qr | mobile_money). Null for manual/EFT rows and any pre-feature payment.
alter table payments add column if not exists channel text;

comment on column payments.channel is
  'Provider sub-channel for the payment (Paystack verify data.channel: card|eft|bank|bank_transfer|ussd|qr|mobile_money). Null for manual / pre-feature rows.';
