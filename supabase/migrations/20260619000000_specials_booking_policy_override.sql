-- Migration: Specials — booking wiring (S3) DB support
--
-- Two additive changes the special booking action needs:
--
--   1. snapshot_booking_policies() gains an optional special cancellation policy
--      override. A special may attach its OWN cancellation policy; when a booking
--      is created from that special, the override must win over the normal
--      property/room/host resolution for the cancellation type (other types still
--      resolve normally). Resolution order for cancellation becomes:
--          special override → room → listing-wide → host default.
--      The 2-arg form is dropped and replaced by a 3-arg form with a defaulted
--      third param, so every existing caller (createBookingAction, the confirm
--      backfill) keeps working unchanged.
--
--   2. release_special() — the atomic inverse of redeem_special(). The booking
--      action claims a unit with redeem_special() right after inserting the
--      booking row; if a later step fails it deletes the bare booking row, which
--      does NOT fire on_booking_cancelled (that trigger is AFTER UPDATE OF status,
--      not DELETE). So the rollback ladder calls release_special() to return the
--      claimed unit, race-safe.
--
-- Based on the live definition in 20260618000400_host_booking_terms.sql (4 host
-- policy types: cancellation / check_in_out / house_rules / booking_terms).

-- ─── 1. release_special() — return a claimed redemption ──────────
CREATE OR REPLACE FUNCTION release_special(p_special_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE specials
     SET redemptions_used = GREATEST(0, redemptions_used - 1)
   WHERE id = p_special_id;
END;
$$;

COMMENT ON FUNCTION release_special IS
  'Atomic inverse of redeem_special: returns one claimed unit to a special''s pool. Used by the booking action''s rollback ladder when a special booking unwinds before confirmation (a bare DELETE does not fire on_booking_cancelled).';

-- ─── 2. snapshot_booking_policies() with special override ────────
DROP FUNCTION IF EXISTS snapshot_booking_policies(uuid, uuid);

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
  SELECT count(*), min(room_id) INTO v_nroom, v_room
  FROM booking_rooms WHERE booking_id = p_booking_id;
  IF v_nroom <> 1 THEN
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
  'Freezes the effective policy of each host type onto a booking. Cancellation resolution: special override (if supplied + valid) → room → listing-wide → host default; other types resolve via resolve_listing_policy_id. Privacy stays platform-wide.';
