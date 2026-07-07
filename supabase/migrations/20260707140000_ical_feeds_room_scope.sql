-- Migration: optional per-room scoping for iCal feeds.
--
-- Per-room OTA calendars (SafariNow, or an Airbnb "listing" that is really one
-- room of a multi-room property) must block ONLY that room, not the whole place.
-- The availability engine already supports this (blocked_dates.room_id: NULL =
-- whole listing, set = that room; room_is_available / listing_is_available_whole
-- both honour it — migration 20260524000000). This wires feeds to it.
--
-- Backward compatible: room_id defaults NULL = whole-listing (today's behaviour),
-- so single-unit listings are unaffected.

ALTER TABLE public.ical_feeds
  ADD COLUMN IF NOT EXISTS room_id uuid
    REFERENCES public.property_rooms(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.ical_feeds.room_id IS
  'NULL = feed blocks the whole listing. Set = feed blocks only this room (per-room OTA calendars, e.g. SafariNow).';

CREATE INDEX IF NOT EXISTS idx_ical_feeds_room
  ON public.ical_feeds(room_id) WHERE room_id IS NOT NULL;

-- Replace the import writer with a room-aware version. New 4th arg is DEFAULT
-- NULL so existing whole-listing 3-arg callers keep working; drop the old 3-arg
-- signature first so PostgREST has no overload ambiguity.
DROP FUNCTION IF EXISTS public.import_ical_blocks(uuid, uuid, date[]);

CREATE OR REPLACE FUNCTION public.import_ical_blocks(
  p_feed_id     uuid,
  p_property_id uuid,
  p_dates       date[],
  p_room_id     uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  -- Replace ONLY this feed's own imported rows (never touch other sources).
  DELETE FROM public.blocked_dates
  WHERE ical_feed_id = p_feed_id AND source = 'ical';

  INSERT INTO public.blocked_dates
    (property_id, room_id, date, reason, source, ical_feed_id)
  SELECT p_property_id, p_room_id, d,
         'Imported from external calendar', 'ical', p_feed_id
  FROM unnest(p_dates) AS d
  -- DO NOTHING per (property, scope, date): a manual / booking / quote_hold block
  -- on the same date+scope always wins. A whole-listing block (room_id NULL) and
  -- a room-scoped block are different scopes, so they coexist correctly.
  ON CONFLICT (property_id,
               COALESCE(room_id, '00000000-0000-0000-0000-000000000000'::uuid),
               date)
  DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_ical_blocks(uuid, uuid, date[], uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.import_ical_blocks(uuid, uuid, date[], uuid) TO service_role;
