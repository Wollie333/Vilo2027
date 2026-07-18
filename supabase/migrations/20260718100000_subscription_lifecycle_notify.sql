-- Subscription lifecycle notifications + auto-status audit.
--
-- The subscription dunning state-machine (active → past_due → restricted, and
-- recovery back to active) already existed and works, and feature-gating already
-- drops a lapsed host to the free floor WITHOUT touching their data. What was
-- missing: the host + admin were never TOLD when a payment was coming up, failed,
-- or when the account was restricted. The four events + their email templates
-- exist in the notification registry but NOTHING dispatched them (classic
-- "exists, wired to nothing"). This migration adds the single dispatch SSOT and
-- wires the two subscription crons through it, and records a subscription_history
-- row when the grace period elapses (the auto status-update audit trail).
--
-- Money correctness through the lifecycle (the ledger side) is handled in the
-- paystack-webhook Edge Function (charge.failed now records a failed ledger row
-- for auto-renewals + writes the past_due history row); this file owns the
-- DB-side crons + the notification SSOT.
--
-- Security:
--   * notify_subscription_event is SECURITY DEFINER with a pinned search_path,
--     REVOKEd from public/anon/authenticated and GRANTed to service_role only.
--   * p_kind is whitelisted to the four known events, so the function can never
--     be coerced into inserting an arbitrary email `type` or forging admin-feed
--     rows even if it were ever reached with hostile input.
--   * No dynamic SQL. Payloads carry only subscription_id (the email resolver
--     hydrates plan/date/amount server-side) — no PII is written to the queue.

