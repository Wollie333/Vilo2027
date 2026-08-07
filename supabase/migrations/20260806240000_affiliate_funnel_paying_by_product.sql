-- Correct the affiliate funnels' "paying" signal — use product_id, not plan.
--
-- 20260806230000 switched the funnels to a subscription-based paying count, but
-- keyed it on `plan NOT IN ('free',...)`. The `plan` COLUMN is unreliable:
-- activation sets a paid subscription's `product_id` to the product but can leave
-- `plan = 'free'` (confirmed on a live Starter subscriber), so a plan-string check
-- still drops genuine payers. Use the same signal lib/affiliate/paying.ts now uses:
-- a live PAID membership = an active/past-due subscription that carries a
-- product_id (free tier = product_id null), with a non-free plan as a legacy
-- fallback for pre-product paid subs. Read-only; no money written.

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
    SELECT DISTINCT hr.user_id
    FROM public.subscriptions sub
    JOIN host_rows hr ON hr.host_id = sub.host_id
    WHERE lower(coalesce(sub.status, '')) IN ('active', 'past_due')
      AND (
        sub.product_id IS NOT NULL
        OR lower(coalesce(sub.plan, '')) NOT IN ('free', 'none', '')
      )
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
      AND (
        sub.product_id IS NOT NULL
        OR lower(coalesce(sub.plan, '')) NOT IN ('free', 'none', '')
      )
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
