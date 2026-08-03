-- Affiliate pipeline — Won means "referred a PAYING member", not just registered.
--
-- Founder (2026-08-01): on the affiliate board, only affiliates who have
-- successfully referred a paying member belong in Won. Everyone who has merely
-- registered (accepted the terms → affiliate_accounts.active) sits in
-- "Joined program". The "Nurturing" stage is redundant (nothing moves a card
-- there, no email is attached to it — the nurture drip is funnel/enrolment
-- driven, not stage driven) and is removed.
--
-- Changes:
--   1. on_affiliate_activated: registration → "Joined program" (was Won),
--      create-if-missing so every registered affiliate is visible. Keeps the
--      Meta CompleteRegistration event.
--   2. NEW on_affiliate_commission_accrued: a referred member paying (an
--      affiliate_commissions accrual row) → move that affiliate's card to Won.
--   3. Drop the affiliate "Nurturing" stage; relabel Won; recompact order.
--   4. Backfill: demote any Won affiliate with no accrual back to Joined;
--      promote any affiliate with an accrual to Won.
--
-- Mapping: affiliate_accounts.user_id = pipeline_leads.user_id (audience
-- 'affiliate'); affiliate_commissions.affiliate_id → affiliate_accounts.user_id.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS trg_affiliate_commission_accrued ON public.affiliate_commissions;
--   DROP FUNCTION IF EXISTS public.on_affiliate_commission_accrued();
--   (re-apply on_affiliate_activated from 20260801200000; re-add nurturing stage)

-- ─── 1. Remove the redundant "Nurturing" affiliate stage ──────────────
-- Defensive: park any card that somehow sits there into "Joined program" first
-- (stage_id FK is ON DELETE RESTRICT, so a referenced stage can't be dropped).
UPDATE public.pipeline_leads pl
   SET stage_id = (SELECT id FROM public.pipeline_stages WHERE audience='affiliate' AND key='joined'),
       last_activity_at = now()
  FROM public.pipeline_stages ps
 WHERE pl.stage_id = ps.id
   AND ps.audience = 'affiliate' AND ps.key = 'nurturing';

DELETE FROM public.pipeline_stages WHERE audience='affiliate' AND key='nurturing';

-- Recompact order (won 4→3, lost 5→4) and rename Won to the new definition.
UPDATE public.pipeline_stages
   SET sort_order = sort_order - 1
 WHERE audience='affiliate' AND sort_order > 3;

UPDATE public.pipeline_stages
   SET label = 'Won (referred a paying member)'
 WHERE audience='affiliate' AND key='won';

-- ─── 2. Registration → "Joined program" (not Won) ─────────────────────
CREATE OR REPLACE FUNCTION public.on_affiliate_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_joined_stage uuid;
  v_joined_sort  int;
  v_lead_id      uuid;
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

  SELECT id, sort_order INTO v_joined_stage, v_joined_sort
  FROM public.pipeline_stages WHERE audience='affiliate' AND key='joined';

  IF v_joined_stage IS NOT NULL THEN
    -- Advance an OPEN card sitting before "Joined program" (New/Contacted).
    -- Never downgrade a Won card, nor a card already further along.
    UPDATE public.pipeline_leads AS pl
       SET stage_id = v_joined_stage, last_activity_at = now()
      FROM public.pipeline_stages AS ps
     WHERE pl.user_id = NEW.user_id
       AND pl.audience = 'affiliate'
       AND pl.status = 'open'
       AND pl.stage_id = ps.id
       AND ps.sort_order < v_joined_sort
    RETURNING pl.id INTO v_lead_id;

    IF v_lead_id IS NOT NULL THEN
      INSERT INTO public.pipeline_activities (lead_id, staff_id, kind, body, meta)
      VALUES (v_lead_id, NULL, 'stage_moved', 'Registered as an affiliate — moved to Joined program.',
              jsonb_build_object('stage_id', v_joined_stage, 'affiliate_id', NEW.id, 'system', true));
    -- No card advanced and none exists → create one at "Joined program".
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.pipeline_leads
      WHERE user_id = NEW.user_id AND audience = 'affiliate'
    ) THEN
      INSERT INTO public.pipeline_leads (user_id, audience, stage_id, source_kind, last_activity_at)
      VALUES (NEW.user_id, 'affiliate', v_joined_stage, 'direct', now())
      ON CONFLICT (user_id, audience) DO NOTHING
      RETURNING id INTO v_lead_id;
      IF v_lead_id IS NOT NULL THEN
        INSERT INTO public.pipeline_activities (lead_id, staff_id, kind, body, meta)
        VALUES (v_lead_id, NULL, 'created', 'Registered as an affiliate — added to Joined program.',
                jsonb_build_object('stage_id', v_joined_stage, 'affiliate_id', NEW.id, 'system', true));
      END IF;
    END IF;
  END IF;

  -- Carry the card id (even if unchanged) for the consent lookup on the event.
  IF v_lead_id IS NULL THEN
    SELECT id INTO v_lead_id
    FROM public.pipeline_leads WHERE user_id = NEW.user_id AND audience='affiliate' LIMIT 1;
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

