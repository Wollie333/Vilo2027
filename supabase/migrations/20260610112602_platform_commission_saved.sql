-- =====================================================
-- Platform-wide commission saved (public marketing stat)
-- =====================================================
-- Powers the "Commission saved" hero card on /booking-management.
-- Returns ONE aggregate number: total commission every host has avoided
-- across the whole platform, all-time, by taking bookings direct.
--
-- Mirrors the per-host calc in fetch_secondary_metrics:
--   commission_saved = SUM(total_amount * 0.15) over direct bookings in
--   status ('confirmed','checked_in','completed'), excluding soft-deleted.
-- The only difference: NO host filter — it sums across every host.
--
-- SECURITY DEFINER + a single scalar return means anon callers can read
-- the rolled-up figure without any per-host row ever being exposed (RLS
-- on bookings stays intact for every other access path).
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_platform_commission_saved()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(total_amount * 0.15), 0)
  FROM bookings
  WHERE status IN ('confirmed', 'checked_in', 'completed')
    AND channel = 'direct'
    AND deleted_at IS NULL;
$$;

COMMENT ON FUNCTION fetch_platform_commission_saved() IS
  'Total commission saved platform-wide (all hosts, all-time): SUM(total_amount * 0.15) over direct confirmed/checked_in/completed bookings. Public marketing stat for the booking-management hero.';

GRANT EXECUTE ON FUNCTION fetch_platform_commission_saved() TO anon, authenticated;
