-- Trial-ending reminder: email + in-app ~24h before a free trial expires.
--
-- Gap this closes: a trialing subscription (status='trialing' + trial_ends_at)
-- is flipped to 'restricted' (read-only) by the daily `expire-trials` cron, but
-- the host was never warned. The existing `subscription-expiry-warnings` cron
-- keys off current_period_end (paid renewals), NOT trial_ends_at, so trial-only
-- expiry produced no notification. This adds:
--   1) a new `trial_ending` kind to the notify_subscription_event SSOT, and
--   2) an HOURLY cron that catches trials expiring in the next 23–24h and fires
--      the reminder exactly once (rolling 1h window + per-trial dedupe key).
--
-- The email CTA is affiliate-aware: trialEndingResolver (apps/web) routes a
-- referred host's subscribe CTA through /r/<slug> to credit the affiliate. That
-- lives in the email resolver — the queue row stays a thin {subscription_id}.
--
-- Security unchanged: notify_subscription_event is SECURITY DEFINER, service_role
-- only, p_kind whitelisted (now five kinds). No dynamic SQL; no PII in the queue.

-- ── Re-declare the dispatch SSOT with the new whitelisted kind ────────────
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
    'subscription_failed',  'subscription_restricted',
    'trial_ending'
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
  ELSIF p_kind = 'trial_ending' THEN
    v_category := 'subscription';     v_severity := 'default';
    v_title := 'Your trial ends in 24 hours';
    v_body  := 'Subscribe now to keep your listings live before your free trial ends.';
    v_admin_title := 'Host trial ending soon';
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
  'Single dispatch point for host subscription lifecycle notifications: host email (notification_queue) + host in-app + admin finance feed, deduped per billing period. service_role only; p_kind whitelisted (subscription_welcome/expiring/failed/restricted + trial_ending).';

-- ── Cron: warn trialing hosts ~24h before the free trial expires ──────────
-- Hourly, rolling 1-hour window [now()+23h, now()+24h): each trial crosses the
-- window on exactly one tick, so it fires once ~23–24h out. The per-trial dedupe
-- key (encoding trial_ends_at::date) is belt-and-suspenders against a re-run.
DO $resched$
BEGIN
  PERFORM cron.unschedule('trial-ending-warnings');
EXCEPTION WHEN OTHERS THEN NULL;
END $resched$;

SELECT cron.schedule('trial-ending-warnings', '5 * * * *', $cron$
  DO $body$
  DECLARE r record;
  BEGIN
    FOR r IN
      SELECT id, host_id, trial_ends_at
        FROM public.subscriptions
       WHERE status = 'trialing'
         AND trial_ends_at IS NOT NULL
         AND trial_ends_at BETWEEN now() + interval '23 hours'
                               AND now() + interval '24 hours'
    LOOP
      PERFORM public.notify_subscription_event(
        r.host_id, r.id, 'trial_ending',
        jsonb_build_object('trial_ends_at', r.trial_ends_at),
        'trial_ending:' || r.id::text || ':' || r.trial_ends_at::date
      );
    END LOOP;
  END $body$;
$cron$);
