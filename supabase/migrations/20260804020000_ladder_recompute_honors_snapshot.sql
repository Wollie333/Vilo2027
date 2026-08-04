-- F4 · The nightly ladder re-rate must honor the per-referral SNAPSHOT bands,
-- not the live campaign bands.
--
-- accrue_affiliate_commission (20260730000000) resolves a campaign referral's
-- ladder bands from affiliate_referrals.commission_snapshot (captured at bind
-- time), so the rate is permanent and survives a later edit to the campaign.
-- But recompute_affiliate_campaign_rates (20260720110000) still read the LIVE
-- campaign commission_structure bands. Result: an admin editing a live ladder
-- campaign's bands would have the nightly recompute re-rate that month's PENDING
-- rows to the NEW live bands — silently overriding the snapshot the accrual
-- stamped, breaking the "locked at referral time" guarantee for ladder rows.
--
-- Fix: recompute now sources each pending row's bands from ITS OWN referral's
-- commission_snapshot (falling back to the live campaign structure only when a
-- legacy referral has no snapshot), exactly like accrual. The month-to-date book
-- and the won floor are unchanged (both are inherently current-state). PENDING-
-- only remains the money-safety invariant (a pending row has not emitted its
-- cleared-time platform_ledger mirror, so updating commission_amount can't
-- desync it). Flat / inherit campaigns are untouched (ladder-only). The flat
-- Founding Race is unaffected either way.

CREATE OR REPLACE FUNCTION public.recompute_affiliate_campaign_rates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c        record;
  a        record;
  v_book   numeric;
  v_floor  numeric;
  v_total  integer := 0;
  v_n      integer;
BEGIN
  FOR c IN
    SELECT id, commission_structure AS cs
    FROM public.affiliate_campaigns
    WHERE status = 'active'
      AND commission_structure->>'model' = 'ladder'
  LOOP
    FOR a IN
      SELECT DISTINCT affiliate_id
      FROM public.affiliate_commissions
      WHERE campaign_id = c.id
        AND entry_type = 'accrual'
        AND status = 'pending'
        AND kind IN ('subscription', 'upgrade')
        AND rate_type = 'percent'
        AND created_at >= date_trunc('month', now())
        AND created_at <  date_trunc('month', now()) + interval '1 month'
    LOOP
      -- Book + floor are per (affiliate, campaign) and current-state.
      v_book  := public.campaign_ladder_book(a.affiliate_id, c.id);
      v_floor := COALESCE((
        SELECT floor_rate FROM public.affiliate_campaign_floors
        WHERE affiliate_id = a.affiliate_id AND campaign_id = c.id), 0);

      -- Re-rate each pending row using ITS OWN referral's snapshot bands
      -- (fallback: the live campaign structure for a legacy no-snapshot referral).
      -- The effective rate therefore matches what accrual would have stamped.
      UPDATE public.affiliate_commissions ac
      SET rate_value = round(le.eff * 100, 4),
          commission_amount = round(ac.base_amount * le.eff, 2)
      FROM (
        SELECT ac2.id,
               GREATEST(
                 public.ladder_rate_for_book(
                   COALESCE(r.commission_snapshot->'bands', c.cs->'bands'),
                   v_book),
                 v_floor
               ) AS eff
        FROM public.affiliate_commissions ac2
        JOIN public.affiliate_referrals r ON r.id = ac2.referral_id
        WHERE ac2.campaign_id = c.id
          AND ac2.affiliate_id = a.affiliate_id
          AND ac2.entry_type = 'accrual'
          AND ac2.status = 'pending'
          AND ac2.kind IN ('subscription', 'upgrade')
          AND ac2.rate_type = 'percent'
          AND ac2.created_at >= date_trunc('month', now())
          AND ac2.created_at <  date_trunc('month', now()) + interval '1 month'
      ) le
      WHERE ac.id = le.id;

      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_total := v_total + v_n;
    END LOOP;
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_affiliate_campaign_rates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_affiliate_campaign_rates() TO service_role;

COMMENT ON FUNCTION public.recompute_affiliate_campaign_rates() IS
  'Nightly whole-book re-rate of current-month PENDING ladder commission rows to the current band (MAX band, floor), using each row''s per-referral SNAPSHOT bands (fallback live campaign) so a live-campaign band edit never overrides the locked-at-referral rate (F4). Pending-only → never desyncs the cleared-time platform_ledger mirror.';
