-- Migration: one canonical policy resolver for display AND snapshot
--
-- THE BUG THIS FIXES
-- ------------------
-- `get_listing_policy_summary` (20260531000020) resolves a listing's effective
-- policy per type as:  explicit listing-wide assignment → host active default.
-- But `snapshot_booking_policies` (20260531000003) only ever snapshotted an
-- *explicit* listing_policies row (room_id IS NULL) and had NO default
-- fallback and NO room scope.
--
-- Consequence: a host who relies on a default policy (never explicitly assigns
-- it on the listing) shows a perfectly good cancellation policy to the guest on
-- the listing/checkout page, but the booking snapshot is EMPTY → the refund
-- engine returns `no_policy_snapshot` → 0% refund. The displayed policy did not
-- match the enforced policy.
--
-- THE FIX
-- -------
-- `resolve_listing_policy_id(listing, room, type)` is now the single source of
-- truth for "which policy applies". Resolution order, used everywhere:
--     1. room-level assignment  (listing_policies.room_id = room)   — if room given
--     2. listing-wide assignment (listing_policies.room_id IS NULL)
--     3. host active default     (policies.is_default)
--     → else NULL (no policy of this type).
--
-- Both `get_listing_policy_summary` (room-aware via an optional arg) and
-- `snapshot_booking_policies` (room derived from the booking) delegate to it, so
-- the policy a guest sees is guaranteed to be the policy that gets snapshotted
-- and later used for the refund.
--
-- Signature note: the 1-arg `get_listing_policy_summary(uuid)` is dropped and
-- replaced by `get_listing_policy_summary(uuid, uuid DEFAULT NULL)`. The 1-arg
-- RPC call (`{ p_listing_id }`) still resolves to the new function, so the
-- public listing page needs no change. Generated types: the return stays jsonb.

-- ─── 1. Canonical resolver ──────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_listing_policy_id(
  p_listing_id uuid,
  p_room_id    uuid,
  p_type       text
)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_pid  uuid;
  v_host uuid;
BEGIN
  -- 1. Room-level override (only when a room is in play).
  IF p_room_id IS NOT NULL THEN
    SELECT p.id INTO v_pid
    FROM listing_policies lp
    JOIN policies p ON p.id = lp.policy_id
    WHERE lp.listing_id = p_listing_id
      AND lp.room_id = p_room_id
      AND lp.policy_type = p_type
      AND p.status = 'active'
      AND p.deleted_at IS NULL
    LIMIT 1;
    IF v_pid IS NOT NULL THEN RETURN v_pid; END IF;
  END IF;

  -- 2. Listing-wide assignment.
  SELECT p.id INTO v_pid
  FROM listing_policies lp
  JOIN policies p ON p.id = lp.policy_id
  WHERE lp.listing_id = p_listing_id
    AND lp.room_id IS NULL
    AND lp.policy_type = p_type
    AND p.status = 'active'
    AND p.deleted_at IS NULL
  LIMIT 1;
  IF v_pid IS NOT NULL THEN RETURN v_pid; END IF;

  -- 3. Host active default.
  SELECT host_id INTO v_host FROM listings WHERE id = p_listing_id;
  IF v_host IS NULL THEN RETURN NULL; END IF;

  SELECT p.id INTO v_pid
  FROM policies p
  WHERE p.host_id = v_host
    AND p.type = p_type
    AND p.is_default = true
    AND p.status = 'active'
    AND p.deleted_at IS NULL
  LIMIT 1;

  RETURN v_pid;
END;
$$;

COMMENT ON FUNCTION resolve_listing_policy_id IS
  'Single source of truth for the effective policy id of a type on a listing. Precedence: room-level assignment (if room given) → listing-wide assignment → host active default → NULL. Used by both get_listing_policy_summary and snapshot_booking_policies.';

-- ─── 2. Public summary delegates to the resolver (now room-aware) ──
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
  v_cont   jsonb;
BEGIN
  FOREACH v_type IN ARRAY
    ARRAY['cancellation','check_in_out','house_rules','booking_terms','privacy']
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
  'Public guest-facing policy summary for a listing (optionally a specific room). Delegates resolution to resolve_listing_policy_id: room → listing-wide → host default. Returns cancellation / check_in_out / house_rules / booking_terms / privacy keyed by type.';

-- ─── 3. Snapshot uses the SAME resolver, room derived from booking ──
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
  -- A whole-listing booking has no booking_rooms rows (room NULL). A single-room
  -- booking resolves room-level overrides; a multi-room booking is ambiguous, so
  -- it falls back to listing-wide/default (room NULL) — matching what the guest
  -- saw on the listing page summary.
  SELECT count(*), min(room_id) INTO v_nroom, v_room
  FROM booking_rooms WHERE booking_id = p_booking_id;
  IF v_nroom <> 1 THEN
    v_room := NULL;
  END IF;

  FOREACH v_type IN ARRAY
    ARRAY['cancellation','check_in_out','house_rules','booking_terms','privacy']
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
  'Freezes the effective policy of each type onto a booking at creation. Resolution via resolve_listing_policy_id (room → listing-wide → host default), so the snapshot always matches what the guest was shown. Room is derived from booking_rooms (single-room → that room; whole-listing or multi-room → listing-wide/default).';

-- ─── 4. Backfill: any booking missing a cancellation snapshot gets one ──
-- Idempotent (ON CONFLICT DO NOTHING inside the fn). Pre-MVP there is no real
-- data, but this heals any booking created before the resolver fix that relied
-- on a default policy and therefore has an empty/missing cancellation snapshot.
DO $$
DECLARE
  v_b record;
BEGIN
  FOR v_b IN
    SELECT b.id, b.listing_id
    FROM bookings b
    WHERE NOT EXISTS (
      SELECT 1 FROM policy_snapshots s
      WHERE s.booking_id = b.id AND s.policy_type = 'cancellation'
    )
  LOOP
    PERFORM snapshot_booking_policies(v_b.id, v_b.listing_id);
  END LOOP;
END $$;
