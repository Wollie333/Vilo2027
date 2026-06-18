-- Migration: host-authored booking terms & conditions (per-property, default)
--
-- REVERSAL (intentional, founder decision 2026-06-18): 20260610180004 made
-- booking_terms + privacy platform-wide (Vilo-authored) and scoped the policy
-- resolver/snapshot to three host types. Hosts now want to author their OWN
-- property Terms & Conditions, shown at checkout ALONGSIDE Vilo's platform Terms
-- (the platform liability shield in platform_settings.legal_* stays untouched).
--
-- This migration re-enables booking_terms as a host-controlled policy type:
--   1. get_listing_policy_summary + snapshot_booking_policies resolve FOUR host
--      types now (cancellation, check_in_out, house_rules, booking_terms).
--      PRIVACY stays platform-wide (NOT added here).
--   2. Both delegate to the canonical resolve_listing_policy_id (room → listing-
--      wide → host active default) — this also REPAIRS migration drift: the live
--      snapshot fn (recreated by the R3 rename) had lost the host-default
--      fallback, so default-only listings were snapshotting nothing. Restored.
--   3. ensure_host_booking_terms seeds ONE editable default T&C per host so every
--      property resolves a terms doc out of the box (host can edit/duplicate it;
--      only one is active+default at a time).
--   4. ensure_host_default_policies now also guarantees a booking_terms default.

-- ─── 1. Public summary — 4 host types, resolver-delegated ──────────
DROP FUNCTION IF EXISTS get_listing_policy_summary(uuid);

