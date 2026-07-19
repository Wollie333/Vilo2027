-- Cap: a guest can have at most 3 ACTIVE Looking For posts at a time. Posting is
-- free (no credits, no plan quota — see 20260716300000), but we hold new posters
-- to 3 live requests so the directory stays high-signal; a slot frees up as a
-- post is fulfilled / cancelled / expires. Enforced here as the authoritative
-- server-side guard (RLS only checks ownership, so it can't count); the app
-- action mirrors it for a friendly message.

CREATE OR REPLACE FUNCTION enforce_looking_for_post_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active integer;
  v_cap    constant integer := 3;
BEGIN
  -- Only live ("active") posts occupy a slot; terminal ones (fulfilled,
  -- cancelled, expired, removed, quotes_closed, suspended, flagged) don't.
  IF NEW.status = 'active' THEN
    SELECT count(*) INTO v_active
      FROM public.looking_for_posts
      WHERE guest_id = NEW.guest_id AND status = 'active';
    IF v_active >= v_cap THEN
      RAISE EXCEPTION 'looking_for_post_cap_reached'
        USING HINT = 'A guest can have at most 3 active requests at a time.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_looking_for_post_cap ON public.looking_for_posts;
CREATE TRIGGER trg_looking_for_post_cap
  BEFORE INSERT ON public.looking_for_posts
  FOR EACH ROW EXECUTE FUNCTION enforce_looking_for_post_cap();
