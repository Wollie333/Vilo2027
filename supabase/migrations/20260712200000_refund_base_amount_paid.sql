-- G5: refund base = amount actually PAID, not the booking total.
--
-- calculate_policy_refund_amount computed the entitlement as
-- `total_amount * refund_percent`. That over-refunds any booking the guest
-- hasn't paid in full — e.g. a deposit-only booking (paid R1 000 of R4 830)
-- with a 100% policy would return R4 830, more than the host ever captured.
--
-- The policy percentage must apply to what the guest actually paid: the NET
-- captured amount (Σ amount − refunded_amount) over the booking's inbound,
-- non-voided payments in a captured status — the SAME definition used by
-- sumPaidFromRows / update_payment_refunded_amount (CHANGELOG #74). This also
-- fixes the mislabelled `total_paid` field, which reported the booking total.
--
-- Only the base changes; the day-band rule matching is untouched.

CREATE OR REPLACE FUNCTION calculate_policy_refund_amount(
  p_booking_id  uuid,
  p_cancelled_at timestamptz DEFAULT now()
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_booking         bookings%ROWTYPE;
  v_snapshot        jsonb;
  v_rules           jsonb;
  v_rule            jsonb;
  v_days_before     integer;
  v_refund_percent  integer := 0;
  v_refund_amount   numeric := 0;
  v_paid            numeric := 0;
  v_matched_rule    text;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  -- Net captured = what the guest has actually paid and the host still holds.
  SELECT COALESCE(SUM(amount - COALESCE(refunded_amount, 0)), 0)
    INTO v_paid
  FROM payments
  WHERE booking_id = p_booking_id
    AND voided_at IS NULL
    AND kind IN ('deposit','balance','addon','payment','credit')
    AND status IN ('completed','partially_refunded','refunded');
  IF v_paid < 0 THEN v_paid := 0; END IF;

  SELECT snapshot_data INTO v_snapshot
  FROM policy_snapshots
  WHERE booking_id = p_booking_id AND policy_type = 'cancellation'
  LIMIT 1;

  IF v_snapshot IS NULL THEN
    RETURN jsonb_build_object(
      'refund_amount', 0, 'refund_percent', 0,
      'rule_applied', 'no_policy_snapshot', 'days_before_checkin', NULL,
      'total_paid', v_paid
    );
  END IF;

  IF (v_snapshot->>'is_non_refundable')::boolean = true THEN
    RETURN jsonb_build_object(
      'refund_amount', 0, 'refund_percent', 0,
      'rule_applied', 'non_refundable', 'days_before_checkin', NULL,
      'total_paid', v_paid
    );
  END IF;

  v_days_before := (v_booking.check_in::date - p_cancelled_at::date)::integer;

  v_rules := v_snapshot->'rules';
  FOR v_rule IN
    SELECT value FROM jsonb_array_elements(v_rules)
    ORDER BY (value->>'days_before')::integer DESC
  LOOP
    IF v_days_before >= (v_rule->>'days_before')::integer THEN
      v_refund_percent := (v_rule->>'refund_percent')::integer;
      v_matched_rule   := v_rule->>'label';
      EXIT;
    END IF;
  END LOOP;

  -- Refund the policy % of what was actually PAID (never more than captured).
  v_refund_amount := ROUND((v_paid * v_refund_percent) / 100.0, 2);

  RETURN jsonb_build_object(
    'refund_amount',      v_refund_amount,
    'refund_percent',     v_refund_percent,
    'rule_applied',       v_matched_rule,
    'days_before_checkin', v_days_before,
    'total_paid',         v_paid
  );
END;
$$;
