-- Funnel Manager — Phase 5: seed the Affiliate funnel + activate its nurture drip.
--
-- Mirrors the Hosts funnel (20260801100300 seed + 20260801110000 drip) for the
-- affiliate recruitment audience. The public /go/affiliate landing page resolves
-- its copy/resource from this funnels row; consenting leads enrol in the affiliate
-- nurture sequence (seeded inactive in 20260801100000, activated here once it has
-- steps). Brochure + video left null and filled later via the admin. The board,
-- affiliate pipeline_stages and (inactive) affiliate sequence already exist.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   SELECT cron.unschedule('drain-nurture');  -- shared cron; leave if host still active
--   DELETE FROM public.funnels WHERE slug = 'affiliate';
--   DELETE FROM public.nurture_steps WHERE sequence_id IN
--     (SELECT id FROM public.nurture_sequences WHERE audience='affiliate');
--   UPDATE public.nurture_sequences SET is_active=false WHERE audience='affiliate';

-- ─── 1. Seed the affiliate nurture sequence steps ─────────────────────
-- delay_hours is measured from the previous step (step 1 = from enrolment).
INSERT INTO public.nurture_steps (sequence_id, step_order, delay_hours, email_type, subject_override)
SELECT s.id, v.step_order, v.delay_hours, v.email_type, v.subject_override
FROM public.nurture_sequences s
CROSS JOIN (VALUES
  (1, 0,   'nurture_affiliate_welcome', 'Welcome — here''s how partners earn with Wielo'),
  (2, 48,  'nurture_affiliate_value',   'How much can you earn referring hosts?'),
  (3, 120, 'nurture_affiliate_offer',   'Grab your referral link and start earning')
) AS v(step_order, delay_hours, email_type, subject_override)
WHERE s.audience = 'affiliate'
ON CONFLICT (sequence_id, step_order) DO NOTHING;

-- ─── 2. Activate the affiliate sequence now that it has steps ──────────
-- (The funnel submit only enrols a consenting lead when the sequence is active
-- AND has active steps — see lib/funnels/submit.ts.)
UPDATE public.nurture_sequences SET is_active = true WHERE audience = 'affiliate';

-- ─── 3. Seed the affiliate funnel row ─────────────────────────────────
INSERT INTO public.funnels (audience, slug, name, headline, subcopy, thankyou_config, sequence_id, is_active)
VALUES (
  'affiliate',
  'affiliate',
  'Affiliate funnel',
  'Earn recurring commission sending hosts to Wielo.',
  'Wielo is 0%-commission direct-booking management for South African hosts. Refer a host, and you earn commission every time they pay — for as long as they stay. Get the free Partner Pack and your referral link.',
  '{}'::jsonb,
  (SELECT id FROM public.nurture_sequences WHERE audience = 'affiliate' ORDER BY created_at LIMIT 1),
  true
)
ON CONFLICT (slug) DO NOTHING;
