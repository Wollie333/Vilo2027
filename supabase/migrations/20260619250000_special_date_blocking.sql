-- Migration: Special date blocking
--
-- When a fixed-date special is activated, its dates must be blocked on the
-- calendar so no regular bookings can overlap. This migration:
--
-- 1. Adds special_id to blocked_dates to track special-created blocks
-- 2. Adds helper functions for checking/blocking/releasing special dates
-- 3. Adds a trigger to auto-release blocks when a special leaves active status

-- ─── 1. Add special_id column to blocked_dates ─────────────────────────────
ALTER TABLE public.blocked_dates
  ADD COLUMN special_id uuid REFERENCES specials(id) ON DELETE CASCADE;

COMMENT ON COLUMN blocked_dates.special_id IS
  'Set when this block was created by an active fixed-date special.';

CREATE INDEX idx_blocked_dates_special
  ON blocked_dates(special_id) WHERE special_id IS NOT NULL;

-- ─── 2. Check if a special's fixed dates are available ─────────────────────
-- Returns TRUE if the date range is completely free, FALSE otherwise.
-- For room-scoped specials, checks only that room; otherwise checks whole property.
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
      NOT EXISTS (
        SELECT 1 FROM blocked_dates
        WHERE property_id = p_property_id
          AND date >= p_check_in
          AND date < p_check_out
          AND (room_id IS NULL OR room_id = p_room_id)
          AND (p_exclude_special_id IS NULL OR special_id IS DISTINCT FROM p_exclude_special_id)
      )
    ELSE
      -- Whole-property special: check whole property availability
      NOT EXISTS (
        SELECT 1 FROM blocked_dates
        WHERE property_id = p_property_id
          AND date >= p_check_in
          AND date < p_check_out
          AND (p_exclude_special_id IS NULL OR special_id IS DISTINCT FROM p_exclude_special_id)
      )
  END;
$$;

COMMENT ON FUNCTION special_dates_available IS
  'Returns TRUE if the date range [check_in, check_out) is available for a special. Optionally excludes blocks from a specific special (for edits).';

-- ─── 3. Block dates for an active fixed-date special ───────────────────────
CREATE OR REPLACE FUNCTION block_special_dates(
  p_special_id  uuid,
  p_property_id uuid,
  p_room_id     uuid,  -- NULL = whole property
  p_check_in    date,
  p_check_out   date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_date date;
BEGIN
  v_date := p_check_in;
  WHILE v_date < p_check_out LOOP
    INSERT INTO blocked_dates (property_id, room_id, date, reason, special_id, source)
    VALUES (p_property_id, p_room_id, v_date, 'special', p_special_id, 'special')
    ON CONFLICT DO NOTHING;
    v_date := v_date + 1;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION block_special_dates IS
  'Inserts blocked_dates rows for each night of a fixed-date special.';

-- ─── 4. Release dates when a special leaves active status ──────────────────
CREATE OR REPLACE FUNCTION release_special_dates(p_special_id uuid)
RETURNS void LANGUAGE sql AS $$
  DELETE FROM blocked_dates WHERE special_id = p_special_id;
$$;

COMMENT ON FUNCTION release_special_dates IS
  'Removes all blocked_dates rows created by a specific special.';

-- ─── 5. Trigger: auto-release dates when special leaves active status ──────
CREATE OR REPLACE FUNCTION on_special_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- When a fixed-date special leaves 'active' status, release its blocked dates
  IF OLD.status = 'active' AND NEW.status != 'active' THEN
    IF OLD.date_mode = 'fixed' THEN
      PERFORM release_special_dates(OLD.id);
    END IF;
  END IF;

  -- When a fixed-date special is soft-deleted, release its blocked dates
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    IF OLD.date_mode = 'fixed' THEN
      PERFORM release_special_dates(OLD.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_special_status_change ON specials;
CREATE TRIGGER trigger_special_status_change
  AFTER UPDATE ON specials
  FOR EACH ROW
  EXECUTE FUNCTION on_special_status_change();

COMMENT ON FUNCTION on_special_status_change IS
  'Auto-releases blocked dates when a fixed-date special leaves active status or is soft-deleted.';
