-- Migration: onboarding wizard hardening — default booking terms for every host,
-- listing-wide default assignments for all four policy types, and the
-- listing-published (onboarding-complete) email event.
--
-- Founder directive 2026-07-12 (NEXT_STEPS §A #4 + #6):
--   • The policies step must start with a DEFAULT of every host-controlled type
--     already active (cancellation, check_in_out, house_rules, booking_terms).
--     Previously the host-create trigger seeded only the first three; a fresh
--     host had NO booking_terms default, and no type was explicitly assigned to
--     the listing, so the wizard rendered every picker as "nothing selected"
--     even though the resolver fell back to the host default at booking time.
--   • On successful publish the host receives an onboarding-complete email — a
--     new notification event `listing_published_host`.
--
-- Pre-MVP data policy (CLAUDE.md): additive + idempotent; safe to re-run.

-- ─── 1. Seed booking_terms at host-create too ──────────────────────
-- ensure_host_booking_terms already exists (20260618000400). Fold it into the
-- AFTER INSERT trigger so every NEW host starts with an active, editable,
-- default Terms & Conditions doc — not just the three seeded by
-- ensure_host_policy_presets.
CREATE OR REPLACE FUNCTION seed_host_policies_on_create()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM ensure_host_policy_presets(NEW.id);   -- cancellation / check_in_out / house_rules
  PERFORM ensure_host_booking_terms(NEW.id);    -- booking_terms (T&C)
  PERFORM ensure_host_default_policies(NEW.id);  -- guarantee an active default per type
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION seed_host_policies_on_create IS
  'AFTER INSERT on hosts: seed the editable default policy of ALL FOUR host types (cancellation, check_in_out, house_rules, booking_terms) and guarantee an active default per type, so every host and every listing resolves each policy from day one.';

-- ─── 2. Assign the host default of each type to a listing, listing-wide ──
-- Makes the four host defaults EXPLICIT on a listing (property_policies rows,
-- room_id NULL) when the listing has no assignment of that type yet. The
-- resolver already falls back to the host default, but an explicit row is what
-- the setup wizard reads to show each policy as the active/selected choice —
-- "active by default", while the host can still pick a different one.
CREATE OR REPLACE FUNCTION ensure_listing_policy_assignments(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_host  uuid;
  v_type  text;
  v_pid   uuid;
BEGIN
  SELECT host_id INTO v_host FROM properties WHERE id = p_listing_id;
  IF v_host IS NULL THEN
    RETURN;
  END IF;

  -- Belt-and-braces: guarantee the host actually has a default of each type
  -- before we try to assign it (a listing can predate the trigger fix above).
  PERFORM ensure_host_policy_presets(v_host);
  PERFORM ensure_host_booking_terms(v_host);
  PERFORM ensure_host_default_policies(v_host);

  FOREACH v_type IN ARRAY
    ARRAY['cancellation','check_in_out','house_rules','booking_terms']
  LOOP
    -- Already assigned listing-wide? leave the host's choice untouched.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM property_policies
      WHERE property_id = p_listing_id
        AND policy_type = v_type
        AND room_id IS NULL
    );

    -- Resolve the effective default (room → listing → host default). With no
    -- listing assignment this returns the host's active default of the type.
    v_pid := resolve_listing_policy_id(p_listing_id, NULL, v_type);
    CONTINUE WHEN v_pid IS NULL;

    INSERT INTO property_policies (property_id, room_id, policy_type, policy_id)
    VALUES (p_listing_id, NULL, v_type, v_pid)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION ensure_listing_policy_assignments IS
  'Idempotently writes a listing-wide (room_id NULL) property_policies assignment for each of the four host policy types, pointing at the host active default, when that type has no listing assignment yet. Makes the setup wizard show every policy as active-by-default while still letting the host reassign.';

-- ─── 3. Backfill: every host gets booking terms; every listing gets assignments ──
DO $$
DECLARE
  v_host uuid;
  v_list uuid;
BEGIN
  FOR v_host IN SELECT id FROM hosts WHERE deleted_at IS NULL LOOP
    PERFORM ensure_host_booking_terms(v_host);
    PERFORM ensure_host_default_policies(v_host);
  END LOOP;

  FOR v_list IN SELECT id FROM properties WHERE deleted_at IS NULL LOOP
    PERFORM ensure_listing_policy_assignments(v_list);
  END LOOP;
END $$;

-- ─── 4. Onboarding-complete email event ────────────────────────────
-- Fired once when a host publishes their first/only listing (togglePublishAction).
-- Email only (no push/in-app) — a milestone confirmation with the live link.
INSERT INTO public.notification_events
  (kind, category_id, feature, severity, email_template_key,
   push_supported, in_app_supported, human_label, human_description)
VALUES
  ('listing_published_host', 'account_security', 'account', 'default',
   'listing_published_host', false, true,
   'Listing published',
   'Sent to the host when their listing goes live, with a summary and the public link.')
ON CONFLICT (kind) DO UPDATE
  SET email_template_key = EXCLUDED.email_template_key,
      human_label        = EXCLUDED.human_label,
      human_description  = EXCLUDED.human_description,
      in_app_supported   = EXCLUDED.in_app_supported;
