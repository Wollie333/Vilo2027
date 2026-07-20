-- WS-3a fix — make merge_feature_requests ADDITIVE.
--
-- The first version recomputed the target's tallies from the live vote ROWS.
-- That's wrong for the seeded board: seed items carry a denormalised vote_count
-- with NO backing feature_request_votes rows (we can't mint hundreds of fake
-- auth users), so a merge collapsed the target to its real row count (e.g. 59 → 1).
--
-- Fix: carry the SOURCE's tallies onto the target's existing tallies, minus the
-- collisions we drop (source voters who already voted the target). This is exact
-- for real data (denormalised count == row count, so target += net-new voters)
-- AND preserves seeded numbers (no rows → no collisions → target += source).

CREATE OR REPLACE FUNCTION public.merge_feature_requests(p_source uuid, p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_src   public.feature_requests;
  c_total int;
  c_host  int;
  c_guest int;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_source = p_target THEN
    RAISE EXCEPTION 'cannot merge a request into itself';
  END IF;

  SELECT * INTO v_src FROM public.feature_requests WHERE id = p_source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source request not found';
  END IF;

  -- Collisions: source vote rows whose user already voted the target. These get
  -- dropped in the move, so subtract them from the tallies we carry over.
  SELECT
    count(*),
    count(*) FILTER (WHERE s.voter_role = 'host'),
    count(*) FILTER (WHERE s.voter_role = 'guest')
  INTO c_total, c_host, c_guest
  FROM public.feature_request_votes s
  WHERE s.request_id = p_source
    AND EXISTS (
      SELECT 1 FROM public.feature_request_votes t
       WHERE t.request_id = p_target AND t.user_id = s.user_id
    );

  DELETE FROM public.feature_request_votes s
   WHERE s.request_id = p_source
     AND EXISTS (
       SELECT 1 FROM public.feature_request_votes t
        WHERE t.request_id = p_target AND t.user_id = s.user_id
     );
  UPDATE public.feature_request_votes
     SET request_id = p_target
   WHERE request_id = p_source;

  -- Carry the source's tallies onto the target (minus the dropped collisions).
  UPDATE public.feature_requests t SET
    vote_count       = t.vote_count       + GREATEST(0, v_src.vote_count       - c_total),
    host_vote_count  = t.host_vote_count  + GREATEST(0, v_src.host_vote_count  - c_host),
    guest_vote_count = t.guest_vote_count + GREATEST(0, v_src.guest_vote_count - c_guest),
    updated_at = now()
  WHERE t.id = p_target;

  -- Hide the source under the target, zero its tallies.
  UPDATE public.feature_requests SET
    merged_into_id = p_target, is_public = false,
    vote_count = 0, host_vote_count = 0, guest_vote_count = 0,
    updated_at = now()
  WHERE id = p_source;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_feature_requests(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_feature_requests(uuid, uuid) TO authenticated;
