-- Migration: v1.1 Database Functions (Refund + Policy Manager)
-- Per supabase_database.md §13.5 and §14.8

-- ═══ Refund Manager Functions ═════════════════════════════════

-- calculate_policy_refund_amount
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
  v_matched_rule    text;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  SELECT snapshot_data INTO v_snapshot
  FROM policy_snapshots
  WHERE booking_id = p_booking_id AND policy_type = 'cancellation'
  LIMIT 1;

  IF v_snapshot IS NULL THEN
    RETURN jsonb_build_object(
      'refund_amount', 0, 'refund_percent', 0,
      'rule_applied', 'no_policy_snapshot', 'days_before_checkin', NULL
    );
  END IF;

  IF (v_snapshot->>'is_non_refundable')::boolean = true THEN
    RETURN jsonb_build_object(
      'refund_amount', 0, 'refund_percent', 0,
      'rule_applied', 'non_refundable', 'days_before_checkin', NULL
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

  v_refund_amount := ROUND((v_booking.total_amount * v_refund_percent) / 100.0, 2);

  RETURN jsonb_build_object(
    'refund_amount',      v_refund_amount,
    'refund_percent',     v_refund_percent,
    'rule_applied',       v_matched_rule,
    'days_before_checkin', v_days_before,
    'total_paid',         v_booking.total_amount
  );
END;
$$;

-- get_host_refund_stats
CREATE OR REPLACE FUNCTION get_host_refund_stats(p_host_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'pending_count',    COUNT(*) FILTER (WHERE status = 'pending'),
    'escalated_count',  COUNT(*) FILTER (WHERE status = 'escalated'),
    'completed_this_month', COUNT(*) FILTER (
      WHERE status = 'completed' AND created_at >= date_trunc('month', now())
    ),
    'total_refunded_this_month', COALESCE(SUM(approved_amount) FILTER (
      WHERE status = 'completed' AND created_at >= date_trunc('month', now())
    ), 0)
  )
  FROM refund_requests WHERE host_id = p_host_id;
$$;

-- ═══ Policy Manager Functions ═════════════════════════════════

-- snapshot_booking_policies — called by booking-create Edge Function
CREATE OR REPLACE FUNCTION snapshot_booking_policies(
  p_booking_id  uuid,
  p_listing_id  uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lp    record;
  v_pol   policies%ROWTYPE;
  v_data  jsonb;
  v_rules jsonb;
  v_cont  jsonb;
BEGIN
  FOR v_lp IN
    SELECT policy_id, policy_type FROM listing_policies WHERE listing_id = p_listing_id
  LOOP
    SELECT * INTO v_pol FROM policies WHERE id = v_lp.policy_id;

    IF v_pol.type = 'cancellation' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'days_before',    days_before,
          'refund_percent', refund_percent,
          'label',          label
        ) ORDER BY days_before DESC
      ) INTO v_rules
      FROM policy_cancellation_rules WHERE policy_id = v_pol.id;

      v_data := jsonb_build_object(
        'id',               v_pol.id,
        'name',             v_pol.name,
        'type',             v_pol.type,
        'is_non_refundable',v_pol.is_non_refundable,
        'preset',           v_pol.preset,
        'version',          v_pol.version,
        'rules',            COALESCE(v_rules, '[]'::jsonb)
      );
    ELSE
      SELECT jsonb_build_object(
        'body_html',  body_html,
        'body_plain', body_plain,
        'locale',     locale
      ) INTO v_cont
      FROM policy_content WHERE policy_id = v_pol.id AND locale = 'en' LIMIT 1;

      v_data := jsonb_build_object(
        'id', v_pol.id, 'name', v_pol.name, 'type', v_pol.type,
        'version', v_pol.version, 'content', COALESCE(v_cont, '{}'::jsonb)
      );
    END IF;

    INSERT INTO policy_snapshots (
      booking_id, policy_id, policy_type,
      policy_version, policy_name, snapshot_data
    ) VALUES (
      p_booking_id, v_pol.id, v_pol.type,
      v_pol.version, v_pol.name, v_data
    )
    ON CONFLICT (booking_id, policy_type) DO NOTHING;
  END LOOP;
END;
$$;

-- get_listing_policy_summary — public-facing (no auth)
CREATE OR REPLACE FUNCTION get_listing_policy_summary(p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb := '{}';
  v_lp     record;
  v_rules  jsonb;
BEGIN
  FOR v_lp IN
    SELECT lp.policy_type, p.name, p.is_non_refundable, p.preset, p.id as policy_id
    FROM listing_policies lp
    JOIN policies p ON p.id = lp.policy_id
    WHERE lp.listing_id = p_listing_id AND p.status = 'active'
  LOOP
    IF v_lp.policy_type = 'cancellation' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'days_before',    days_before,
          'refund_percent', refund_percent,
          'label',          label
        ) ORDER BY days_before DESC
      ) INTO v_rules
      FROM policy_cancellation_rules WHERE policy_id = v_lp.policy_id;

      v_result := v_result || jsonb_build_object(
        'cancellation', jsonb_build_object(
          'name',             v_lp.name,
          'is_non_refundable',v_lp.is_non_refundable,
          'preset',           v_lp.preset,
          'rules',            COALESCE(v_rules, '[]'::jsonb)
        )
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        v_lp.policy_type, jsonb_build_object('name', v_lp.name)
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;
