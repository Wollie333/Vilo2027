-- =============================================================================
-- IDOR: the host-analytics functions never checked who owns p_host_id.
--
-- 18 SECURITY DEFINER functions take a `p_host_id` argument, run as owner (so
-- they bypass RLS), and are granted to `authenticated`. The app always passes
-- the caller's own host, but nothing STOPPED a signed-in user from calling them
-- directly over PostgREST with someone else's host id — leaking another host's
-- KPIs, revenue, guest PII and broadcast recipient lists. (anon was already
-- revoked in 20260716320000; this is the signed-in-user hole it left open.)
--
-- Fix: a single guard, `_assert_can_read_host(p_host_id)`, injected at the top of
-- each function. It RAISES for a signed-in caller who doesn't own the host, and
-- is a NO-OP for service-role/internal callers (auth.uid() IS NULL) — the admin
-- dashboards and seed scripts legitimately read any host, and broadcast_audience
-- is called via the service-role client. Mirrors the check the already-guarded
-- functions (fetch_host_guests, etc.) use via _can_read_host, but with the
-- service-role escape those didn't need.
--
-- Injection is programmatic (not hand-transcribed) and FAILS LOUDLY if a
-- function's shape is unexpected, so the migration can't half-apply. Idempotent:
-- a function that already references the guard is skipped.
-- =============================================================================

-- ─── The guard ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._assert_can_read_host(p_host_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $$
BEGIN
  -- Only a signed-in caller is constrained. Service-role / internal callers
  -- (auth.uid() IS NULL) are trusted — admin dashboards + seeds read any host.
  IF auth.uid() IS NOT NULL AND NOT public._can_read_host(p_host_id) THEN
    RAISE EXCEPTION 'not authorised to read this host''s data'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public._assert_can_read_host(uuid)
  TO authenticated, service_role;

-- ─── Inject the guard into the 18 unguarded p_host_id functions ──
DO $mig$
DECLARE
  -- fetch_host_savings is intentionally absent — it already verifies ownership
  -- inline (hosts.user_id = auth.uid()), just with a different idiom.
  target text[] := ARRAY[
    -- plpgsql analytics (guard goes after BEGIN)
    'fetch_channel_mix','fetch_conversion_funnel','fetch_guest_demographics',
    'fetch_looking_for_stats','fetch_popular_rooms',
    'fetch_primary_kpis','fetch_property_performance','fetch_refunds_cancellations',
    'fetch_regional_breakdown','fetch_revenue_trend','fetch_seasonality_heatmap',
    'fetch_secondary_metrics','fetch_time_to_book',
    -- sql (guard goes as a leading statement)
    '_host_guest_rows','broadcast_audience','get_host_inbox_stats',
    'get_host_refund_stats'
  ];
  fn   text;
  rec  record;
  def  text;
  nd   text;
  is_plpgsql boolean;
BEGIN
  FOREACH fn IN ARRAY target LOOP
    FOR rec IN
      SELECT p.oid, l.lanname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      def := pg_get_functiondef(rec.oid);

      -- Idempotent: already guarded → leave it.
      IF def ILIKE '%_assert_can_read_host%' THEN
        CONTINUE;
      END IF;

      is_plpgsql := rec.lanname = 'plpgsql';

      IF is_plpgsql THEN
        -- Insert the guard right after the first `BEGIN` line (case-insensitive:
        -- some functions write `begin` lowercase).
        nd := regexp_replace(
          def,
          E'\\n[ \\t]*begin[ \\t]*\\n',
          E'\nBEGIN\n  PERFORM public._assert_can_read_host(p_host_id);\n',
          'i'
        );
      ELSE
        -- SQL function: prepend a leading guard statement (makes it
        -- multi-statement → not inlined → the guard runs before the body).
        nd := regexp_replace(
          def,
          E'AS \\$function\\$',
          E'AS $function$\nSELECT public._assert_can_read_host(p_host_id);'
        );
      END IF;

      IF nd = def THEN
        RAISE EXCEPTION
          'IDOR guard injection failed for %(): injection point not found', fn;
      END IF;

      EXECUTE nd;
    END LOOP;
  END LOOP;
END
$mig$;

-- ─── Verify every target now carries the guard (belt-and-braces) ─
DO $check$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(p.proname, ', ')
  INTO missing
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'fetch_channel_mix','fetch_conversion_funnel','fetch_guest_demographics',
      'fetch_looking_for_stats','fetch_popular_rooms',
      'fetch_primary_kpis','fetch_property_performance','fetch_refunds_cancellations',
      'fetch_regional_breakdown','fetch_revenue_trend','fetch_seasonality_heatmap',
      'fetch_secondary_metrics','fetch_time_to_book',
      '_host_guest_rows','broadcast_audience','get_host_inbox_stats',
      'get_host_refund_stats'
    )
    AND p.prosrc NOT ILIKE '%_assert_can_read_host%';
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'IDOR guard missing on: %', missing;
  END IF;
END
$check$;
