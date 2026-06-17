-- Migration: Affiliate program — admin-editable terms text.
--
-- Adds affiliate_settings.terms_content so the actual affiliate terms shown on
-- the gated /portal/affiliates programme are controlled from the admin
-- (Affiliates → Terms), not hardcoded in the component. `{brand}` is a
-- placeholder the UI replaces with the live brand name. Blank lines separate
-- paragraphs when rendered.

ALTER TABLE public.affiliate_settings
  ADD COLUMN IF NOT EXISTS terms_content text;

-- Seed the singleton with the previous hardcoded copy so nothing regresses.
UPDATE public.affiliate_settings
SET terms_content = COALESCE(terms_content,
'As a {brand} affiliate you may promote {brand} products using the unique referral link and approved marketing material provided to you. You may not misrepresent {brand}, bid on {brand} brand terms in paid search, spam, or self-refer.

Commission is calculated on the net amount a referred customer actually pays {brand} for a product (excluding VAT and before payout fees), at the rate set on that product. A referred customer is attributed to you for 30 days from their click and remains yours once they create an account.

Commission is held until the refund window passes, then becomes payable. Refunded or charged-back sales reverse the related commission. Payouts are made on request once your cleared balance meets the threshold; the payout processor fee is deducted from your payout. {brand} may suspend an affiliate for abuse, which voids pending commission. {brand} may update these terms; continued use means you accept the changes.')
WHERE id = true;

COMMENT ON COLUMN public.affiliate_settings.terms_content IS
  'Admin-editable affiliate terms body shown on the gated programme. {brand} is replaced with the live brand name; blank lines separate paragraphs.';
