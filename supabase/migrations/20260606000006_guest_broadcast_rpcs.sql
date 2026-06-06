-- Migration: Guests (CRM) — Phase 9 · bulk mailer RPCs
--
-- broadcast_audience(host, audience) → one row per guest in the audience with an
--   eligibility status. Shared by the count RPC and the send action (service role).
-- count_broadcast_recipients(host, audience) → tallies for the composer preview.
-- can_send_broadcast(host) → monthly-cap gate.
--
-- Eligibility (decisions A–E):
--   no_email      — no usable email
--   blocked       — host blocked this guest
--   unsubscribed  — guest_marketing.is_subscribed = false
--   no_consent    — manual contact (no bookings) without email_consent
--   ok            — emailable

CREATE OR REPLACE FUNCTION broadcast_audience(p_host_id uuid, p_audience text)
RETURNS TABLE (gkey text, email text, first_name text, status text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH rows AS (SELECT * FROM _host_guest_rows(p_host_id)),
  hc AS (
    SELECT
      CASE WHEN guest_id IS NOT NULL THEN 'u_' || guest_id::text
           ELSE guest_gkey_for_email(email) END AS gkey,
      email_consent
    FROM host_contacts WHERE host_id = p_host_id
  ),
  filtered AS (
    SELECT r.* FROM rows r
    WHERE p_audience = 'all'
       OR (p_audience = 'vip'       AND r.is_vip)
       OR (p_audience = 'returning' AND r.is_returning)
       OR (p_audience = 'new'       AND r.is_new)
       OR (p_audience = 'ota'       AND r.is_ota)
       OR (p_audience = 'lapsed'    AND r.is_lapsed)
       OR (p_audience NOT IN ('all','vip','returning','new','ota','lapsed')
           AND p_audience = ANY(r.tags))
  )
  SELECT
    f.gkey,
    lower(f.email) AS email,
    split_part(COALESCE(f.name, ''), ' ', 1) AS first_name,
    CASE
      WHEN f.email IS NULL OR length(trim(f.email)) = 0 THEN 'no_email'
      WHEN f.is_blocked THEN 'blocked'
      WHEN gm.is_subscribed = false THEN 'unsubscribed'
      WHEN f.total_bookings = 0 AND COALESCE(h.email_consent, false) = false THEN 'no_consent'
      ELSE 'ok'
    END AS status
  FROM filtered f
  LEFT JOIN hc h ON h.gkey = f.gkey
  LEFT JOIN guest_marketing gm ON gm.host_id = p_host_id AND gm.gkey = f.gkey;
$$;

-- Not client-callable directly; the count wrapper (SECURITY DEFINER, ownership-
-- checked) and the service-role send action are the only callers.
REVOKE ALL ON FUNCTION broadcast_audience(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION broadcast_audience(uuid, text) TO service_role;

COMMENT ON FUNCTION broadcast_audience IS
  'Internal: resolves a broadcast audience to recipients + eligibility status. SECURITY DEFINER; call via count_broadcast_recipients or the service-role send action.';

-- ─── count_broadcast_recipients ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION count_broadcast_recipients(p_host_id uuid, p_audience text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  IF NOT _can_read_host(p_host_id) THEN
    RETURN json_build_object('error','forbidden');
  END IF;

  SELECT json_build_object(
    'eligible',     count(*) FILTER (WHERE status = 'ok'),
    'no_email',     count(*) FILTER (WHERE status = 'no_email'),
    'unsubscribed', count(*) FILTER (WHERE status = 'unsubscribed'),
    'no_consent',   count(*) FILTER (WHERE status = 'no_consent'),
    'blocked',      count(*) FILTER (WHERE status = 'blocked')
  ) INTO result
  FROM broadcast_audience(p_host_id, p_audience);

  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION count_broadcast_recipients(uuid, text) TO authenticated;

-- ─── can_send_broadcast (calendar-month cap, decision B) ───────────────────
CREATE OR REPLACE FUNCTION can_send_broadcast(p_host_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_last timestamptz;
BEGIN
  IF NOT _can_read_host(p_host_id) THEN
    RETURN json_build_object('error','forbidden');
  END IF;

  SELECT max(sent_at) INTO v_last
  FROM guest_broadcasts
  WHERE host_id = p_host_id AND status = 'sent'
    AND date_trunc('month', sent_at) = date_trunc('month', now());

  RETURN json_build_object(
    'allowed', v_last IS NULL,
    'last_sent_at', v_last,
    'next_allowed_on', (date_trunc('month', now()) + interval '1 month')::date
  );
END;
$$;
GRANT EXECUTE ON FUNCTION can_send_broadcast(uuid) TO authenticated;
