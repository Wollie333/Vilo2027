-- Pipeline → Meta CAPI — Phase 3b: subscription-trialing → Trial + StartTrial.
--
-- When a subscription enters status='trialing' (the competition free-trial signup
-- path), this trigger:
--   (a) enqueues a Meta StartTrial event for the host (ALWAYS — audience signal),
--   (b) moves that host's pipeline card to the Trial stage IF a card exists
--       (move-only, never create — the board stays real funnel leads).
-- StartTrial carries NO value (a trial is not real money; Won/Subscribe with the
-- real ZAR amount fires later off platform_ledger).
--
-- Mapping: subscriptions.host_id → hosts.id → hosts.user_id = user_profiles.id
--          = pipeline_leads.user_id.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS trg_subscription_trial ON public.subscriptions;
--   DROP FUNCTION IF EXISTS public.on_subscription_trialing();

CREATE OR REPLACE FUNCTION public.on_subscription_trialing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid;
  v_stage_id uuid;
  v_lead_id  uuid;
BEGIN
  -- Only the transition INTO 'trialing'.
  IF NEW.status IS DISTINCT FROM 'trialing' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'trialing' THEN
    RETURN NEW;  -- already trialing; some other column changed
  END IF;

  -- Resolve the host's owner account.
  SELECT user_id INTO v_user_id FROM public.hosts WHERE id = NEW.host_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Move an EXISTING open host card into Trial (don't create, don't downgrade a
  -- won/lost card).
  SELECT id INTO v_stage_id
  FROM public.pipeline_stages
  WHERE audience = 'host' AND key = 'trial';

  IF v_stage_id IS NOT NULL THEN
    UPDATE public.pipeline_leads
       SET stage_id = v_stage_id, last_activity_at = now()
     WHERE user_id = v_user_id
       AND audience = 'host'
       AND status = 'open'
       AND stage_id <> v_stage_id
    RETURNING id INTO v_lead_id;

    IF v_lead_id IS NOT NULL THEN
      INSERT INTO public.pipeline_activities (lead_id, staff_id, kind, body, meta)
      VALUES (v_lead_id, NULL, 'stage_moved', 'Started a trial — moved to Trial.',
              jsonb_build_object('stage_id', v_stage_id, 'subscription_id', NEW.id, 'system', true));
    END IF;
  END IF;

  -- ALWAYS enqueue StartTrial (fires even when there's no CRM card).
  INSERT INTO public.meta_conversion_events
    (event_name, user_id, lead_id, event_id, source_ref, action_source)
  VALUES
    ('StartTrial', v_user_id, v_lead_id,
     'sub:' || NEW.id || ':StartTrial', 'sub:' || NEW.id, 'system_generated')
  ON CONFLICT (event_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_trial ON public.subscriptions;
CREATE TRIGGER trg_subscription_trial
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_subscription_trialing();
