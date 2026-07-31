-- Wire the payout sweep-up into competition close (SoT §4.2 / §10.6).
--
-- sweep_affiliate_payouts() (20260730080000) pays out every eligible balance
-- regardless of the R1,000 threshold, but only the annual June cron called it —
-- so a sub-threshold partner's cleared balance sat unpaid until 1 June even after
-- the competition ended. SoT §4.2: "any balance is paid ... at competition close".
--
-- finalize_ended_campaigns() is the hourly auto-close. After it flips any campaign
-- to 'ended', sweep ALL active partners once (guarded on n>0 so the sweep only
-- runs in the hour a campaign actually closes). The sweep is idempotent: it only
-- claims cleared, unattached commission (payout_id IS NULL), so a later close
-- re-sweeps only balances earned since. Body is otherwise the live 20260724000000
-- definition unchanged. The manual close action (closeCampaignNowAction) calls the
-- sweep from TS in the same commit.

CREATE OR REPLACE FUNCTION public.finalize_ended_campaigns()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c   record;
  n   integer := 0;
BEGIN
  FOR c IN
    SELECT id FROM public.affiliate_campaigns
    WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= now()
  LOOP
    UPDATE public.affiliate_campaigns
    SET status = 'ended',
        results = public.compute_campaign_results(c.id),
        results_computed_at = now()
    WHERE id = c.id;
    n := n + 1;
  END LOOP;

  -- Competition close → pay out every eligible balance regardless of threshold
  -- (SoT §4.2). Only when at least one campaign actually closed this run.
  IF n > 0 THEN
    PERFORM public.sweep_affiliate_payouts();
  END IF;

  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_ended_campaigns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_ended_campaigns() TO service_role;
