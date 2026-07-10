-- Add SWIFT/BIC code to Wielo's own EFT bank details (platform_payment_settings).
-- Printed on Wielo invoices as part of the EFT payment instructions, alongside
-- bank name / account / branch. Nullable — many local (ZA) accounts don't need it.

alter table public.platform_payment_settings
  add column if not exists eft_swift_code text;

comment on column public.platform_payment_settings.eft_swift_code is
  'SWIFT/BIC code for Wielo''s EFT bank account. Shown on Wielo invoices.';
