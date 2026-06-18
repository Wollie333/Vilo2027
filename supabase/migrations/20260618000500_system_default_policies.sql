-- Migration: three editable system default policies (+ terms), one per type
--
-- Founder decision 2026-06-18: stop seeding the four locked cancellation presets
-- (flexible / moderate / strict / non_refundable). A host should start with ONE
-- editable default of each host-controlled type, active on every property unless
-- they override it:
--   • Moderate cancellation   (editable — was a locked preset)
--   • Standard check-in & out  (14:00 / 10:00)
--   • House rules
--   • Booking terms & conditions  (seeded by 20260618000400)
--
-- "Editable" = preset 'custom' (isLockedPreset → false), so the host edits them
-- in place instead of duplicating a locked preset. The resolver already applies
-- the host's active default wherever a property has no explicit assignment.

-- ─── 1. Make the existing Moderate preset editable; remove the rest ──
UPDATE policies
SET preset = 'custom'
WHERE type = 'cancellation' AND preset = 'moderate' AND deleted_at IS NULL;

-- Drop assignments pointing at the presets we're retiring so properties fall
-- back cleanly to the host default, then archive the preset policies themselves
-- (soft-delete — never hard-delete a policy that may own snapshots).
DELETE FROM property_policies
WHERE policy_id IN (
  SELECT id FROM policies
  WHERE type = 'cancellation'
    AND preset IN ('flexible','strict','non_refundable')
);

UPDATE policies
SET status = 'archived', is_default = false, deleted_at = COALESCE(deleted_at, now())
WHERE type = 'cancellation'
  AND preset IN ('flexible','strict','non_refundable')
  AND deleted_at IS NULL;

-- ─── 2. Seed the editable system defaults (idempotent, per host) ────
-- Replaces the old locked-preset materialiser. Seeds one active, default,
-- editable policy per host-controlled type only when the host has none of it.
CREATE OR REPLACE FUNCTION ensure_host_policy_presets(p_host_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid uuid;
BEGIN
  -- Moderate cancellation (editable) — 100% at 5d, 50% at 1d, 0% under.
  IF NOT EXISTS (
    SELECT 1 FROM policies
    WHERE host_id = p_host_id AND type = 'cancellation'
      AND status = 'active' AND deleted_at IS NULL
  ) THEN
    INSERT INTO policies
      (host_id, name, type, status, preset, is_default, is_non_refundable, summary)
    VALUES
      (p_host_id, 'Moderate cancellation', 'cancellation', 'active', 'custom',
       true, false, 'Full refund up to 5 days before check-in.')
    RETURNING id INTO v_pid;

    INSERT INTO policy_cancellation_rules
      (policy_id, days_before, refund_percent, label, sort_order)
    VALUES
      (v_pid, 5, 100, 'Full refund', 0),
      (v_pid, 1, 50,  '50% refund', 1),
      (v_pid, 0, 0,   'No refund',  2);
  END IF;

  -- Standard check-in & out (editable) — 14:00 / 10:00.
  IF NOT EXISTS (
    SELECT 1 FROM policies
    WHERE host_id = p_host_id AND type = 'check_in_out'
      AND status = 'active' AND deleted_at IS NULL
  ) THEN
    INSERT INTO policies
      (host_id, name, type, status, preset, is_default, summary,
       check_in_time, check_out_time)
    VALUES
      (p_host_id, 'Standard check-in & out', 'check_in_out', 'active', 'custom',
       true, 'Check in from 14:00, check out by 10:00.', '14:00', '10:00');
  END IF;

  -- House rules (editable).
  IF NOT EXISTS (
    SELECT 1 FROM policies
    WHERE host_id = p_host_id AND type = 'house_rules'
      AND status = 'active' AND deleted_at IS NULL
  ) THEN
    INSERT INTO policies
      (host_id, name, type, status, preset, is_default, summary)
    VALUES
      (p_host_id, 'House rules', 'house_rules', 'active', 'custom', true,
       'The rules guests agree to when they book.')
    RETURNING id INTO v_pid;

    INSERT INTO policy_content (policy_id, body_html, locale)
    VALUES (
      v_pid,
      '<h2>House rules</h2><ul>'
      || '<li>No smoking indoors.</li>'
      || '<li>No parties or events.</li>'
      || '<li>Quiet hours after 22:00.</li>'
      || '<li>Please treat the property with respect.</li>'
      || '</ul>',
      'en'
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION ensure_host_policy_presets IS
  'Idempotently seeds the editable system default policies (Moderate cancellation, Standard check-in & out, House rules) for a host — one active default per type. Replaces the old locked four-preset seed (2026-06-18).';

-- ─── 3. Backfill every host ────────────────────────────────────────
DO $$
DECLARE
  v_host uuid;
BEGIN
  FOR v_host IN SELECT id FROM hosts WHERE deleted_at IS NULL LOOP
    PERFORM ensure_host_policy_presets(v_host);
    PERFORM ensure_host_booking_terms(v_host);
    PERFORM ensure_host_default_policies(v_host);
  END LOOP;
END $$;
