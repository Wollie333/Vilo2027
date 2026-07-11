-- Migration: seed policy presets only when the host has NO policy of a type
--
-- THE BUG THIS FIXES
-- ------------------
-- `ensure_host_policy_presets` (20260618000500) is invoked on every
-- /dashboard/policies render (and setup, host-create, checkout). It seeded a
-- fresh active default of a type whenever the host had no *active* policy of
-- that type. But a host can legitimately draft their policies — and the moment
-- the last active policy of a type is drafted, the next page load found "no
-- active <type>" and INSERTED A BRAND-NEW DUPLICATE (active, is_default). Draft
-- → reload → a second identical "House rules" card appears; repeat → they pile
-- up. (Discovered in the host-dashboard sweep by toggling the sole House rules
-- policy to draft.)
--
-- THE FIX
-- -------
-- Make the seeder a true first-time seeder: it seeds a type only when the host
-- has NO non-deleted policy of that type AT ALL (active OR draft). A host who
-- has drafted their only policy of a type keeps exactly that one row — no
-- duplicate is spawned. The "every listing must resolve an active default"
-- invariant is now upheld at the source instead: togglePolicyStatusAction
-- refuses to draft the last active policy of a type (see
-- app/[locale]/dashboard/policies/actions.ts), so a type can never be left with
-- zero active policies through the UI.
--
-- Idempotent + safe: for a brand-new host (no rows) behaviour is unchanged
-- (seeds one active default per type). Only the "drafted-only" edge changes:
-- it no longer resurrects a duplicate.

CREATE OR REPLACE FUNCTION ensure_host_policy_presets(p_host_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid uuid;
BEGIN
  -- Moderate cancellation (editable) — 100% at 5d, 50% at 1d, 0% under.
  IF NOT EXISTS (
    SELECT 1 FROM policies
    WHERE host_id = p_host_id AND type = 'cancellation'
      AND deleted_at IS NULL
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
      AND deleted_at IS NULL
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
      AND deleted_at IS NULL
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
  'Idempotently seeds the editable system default policies (Moderate cancellation, Standard check-in & out, House rules) for a host — ONE per type, only when the host has no non-deleted policy of that type. First-time seeder only: it never resurrects a duplicate when a host has drafted their sole policy of a type (2026-07-12).';
