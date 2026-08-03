-- Funnel Manager — host signups appear on the pipeline board.
--
-- Founder directive (2026-08-01): the DEFAULT signup process (not just the
-- /go/hosts landing page) must surface hosts on the Hosts pipeline, and the
-- card must reflect HOW FAR they got:
--   * starts host signup (account created, onboarding unfinished) → stage "New"
--     (written app-side by lib/pipeline/hostSignupLead.ts inside the host
--     createAccountAction — the only host-INTENT signal; a pure guest signup
--     must never land on the host board).
--   * completes onboarding (a hosts row is inserted, ANY path) → advance to a
--     NEW "Signed up" stage (this migration's trigger).
--   * starts a trial / pays → Trial / Won (the existing subscription + ledger
--     triggers already do this; they are move-only, and now always have a card
--     to move).
--
-- This REVERSES plan §4b ("cold direct signup → no card"): the founder wants
-- drop-off visibility, so every host — self-serve or funnel — gets a card.
--
-- Conventions: text+CHECK (no enums), SECURITY DEFINER + search_path=public
-- (matches on_subscription_trialing / on_platform_ledger_settled /
-- on_affiliate_activated), ON CONFLICT (user_id, audience) keeps one card per
-- board so a funnel lead who later signs up keeps their existing card + source.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS trg_host_created ON public.hosts;
--   DROP FUNCTION IF EXISTS public.on_host_created();
--   DELETE FROM public.pipeline_stages WHERE audience='host' AND key='signed_up';
--   -- (then re-compact host sort_order 0..7; forward-only in prod)

-- ─── 1. New host stage "Signed up" (between New and Contacted) ─────────
-- Shift every host stage after "New" up by one, then slot "Signed up" at 1.
-- No UNIQUE(audience, sort_order) exists, so the shift can't collide; it just
-- keeps the visual order right. is_customer=false — a free-tier host who has
-- not started a trial or paid is still a conversion target (deletable, workable).
UPDATE public.pipeline_stages
   SET sort_order = sort_order + 1
 WHERE audience = 'host' AND sort_order >= 1;

INSERT INTO public.pipeline_stages (audience, key, label, sort_order, is_won, is_lost, is_customer)
VALUES ('host', 'signed_up', 'Signed up', 1, false, false, false)
ON CONFLICT (audience, key) DO NOTHING;

-- Fail loudly if the stage isn't present (self-verifying migration).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE audience='host' AND key='signed_up') THEN
    RAISE EXCEPTION 'signup_pipeline_stage: host "signed_up" stage missing after insert';
  END IF;
END$$;

-- ─── 2. Completion trigger: hosts INSERT → advance/create at "Signed up" ─
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
  v_source_kind  text;
  v_source_label text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, sort_order INTO v_signed_stage, v_signed_sort
  FROM public.pipeline_stages
  WHERE audience = 'host' AND key = 'signed_up';
  IF v_signed_stage IS NULL THEN
    RETURN NEW;  -- stage not provisioned; nothing to do
  END IF;

  -- (a) An OPEN card sitting before "Signed up" (the "New" start-of-signup
  --     card, or a funnel lead) → advance it. Never downgrade a card that is
  --     already further along (Contacted…), nor a won/lost/trial card.
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

  -- (b) A card already exists at/after "Signed up" (or won/lost/trial) → leave it.
  IF EXISTS (
    SELECT 1 FROM public.pipeline_leads
    WHERE user_id = NEW.user_id AND audience = 'host'
  ) THEN
    RETURN NEW;
  END IF;

  -- (c) No card at all → this host was created outside the host-signup start
  --     flow (admin, quote-only, free-product fulfilment). Create one directly
  --     at "Signed up" — they are already a host.
  SELECT aa.slug INTO v_slug
  FROM public.affiliate_referrals ar
  JOIN public.affiliate_accounts aa ON aa.id = ar.affiliate_id
  WHERE ar.referred_user_id = NEW.user_id;

  IF v_slug IS NOT NULL THEN
    v_source_kind := 'affiliate_referral';
    v_source_label := v_slug;
  ELSE
    v_source_kind := 'direct';
    v_source_label := NULL;
  END IF;

  INSERT INTO public.pipeline_leads
    (user_id, audience, stage_id, source_kind, source_label, affiliate_ref, last_activity_at)
  VALUES
    (NEW.user_id, 'host', v_signed_stage, v_source_kind, v_source_label, v_slug, now())
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

DROP TRIGGER IF EXISTS trg_host_created ON public.hosts;
CREATE TRIGGER trg_host_created
  AFTER INSERT ON public.hosts
  FOR EACH ROW
  EXECUTE FUNCTION public.on_host_created();

-- ─── 3. Backfill: every existing host without a card gets one, placed by
--         their real state (paid → Won, trialing → Trial, else Signed up). ─
WITH host_rows AS (
  SELECT h.user_id
  FROM public.hosts h
  WHERE h.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.pipeline_leads pl
      WHERE pl.user_id = h.user_id AND pl.audience = 'host'
    )
  GROUP BY h.user_id
),
placed AS (
  SELECT
    hr.user_id,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.platform_ledger pl
        WHERE pl.user_id = hr.user_id AND pl.type = 'charge'
          AND pl.status = 'completed' AND coalesce(pl.amount, 0) > 0
      ) THEN 'won'
      WHEN EXISTS (
        SELECT 1 FROM public.subscriptions s
        JOIN public.hosts h2 ON h2.id = s.host_id
        WHERE h2.user_id = hr.user_id AND s.status = 'trialing'
      ) THEN 'trial'
      ELSE 'signed_up'
    END AS stage_key,
    (SELECT aa.slug
       FROM public.affiliate_referrals ar
       JOIN public.affiliate_accounts aa ON aa.id = ar.affiliate_id
      WHERE ar.referred_user_id = hr.user_id
      LIMIT 1) AS aff_slug
  FROM host_rows hr
),
ins AS (
  INSERT INTO public.pipeline_leads
    (user_id, audience, stage_id, status, source_kind, source_label, affiliate_ref, last_activity_at)
  SELECT
    p.user_id, 'host', ps.id,
    CASE WHEN p.stage_key = 'won' THEN 'won' ELSE 'open' END,
    CASE WHEN p.aff_slug IS NOT NULL THEN 'affiliate_referral' ELSE 'direct' END,
    p.aff_slug, p.aff_slug, now()
  FROM placed p
  JOIN public.pipeline_stages ps ON ps.audience = 'host' AND ps.key = p.stage_key
  ON CONFLICT (user_id, audience) DO NOTHING
  RETURNING id
)
INSERT INTO public.pipeline_activities (lead_id, staff_id, kind, body, meta)
SELECT ins.id, NULL, 'created', 'Became a host — added to the pipeline (backfill).',
       jsonb_build_object('system', true, 'backfill', true)
FROM ins;
