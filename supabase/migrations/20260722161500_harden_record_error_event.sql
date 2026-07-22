-- record_error_event: stop trusting the caller's p_user_id.
--
-- THE BUG (proven against production before this migration):
--   The function is SECURITY DEFINER and anon-EXECUTABLE by design — unauthenticated
--   visitors hit errors too, so the reporter has to be callable without a session.
--   But it wrote `p_user_id` straight into error_events.user_id, and that column has a
--   FOREIGN KEY. So the row either inserted or raised a violation depending on whether
--   the uuid existed, turning the endpoint into a USER-ENUMERATION ORACLE for anyone
--   holding the public anon key:
--
--     random uuid -> HTTP 409 (fk violation)      real user uuid -> HTTP 204
--
--   Two lesser problems rode along: any caller could ATTRIBUTE an error to any user
--   (log spoofing, which poisons the one surface we use to judge production health),
--   and nothing tied the row to the session at all.
--
-- THE FIX
--   Take the identity from the verified JWT (auth.uid()), not from the arguments.
--   Server-side reporters legitimately report ON BEHALF OF a user and call with the
--   service-role key, where auth.uid() is NULL — so p_user_id is honoured for that
--   role only, detected the same way as the SECDEF owner-check helpers
--   (request.jwt.claims ->> 'role'), never from a client-supplied flag.
--
--   p_user_id stays in the signature: dropping it would break every existing call site
--   and the parameter is still meaningful for the service-role path.
--
-- NOT FIXED HERE: `fingerprint` is still attacker-chosen, so unique values can still
-- grow the table. Bounded-length and deduplicating, so it is noise rather than a
-- vulnerability; rate limiting belongs at the edge, not in this function.

CREATE OR REPLACE FUNCTION public.record_error_event(
  p_source      text,
  p_fingerprint text,
  p_message     text,
  p_stack       text  DEFAULT NULL::text,
  p_url         text  DEFAULT NULL::text,
  p_user_id     uuid  DEFAULT NULL::uuid,
  p_context     jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_service boolean :=
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb ->> 'role',
      ''
    ) = 'service_role';
  v_user_id uuid;
BEGIN
  -- Trust the session, not the payload. Only a service-role caller may name someone.
  v_user_id := CASE WHEN v_is_service THEN p_user_id ELSE auth.uid() END;

  INSERT INTO error_events (source, fingerprint, message, stack, url, user_id, context)
  VALUES (
    COALESCE(NULLIF(p_source, ''), 'server'),
    left(p_fingerprint, 200),
    left(p_message, 2000),
    left(p_stack, 8000),
    left(p_url, 500),
    v_user_id,
    COALESCE(p_context, '{}'::jsonb)
  )
  ON CONFLICT (fingerprint) DO UPDATE SET
    occurrences = error_events.occurrences + 1,
    last_seen   = now(),
    -- A recurrence reopens a problem that was marked resolved.
    resolved_at = NULL,
    message     = EXCLUDED.message,
    stack       = COALESCE(EXCLUDED.stack, error_events.stack),
    url         = COALESCE(EXCLUDED.url, error_events.url);
END;
$function$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC, so re-state the intended grants rather
-- than assuming the old ones survived the replace. Revoking from `anon` alone is a
-- no-op while PUBLIC still holds it — that trap has cost this project real time before.
REVOKE ALL ON FUNCTION public.record_error_event(text, text, text, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_error_event(text, text, text, text, text, uuid, jsonb)
  TO anon, authenticated, service_role;

-- Remove the probe rows this vulnerability was demonstrated with.
DELETE FROM error_events WHERE fingerprint LIKE 'sec-probe-%';
