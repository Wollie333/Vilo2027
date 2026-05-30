-- Migration: enterprise room management — futon bed, pricing modes, bed-derived capacity
--
-- Adds the 'futon' bed kind, three per-room pricing modes (flat per-room,
-- per-person, base+extra-guest), and backfills room capacity from beds.
-- Pre-MVP (CLAUDE.md): destructive reshapes are fine.

-- 1. Allow the 'futon' bed kind.
ALTER TABLE room_beds DROP CONSTRAINT IF EXISTS room_beds_bed_kind_check;
ALTER TABLE room_beds ADD CONSTRAINT room_beds_bed_kind_check
  CHECK (bed_kind IN (
    'king','queen','double','twin','single','bunk','futon',
    'sofa_bed','cot','floor_mattress'
  ));

-- 2. Per-room pricing model. base_price stays the per_room / per_room_plus_extra
--    base; the new columns drive per_person and the extra-guest add-on.
ALTER TABLE listing_rooms
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'per_room'
    CHECK (pricing_mode IN ('per_room','per_person','per_room_plus_extra')),
  ADD COLUMN IF NOT EXISTS price_per_person  numeric,
  ADD COLUMN IF NOT EXISTS base_occupancy    integer,
  ADD COLUMN IF NOT EXISTS extra_guest_price numeric;

COMMENT ON COLUMN listing_rooms.pricing_mode IS
  'per_room = flat/night; per_person = price_per_person × guests/night; per_room_plus_extra = base_price covers base_occupancy guests, then extra_guest_price per extra guest/night.';
COMMENT ON COLUMN listing_rooms.max_guests IS
  'Sleeping capacity — derived from room_beds (Σ bed capacity × qty), not hand-typed.';

-- 3. Backfill max_guests from existing beds (capacity per kind, mirrors
--    apps/web/app/dashboard/listings/[id]/edit/roomBeds.ts BED_CAPACITY).
UPDATE listing_rooms r
SET max_guests = sub.cap
FROM (
  SELECT rb.room_id,
         SUM(
           CASE rb.bed_kind
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
             ELSE 0
           END * rb.quantity
         ) AS cap
  FROM room_beds rb
  GROUP BY rb.room_id
) sub
WHERE r.id = sub.room_id
  AND sub.cap > 0;
