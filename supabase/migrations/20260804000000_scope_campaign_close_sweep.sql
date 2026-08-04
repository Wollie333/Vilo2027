-- F3 · Scope the competition-close payout sweep to the CLOSING campaign's
-- participants (multi-competition safety).
--
-- Background: sweep_affiliate_payouts() (20260730080000) pays out every eligible
-- balance regardless of the R1,000 threshold. It was called PLATFORM-WIDE from
-- finalize_ended_campaigns() and closeCampaignNowAction — so closing ONE
-- competition force-swept EVERY active partner, including entrants of OTHER live
-- competitions, cashing out their sub-threshold balances early. With multiple
-- concurrent competitions (the launch goal) that is wrong: a close must only
-- sweep the partners who participated in THE campaign that closed.
--
-- Fix: add p_campaign_id to sweep_affiliate_payouts. When set, the partner loop
-- is restricted to accounts that participated in that campaign. "Participated" =
-- an active enrollment OR a referral/commission bound to the campaign — because
-- an `eligible_partners='all'` campaign (e.g. the Founding Race) lets a partner
-- earn campaign commission WITHOUT an enrollment row, so enrollment alone would
-- miss them. The sweep still pays each matched partner's ENTIRE cleared balance
-- (payouts are blended/lifetime, not per-competition — pt24 decision); the scope
-- only decides WHO gets the threshold-bypassing early sweep, not the amount.
--
-- The sweep remains idempotent (create_affiliate_payout only claims cleared,
-- unattached commission). Body is otherwise the live 20260730080000 definition.

-- Old 1-arg signature is replaced by a 2-arg one (both args default NULL). The
-- June cron's 0-arg call and account-closure's 1-positional-arg call both still
-- resolve via the defaults.
DROP FUNCTION IF EXISTS public.sweep_affiliate_payouts(uuid);

CREATE OR REPLACE FUNCTION public.sweep_affiliate_payouts(
  p_affiliate_id uuid DEFAULT NULL,
  p_campaign_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        record;
  v_method text;
  v_bal    numeric;
  v_res    jsonb;
  v_swept  integer := 0;
  v_skipped integer := 0;
BEGIN
  FOR r IN
    SELECT a.id
    FROM public.affiliate_accounts a
    WHERE a.status = 'active'
      AND (p_affiliate_id IS NULL OR a.id = p_affiliate_id)
      AND (
        p_campaign_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.affiliate_campaign_enrollments e
          WHERE e.affiliate_id = a.id
            AND e.campaign_id = p_campaign_id
            AND e.status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM public.affiliate_referrals rf
          WHERE rf.affiliate_id = a.id
            AND rf.campaign_id = p_campaign_id
        )
        OR EXISTS (
          SELECT 1 FROM public.affiliate_commissions ac
          WHERE ac.affiliate_id = a.id
            AND ac.campaign_id = p_campaign_id
        )
      )
  LOOP
    SELECT COALESCE(sum(commission_amount), 0) INTO v_bal
    FROM public.affiliate_commissions
    WHERE affiliate_id = r.id AND status = 'cleared' AND payout_id IS NULL;
    IF v_bal <= 0 THEN CONTINUE; END IF;

    SELECT method INTO v_method FROM public.affiliate_payout_methods
    WHERE affiliate_id = r.id ORDER BY is_default DESC, created_at LIMIT 1;
    IF v_method IS NULL THEN
      v_skipped := v_skipped + 1;   -- has a balance but no payout method on file
      CONTINUE;
    END IF;

    v_res := public.create_affiliate_payout(r.id, v_method, true);
    IF COALESCE((v_res->>'ok')::boolean, false) THEN
      v_swept := v_swept + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('swept', v_swept, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_affiliate_payouts(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_affiliate_payouts(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.sweep_affiliate_payouts(uuid, uuid) IS
  'Sweep-up payout (SoT §4.2): pays out every eligible balance regardless of the threshold. p_affiliate_id scopes to one partner (account closure); p_campaign_id scopes to one campaign''s participants (enrolled OR referral/commission bound) so closing one competition does not sweep another''s entrants; both NULL = everyone (June cron). Skips partners with no payout method on file.';

-- finalize_ended_campaigns: sweep EACH closed campaign scoped to its own
-- participants, inside the loop, instead of one platform-wide sweep afterwards.
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

    -- Competition close → pay out this campaign's participants regardless of the
    -- threshold (SoT §4.2), scoped so other live competitions are untouched (F3).
    PERFORM public.sweep_affiliate_payouts(NULL, c.id);

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_ended_campaigns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_ended_campaigns() TO service_role;
