-- Pipeline → Meta CAPI — Phase 2: platform_ledger settle → Subscribe/Purchase + Won.
--
-- When a Wielo-revenue charge settles (platform_ledger.status -> 'completed',
-- type='charge', amount>0) this trigger:
--   (a) moves the payer's host pipeline card to Won (move-only, once — a paying
--       host is a customer), and
--   (b) enqueues a Meta conversion event with the REAL ZAR amount:
--         membership  -> Subscribe   (fired ONCE, on the first membership charge;
--                                      monthly renewals are not new conversions)
--         product     -> Purchase    (every one-off buy)
--         wielo_credits -> skipped   (a wallet top-up isn't becoming a customer)
--
-- platform_ledger.user_id = user_profiles.id = pipeline_leads.user_id. Value is
-- platform_ledger.amount (post-VAT/discount, always ZAR). Fires across every
-- settle path (signup checkout, renewals, product buys) and both runtimes.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS trg_platform_ledger_settled ON public.platform_ledger;
--   DROP FUNCTION IF EXISTS public.on_platform_ledger_settled();

CREATE OR REPLACE FUNCTION public.on_platform_ledger_settled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ptype     text;
  v_slug      text;
  v_name      text;
  v_event     text;
  v_won_stage uuid;
  v_lead_id   uuid;
  v_first     boolean;
BEGIN
  -- Only a freshly settled positive charge.
  IF NEW.status <> 'completed' OR NEW.type <> 'charge' OR coalesce(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;  -- already settled; a later edit isn't a new conversion
  END IF;
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    SELECT product_type, slug, name INTO v_ptype, v_slug, v_name
    FROM public.products WHERE id = NEW.product_id;
  END IF;

  -- Credit top-ups are not a pipeline conversion — no event, no Won.
  IF v_ptype = 'wielo_credits' THEN
    RETURN NEW;
  END IF;

  IF v_ptype = 'membership' OR (v_ptype IS NULL AND NEW.subscription_id IS NOT NULL) THEN
    v_event := 'Subscribe';
  ELSE
    v_event := 'Purchase';
  END IF;

  -- Move an existing, not-yet-won host card to Won (once).
  SELECT id INTO v_won_stage
  FROM public.pipeline_stages WHERE audience = 'host' AND is_won = true LIMIT 1;

  IF v_won_stage IS NOT NULL THEN
    UPDATE public.pipeline_leads
       SET stage_id = v_won_stage, status = 'won', last_activity_at = now()
     WHERE user_id = NEW.user_id AND audience = 'host' AND status <> 'won'
    RETURNING id INTO v_lead_id;

    IF v_lead_id IS NOT NULL THEN
      INSERT INTO public.pipeline_activities (lead_id, staff_id, kind, body, meta)
      VALUES (v_lead_id, NULL, 'converted', 'Paid — became a customer. Moved to Won.',
              jsonb_build_object('stage_id', v_won_stage, 'status', 'won',
                                 'ledger_id', NEW.id, 'event', v_event, 'system', true));
    END IF;
  END IF;

  -- For the event, carry the card id even if it was already Won (consent lookup).
  IF v_lead_id IS NULL THEN
    SELECT id INTO v_lead_id
    FROM public.pipeline_leads WHERE user_id = NEW.user_id AND audience = 'host' LIMIT 1;
  END IF;

  -- Subscribe fires ONCE (first membership charge); renewals are not conversions.
  IF v_event = 'Subscribe' THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.platform_ledger pl
      LEFT JOIN public.products p ON p.id = pl.product_id
      WHERE pl.user_id = NEW.user_id
        AND pl.type = 'charge' AND pl.status = 'completed'
        AND pl.id <> NEW.id AND pl.created_at < NEW.created_at
        AND (pl.subscription_id IS NOT NULL OR p.product_type = 'membership')
    ) INTO v_first;
    IF NOT v_first THEN
      RETURN NEW;  -- renewal: card already Won above, no new Meta event
    END IF;
  END IF;

  INSERT INTO public.meta_conversion_events
    (event_name, user_id, lead_id, value, currency, content_ids, content_name,
     event_id, source_ref, action_source)
  VALUES
    (v_event, NEW.user_id, v_lead_id, NEW.amount, coalesce(NEW.currency, 'ZAR'),
     ARRAY[coalesce(v_slug, NEW.plan, 'wielo')], v_name,
     'ledger:' || NEW.id || ':' || v_event, 'ledger:' || NEW.id, 'system_generated')
  ON CONFLICT (event_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_ledger_settled ON public.platform_ledger;
CREATE TRIGGER trg_platform_ledger_settled
  AFTER INSERT OR UPDATE OF status ON public.platform_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.on_platform_ledger_settled();
