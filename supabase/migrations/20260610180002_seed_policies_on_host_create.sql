-- Migration: every host gets refund presets + a default at creation
--
-- Presets were only ever materialised lazily when a host opened the Policies
-- page (`ensure_host_policy_presets`). A host who never visited that page had
-- ZERO cancellation policies, so:
--   • the resolver found no listing assignment AND no default → guest saw no
--     cancellation policy on the listing,
--   • the booking snapshot was empty → 0% refund.
--
-- Fix: seed the locked presets + pick a default the moment a host row is
-- created, via an AFTER INSERT trigger, and backfill every existing host.

CREATE OR REPLACE FUNCTION seed_host_policies_on_create()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM ensure_host_policy_presets(NEW.id);
  PERFORM ensure_host_default_policies(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_host_policies ON hosts;
CREATE TRIGGER trg_seed_host_policies
  AFTER INSERT ON hosts
  FOR EACH ROW EXECUTE FUNCTION seed_host_policies_on_create();

COMMENT ON FUNCTION seed_host_policies_on_create IS
  'AFTER INSERT on hosts: materialise the locked refund presets and pick a default so every host (and every listing) resolves a cancellation policy from day one.';

-- Backfill every existing host: seed presets, then guarantee a default.
DO $$
DECLARE
  v_host uuid;
BEGIN
  FOR v_host IN SELECT id FROM hosts WHERE deleted_at IS NULL LOOP
    PERFORM ensure_host_policy_presets(v_host);
    PERFORM ensure_host_default_policies(v_host);
  END LOOP;
END $$;

-- Re-snapshot any booking whose cancellation snapshot is still missing now that
-- the host has a resolvable default (idempotent — ON CONFLICT DO NOTHING).
DO $$
DECLARE
  v_b record;
BEGIN
  FOR v_b IN
    SELECT b.id, b.listing_id FROM bookings b
    WHERE NOT EXISTS (
      SELECT 1 FROM policy_snapshots s
      WHERE s.booking_id = b.id AND s.policy_type = 'cancellation'
    )
  LOOP
    PERFORM snapshot_booking_policies(v_b.id, v_b.listing_id);
  END LOOP;
END $$;
