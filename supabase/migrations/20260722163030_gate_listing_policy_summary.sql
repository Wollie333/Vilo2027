-- get_listing_policy_summary: stop answering for listings the caller cannot see.
-- Flagged by scripts/generate-schema-doc.mjs as a SECURITY DEFINER function reachable
-- by anon. It is meant to be public (the booking page needs it), but it never checked
-- whether the LISTING was public.

CREATE OR REPLACE FUNCTION public.get_listing_policy_summary(p_listing_id uuid, p_room_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb := '{}';
  v_type   text;
  v_pid    uuid;
  v_pol    policies%ROWTYPE;
  v_rules  jsonb;
  v_cont   text;
BEGIN
  -- Visibility gate. This function is SECURITY DEFINER and anon-executable so the
  -- public booking page can show a stay's terms without a session -- but it took any
  -- listing id and answered, so anon could read the policies of an UNPUBLISHED draft
  -- (proven against production: 'Mela Lodge', is_published = false, returned its full
  -- house_rules). Minor on its own -- policy text is not personal data -- but it also
  -- confirmed which listing uuids exist.
  --
  -- Returns an EMPTY object for both 'hidden' and 'does not exist', deliberately: a
  -- different answer for the two would leave the existence oracle in place, which is
  -- the actual point of closing this.
  IF NOT EXISTS (
    SELECT 1 FROM properties p
     WHERE p.id = p_listing_id
       AND (
            (p.is_published
             AND NOT p.is_suspended
             AND p.deleted_at IS NULL
             AND NOT host_public_suppressed(p.host_id))
         OR p.host_id = get_my_host_id()
         OR p.host_id = get_my_host_id_as_staff()
         OR is_super_admin()
         OR COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
       )
  ) THEN
    RETURN '{}'::jsonb;
  END IF;
  FOREACH v_type IN ARRAY
    ARRAY['cancellation','check_in_out','house_rules','booking_terms']
  LOOP
    v_pid := resolve_listing_policy_id(p_listing_id, p_room_id, v_type);
    CONTINUE WHEN v_pid IS NULL;

    SELECT * INTO v_pol FROM policies WHERE id = v_pid;

    IF v_type = 'cancellation' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'days_before',    days_before,
          'refund_percent', refund_percent,
          'label',          label
        ) ORDER BY days_before DESC
      ) INTO v_rules
      FROM policy_cancellation_rules WHERE policy_id = v_pid;

      SELECT body_html INTO v_cont
      FROM policy_content WHERE policy_id = v_pid AND locale = 'en' LIMIT 1;

      v_result := v_result || jsonb_build_object(
        'cancellation', jsonb_build_object(
          'name',             v_pol.name,
          'summary',          v_pol.summary,
          'is_non_refundable',v_pol.is_non_refundable,
          'preset',           v_pol.preset,
          'rules',            COALESCE(v_rules, '[]'::jsonb),
          'body_html',        v_cont
        )
      );
    ELSE
      SELECT body_html INTO v_cont
      FROM policy_content WHERE policy_id = v_pid AND locale = 'en' LIMIT 1;

      v_result := v_result || jsonb_build_object(
        v_type, jsonb_build_object(
          'name',             v_pol.name,
          'summary',          v_pol.summary,
          'version',          v_pol.version,
          'check_in_time',    v_pol.check_in_time,
          'check_out_time',   v_pol.check_out_time,
          'check_in_method',  v_pol.check_in_method,
          'pets_allowed',     v_pol.pets_allowed,
          'smoking_allowed',  v_pol.smoking_allowed,
          'parties_allowed',  v_pol.parties_allowed,
          'children_welcome', v_pol.children_welcome,
          'quiet_hours_start',v_pol.quiet_hours_start,
          'quiet_hours_end',  v_pol.quiet_hours_end,
          'body_html',        v_cont
        )
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$function$;
