-- get_my_host_id() must exclude soft-deleted hosts.
--
-- Every host RLS policy resolves the caller's host through this SECURITY DEFINER
-- function (host_manage_own_bookings, and the equivalent policies on properties,
-- calendars, payouts, …). It was:
--
--     SELECT id FROM hosts WHERE user_id = auth.uid() LIMIT 1;
--
-- which ignores `deleted_at`. Two real consequences:
--
--  1. Soft-delete didn't revoke access. Hosts are soft-deleted (deleted_at) —
--     never hard-deleted (AGENT_RULES §2.1). A closed/soft-deleted host still
--     resolved as "my host" here, so RLS kept granting them access to that host's
--     rows. Soft-delete must actually revoke, not just hide.
--
--  2. It diverged from the app. The TypeScript resolver (lib/host/current.ts
--     getMyHostId / requireHost) filters `deleted_at IS NULL`, so when a user has
--     a soft-deleted host alongside an active one, the app resolved the ACTIVE
--     host (dashboard showed the right listing) while this function's unordered
--     LIMIT 1 could return the SOFT-DELETED one — RLS then filtered every read to
--     the wrong host_id and the host saw zero of their own bookings.
--
-- Fix: exclude soft-deleted rows and pick deterministically (oldest active host)
-- so the SQL resolver matches the app resolver exactly.
CREATE OR REPLACE FUNCTION public.get_my_host_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT id
  FROM hosts
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;
$function$;
