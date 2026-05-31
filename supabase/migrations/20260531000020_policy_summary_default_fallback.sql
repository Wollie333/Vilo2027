-- Migration: listing policy summary falls back to the host's active defaults
--
-- `get_listing_policy_summary` previously returned ONLY the policies a host had
-- explicitly assigned to the listing (listing_policies, room_id IS NULL). A
-- listing with no explicit assignment returned `{}`, so the guest-facing
-- ListingPolicyBlock rendered nothing and the listing fell back to the legacy
-- flexible/moderate/strict blurb.
--
-- The `policies.is_default` column (added in 20260531000003) is documented as
-- "the fallback for rooms with no explicit assignment" — this wires that intent
-- into the public summary so EVERY listing surfaces the host's real, active
-- default policies (cancellation / check-in-out / house rules / booking terms /
-- privacy) on both the listing detail page and the checkout page.
--
-- Precedence per type: explicit listing-wide assignment (active) → host's
-- active default (is_default) → omitted. Signature is unchanged (uuid → jsonb),
-- so no generated-types change is required.

CREATE OR REPLACE FUNCTION get_listing_policy_summary(p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb := '{}';
  v_host   uuid;
  v_type   text;
  v_pid    uuid;
  v_pol    policies%ROWTYPE;
  v_rules  jsonb;
  v_cont   jsonb;
BEGIN
  SELECT host_id INTO v_host FROM listings WHERE id = p_listing_id;

  FOREACH v_type IN ARRAY
    ARRAY['cancellation','check_in_out','house_rules','booking_terms','privacy']
  LOOP
    v_pid := NULL;

    -- 1. Explicit listing-wide assignment (must be active).
    SELECT p.id INTO v_pid
    FROM listing_policies lp
    JOIN policies p ON p.id = lp.policy_id
    WHERE lp.listing_id = p_listing_id
      AND lp.room_id IS NULL
      AND lp.policy_type = v_type
      AND p.status = 'active'
      AND p.deleted_at IS NULL
    LIMIT 1;

    -- 2. Fall back to the host's active default of this type.
    IF v_pid IS NULL AND v_host IS NOT NULL THEN
      SELECT p.id INTO v_pid
      FROM policies p
      WHERE p.host_id = v_host
        AND p.type = v_type
        AND p.is_default = true
        AND p.status = 'active'
        AND p.deleted_at IS NULL
      LIMIT 1;
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
  'Public guest-facing policy summary for a listing. Precedence per type: explicit listing-wide assignment (active) → host active default (is_default) → omitted. Returns cancellation / check_in_out / house_rules / booking_terms / privacy keyed by type.';
