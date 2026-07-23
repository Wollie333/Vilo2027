-- Affiliate metrics layer (WS-1m).
--
-- Adds the read-side plumbing behind the new campaign Metrics tab and the
-- program-wide analytics page. NO money is written here — these are STABLE read
-- functions plus one nullable column so a campaign's funnel can start at clicks.
--
-- Everything runs behind requirePermission('subscriptions.edit') via the
-- service-role admin client, so the RPCs are locked to service_role: default
-- CREATE FUNCTION grants EXECUTE to PUBLIC, which we revoke (see the standing
-- "anon COULD MINT CREDITS" trap — always revoke from PUBLIC, not just anon).

-- ── 1. Tag clicks to a campaign ──────────────────────────────────────────────
-- The /r/<slug>?c=<campaignSlug> route already resolves the campaign id before
-- it logs the click; it just had nowhere to store it. With this column the
-- campaign funnel measures the true top of the funnel (clicks), not just the
-- referrals that converted into an account.
ALTER TABLE public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS campaign_id uuid
  REFERENCES public.affiliate_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_campaign
  ON public.affiliate_clicks(campaign_id) WHERE campaign_id IS NOT NULL;

-- ── 2. Campaign funnel ───────────────────────────────────────────────────────
-- One row of headline counts for a single campaign: clicks → referrals →
-- became-a-host → has-a-live-listing → paying. `live_listings` is the same read
-- the leaderboard uses (published, non-suspended, non-deleted properties from
-- referred hosts), so the funnel and the standings can never disagree.
CREATE OR REPLACE FUNCTION public.campaign_funnel(p_campaign_id uuid)
RETURNS TABLE(
  clicks        integer,
  referrals     integer,
  hosts         integer,
  listed_hosts  integer,
  paying_hosts  integer,
  live_listings integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH refs AS (
    SELECT r.referred_user_id
    FROM public.affiliate_referrals r
    WHERE r.campaign_id = p_campaign_id
  ),
  host_rows AS (
    SELECT h.id AS host_id, h.user_id
    FROM public.hosts h
    JOIN refs ON refs.referred_user_id = h.user_id
    WHERE h.deleted_at IS NULL
  ),
  live_props AS (
    SELECT p.host_id
    FROM public.properties p
    JOIN host_rows hr ON hr.host_id = p.host_id
    WHERE p.is_published = true
      AND p.is_suspended = false
      AND p.deleted_at IS NULL
  ),
  paying AS (
    SELECT DISTINCT pl.user_id
    FROM public.platform_ledger pl
    JOIN refs ON refs.referred_user_id = pl.user_id
    WHERE pl.type = 'charge'
      AND pl.status = 'completed'
      AND pl.subscription_id IS NOT NULL
      AND round(pl.amount - COALESCE(pl.vat_amount, 0), 2) > 0
  )
  SELECT
    (SELECT count(*)::int FROM public.affiliate_clicks WHERE campaign_id = p_campaign_id),
    (SELECT count(*)::int FROM refs),
    (SELECT count(DISTINCT user_id)::int FROM host_rows),
    (SELECT count(DISTINCT host_id)::int FROM live_props),
    (SELECT count(*)::int FROM paying),
    (SELECT count(*)::int FROM live_props);
$function$;

REVOKE ALL ON FUNCTION public.campaign_funnel(uuid) FROM PUBLIC;

-- ── 3. Program-wide funnel ───────────────────────────────────────────────────
-- The same shape across the ENTIRE affiliate programme (every referral, campaign
-- or default), plus the active-partner count for the analytics header.
CREATE OR REPLACE FUNCTION public.program_affiliate_funnel()
RETURNS TABLE(
  clicks          integer,
  referrals       integer,
  hosts           integer,
  listed_hosts    integer,
  paying_hosts    integer,
  live_listings   integer,
  active_partners integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH refs AS (
    SELECT r.referred_user_id
    FROM public.affiliate_referrals r
  ),
  host_rows AS (
    SELECT h.id AS host_id, h.user_id
    FROM public.hosts h
    JOIN refs ON refs.referred_user_id = h.user_id
    WHERE h.deleted_at IS NULL
  ),
  live_props AS (
    SELECT p.host_id
    FROM public.properties p
    JOIN host_rows hr ON hr.host_id = p.host_id
    WHERE p.is_published = true
      AND p.is_suspended = false
      AND p.deleted_at IS NULL
  ),
  paying AS (
    SELECT DISTINCT pl.user_id
    FROM public.platform_ledger pl
    JOIN refs ON refs.referred_user_id = pl.user_id
    WHERE pl.type = 'charge'
      AND pl.status = 'completed'
      AND pl.subscription_id IS NOT NULL
      AND round(pl.amount - COALESCE(pl.vat_amount, 0), 2) > 0
  )
  SELECT
    (SELECT count(*)::int FROM public.affiliate_clicks),
    (SELECT count(*)::int FROM refs),
    (SELECT count(DISTINCT user_id)::int FROM host_rows),
    (SELECT count(DISTINCT host_id)::int FROM live_props),
    (SELECT count(*)::int FROM paying),
    (SELECT count(*)::int FROM live_props),
    (SELECT count(*)::int FROM public.affiliate_accounts WHERE status = 'active');
$function$;

REVOKE ALL ON FUNCTION public.program_affiliate_funnel() FROM PUBLIC;
