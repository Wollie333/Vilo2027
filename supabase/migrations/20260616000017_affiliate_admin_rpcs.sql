-- Migration: Affiliate program — admin RPCs (suspend + payout settlement).
--
-- set_affiliate_status: suspend/reactivate an affiliate. Suspending voids their
--   PENDING commission (cleared/paid is untouched) and stops future accrual
--   (accrue_affiliate_commission checks status='active').
--
-- settle_affiliate_payout: move a payout through approve → paid, or reject it.
--   'paid' flips the attached commission rows cleared→paid. 'reject' un-stamps
--   them (payout_id=NULL) so they return to the available pool.

CREATE OR REPLACE FUNCTION public.set_affiliate_status(
  p_affiliate_id uuid,
  p_status text,
  p_admin uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'bad status %', p_status;
  END IF;

  IF p_status = 'suspended' THEN
    UPDATE public.affiliate_accounts
    SET status = 'suspended', suspended_at = now(),
        suspended_by = p_admin, suspended_reason = p_reason, updated_at = now()
    WHERE id = p_affiliate_id;

    -- Voiding pending commission only — cleared/paid stays.
    UPDATE public.affiliate_commissions
    SET status = 'voided', voided_at = now(), void_reason = 'suspended'
    WHERE affiliate_id = p_affiliate_id
      AND entry_type = 'accrual'
      AND status = 'pending';
  ELSE
    UPDATE public.affiliate_accounts
    SET status = 'active', suspended_at = NULL,
        suspended_by = NULL, suspended_reason = NULL, updated_at = now()
    WHERE id = p_affiliate_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_affiliate_payout(
  p_payout_id uuid,
  p_action text,
  p_admin uuid,
  p_reference text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay public.affiliate_payouts%ROWTYPE;
BEGIN
  SELECT * INTO pay FROM public.affiliate_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;

  IF p_action = 'approve' THEN
    IF pay.status <> 'requested' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'bad_state');
    END IF;
    UPDATE public.affiliate_payouts
    SET status = 'approved', processed_by = p_admin, processed_at = now()
    WHERE id = p_payout_id;

  ELSIF p_action = 'paid' THEN
    IF pay.status NOT IN ('requested', 'approved', 'processing') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'bad_state');
    END IF;
    UPDATE public.affiliate_payouts
    SET status = 'paid', processed_by = p_admin, processed_at = now(),
        provider_reference = COALESCE(p_reference, provider_reference)
    WHERE id = p_payout_id;
    -- The claimed commission rows are now settled.
    UPDATE public.affiliate_commissions
    SET status = 'paid', paid_at = now()
    WHERE payout_id = p_payout_id AND status = 'cleared';

  ELSIF p_action = 'reject' THEN
    IF pay.status NOT IN ('requested', 'approved', 'processing') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'bad_state');
    END IF;
    UPDATE public.affiliate_payouts
    SET status = 'rejected', processed_by = p_admin, processed_at = now(),
        failure_reason = p_reason
    WHERE id = p_payout_id;
    -- Return the claimed commission to the available pool.
    UPDATE public.affiliate_commissions
    SET payout_id = NULL
    WHERE payout_id = p_payout_id;

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'bad_action');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.set_affiliate_status(uuid, text, uuid, text) IS
  'Suspend (voids pending commission) or reactivate an affiliate.';
COMMENT ON FUNCTION public.settle_affiliate_payout(uuid, text, uuid, text, text) IS
  'Admin payout transitions: approve / paid (settles commission) / reject (returns commission to pool).';