CREATE OR REPLACE FUNCTION get_listing_policy_summary(
  p_listing_id uuid,
  p_room_id    uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb := '{}';
  v_type   text;
  v_pid    uuid;
  v_pol    policies%ROWTYPE;
  v_rules  jsonb;
  v_cont   text;
BEGIN
  FOREACH v_type IN ARRAY
    ARRAY['cancellation','check_in_out','house_rules','booking_terms']
  LOOP
    v_pid := resolve_listing_policy_id(p_listing_id, p_room_id, v_type);
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

      SELECT body_html INTO v_cont
      FROM policy_content WHERE policy_id = v_pid AND locale = 'en' LIMIT 1;

      v_result := v_result || jsonb_build_object(
        'cancellation', jsonb_build_object(
          'name',             v_pol.name,
          'summary',          v_pol.summary,
          'is_non_refundable',v_pol.is_non_refundable,
          'preset',           v_pol.preset,
          'rules',            COALESCE(v_rules, '[]'::jsonb),
          'body_html',        v_cont
        )
      );
    ELSE
      SELECT body_html INTO v_cont
      FROM policy_content WHERE policy_id = v_pid AND locale = 'en' LIMIT 1;

      v_result := v_result || jsonb_build_object(
        v_type, jsonb_build_object(
          'name',             v_pol.name,
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
          'body_html',        v_cont
        )
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_listing_policy_summary IS
  'Guest-facing policy summary for a listing (optionally a room). Resolves cancellation / check_in_out / house_rules / booking_terms via resolve_listing_policy_id (room → listing-wide → host default). Privacy is platform-wide (not here).';

-- ─── 2. Snapshot — same 4 host types, resolver-delegated ───────────
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
  -- Whole-listing booking → room NULL. Single-room booking → that room's
  -- overrides. Multi-room is ambiguous → listing-wide/default (room NULL), which
  -- matches what the guest saw on the listing summary.
  SELECT count(*), min(room_id) INTO v_nroom, v_room
  FROM booking_rooms WHERE booking_id = p_booking_id;
  IF v_nroom <> 1 THEN
    v_room := NULL;
  END IF;

  FOREACH v_type IN ARRAY
    ARRAY['cancellation','check_in_out','house_rules','booking_terms']
  LOOP
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

COMMENT ON FUNCTION snapshot_booking_policies IS
  'Freezes the effective policy of each host type (cancellation / check_in_out / house_rules / booking_terms) onto a booking. Resolution via resolve_listing_policy_id (room → listing-wide → host default), so the snapshot matches what the guest accepted. Privacy is platform-wide (recorded via bookings.accepted_privacy_version).';

-- ─── 3. Seed one editable default Terms & Conditions per host ───────
CREATE OR REPLACE FUNCTION ensure_host_booking_terms(p_host_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid uuid;
BEGIN
  -- Already has an active (non-deleted) booking_terms doc? leave it.
  IF EXISTS (
    SELECT 1 FROM policies
    WHERE host_id = p_host_id AND type = 'booking_terms'
      AND status = 'active' AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO policies (host_id, name, type, status, preset, is_default, summary)
  VALUES (
    p_host_id,
    'Booking terms & conditions',
    'booking_terms',
    'active',
    'custom',
    true,
    'The agreement guests accept at checkout.'
  )
  RETURNING id INTO v_pid;

  INSERT INTO policy_content (policy_id, body_html, locale)
  VALUES (
    v_pid,
    '<h2>Booking terms &amp; conditions</h2>'
    || '<p>By booking this property you agree to the following terms. Please read them carefully before confirming your stay.</p>'
    || '<h3>Booking &amp; payment</h3>'
    || '<p>Your booking is confirmed once payment (or the required deposit) is received. Payments and any refunds are made <strong>directly between you and the host</strong> — the platform does not hold or process the funds and is not party to the transaction.</p>'
    || '<h3>Cancellations &amp; refunds</h3>'
    || '<p>Cancellations are governed by the cancellation policy shown at checkout. Refunds, where due, are issued by the host directly.</p>'
    || '<h3>House rules</h3>'
    || '<p>Guests agree to the house rules for this property, including occupancy limits, quiet hours and any restrictions on smoking, pets or events.</p>'
    || '<h3>Damages &amp; liability</h3>'
    || '<p>Guests are responsible for any damage caused during their stay. The host is not liable for loss or injury except as required by law.</p>'
    || '<p><em>Edit this document to reflect your own terms. You can duplicate it to keep older versions.</em></p>',
    'en'
  );
END;
$$;

COMMENT ON FUNCTION ensure_host_booking_terms IS
  'Idempotently seeds one editable, active, default booking_terms document per host (preset=custom) so every property resolves a Terms & Conditions doc at checkout. The host can edit, duplicate or replace it.';

-- ─── 4. ensure_host_default_policies now covers booking_terms ──────
CREATE OR REPLACE FUNCTION ensure_host_default_policies(p_host_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_type text;
  v_pid  uuid;
BEGIN
  FOREACH v_type IN ARRAY
    ARRAY['cancellation','check_in_out','house_rules','booking_terms']
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM policies
      WHERE host_id = p_host_id AND type = v_type
        AND is_default = true AND status = 'active' AND deleted_at IS NULL
    );

    v_pid := NULL;

    IF v_type = 'cancellation' THEN
      SELECT id INTO v_pid FROM policies
      WHERE host_id = p_host_id AND type = 'cancellation'
        AND preset = 'moderate' AND status = 'active' AND deleted_at IS NULL
      LIMIT 1;
    END IF;

    IF v_pid IS NULL THEN
      SELECT id INTO v_pid FROM policies
      WHERE host_id = p_host_id AND type = v_type
        AND status = 'active' AND deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF v_pid IS NOT NULL THEN
      UPDATE policies SET is_default = true WHERE id = v_pid;
    END IF;
  END LOOP;
END;
$$;

-- ─── 5. Backfill every host: seed terms + ensure defaults ──────────
DO $$
DECLARE
  v_host uuid;
BEGIN
  FOR v_host IN SELECT id FROM hosts WHERE deleted_at IS NULL LOOP
    PERFORM ensure_host_booking_terms(v_host);
    PERFORM ensure_host_default_policies(v_host);
  END LOOP;
END $$;
