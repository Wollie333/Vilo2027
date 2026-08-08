-- Fix: hard-deleting a REFERRED user was impossible.
--
-- affiliate_referrals.referred_user_id -> user_profiles(id) is ON DELETE
-- CASCADE, so deleting a user removes their referral row. But
-- affiliate_commissions.referral_id -> affiliate_referrals(id) was ON DELETE
-- RESTRICT, and both referral_id and referred_user_id are NOT NULL, so a
-- commission cannot outlive its referral. The RESTRICT therefore blocked the
-- whole user delete with GoTrue's opaque "Database error deleting user"
-- (constraint affiliate_commissions_referral_id_fkey).
--
-- A commission whose referral is gone is meaningless (referral_id is NOT NULL,
-- so it can't be orphaned), so CASCADE is the only consistent behaviour: when a
-- referral is removed, its commissions go with it. The only inbound reference to
-- affiliate_commissions is affiliate_payout_fees.affiliate_commission_id, which
-- is already ON DELETE SET NULL, so this cascade is self-contained.
--
-- NOTE (post-MVP): if the business later wants to PRESERVE a referrer's earned
-- commission after the referred user deletes their account, that requires making
-- referred_user_id / referral_id nullable and anonymising the referral instead
-- of cascading. Out of scope pre-MVP.

alter table public.affiliate_commissions
  drop constraint if exists affiliate_commissions_referral_id_fkey;

alter table public.affiliate_commissions
  add constraint affiliate_commissions_referral_id_fkey
  foreign key (referral_id)
  references public.affiliate_referrals(id)
  on delete cascade;
