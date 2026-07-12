-- Migration: fix snapshot_booking_policies crashing on min(uuid) — again
--
-- P0 REGRESSION. 20260610180006_fix_snapshot_min_uuid.sql already fixed the
-- `min(uuid)` crash by counting first and SELECTing the lone room only when a
-- booking has exactly one room. The later specials-override migration
-- (20260619000000_specials_booking_policy_override.sql:59) rewrote the 3-arg
-- CREATE OR REPLACE and re-introduced `SELECT count(*), min(room_id) ...`.
-- Postgres has no min(uuid) aggregate, so the function raises
-- "function min(uuid) does not exist" at plan time on EVERY call.
--
-- Because the booking-create snapshot call is best-effort (persist.ts, unchecked
-- await), bookings still succeed — but policy_snapshots ends up EMPTY for every
-- booking. Downstream calculate_policy_refund_amount then returns
-- rule_applied='no_policy_snapshot' → 0% refund for everyone. Guest protection
-- is effectively absent even though checkout shows a cancellation policy.
--
-- Fix: re-apply the count-then-conditional-select room derivation inside the
-- current 3-arg (specials-override) body, preserving the special cancellation
-- override precedence and all 4 host policy types. Then backfill every booking
-- that is missing a cancellation snapshot.
--
-- The 2-arg overload was already dropped by 20260619000000; the 3-arg form's
-- defaulted third param serves persist.ts's 2-arg call. We keep only the 3-arg
-- form so no stale body can ever be resolved again.

CREATE OR REPLACE FUNCTION snapshot_booking_policies(
  p_booking_id                     uuid,
  p_listing_id                     uuid,
  p_special_cancellation_policy_id uuid DEFAULT NULL
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
  -- Whole-listing booking → room NULL. Single-room booking → that room's
  -- overrides. Multi-room is ambiguous → listing-wide/default (room NULL).
  -- Count first, then SELECT the lone room_id only when there is exactly one —
  -- Postgres has no min(uuid) aggregate, so do not aggregate the uuid directly.
  SELECT count(*) INTO v_nroom FROM booking_rooms WHERE booking_id = p_booking_id;
  IF v_nroom = 1 THEN
    SELECT room_id INTO v_room FROM booking_rooms WHERE booking_id = p_booking_id LIMIT 1;
  ELSE
    v_room := NULL;
  END IF;

  FOREACH v_type IN ARRAY
    ARRAY['cancellation','check_in_out','house_rules','booking_terms']
  LOOP
    v_pid := NULL;

    -- Special cancellation override: only for the cancellation type, only when a
    -- valid (active, non-deleted, cancellation) override is supplied. Anything
    -- else falls through to the canonical resolver below.
    IF v_type = 'cancellation' AND p_special_cancellation_policy_id IS NOT NULL THEN
      SELECT id INTO v_pid FROM policies
      WHERE id = p_special_cancellation_policy_id
        AND type = 'cancellation'
        AND status = 'active'
        AND deleted_at IS NULL;
    END IF;

    IF v_pid IS NULL THEN
      v_pid := resolve_listing_policy_id(p_listing_id, v_room, v_type);
    END IF;
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

COMMENT ON FUNCTION snapshot_booking_policies IS
  'Freezes the effective policy of each host type onto a booking. Cancellation resolution: special override (if supplied + valid) → room → listing-wide → host default; other types resolve via resolve_listing_policy_id. Privacy stays platform-wide. Room derivation counts booking_rooms first, then SELECTs the lone room (no min(uuid)).';

-- Backfill: heal every booking left without a cancellation snapshot by the
-- broken version. property_id is the listing the booking is against.
DO $$
DECLARE
  v_b record;
BEGIN
  FOR v_b IN
    SELECT b.id, b.property_id FROM bookings b
    WHERE NOT EXISTS (
      SELECT 1 FROM policy_snapshots s
      WHERE s.booking_id = b.id AND s.policy_type = 'cancellation'
    )
  LOOP
    PERFORM snapshot_booking_policies(v_b.id, v_b.property_id);
  END LOOP;
END $$;
