-- Migration: Policy Manager UI support
--
-- The Domain 11 policy tables/RLS/functions/triggers already exist
-- (20260502000000..0008) but were never surfaced in the app. This migration
-- adds the few pieces the new /dashboard/policies UI needs:
--   1. Two new policy types: check_in_out, house_rules (separately assignable).
--   2. summary + structured check-in/out columns on policies.
--   3. Per-room assignment on listing_policies (mirrors listing_addons).
--   4. Snapshot/summary functions + denorm-sync trigger updated for the above.
--   5. ensure_host_policy_presets() to materialise the locked refund presets.
--   6. plan_features row for 'policies' (open on all plans pre-MVP, AGENT_RULES §3.4).
--
-- Pre-MVP data policy (CLAUDE.md): dropping/replacing constraints is fine.

-- ─── 1. Extend the policy-type CHECK constraints ─────────────────
-- Refund terms = 'cancellation', check-in/out = 'check_in_out',
-- house rules = 'house_rules'. booking_terms/privacy kept for the future.
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_type_check;
ALTER TABLE policies ADD CONSTRAINT policies_type_check
  CHECK (type IN ('cancellation','check_in_out','house_rules','booking_terms','privacy'));

ALTER TABLE listing_policies DROP CONSTRAINT IF EXISTS listing_policies_policy_type_check;
ALTER TABLE listing_policies ADD CONSTRAINT listing_policies_policy_type_check
  CHECK (policy_type IN ('cancellation','check_in_out','house_rules','booking_terms','privacy'));

ALTER TABLE policy_snapshots DROP CONSTRAINT IF EXISTS policy_snapshots_policy_type_check;
ALTER TABLE policy_snapshots ADD CONSTRAINT policy_snapshots_policy_type_check
  CHECK (policy_type IN ('cancellation','check_in_out','house_rules','booking_terms','privacy'));

-- ─── 2. New columns on policies ──────────────────────────────────
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS summary        text,
  ADD COLUMN IF NOT EXISTS check_in_time  time,
  ADD COLUMN IF NOT EXISTS check_out_time time;

COMMENT ON COLUMN policies.summary IS
  'Short blurb shown on cards and checkout. Full prose lives in policy_content.body_html.';
COMMENT ON COLUMN policies.check_in_time IS
  'Only used when type = check_in_out.';

-- ─── 3. Per-room assignment on listing_policies ──────────────────
-- Listing-wide default (room_id NULL) + per-room overrides, mirroring
-- listing_addons. The old single-row-per-type constraint is replaced by two
-- NULL-safe partial unique indexes.
ALTER TABLE listing_policies
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES listing_rooms(id) ON DELETE CASCADE;

ALTER TABLE listing_policies DROP CONSTRAINT IF EXISTS unique_policy_type_per_listing;

CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_policies_listingwide
  ON listing_policies(listing_id, policy_type) WHERE room_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_policies_room
  ON listing_policies(listing_id, policy_type, room_id) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listing_policies_room_scoped
  ON listing_policies(room_id) WHERE room_id IS NOT NULL;

COMMENT ON COLUMN listing_policies.room_id IS
  'NULL = listing-wide default. NOT NULL = override for that room only.';

