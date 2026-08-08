-- TEMPORARY one-shot: clear platform-level "dashboard noise" so the super-admin
-- dashboard reads vanilla (no Wielo money, no notifications, no reports/audit).
-- Config/reference data and the admin's login/staff role are NOT touched.
--
-- TRUNCATE (not DELETE) is deliberate: it ignores FK ON DELETE actions (order is
-- handled by listing the set together + CASCADE) and bypasses the row-level
-- immutability triggers on admin_audit_log / subscription_history. Every table
-- CASCADE reaches beyond this list was verified empty in the pre-wipe census, so
-- nothing config-bearing is affected. Dropped again in a follow-up migration.

create or replace function public._wipe_platform_noise()
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  truncate table
    platform_ledger,
    wielo_invoices, wielo_credit_ledger, wielo_credit_notes, wielo_credit_wallet,
    admin_notifications, in_app_notifications,
    notification_queue, notification_delivery_log, pending_push_queue, pending_digest_items,
    error_events, webhook_deliveries, meta_conversion_events,
    signup_rate_limits,
    pipeline_activities, pipeline_leads,
    subscription_history,
    admin_audit_log,
    affiliate_agreement_acceptances, affiliate_accounts,
    form_drafts,
    product_orders
  cascade;
  return 'platform noise truncated';
end;
$$;
revoke all on function public._wipe_platform_noise() from public;
