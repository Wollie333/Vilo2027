-- Migration: atomic, non-destructive iCal import writer.
--
-- BUG: syncIcalFeedAction wrote imported dates with
--   .upsert(rows, { onConflict: "property_id,date" })
-- but there is NO unique constraint on (property_id, date) — the only unique key
-- is the expression index unique_blocked_date_per_scope
--   (property_id, COALESCE(room_id, '000…'::uuid), date).
-- So every import errored with 42P10 ("no unique/exclusion constraint matching
-- the ON CONFLICT specification") and the feed was marked status='error'. iCal
-- import never blocked any dates.
--
-- Also, upsert (DO UPDATE) would have been DESTRUCTIVE — it would overwrite a
-- date already blocked by a Vilo booking/manual/quote_hold, flipping its source
-- to 'ical'; removing the feed later would then delete a real booking's block →
-- double-booking risk. BOOKING_SYNC.md requires imports to be NON-destructive
-- (ON CONFLICT DO NOTHING).
--
-- This RPC does the delete-then-insert atomically against the REAL expression
-- conflict target, DO NOTHING (preserves every other source). iCal imports are
-- always whole-listing (room_id NULL). Returns the number of rows it inserted.
CREATE OR REPLACE FUNCTION public.import_ical_blocks(
  p_feed_id     uuid,
  p_property_id uuid,
  p_dates       date[]
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
  SELECT p_property_id, NULL, d,
         'Imported from external calendar', 'ical', p_feed_id
  FROM unnest(p_dates) AS d
  -- DO NOTHING: a manual / booking / quote_hold / other-feed block on the same
  -- date wins — the external feed never overwrites a real Vilo block.
  ON CONFLICT (property_id,
               COALESCE(room_id, '00000000-0000-0000-0000-000000000000'::uuid),
               date)
  DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_ical_blocks(uuid, uuid, date[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.import_ical_blocks(uuid, uuid, date[]) TO service_role;
