-- Migration: fix snapshot_booking_policies crashing on min(uuid)
--
-- The room-derivation in 20260610180000/...0004 used `min(room_id)` to grab the
-- single room of a one-room booking. room_id is uuid and Postgres has no
-- min(uuid) aggregate, so the function raised "function min(uuid) does not
-- exist" at plan time — every NEW booking's snapshot silently failed (the
-- booking-create call is best-effort), leaving no cancellation snapshot → 0%
-- refund. (Pre-existing bookings were unaffected: they kept the snapshot taken
-- by the older function at their creation time.)
--
-- Fix: count first, then SELECT the lone room_id only when there is exactly one.

CREATE OR REPLACE FUNCTION snapshot_booking_policies(
  p_booking_id  uuid,
  p_listing_id  uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_room  uuid;
  v_nroom integer;
  v_type  text;
  v_pid   uuid;
  v_pol   policies%ROWTYPE;
  v_data  jsonb;
  v_rules jsonb;
  v_cont  jsonb;
BEGIN
  SELECT count(*) INTO v_nroom FROM booking_rooms WHERE booking_id = p_booking_id;
  IF v_nroom = 1 THEN
    SELECT room_id INTO v_room FROM booking_rooms WHERE booking_id = p_booking_id LIMIT 1;
  ELSE
    v_room := NULL;  -- whole-listing or multi-room → listing-wide/default
  END IF;

  FOREACH v_type IN ARRAY ARRAY['cancellation','check_in_out','house_rules'] LOOP
    v_pid := resolve_listing_policy_id(p_listing_id, v_room, v_type);
    CONTINUE WHEN v_pid IS NULL;

    SELECT * INTO v_pol FROM policies WHERE id = v_pid;

    IF v_type = 'cancellation' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'days_before',    days_before,
          'refund_percent', refund_percent,
          'label',          label
        ) ORDER BY days_before DESC
      ) INTO v_rules
      FROM policy_cancellation_rules WHERE policy_id = v_pid;

      v_data := jsonb_build_object(
        'id',               v_pol.id,
        'name',             v_pol.name,
        'type',             v_pol.type,
        'summary',          v_pol.summary,
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
      FROM policy_content WHERE policy_id = v_pid AND locale = 'en' LIMIT 1;

      v_data := jsonb_build_object(
        'id',               v_pol.id,
        'name',             v_pol.name,
        'type',             v_pol.type,
        'summary',          v_pol.summary,
        'version',          v_pol.version,
        'check_in_time',    v_pol.check_in_time,
        'check_out_time',   v_pol.check_out_time,
        'check_in_method',  v_pol.check_in_method,
        'pets_allowed',     v_pol.pets_allowed,
        'smoking_allowed',  v_pol.smoking_allowed,
        'parties_allowed',  v_pol.parties_allowed,
        'children_welcome', v_pol.children_welcome,
        'quiet_hours_start',v_pol.quiet_hours_start,
        'quiet_hours_end',  v_pol.quiet_hours_end,
        'content',          COALESCE(v_cont, '{}'::jsonb)
      );
    END IF;

    INSERT INTO policy_snapshots (
      booking_id, policy_id, policy_type,
      policy_version, policy_name, snapshot_data
    ) VALUES (
      p_booking_id, v_pid, v_pol.type,
      v_pol.version, v_pol.name, v_data
    )
    ON CONFLICT (booking_id, policy_type) DO NOTHING;
  END LOOP;
END;
$$;

-- Heal any booking left without a cancellation snapshot by the broken version.
DO $$
DECLARE
  v_b record;
BEGIN
  FOR v_b IN
    SELECT b.id, b.listing_id FROM bookings b
    WHERE NOT EXISTS (
      SELECT 1 FROM policy_snapshots s
      WHERE s.booking_id = b.id AND s.policy_type = 'cancellation'
    )
  LOOP
    PERFORM snapshot_booking_policies(v_b.id, v_b.listing_id);
  END LOOP;
END $$;
