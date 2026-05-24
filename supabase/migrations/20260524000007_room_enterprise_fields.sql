-- Migration: Enterprise per-room fields
--
-- Adds the three real-world gaps from the per-room management plan:
--   1. Room-level policy flags (ensuite, smoking, pets, accessible, entrance,
--      floor)
--   2. Hotel-style inventory_count (informational in v1; multi-unit booking
--      logic lands in a follow-up)
--   3. Structured bed composition via a new room_beds table — replaces the
--      ergonomics of the freetext listing_rooms.bed_type while keeping that
--      column as a derived display shim for existing readers.
--
-- Pre-MVP per CLAUDE.md: additive, defaults safe, reversible.

-- ─── 1. Policy flags + inventory on listing_rooms ───────────────
ALTER TABLE public.listing_rooms
  ADD COLUMN has_ensuite_bathroom  boolean NOT NULL DEFAULT false,
  ADD COLUMN smoking_allowed       boolean NOT NULL DEFAULT false,
  ADD COLUMN pets_allowed          boolean NOT NULL DEFAULT false,
  ADD COLUMN wheelchair_accessible boolean NOT NULL DEFAULT false,
  ADD COLUMN private_entrance      boolean NOT NULL DEFAULT false,
  ADD COLUMN floor_number          integer
                                   CHECK (floor_number IS NULL
                                          OR floor_number BETWEEN -5 AND 200),
  ADD COLUMN inventory_count       integer NOT NULL DEFAULT 1
                                   CHECK (inventory_count BETWEEN 1 AND 99);

COMMENT ON COLUMN listing_rooms.has_ensuite_bathroom IS
  'True when the listed bathroom(s) are inside this room (not shared).';
COMMENT ON COLUMN listing_rooms.floor_number IS
  'Optional floor the room is on. Negative values for basement levels. NULL when single-story or unknown.';
COMMENT ON COLUMN listing_rooms.inventory_count IS
  'How many identical units of this room exist (hotel-style). v1 treats this as informational; multi-unit booking logic lands in a follow-up.';

-- ─── 2. Structured bed composition ──────────────────────────────
CREATE TABLE public.room_beds (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid        NOT NULL REFERENCES listing_rooms(id) ON DELETE CASCADE,
  bed_kind   text        NOT NULL CHECK (bed_kind IN (
    'king','queen','double','twin','single','bunk','sofa_bed','cot','floor_mattress'
  )),
  quantity   integer     NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 20),
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_beds_room ON room_beds(room_id);

ALTER TABLE room_beds ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE room_beds IS
  'Structured per-room bed composition. Replaces the ergonomics of the freetext listing_rooms.bed_type; that column becomes a derived display shim populated by setRoomBedsAction.';

-- Host CRUD via listing ownership chain.
CREATE POLICY "host_manage_own_room_beds" ON room_beds FOR ALL
  USING (
    room_id IN (
      SELECT lr.id FROM listing_rooms lr
      JOIN listings l ON l.id = lr.listing_id
      WHERE l.host_id = get_my_host_id()
    )
  );

-- Staff (if added later) gets read via the same chain.
CREATE POLICY "staff_read_room_beds" ON room_beds FOR SELECT
  USING (
    room_id IN (
      SELECT lr.id FROM listing_rooms lr
      JOIN listings l ON l.id = lr.listing_id
      WHERE l.host_id = get_my_host_id_as_staff()
    )
  );

-- Public guests can read bed composition for published listings.
CREATE POLICY "public_read_room_beds" ON room_beds FOR SELECT
  USING (
    room_id IN (
      SELECT lr.id FROM listing_rooms lr
      JOIN listings l ON l.id = lr.listing_id
      WHERE l.is_published = true
        AND l.is_suspended = false
        AND l.deleted_at IS NULL
    )
  );

CREATE POLICY "admin_full_room_beds" ON room_beds FOR ALL
  USING (is_super_admin());
