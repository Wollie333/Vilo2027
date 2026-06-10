-- Migration: guarantee every host has a default policy per type
--
-- The resolver (20260610180000) falls back to the host's active default when a
-- listing has no explicit assignment. But nothing guaranteed a default ever
-- existed — a host who only had the seeded locked presets (and never marked one
-- default) left every unassigned listing with NO resolvable cancellation policy
-- → guest sees nothing, refund snapshot is empty.
--
-- `ensure_host_default_policies(host)` makes a default exist wherever an active
-- policy of that type exists:
--   • cancellation  → prefer the 'moderate' preset, else any active cancellation
--   • check_in_out  → the oldest active one (only exists once the host makes one)
--   • house_rules   → the oldest active one
-- Idempotent: only fills a type that has no active default yet. One default per
-- host/type is enforced by the partial unique index, so we never create a clash.
--
-- This is also called by the server (createPolicyAction / togglePolicyStatus)
-- so a host's FIRST active policy of a type automatically becomes the default
-- and is therefore immediately valid on every listing lacking an assignment.

CREATE OR REPLACE FUNCTION ensure_host_default_policies(p_host_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_type text;
  v_pid  uuid;
BEGIN
  FOREACH v_type IN ARRAY ARRAY['cancellation','check_in_out','house_rules'] LOOP
    -- Already has an active default of this type? leave it.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM policies
      WHERE host_id = p_host_id AND type = v_type
        AND is_default = true AND status = 'active' AND deleted_at IS NULL
    );

    v_pid := NULL;

    IF v_type = 'cancellation' THEN
      -- Prefer the Moderate preset as a sensible house default.
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

COMMENT ON FUNCTION ensure_host_default_policies IS
  'Idempotently guarantee a host has an active default policy per type (cancellation prefers the moderate preset). Fills only types with no current default. Called on policies-page load and after a policy is created/activated.';

-- Backfill: every host with seeded presets but no default gets one now.
DO $$
DECLARE
  v_host uuid;
BEGIN
  FOR v_host IN SELECT id FROM hosts WHERE deleted_at IS NULL LOOP
    PERFORM ensure_host_default_policies(v_host);
  END LOOP;
END $$;