-- ─── 3. Referred a PAYING member → Won ────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_affiliate_commission_accrued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_won_stage uuid;
  v_lead_id   uuid;
BEGIN
  -- Only a real accrual (a referred member paid); clawbacks aren't a new referral.
  IF NEW.entry_type <> 'accrual' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user_id FROM public.affiliate_accounts WHERE id = NEW.affiliate_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_won_stage
  FROM public.pipeline_stages WHERE audience='affiliate' AND is_won = true LIMIT 1;
  IF v_won_stage IS NULL THEN
    RETURN NEW;
  END IF;

  -- Move an existing, not-yet-won affiliate card to Won.
  UPDATE public.pipeline_leads
     SET stage_id = v_won_stage, status = 'won', last_activity_at = now()
   WHERE user_id = v_user_id AND audience = 'affiliate' AND status <> 'won'
  RETURNING id INTO v_lead_id;

  -- No card yet (registered before this existed / recruited off-board) → create at Won.
  IF v_lead_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.pipeline_leads WHERE user_id = v_user_id AND audience='affiliate'
  ) THEN
    INSERT INTO public.pipeline_leads (user_id, audience, stage_id, status, source_kind, last_activity_at)
    VALUES (v_user_id, 'affiliate', v_won_stage, 'won', 'direct', now())
    ON CONFLICT (user_id, audience) DO NOTHING
    RETURNING id INTO v_lead_id;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    INSERT INTO public.pipeline_activities (lead_id, staff_id, kind, body, meta)
    VALUES (v_lead_id, NULL, 'converted', 'Referred a paying member — moved to Won.',
            jsonb_build_object('stage_id', v_won_stage, 'status', 'won',
                               'commission_id', NEW.id, 'system', true));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_commission_accrued ON public.affiliate_commissions;
CREATE TRIGGER trg_affiliate_commission_accrued
  AFTER INSERT ON public.affiliate_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_affiliate_commission_accrued();

-- ─── 4. Backfill existing affiliate cards to the new rule ─────────────
-- (a) Demote any card in Won whose owner has NO accrual → Joined program.
UPDATE public.pipeline_leads pl
   SET stage_id = (SELECT id FROM public.pipeline_stages WHERE audience='affiliate' AND key='joined'),
       status = 'open', last_activity_at = now()
  FROM public.pipeline_stages ps
 WHERE pl.audience = 'affiliate'
   AND pl.stage_id = ps.id AND ps.is_won = true
   AND NOT EXISTS (
     SELECT 1 FROM public.affiliate_commissions ac
     JOIN public.affiliate_accounts aa ON aa.id = ac.affiliate_id
     WHERE aa.user_id = pl.user_id AND ac.entry_type = 'accrual'
   );

-- (b) Promote any card whose owner HAS an accrual but isn't Won → Won.
UPDATE public.pipeline_leads pl
   SET stage_id = (SELECT id FROM public.pipeline_stages WHERE audience='affiliate' AND is_won=true LIMIT 1),
       status = 'won', last_activity_at = now()
 WHERE pl.audience = 'affiliate'
   AND pl.status <> 'won'
   AND EXISTS (
     SELECT 1 FROM public.affiliate_commissions ac
     JOIN public.affiliate_accounts aa ON aa.id = ac.affiliate_id
     WHERE aa.user_id = pl.user_id AND ac.entry_type = 'accrual'
   );
