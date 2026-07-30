-- Migration: admin referral reassignment within the 30-day window (SoT §3.2 rule 5).
--
-- Wielo may reassign an incorrectly-bound referral to the correct partner within
-- 30 days of the bind. Atomic + money-safe:
--   • only within 30 days of bound_at (raises otherwise);
--   • target must be an active partner and not a self-referral;
--   • moves the referral's affiliate_id;
--   • moves ONLY PENDING commissions — cleared/paid rows already belong to the
--     original partner and are never un-paid;
--   • the campaign_id + commission_snapshot (the stamped rate) stay with the
--     referral — a mis-bind fixes WHO earns, not the rate the host came in on.
-- Audit is written by the calling server action (withAdminAudit).
--
-- service_role only: the default PUBLIC execute grant is revoked (a CREATE
-- FUNCTION grants EXECUTE to PUBLIC — see project-wiring-audit-jul16), so a
-- forged anon/authenticated caller can never reach it.

CREATE OR REPLACE FUNCTION public.reassign_affiliate_referral(
  p_referral_id     uuid,
  p_new_affiliate_id uuid
)
RETURNS TABLE (moved_commissions integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.affiliate_referrals%ROWTYPE;
  a public.affiliate_accounts%ROWTYPE;
  v_moved integer;
BEGIN
  SELECT * INTO r FROM public.affiliate_referrals WHERE id = p_referral_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'reassign: referral not found'; END IF;

  IF now() - r.bound_at > interval '30 days' THEN
    RAISE EXCEPTION 'reassign: outside the 30-day correction window (bound %)', r.bound_at;
  END IF;

  SELECT * INTO a FROM public.affiliate_accounts WHERE id = p_new_affiliate_id;
  IF NOT FOUND OR a.status <> 'active' THEN
    RAISE EXCEPTION 'reassign: target partner not found or not active';
  END IF;
  IF a.id = r.affiliate_id THEN
    RAISE EXCEPTION 'reassign: referral is already bound to that partner';
  END IF;
  IF a.user_id = r.referred_user_id THEN
    RAISE EXCEPTION 'reassign: would be a self-referral';
  END IF;

  UPDATE public.affiliate_referrals SET affiliate_id = a.id WHERE id = r.id;

  UPDATE public.affiliate_commissions
  SET affiliate_id = a.id
  WHERE referral_id = r.id AND status = 'pending';
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  moved_commissions := v_moved;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_affiliate_referral(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_affiliate_referral(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.reassign_affiliate_referral(uuid, uuid) IS
  'Admin: reassign a mis-bound referral to another active partner within 30 days of bind. Moves the referral + its PENDING commissions; keeps campaign_id + snapshot. service_role only.';