-- ─── 4. Snapshot + summary functions (replace to add new types) ──
-- snapshot_booking_policies: snapshots the LISTING-WIDE policy of each type
-- (room_id IS NULL) at booking creation. Deterministic; per-room snapshots
-- are a later enhancement.
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
    SELECT policy_id, policy_type
    FROM listing_policies
    WHERE listing_id = p_listing_id AND room_id IS NULL
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
      FROM policy_content WHERE policy_id = v_pol.id AND locale = 'en' LIMIT 1;

      v_data := jsonb_build_object(
        'id',             v_pol.id,
        'name',           v_pol.name,
        'type',           v_pol.type,
        'summary',        v_pol.summary,
        'version',        v_pol.version,
        'check_in_time',  v_pol.check_in_time,
        'check_out_time', v_pol.check_out_time,
        'content',        COALESCE(v_cont, '{}'::jsonb)
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

-- get_listing_policy_summary: public-facing, listing-wide policies only.
CREATE OR REPLACE FUNCTION get_listing_policy_summary(p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb := '{}';
  v_lp     record;
  v_rules  jsonb;
  v_cont   jsonb;
BEGIN
  FOR v_lp IN
    SELECT lp.policy_type, p.id AS policy_id, p.name, p.summary,
           p.is_non_refundable, p.preset, p.check_in_time, p.check_out_time
    FROM listing_policies lp
    JOIN policies p ON p.id = lp.policy_id
    WHERE lp.listing_id = p_listing_id AND lp.room_id IS NULL AND p.status = 'active'
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

      SELECT body_html INTO v_cont
      FROM policy_content WHERE policy_id = v_lp.policy_id AND locale = 'en' LIMIT 1;

      v_result := v_result || jsonb_build_object(
        'cancellation', jsonb_build_object(
          'name',             v_lp.name,
          'summary',          v_lp.summary,
          'is_non_refundable',v_lp.is_non_refundable,
          'preset',           v_lp.preset,
          'rules',            COALESCE(v_rules, '[]'::jsonb),
          'body_html',        v_cont
        )
      );
    ELSE
      SELECT body_html INTO v_cont
      FROM policy_content WHERE policy_id = v_lp.policy_id AND locale = 'en' LIMIT 1;

      v_result := v_result || jsonb_build_object(
        v_lp.policy_type, jsonb_build_object(
          'name',           v_lp.name,
          'summary',        v_lp.summary,
          'check_in_time',  v_lp.check_in_time,
          'check_out_time', v_lp.check_out_time,
          'body_html',      v_cont
        )
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- ─── 5. Denorm-sync trigger (replace to cover new types) ─────────
-- Keeps listings columns that the directory + listing page already read in
-- sync with the LISTING-WIDE assigned policy of each type.
CREATE OR REPLACE FUNCTION sync_listing_policy_label()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pol   policies%ROWTYPE;
  v_plain text;
BEGIN
  -- Only the listing-wide assignment drives the denormalised columns.
  IF NEW.room_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pol FROM policies WHERE id = NEW.policy_id;

  IF NEW.policy_type = 'cancellation' THEN
    UPDATE listings SET
      cancellation_policy_label = v_pol.name,
      is_non_refundable         = v_pol.is_non_refundable
    WHERE id = NEW.listing_id;

  ELSIF NEW.policy_type = 'check_in_out' THEN
    UPDATE listings SET
      check_in_time  = v_pol.check_in_time,
      check_out_time = v_pol.check_out_time
    WHERE id = NEW.listing_id;

  ELSIF NEW.policy_type = 'house_rules' THEN
    SELECT body_plain INTO v_plain
    FROM policy_content WHERE policy_id = v_pol.id AND locale = 'en' LIMIT 1;
    UPDATE listings SET house_rules = v_plain WHERE id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 6. Materialise the locked refund presets per host ───────────
-- Reads the seeded default_policy_templates and creates the four cancellation
-- presets as real, assignable policy rows for a host. Idempotent. The locked
-- convention is preset <> 'custom'. Seeded lazily on first /dashboard/policies
-- visit and defensively in createPolicyAction.
CREATE OR REPLACE FUNCTION ensure_host_policy_presets(p_host_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_templates jsonb;
  v_key       text;
  v_tpl       jsonb;
  v_policy_id uuid;
  v_rule      jsonb;
  v_sort      integer;
BEGIN
  SELECT value INTO v_templates FROM platform_settings WHERE key = 'default_policy_templates';
  IF v_templates IS NULL THEN RETURN; END IF;

  FOREACH v_key IN ARRAY ARRAY[
    'cancellation_flexible',
    'cancellation_moderate',
    'cancellation_strict',
    'cancellation_non_refundable'
  ] LOOP
    v_tpl := v_templates -> v_key;
    CONTINUE WHEN v_tpl IS NULL;

    -- Skip if this host already has a (non-deleted) policy with this preset.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM policies
      WHERE host_id = p_host_id
        AND type = 'cancellation'
        AND preset = (v_tpl->>'preset')
        AND deleted_at IS NULL
    );

    INSERT INTO policies (host_id, name, type, status, is_non_refundable, preset, summary)
    VALUES (
      p_host_id,
      v_tpl->>'name',
      'cancellation',
      'active',
      COALESCE((v_tpl->>'is_non_refundable')::boolean, false),
      v_tpl->>'preset',
      v_tpl->>'name'
    )
    RETURNING id INTO v_policy_id;

    v_sort := 0;
    FOR v_rule IN SELECT value FROM jsonb_array_elements(v_tpl->'rules') LOOP
      INSERT INTO policy_cancellation_rules (policy_id, days_before, refund_percent, label, sort_order)
      VALUES (
        v_policy_id,
        (v_rule->>'days_before')::integer,
        (v_rule->>'refund_percent')::integer,
        v_rule->>'label',
        v_sort
      );
      v_sort := v_sort + 1;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION ensure_host_policy_presets IS
  'Idempotently materialise the locked refund presets (flexible/moderate/strict/non_refundable) for a host. Caller passes its own host_id.';

-- ─── 7. Feature gate (open on all plans pre-MVP, AGENT_RULES §3.4) ─
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
  ('free',     'policies', true, null, 'Policy manager (refund terms, check-in/out, house rules)'),
  ('basic',    'policies', true, null, 'Policy manager (refund terms, check-in/out, house rules)'),
  ('pro',      'policies', true, null, 'Policy manager (refund terms, check-in/out, house rules)'),
  ('business', 'policies', true, null, 'Policy manager (refund terms, check-in/out, house rules)')
ON CONFLICT (plan, feature_key) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled,
      limit_value = EXCLUDED.limit_value,
      description = EXCLUDED.description;
