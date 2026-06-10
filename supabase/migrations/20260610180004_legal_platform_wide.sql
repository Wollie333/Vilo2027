-- Migration: booking terms + privacy become platform-wide (Vilo-authored)
--
-- Hosts should not draft legal/POPIA text. Booking terms + privacy are one
-- Vilo-authored document set, super-admin editable, shown at checkout and the
-- public footer, and version-stamped onto each booking for the legal record.
--
-- This migration:
--   1. Retires every per-host booking_terms/privacy policy (soft-delete) and
--      removes their listing assignments.
--   2. Scopes the resolver + snapshot to the THREE host-controlled types
--      (cancellation, check_in_out, house_rules). Legal no longer flows through
--      the per-host policy system at all.
--   3. Neutralises ensure_host_legal_presets so it never re-seeds legal drafts.
--   4. Seeds versioned platform legal settings + booking acceptance columns.

-- ─── 1. Retire per-host legal policies + their assignments ──────────
DELETE FROM listing_policies WHERE policy_type IN ('booking_terms','privacy');

UPDATE policies
SET status = 'archived', is_default = false, deleted_at = COALESCE(deleted_at, now())
WHERE type IN ('booking_terms','privacy') AND deleted_at IS NULL;

-- ─── 2. Resolver-driven functions scoped to host-controlled types ──
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
  FOREACH v_type IN ARRAY ARRAY['cancellation','check_in_out','house_rules'] LOOP
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
  SELECT count(*), min(room_id) INTO v_nroom, v_room
  FROM booking_rooms WHERE booking_id = p_booking_id;
  IF v_nroom <> 1 THEN
    v_room := NULL;
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

-- ─── 3. ensure_host_legal_presets becomes a no-op ──────────────────
CREATE OR REPLACE FUNCTION ensure_host_legal_presets(p_host_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Booking terms + privacy are now platform-wide (Vilo-authored). Hosts no
  -- longer get per-host legal drafts. Kept as a no-op so any lingering caller
  -- (older RPC wiring) stays safe.
  RETURN;
END;
$$;

COMMENT ON FUNCTION ensure_host_legal_presets IS
  'No-op since 20260610180004 — booking terms + privacy are platform-wide (Vilo-authored), not per-host.';

-- ─── 4. Platform legal settings (versioned) + booking acceptance ───
INSERT INTO platform_settings (key, value, description) VALUES
  ('legal_booking_terms',
   jsonb_build_object('html', null, 'version', 1, 'updated_at', now()),
   'Platform-wide booking terms & conditions (Vilo-authored). html=null falls back to the static /terms page.'),
  ('legal_privacy',
   jsonb_build_object('html', null, 'version', 1, 'updated_at', now()),
   'Platform-wide privacy / POPIA notice (Vilo-authored). html=null falls back to the static /privacy page.')
ON CONFLICT (key) DO NOTHING;

-- Which version of each platform legal doc the guest accepted at checkout.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS accepted_terms_version   integer,
  ADD COLUMN IF NOT EXISTS accepted_privacy_version integer;

COMMENT ON COLUMN bookings.accepted_terms_version IS
  'Version of platform_settings.legal_booking_terms the guest accepted at checkout (legal record).';
COMMENT ON COLUMN bookings.accepted_privacy_version IS
  'Version of platform_settings.legal_privacy the guest accepted at checkout (legal record).';
