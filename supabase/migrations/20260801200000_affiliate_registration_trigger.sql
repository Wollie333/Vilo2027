-- Pipeline → Meta CAPI — Phase 4: affiliate registration → Won + CompleteRegistration.
--
-- When an affiliate account reaches status='active' (self-serve pending→active,
-- in-portal born-active, or admin activation) this trigger:
--   (a) enqueues a Meta CompleteRegistration event for the affiliate (ALWAYS —
--       the affiliate pipeline's "won" is a registration, not a purchase, so no
--       value), and
--   (b) moves that person's affiliate pipeline card to Won IF one exists
--       (move-only, never create — the board stays real funnel leads).
--
-- affiliate_accounts.user_id = user_profiles.id = pipeline_leads.user_id.
-- Idempotent: reinstatement (suspended→active) won't duplicate the event
-- (event_id UNIQUE) nor re-move an already-won card.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS trg_affiliate_activated ON public.affiliate_accounts;
--   DROP FUNCTION IF EXISTS public.on_affiliate_activated();

CREATE OR REPLACE FUNCTION public.on_affiliate_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_won_stage uuid;
  v_lead_id   uuid;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;  -- already active; a later edit isn't a new registration
  END IF;
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Move an existing, not-yet-won affiliate card to Won.
  SELECT id INTO v_won_stage
  FROM public.pipeline_stages WHERE audience = 'affiliate' AND is_won = true LIMIT 1;

  IF v_won_stage IS NOT NULL THEN
    UPDATE public.pipeline_leads
       SET stage_id = v_won_stage, status = 'won', last_activity_at = now()
     WHERE user_id = NEW.user_id AND audience = 'affiliate' AND status <> 'won'
    RETURNING id INTO v_lead_id;

    IF v_lead_id IS NOT NULL THEN
      INSERT INTO public.pipeline_activities (lead_id, staff_id, kind, body, meta)
      VALUES (v_lead_id, NULL, 'converted', 'Registered as an affiliate. Moved to Won.',
              jsonb_build_object('stage_id', v_won_stage, 'status', 'won',
                                 'affiliate_id', NEW.id, 'system', true));
    END IF;
  END IF;

  -- Carry the card id even if it was already Won (consent lookup).
  IF v_lead_id IS NULL THEN
    SELECT id INTO v_lead_id
    FROM public.pipeline_leads WHERE user_id = NEW.user_id AND audience = 'affiliate' LIMIT 1;
  END IF;

  INSERT INTO public.meta_conversion_events
    (event_name, user_id, lead_id, event_id, source_ref, action_source)
  VALUES
    ('CompleteRegistration', NEW.user_id, v_lead_id,
     'affiliate:' || NEW.id || ':CompleteRegistration', 'affiliate:' || NEW.id,
     'system_generated')
  ON CONFLICT (event_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_activated ON public.affiliate_accounts;
CREATE TRIGGER trg_affiliate_activated
  AFTER INSERT OR UPDATE OF status ON public.affiliate_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.on_affiliate_activated();
