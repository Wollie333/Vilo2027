-- Funnel Manager — Phase 2: seed the Hosts funnel row.
--
-- The public /go/hosts landing page resolves its copy/resource from this row.
-- Placeholder copy for now (founder is designing the real page); brochure + video
-- are left null and filled later via the admin. Linked to the seeded (inactive)
-- host nurture sequence so the wiring is complete when Phase 4 activates it.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   DELETE FROM public.funnels WHERE slug = 'hosts';

INSERT INTO public.funnels (audience, slug, name, headline, subcopy, thankyou_config, sequence_id, is_active)
VALUES (
  'host',
  'hosts',
  'Hosts funnel',
  'List once. Keep 100%. Book direct.',
  'Wielo is direct-booking management for South African hosts — no marketplace commission. Get the free Host Guide and see how direct bookings work.',
  '{}'::jsonb,
  (SELECT id FROM public.nurture_sequences WHERE audience = 'host' ORDER BY created_at LIMIT 1),
  true
)
ON CONFLICT (slug) DO NOTHING;
