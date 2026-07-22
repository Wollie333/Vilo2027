-- Competition-scoped pause for a campaign enrollment.
--
-- Deliberately NOT the same thing as affiliate_accounts.status = 'suspended',
-- which is a GLOBAL suspension: that one stops attribution and commission
-- everywhere. A pause is competition-only. The partner drops off the
-- leaderboard and out of prize contention, but:
--
--   * their referral links keep working — /r/<slug> only consults enrollment
--     status for 'tagged'/'invite' campaigns, and the Founding Race is
--     eligible_partners = 'all';
--   * their lifetime commission ladder is untouched — lib/affiliate/
--     commission.ts and tiers.ts have no campaign coupling at all, so nothing
--     about a pause can reach their money;
--   * their score keeps accruing quietly — campaign_active_listings() filters
--     on affiliate_accounts.status, never on enrollment status, so resuming
--     shows the partner's true current standing rather than a stale snapshot.
--
-- 'withdrawn' (the partner left) and 'removed' (disqualified for good) are
-- terminal. 'paused' is the reversible one.

alter table public.affiliate_campaign_enrollments
  drop constraint if exists affiliate_campaign_enrollments_status_check;

alter table public.affiliate_campaign_enrollments
  add constraint affiliate_campaign_enrollments_status_check
  check (status in ('active', 'paused', 'withdrawn', 'removed'));

alter table public.affiliate_campaign_enrollments
  add column if not exists paused_at timestamptz,
  add column if not exists paused_by uuid
    references public.user_profiles(id) on delete set null,
  add column if not exists paused_reason text;

comment on column public.affiliate_campaign_enrollments.paused_reason is
  'Why the partner was paused. Shown to the partner in their portal and sent in the pause email, so write it for them to read.';
