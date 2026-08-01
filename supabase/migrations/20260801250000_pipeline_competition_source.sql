-- Pipeline — record competition vs. normal affiliate vs. direct on the card.
--
-- Founder (2026-08-01): a host who arrives via a COMPETITION affiliate link must
-- be recorded/indicated distinctly from a normal affiliate link or a plain
-- direct signup. The distinction is data-driven: bindAffiliateReferral stamps
-- affiliate_referrals.campaign_id ONLY for a real competition click (a typed
-- partner code or a plain affiliate link leaves it null — lib/affiliate/
-- attribution.ts). So:
--   campaign_id set   → source_kind 'competition'  (label = campaign name),
--                        suppress_default_nurture   (already in the competition's
--                        own comms), affiliate still recorded (commission intact).
--   affiliate only    → source_kind 'affiliate_referral' (label = slug).
--   no referral       → 'direct'.
--
-- This updates the create-path of on_host_created (a host made outside the
-- signup start flow) and fixes up any existing host cards whose owner has a
-- campaign-bound referral. The app-side paths (lib/pipeline/leadSource.ts, used
-- by the signup hook + funnel submit) resolve the same three cases.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   (re-apply the previous on_host_created from 20260801240000)

CREATE OR REPLACE FUNCTION public.on_host_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signed_stage uuid;
  v_signed_sort  int;
  v_lead_id      uuid;
  v_slug         text;
  v_camp_id      uuid;
  v_camp_name    text;
  v_source_kind  text;
  v_source_label text;
  v_suppress     boolean := false;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, sort_order INTO v_signed_stage, v_signed_sort
  FROM public.pipeline_stages
  WHERE audience = 'host' AND key = 'signed_up';
  IF v_signed_stage IS NULL THEN
    RETURN NEW;
  END IF;

  -- (a) Advance an OPEN card sitting before "Signed up".
  UPDATE public.pipeline_leads AS pl
     SET stage_id = v_signed_stage, last_activity_at = now()
    FROM public.pipeline_stages AS ps
   WHERE pl.user_id = NEW.user_id
     AND pl.audience = 'host'
     AND pl.status = 'open'
     AND pl.stage_id = ps.id
     AND ps.sort_order < v_signed_sort
  RETURNING pl.id INTO v_lead_id;

  IF v_lead_id IS NOT NULL THEN
    INSERT INTO public.pipeline_activities (lead_id, staff_id, kind, body, meta)
    VALUES (v_lead_id, NULL, 'stage_moved', 'Completed host signup — moved to Signed up.',
            jsonb_build_object('stage_id', v_signed_stage, 'host_id', NEW.id, 'system', true));
    RETURN NEW;
  END IF;

  -- (b) Card already at/after "Signed up" (or won/lost/trial) → leave it.
  IF EXISTS (
    SELECT 1 FROM public.pipeline_leads
    WHERE user_id = NEW.user_id AND audience = 'host'
  ) THEN
    RETURN NEW;
  END IF;

  -- (c) No card → host made outside the start flow. Create one at "Signed up",
  --     recording the source: competition / affiliate_referral / direct.
  SELECT aa.slug, ar.campaign_id, ac.name
    INTO v_slug, v_camp_id, v_camp_name
  FROM public.affiliate_referrals ar
  LEFT JOIN public.affiliate_accounts  aa ON aa.id = ar.affiliate_id
  LEFT JOIN public.affiliate_campaigns ac ON ac.id = ar.campaign_id
  WHERE ar.referred_user_id = NEW.user_id;

  IF v_camp_id IS NOT NULL THEN
    v_source_kind  := 'competition';
    v_source_label := coalesce(v_camp_name, 'Competition');
    v_suppress     := true;
  ELSIF v_slug IS NOT NULL THEN
    v_source_kind  := 'affiliate_referral';
    v_source_label := v_slug;
  ELSE
    v_source_kind  := 'direct';
    v_source_label := NULL;
  END IF;

  INSERT INTO public.pipeline_leads
    (user_id, audience, stage_id, source_kind, source_label, affiliate_ref,
     suppress_default_nurture, last_activity_at)
  VALUES
    (NEW.user_id, 'host', v_signed_stage, v_source_kind, v_source_label, v_slug,
     v_suppress, now())
  ON CONFLICT (user_id, audience) DO NOTHING
  RETURNING id INTO v_lead_id;

  IF v_lead_id IS NOT NULL THEN
    INSERT INTO public.pipeline_activities (lead_id, staff_id, kind, body, meta)
    VALUES (v_lead_id, NULL, 'created', 'Became a host — added to the pipeline.',
            jsonb_build_object('stage_id', v_signed_stage, 'host_id', NEW.id,
                               'source_kind', v_source_kind, 'system', true));
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Fix-up: existing host cards whose owner has a competition (campaign-bound)
--     referral but were recorded as affiliate_referral/direct by the earlier
--     backfill. Re-tag them competition + suppress; keep the affiliate ref.
UPDATE public.pipeline_leads pl
   SET source_kind = 'competition',
       source_label = coalesce(ac.name, 'Competition'),
       affiliate_ref = coalesce(pl.affiliate_ref, aa.slug),
       suppress_default_nurture = true
  FROM public.affiliate_referrals ar
  JOIN public.affiliate_campaigns ac ON ac.id = ar.campaign_id
  LEFT JOIN public.affiliate_accounts aa ON aa.id = ar.affiliate_id
 WHERE pl.audience = 'host'
   AND pl.user_id = ar.referred_user_id
   AND ar.campaign_id IS NOT NULL
   AND pl.source_kind <> 'competition';
