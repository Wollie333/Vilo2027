-- Migration: per-bed sleeping capacity (host-controlled)
--
-- Each bed row gets its own `sleeps` count so a host can say "this bed sleeps 3"
-- regardless of the bed kind. Room capacity = Σ (sleeps × quantity). The bed
-- kind's default capacity is just the starting suggestion in the UI.
-- Pre-MVP (CLAUDE.md): destructive reshapes are fine.

ALTER TABLE room_beds
  ADD COLUMN IF NOT EXISTS sleeps integer NOT NULL DEFAULT 1;

-- Backfill existing beds from their kind's default capacity (mirrors
-- apps/web/app/dashboard/listings/[id]/edit/roomBeds.ts BED_CAPACITY).
UPDATE room_beds
SET sleeps = CASE bed_kind
  WHEN 'king'           THEN 2
  WHEN 'queen'          THEN 2
  WHEN 'double'         THEN 2
  WHEN 'twin'           THEN 2
  WHEN 'single'         THEN 1
  WHEN 'bunk'           THEN 2
  WHEN 'futon'          THEN 2
  WHEN 'sofa_bed'       THEN 1
  WHEN 'cot'            THEN 1
  WHEN 'floor_mattress' THEN 1
  ELSE 1
END;

ALTER TABLE room_beds DROP CONSTRAINT IF EXISTS room_beds_sleeps_chk;
ALTER TABLE room_beds ADD CONSTRAINT room_beds_sleeps_chk
  CHECK (sleeps >= 1 AND sleeps <= 30);

COMMENT ON COLUMN room_beds.sleeps IS
  'How many people sleep in ONE bed of this row (host-controlled). Room capacity = Σ sleeps × quantity.';
