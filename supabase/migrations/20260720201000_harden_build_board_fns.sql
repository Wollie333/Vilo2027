-- WS-3a hardening — pin search_path + close anon EXECUTE on the Build Board fns.
--
-- The red-flag detector caught two issues on 20260720200000's functions:
--   1. No pinned search_path (a SECURITY DEFINER fn resolving names via the
--      caller's path is a hijack vector) → SET search_path = public, pg_temp.
--   2. merge_feature_requests still executable by `anon`. Supabase's ALTER
--      DEFAULT PRIVILEGES grants EXECUTE to `anon`/`authenticated` BY NAME on
--      every new public function — so REVOKE ... FROM PUBLIC (in the prior
--      migration) was not enough; anon keeps its explicit grant. Revoke from
--      `anon` by name too. (The trigger fn is invoked by the trigger, not via
--      EXECUTE, so it needs no direct grant at all.)

-- ── merge_feature_requests: pin search_path (body unchanged) ──────
CREATE OR REPLACE FUNCTION public.merge_feature_requests(p_source uuid, p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_source = p_target THEN
    RAISE EXCEPTION 'cannot merge a request into itself';
  END IF;

  DELETE FROM public.feature_request_votes s
   WHERE s.request_id = p_source
     AND EXISTS (
       SELECT 1 FROM public.feature_request_votes t
        WHERE t.request_id = p_target AND t.user_id = s.user_id
     );
  UPDATE public.feature_request_votes
     SET request_id = p_target
   WHERE request_id = p_source;

  UPDATE public.feature_requests
     SET merged_into_id = p_target, is_public = false,
         vote_count = 0, host_vote_count = 0, guest_vote_count = 0,
         updated_at = now()
   WHERE id = p_source;

  UPDATE public.feature_requests fr SET
    vote_count       = c.total,
    host_vote_count  = c.hosts,
    guest_vote_count = c.guests,
    updated_at       = now()
  FROM (
    SELECT
      count(*)                                     AS total,
      count(*) FILTER (WHERE voter_role = 'host')  AS hosts,
      count(*) FILTER (WHERE voter_role = 'guest') AS guests
    FROM public.feature_request_votes
    WHERE request_id = p_target
  ) c
  WHERE fr.id = p_target;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_feature_requests(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_feature_requests(uuid, uuid) TO authenticated;

-- ── sync_feature_request_votes: pin search_path + no direct EXECUTE ──
CREATE OR REPLACE FUNCTION public.sync_feature_request_votes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feature_requests SET
      vote_count       = vote_count + 1,
      host_vote_count  = host_vote_count  + (CASE WHEN NEW.voter_role = 'host'  THEN 1 ELSE 0 END),
      guest_vote_count = guest_vote_count + (CASE WHEN NEW.voter_role = 'guest' THEN 1 ELSE 0 END),
      updated_at       = now()
    WHERE id = NEW.request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feature_requests SET
      vote_count       = GREATEST(0, vote_count - 1),
      host_vote_count  = GREATEST(0, host_vote_count  - (CASE WHEN OLD.voter_role = 'host'  THEN 1 ELSE 0 END)),
      guest_vote_count = GREATEST(0, guest_vote_count - (CASE WHEN OLD.voter_role = 'guest' THEN 1 ELSE 0 END)),
      updated_at       = now()
    WHERE id = OLD.request_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Only the trigger invokes it — no role needs a direct EXECUTE grant.
REVOKE ALL ON FUNCTION public.sync_feature_request_votes() FROM PUBLIC, anon, authenticated;
