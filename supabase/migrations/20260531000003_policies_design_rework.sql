-- Migration: Policies page design rework
--
-- Surfaces the new "Policies Library" design (dark hero + card grid). Adds the
-- structured fields the cards render but the schema didn't carry yet:
--   1. policies.is_default      — the ⭐ Default badge (one default per host/type).
--   2. House-rule flag columns  — the chips (Pets / Smoking / Parties / Quiet hrs).
--   3. policies.check_in_method — the "Self check-in" pill on check-in/out cards.
--   4. ensure_host_legal_presets() — seed a Booking-terms + POPIA privacy policy
--      per host so the "Terms & privacy" cards show out of the box.
--   5. Snapshot + summary functions extended to carry the new fields.
--
-- Pre-MVP data policy (CLAUDE.md): reshaping freely, no backfill shims.

-- ─── 1. Default policy per type ──────────────────────────────────
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- At most one default per host per policy type (among live rows).
CREATE UNIQUE INDEX IF NOT EXISTS uq_policies_one_default_per_type
  ON policies(host_id, type)
  WHERE is_default AND deleted_at IS NULL;

COMMENT ON COLUMN policies.is_default IS
  'The host''s default policy of this type — the fallback for rooms with no explicit assignment. Max one per host per type.';

-- ─── 2. Structured house-rule flags (type = house_rules) ─────────
-- NULL = not specified (no chip). body_html still holds the full prose.
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS pets_allowed      boolean,
  ADD COLUMN IF NOT EXISTS smoking_allowed   boolean,
  ADD COLUMN IF NOT EXISTS parties_allowed   boolean,
  ADD COLUMN IF NOT EXISTS children_welcome  boolean,
  ADD COLUMN IF NOT EXISTS quiet_hours_start time,
  ADD COLUMN IF NOT EXISTS quiet_hours_end   time;

COMMENT ON COLUMN policies.pets_allowed IS
  'House-rule chip. NULL = unspecified, true = Pets OK, false = No pets.';

-- ─── 3. Check-in method (type = check_in_out) ────────────────────
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS check_in_method text
    CHECK (check_in_method IS NULL OR check_in_method IN ('self','host','reception'));

COMMENT ON COLUMN policies.check_in_method IS
  'How guests get in: self (lockbox/smart-lock), host (greeted), reception. Drives the check-in pill.';

-- ─── 4. Seed Booking-terms + Privacy (POPIA) presets per host ────
-- Idempotent, mirrors ensure_host_policy_presets. Gives every host a starter
-- legal pair so the "Terms & privacy" cards render immediately. preset='custom'
-- so they're editable (unlike the locked refund presets).
CREATE OR REPLACE FUNCTION ensure_host_legal_presets(p_host_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Booking terms & conditions
  IF NOT EXISTS (
    SELECT 1 FROM policies
    WHERE host_id = p_host_id AND type = 'booking_terms' AND deleted_at IS NULL
  ) THEN
    INSERT INTO policies (host_id, name, type, status, preset, summary)
    VALUES (
      p_host_id,
      'Booking terms & conditions',
      'booking_terms',
      'draft',
      'custom',
      'The agreement guests accept at checkout — deposit, damages & liability.'
    )
    RETURNING id INTO v_id;

    INSERT INTO policy_content (policy_id, body_html, locale)
    VALUES (
      v_id,
      '<h2>Booking terms &amp; conditions</h2>'
      || '<p>By confirming this booking you agree to the following terms.</p>'
      || '<h3>Deposit</h3><p>A deposit may be required to secure your dates and is applied to your total.</p>'
      || '<h3>Damages</h3><p>Guests are responsible for any damage caused during their stay beyond normal wear and tear.</p>'
      || '<h3>Liability</h3><p>The host is not liable for loss, injury or damage to guests'' personal property except where required by law.</p>',
      'en'
    );
  END IF;

  -- Guest privacy (POPIA)
  IF NOT EXISTS (
    SELECT 1 FROM policies
    WHERE host_id = p_host_id AND type = 'privacy' AND deleted_at IS NULL
  ) THEN
    INSERT INTO policies (host_id, name, type, status, preset, summary)
    VALUES (
      p_host_id,
      'Guest privacy (POPIA)',
      'privacy',
      'draft',
      'custom',
      'How guest data is collected, stored and used. Meets SA POPIA requirements.'
    )
    RETURNING id INTO v_id;

    INSERT INTO policy_content (policy_id, body_html, locale)
    VALUES (
      v_id,
      '<h2>Guest privacy (POPIA)</h2>'
      || '<p>We collect your name, contact details and booking information solely to manage your stay.</p>'
      || '<h3>What we collect</h3><p>Contact details, booking dates, and payment confirmation.</p>'
      || '<h3>How we use it</h3><p>To process your booking, communicate with you, and meet our legal obligations.</p>'
      || '<h3>Your rights</h3><p>Under POPIA you may request access to, correction of, or deletion of your personal information at any time.</p>',
      'en'
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION ensure_host_legal_presets IS
  'Idempotently seed a Booking-terms and Privacy (POPIA) policy for a host. Editable (preset=custom), starts as draft.';

-- ─── 5. Carry the new fields into snapshots + the public summary ──
-- Both functions are SECURITY DEFINER and were last set in
-- 20260529000000_policy_manager_ui_support.sql. Re-create to include
-- check_in_method (check_in_out) and the house-rule flags (house_rules).
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
        'check_in_method',v_pol.check_in_method,
        'pets_allowed',     v_pol.pets_allowed,
        'smoking_allowed',  v_pol.smoking_allowed,
        'parties_allowed',  v_pol.parties_allowed,
        'children_welcome', v_pol.children_welcome,
        'quiet_hours_start',v_pol.quiet_hours_start,
        'quiet_hours_end',  v_pol.quiet_hours_end,
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
           p.is_non_refundable, p.preset, p.check_in_time, p.check_out_time,
           p.check_in_method, p.pets_allowed, p.smoking_allowed,
           p.parties_allowed, p.children_welcome,
           p.quiet_hours_start, p.quiet_hours_end
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
          'name',             v_lp.name,
          'summary',          v_lp.summary,
          'check_in_time',    v_lp.check_in_time,
          'check_out_time',   v_lp.check_out_time,
          'check_in_method',  v_lp.check_in_method,
          'pets_allowed',     v_lp.pets_allowed,
          'smoking_allowed',  v_lp.smoking_allowed,
          'parties_allowed',  v_lp.parties_allowed,
          'children_welcome', v_lp.children_welcome,
          'quiet_hours_start',v_lp.quiet_hours_start,
          'quiet_hours_end',  v_lp.quiet_hours_end,
          'body_html',        v_cont
        )
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;
