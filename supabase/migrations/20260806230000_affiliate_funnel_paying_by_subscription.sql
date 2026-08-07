-- Align the affiliate Metrics-tab funnels with the app's "paying" definition.
--
-- campaign_funnel + program_affiliate_funnel computed paying_hosts from a
-- completed platform_ledger charge that ALSO had subscription_id IS NOT NULL.
-- But the FIRST charge (product-order checkout) never sets subscription_id —
-- only renewals do — so a referred host who just paid their first month showed
-- as 0 paying until their first renewal ~30 days later. Meanwhile the portal +
-- per-affiliate pages count "paying" from the live subscription. Two definitions,
-- two answers.
--
-- Converge both funnels onto the SAME signal the pages use (lib/affiliate/paying.ts
-- isPayingSubscription): a referred host is paying when they hold a live PAID
-- membership — any non-free plan on an active/past-due subscription. Read-only;
-- no money is written. Everything else in each function is unchanged.

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
    -- Live PAID membership = non-free plan on an active/past-due subscription.
    -- Mirrors lib/affiliate/paying.ts so admin Metrics agrees with the portal.
    SELECT DISTINCT hr.user_id
    FROM public.subscriptions sub
    JOIN host_rows hr ON hr.host_id = sub.host_id
    WHERE lower(coalesce(sub.status, '')) IN ('active', 'past_due')
      AND lower(coalesce(sub.plan, '')) NOT IN ('free', 'none', '')
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
    SELECT DISTINCT hr.user_id
    FROM public.subscriptions sub
    JOIN host_rows hr ON hr.host_id = sub.host_id
    WHERE lower(coalesce(sub.status, '')) IN ('active', 'past_due')
      AND lower(coalesce(sub.plan, '')) NOT IN ('free', 'none', '')
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
