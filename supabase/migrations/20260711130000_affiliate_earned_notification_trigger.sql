-- Notify an affiliate the moment a commission accrues — from ANY source,
-- including the Deno paystack-webhook (subscription RENEWALS), which runs in a
-- separate runtime and cannot call the app's dispatchEvent. Moving the
-- "commission earned" notification to a DB trigger makes it fire uniformly for
-- every accrual (webhook renewals + in-app purchases + admin charges), so the
-- TS helper no longer dispatches it (see lib/affiliate/notify.ts).
--
-- SAFETY: the whole body is exception-swallowed — a notification failure must
-- NEVER roll back the commission insert / break payment settlement.

CREATE OR REPLACE FUNCTION public.tg_notify_affiliate_commission_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    uuid;
  v_email   text;
  v_name    text;
  v_amount  text;
  v_body    text;
  v_payload jsonb;
  v_prefs   record;
BEGIN
  IF NEW.entry_type <> 'accrual' THEN RETURN NEW; END IF;

  BEGIN
    SELECT a.user_id, up.email
      INTO v_user, v_email
    FROM public.affiliate_accounts a
    LEFT JOIN public.user_profiles up ON up.id = a.user_id
    WHERE a.id = NEW.affiliate_id;
    IF v_user IS NULL THEN RETURN NEW; END IF;

    SELECT name INTO v_name FROM public.products WHERE id = NEW.product_id;

    v_amount := 'R ' || to_char(round(NEW.commission_amount, 2), 'FM999999990.00');
    v_body := CASE WHEN v_name IS NOT NULL
                   THEN 'From ' || v_name
                   ELSE 'Affiliate commission earned.' END;
    v_payload := jsonb_build_object(
      'amount', v_amount, 'detail', v_name, 'recipient_email', v_email);

    -- Effective prefs for the payments_refunds category (locked → all forced on).
    SELECT * INTO v_prefs
    FROM public.resolve_notification_prefs(v_user, 'payments_refunds');

    -- In-app
    IF COALESCE(v_prefs.is_locked, false) OR COALESCE(v_prefs.in_app_enabled, true) THEN
      PERFORM public.enqueue_in_app_notification(
        v_user, 'affiliate_commission_earned',
        'You earned ' || v_amount || ' 🎉',
        v_body, '/portal/affiliates', v_payload,
        'payments_refunds', 'default');
    END IF;

    -- Email (queued; the drain renders + sends via Resend in prod)
    IF v_email IS NOT NULL
       AND (COALESCE(v_prefs.is_locked, false) OR COALESCE(v_prefs.email_enabled, true)) THEN
      INSERT INTO public.notification_queue (type, payload, user_id, category_id)
      VALUES ('affiliate_commission_earned', v_payload, v_user, 'payments_refunds');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never let a notification failure break the accrual / settlement.
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_affiliate_earned ON public.affiliate_commissions;
CREATE TRIGGER trg_notify_affiliate_earned
  AFTER INSERT ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_affiliate_commission_earned();
