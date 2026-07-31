-- Partner account closure with a payout sweep (SoT §4.2 / §10.6 / §88).
--
-- "On partner account closure, any balance is paid regardless of amount." Until
-- now there was no closed state and no closure flow, so the closure sweep-up could
-- not be wired (create_affiliate_payout refuses a non-active account). This adds:
--   1. a terminal 'closed' account status + closed_* audit columns,
--   2. close_affiliate_account(): sweep the balance WHILE still active (bypassing
--      the R1,000 threshold), void any pending accrual, then flip to 'closed'.
-- 'closed' behaves as terminal-inactive everywhere status='active' is required
-- (sweeps, payouts, leaderboards) so a closed partner is cleanly excluded.

-- 1. Allow the new terminal status.
ALTER TABLE public.affiliate_accounts
  DROP CONSTRAINT IF EXISTS affiliate_accounts_status_check;
ALTER TABLE public.affiliate_accounts
  ADD CONSTRAINT affiliate_accounts_status_check
  CHECK (status = ANY (ARRAY['pending','active','suspended','closed']));

-- 2. Closure audit trail.
ALTER TABLE public.affiliate_accounts
  ADD COLUMN IF NOT EXISTS closed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by     uuid,
  ADD COLUMN IF NOT EXISTS closed_reason text;

-- 3. Sweep-then-close. Sweep runs while status is still 'active' (the sweep +
--    create_affiliate_payout both require an active account), so the partner's
--    cleared balance is paid out before the account goes terminal.
CREATE OR REPLACE FUNCTION public.close_affiliate_account(
  p_affiliate_id uuid,
  p_admin uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_sweep  jsonb;
BEGIN
  SELECT status INTO v_status FROM public.affiliate_accounts WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_status = 'closed' THEN
    RETURN jsonb_build_object('ok', true, 'error', 'already_closed', 'swept', jsonb_build_object('swept',0,'skipped',0));
  END IF;
  -- Only an active account can be swept + paid; a suspended one must be
  -- reactivated first (a deliberate admin step, not a silent side effect here).
  IF v_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_active', 'status', v_status);
  END IF;

  -- Pay out every eligible balance regardless of the threshold, BEFORE closing.
  v_sweep := public.sweep_affiliate_payouts(p_affiliate_id);

  -- Commission ceases on closure: void any still-pending accrual (cleared/paid
  -- and the just-created sweep payout are untouched). Mirrors the suspend path.
  UPDATE public.affiliate_commissions
  SET status = 'voided', voided_at = now(), void_reason = 'closed'
  WHERE affiliate_id = p_affiliate_id
    AND entry_type = 'accrual'
    AND status = 'pending';

  UPDATE public.affiliate_accounts
  SET status = 'closed', closed_at = now(), closed_by = p_admin,
      closed_reason = p_reason, updated_at = now()
  WHERE id = p_affiliate_id;

  RETURN jsonb_build_object('ok', true, 'swept', v_sweep);
END;
$$;

REVOKE ALL ON FUNCTION public.close_affiliate_account(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_affiliate_account(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.close_affiliate_account(uuid, uuid, text) IS
  'Terminal partner-account closure: sweeps the cleared balance (threshold bypassed) while still active, voids pending accrual, then sets status=closed. Service-role only.';