-- ── The one dispatch SSOT ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_subscription_event(
  p_host_id         uuid,
  p_subscription_id uuid,
  p_kind            text,
  p_extra           jsonb DEFAULT '{}'::jsonb,
  p_dedupe_key      text  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id     uuid;
  v_category    text;
  v_severity    text;
  v_title       text;
  v_body        text;
  v_admin_title text;
  v_link        text := '/dashboard/settings/subscription';
  v_payload     jsonb;
BEGIN
  -- Whitelist: refuse any kind we don't own. Prevents arbitrary email-type
  -- injection / forged admin notifications.
  IF p_kind NOT IN (
    'subscription_welcome', 'subscription_expiring',
    'subscription_failed',  'subscription_restricted'
  ) THEN
    RAISE EXCEPTION 'notify_subscription_event: unknown kind %', p_kind;
  END IF;
  IF p_host_id IS NULL OR p_subscription_id IS NULL THEN RETURN; END IF;

  SELECT user_id INTO v_user_id FROM hosts WHERE id = p_host_id;

  -- Dedupe ledger: once we've logged this exact key for this host, skip. Callers
  -- encode the billing period into the key so a warning fires once per period,
  -- not on every daily/hourly cron tick.
  IF p_dedupe_key IS NOT NULL AND v_user_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM notification_delivery_log
        WHERE user_id = v_user_id AND dedupe_key = p_dedupe_key
     ) THEN
    RETURN;
  END IF;

  v_payload := jsonb_build_object('subscription_id', p_subscription_id)
               || COALESCE(p_extra, '{}'::jsonb);

  IF p_kind = 'subscription_welcome' THEN
    v_category := 'subscription';     v_severity := 'default';
    v_title := 'Welcome to your new plan';
    v_body  := 'Your subscription is active.';
    v_admin_title := 'Host subscription activated';
  ELSIF p_kind = 'subscription_expiring' THEN
    v_category := 'subscription';     v_severity := 'default';
    v_title := 'Subscription renews soon';
    v_body  := 'Your plan renews soon — make sure your payment method is up to date.';
    v_admin_title := 'Host subscription renewing soon';
  ELSIF p_kind = 'subscription_failed' THEN
    v_category := 'account_security'; v_severity := 'high';
    v_title := 'Subscription payment failed';
    v_body  := 'Update your payment method to keep your features active.';
    v_admin_title := 'Host subscription payment failed';
  ELSE -- subscription_restricted
    v_category := 'account_security'; v_severity := 'critical';
    v_title := 'Account restricted';
    v_body  := 'Reactivate to restore full access and receive new bookings.';
    v_admin_title := 'Host account restricted (subscription lapsed)';
  END IF;

  -- 1) Host email — thin row; drain.ts resolves the recipient from host_id and
  --    the template hydrates all copy from subscription_id.
  INSERT INTO notification_queue (type, payload, host_id, user_id, category_id, dedupe_key)
  VALUES (p_kind, v_payload, p_host_id, v_user_id, v_category, p_dedupe_key);

  -- 2) Host in-app (the channel that works today; email/push await Vault worker
  --    secrets). Best-effort — a host with no user_id (unclaimed) just gets email.
  IF v_user_id IS NOT NULL THEN
    PERFORM enqueue_in_app_notification(
      v_user_id, p_kind, v_title, v_body, v_link, v_payload, v_category, v_severity);
  END IF;

  -- 3) Admin finance feed.
  INSERT INTO admin_notifications (category, kind, title, body, user_id, host_id, href)
  VALUES ('finance', p_kind, v_admin_title, v_body, v_user_id, p_host_id, v_link);

  -- 4) Dedupe ledger row so a repeat call with the same key is a no-op.
  IF p_dedupe_key IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO notification_delivery_log (user_id, event_kind, category_id, channel, dedupe_key)
    VALUES (v_user_id, p_kind, v_category, 'in_app', p_dedupe_key);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_subscription_event(uuid, uuid, text, jsonb, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_subscription_event(uuid, uuid, text, jsonb, text)
  TO service_role;

COMMENT ON FUNCTION public.notify_subscription_event IS
  'Single dispatch point for host subscription lifecycle notifications: host email (notification_queue) + host in-app + admin finance feed, deduped per billing period. service_role only; p_kind whitelisted.';

-- ── Cron: warn hosts (+ admin) of an upcoming renewal, once per period ────
-- Replaces the old email-only, un-deduped, "days_remaining: 7"-hardcoded job.
-- Now routes through the SSOT (email + in-app + admin), reports the real days
-- remaining, dedupes on (subscription, period_end), and also covers trials.
DO $resched$
BEGIN
  PERFORM cron.unschedule('subscription-expiry-warnings');
EXCEPTION WHEN OTHERS THEN NULL;
END $resched$;

SELECT cron.schedule('subscription-expiry-warnings', '0 8 * * *', $cron$
  DO $body$
  DECLARE
    r      record;
    v_days int;
  BEGIN
    FOR r IN
      SELECT id, host_id, current_period_end
        FROM public.subscriptions
       WHERE status IN ('active', 'trialing')
         AND cancel_at_period_end = false
         AND current_period_end IS NOT NULL
         AND current_period_end BETWEEN now() AND now() + interval '7 days'
    LOOP
      v_days := GREATEST(
        0,
        CEIL(EXTRACT(EPOCH FROM (r.current_period_end - now())) / 86400.0)
      )::int;
      PERFORM public.notify_subscription_event(
        r.host_id, r.id, 'subscription_expiring',
        jsonb_build_object('days_remaining', v_days),
        'subscription_expiring:' || r.id::text || ':' || r.current_period_end::date
      );
    END LOOP;
  END $body$;
$cron$);

-- ── Cron: restrict overdue subs when grace elapses (+ notify + audit) ─────
-- Was a bare UPDATE with no notification and no history row. Now loops the newly
-- restricted rows so it can tell the host + admin AND record the auto status
-- transition in subscription_history.
DO $resched$
BEGIN
  PERFORM cron.unschedule('restrict-overdue-subscriptions');
EXCEPTION WHEN OTHERS THEN NULL;
END $resched$;

SELECT cron.schedule('restrict-overdue-subscriptions', '0 * * * *', $cron$
  DO $body$
  DECLARE r record;
  BEGIN
    FOR r IN
      UPDATE public.subscriptions
         SET status = 'restricted', updated_at = now()
       WHERE status = 'past_due'
         AND grace_period_ends_at IS NOT NULL
         AND grace_period_ends_at < now()
      RETURNING id, host_id, current_period_end
    LOOP
      INSERT INTO public.subscription_history
        (subscription_id, host_id, event, to_status, notes)
      VALUES
        (r.id, r.host_id, 'subscription_restricted', 'restricted',
         'Grace period elapsed — account restricted (data retained).');

      PERFORM public.notify_subscription_event(
        r.host_id, r.id, 'subscription_restricted', '{}'::jsonb,
        'subscription_restricted:' || r.id::text || ':'
          || COALESCE(r.current_period_end::text, 'x')
      );
    END LOOP;
  END $body$;
$cron$);
