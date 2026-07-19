-- Cross-tenant hardening, pass 1: lock service-role-only / SQL-internal
-- SECURITY DEFINER functions that take an owner-scoped id (host/business/user/
-- affiliate) to service_role only.
--
-- These bypass RLS and, via the default PUBLIC grant, were callable directly over
-- PostgREST by any AUTHENTICATED user with an arbitrary owner id — a cross-tenant
-- (IDOR) hole. None of them is called from the browser/authenticated client: every
-- app caller uses the service-role admin client (number minting, period checks,
-- notification enqueue/prefs, policy seeding via admin) or they are only ever
-- invoked from within other SECURITY DEFINER functions (which run as owner and
-- keep execute regardless of this grant). So revoking the broad grant closes the
-- hole with zero functional impact.
--
-- Reminder: CREATE FUNCTION grants EXECUTE to PUBLIC, so a plain REVOKE FROM anon
-- is a no-op — revoke from PUBLIC and re-grant service_role.

DO $$
DECLARE
  sig text;
  sigs text[] := ARRAY[
    'public.affiliate_tier_bonus(uuid)',
    'public.business_doc_code(uuid)',
    'public.calculate_looking_for_match_score(uuid, uuid)',
    'public.check_host_availability_for_dates(uuid, date, date)',
    'public.check_host_quote_quota(uuid)',
    'public.ensure_host_default_policies(uuid)',
    'public.ensure_host_legal_presets(uuid)',
    'public.enqueue_in_app_notification(uuid, text, text, text, text, jsonb, text, text)',
    'public.host_public_suppressed(uuid)',
    'public.is_period_closed(uuid, date)',
    'public.next_credit_note_number(uuid)',
    'public.next_forfeit_number(uuid)',
    'public.next_invoice_number(uuid)',
    'public.next_quote_number(uuid)',
    'public.next_receipt_number(uuid)',
    'public.next_refund_number(uuid)',
    'public.resolve_notification_prefs(uuid, text)'
  ];
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', sig);
  END LOOP;
END $$;
