-- Add-ons: per-add-on refundability (G7). Some add-ons are non-refundable once
-- committed (a booked chef, event tickets, a non-returnable hamper). On a
-- cancellation these are RETAINED first — they come out of the policy refund
-- before anything else: refund = max(0, policyRefund − nonRefundableAddonsPaid).
-- Default true (refundable) so existing behaviour is unchanged.
alter table public.addons
  add column if not exists is_refundable boolean not null default true;

comment on column public.addons.is_refundable is
  'When false, the amount paid for this add-on is retained on cancellation (subtracted from the policy refund first).';
