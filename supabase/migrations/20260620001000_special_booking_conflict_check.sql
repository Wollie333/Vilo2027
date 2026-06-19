-- Migration: Enhanced special date availability check
--
-- Updates special_dates_available to also check the bookings table directly,
-- not just blocked_dates. This ensures specials cannot be created/activated
-- on dates that have existing confirmed bookings for the selected room(s).
--
-- The check considers:
--   - confirmed, checked_in bookings (active bookings)
--   - Room-scoped specials: checks if that specific room is booked
--   - Whole-property specials: checks if ANY room is booked
--
-- Booking overlap logic: dates [check_in, check_out) are occupied nights.
-- A special's dates [check_in, check_out) conflict if they overlap.

-- ─── 1. Update special_dates_available to also check bookings ──────────────
CREATE OR REPLACE FUNCTION special_dates_available(
  p_property_id uuid,
  p_room_id     uuid,  -- NULL = whole property deal
  p_check_in    date,
  p_check_out   date,
  p_exclude_special_id uuid DEFAULT NULL  -- exclude existing blocks from this special (for updates)
) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_room_id IS NOT NULL THEN
      -- Room-scoped special: check room availability
      -- 1. No blocked_dates overlap
      NOT EXISTS (
        SELECT 1 FROM blocked_dates
        WHERE property_id = p_property_id
          AND date >= p_check_in
          AND date < p_check_out
          AND (room_id IS NULL OR room_id = p_room_id)
          AND (p_exclude_special_id IS NULL OR special_id IS DISTINCT FROM p_exclude_special_id)
      )
      -- 2. No active bookings overlap for this room
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.property_id = p_property_id
          AND b.status IN ('confirmed', 'checked_in')
          AND b.deleted_at IS NULL
          AND b.check_in < p_check_out
          AND b.check_out > p_check_in
          AND (
            -- Whole-property booking blocks all rooms
            b.scope = 'whole_listing'
            OR
            -- Room-scoped booking: check if this room is in the booking
            EXISTS (
              SELECT 1 FROM booking_rooms br
              WHERE br.booking_id = b.id
                AND br.room_id = p_room_id
            )
          )
      )
    ELSE
      -- Whole-property special: check whole property availability
      -- 1. No blocked_dates overlap
      NOT EXISTS (
        SELECT 1 FROM blocked_dates
        WHERE property_id = p_property_id
          AND date >= p_check_in
          AND date < p_check_out
          AND (p_exclude_special_id IS NULL OR special_id IS DISTINCT FROM p_exclude_special_id)
      )
      -- 2. No active bookings overlap for the property
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.property_id = p_property_id
          AND b.status IN ('confirmed', 'checked_in')
          AND b.deleted_at IS NULL
          AND b.check_in < p_check_out
          AND b.check_out > p_check_in
      )
  END;
$$;

COMMENT ON FUNCTION special_dates_available IS
  'Returns TRUE if the date range [check_in, check_out) is available for a special. Checks both blocked_dates AND active bookings. Optionally excludes blocks from a specific special (for edits).';


-- ─── 2. Helper function to get conflicting booking reference ───────────────
-- Returns the reference of the first conflicting booking, or NULL if none.
-- Useful for showing the user which booking conflicts.
CREATE OR REPLACE FUNCTION get_special_booking_conflict(
  p_property_id uuid,
  p_room_id     uuid,  -- NULL = whole property deal
  p_check_in    date,
  p_check_out   date
) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT b.reference
  FROM bookings b
  WHERE b.property_id = p_property_id
    AND b.status IN ('confirmed', 'checked_in')
    AND b.deleted_at IS NULL
    AND b.check_in < p_check_out
    AND b.check_out > p_check_in
    AND (
      p_room_id IS NULL  -- whole property special: any booking conflicts
      OR b.scope = 'whole_listing'  -- whole property booking blocks all rooms
      OR EXISTS (
        SELECT 1 FROM booking_rooms br
        WHERE br.booking_id = b.id
          AND br.room_id = p_room_id
      )
    )
  ORDER BY b.check_in
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_special_booking_conflict IS
  'Returns the reference of the first booking that conflicts with the given date range and room. NULL if no conflict.';
