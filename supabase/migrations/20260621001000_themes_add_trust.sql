-- Bring the Phase-6A `trust` section into the older themes so every theme works
-- with what we've been building (Aria already includes it). Idempotent: appends a
-- trust band to the HOME page of warm + coastal only if one isn't already there.
-- Home is page_templates[0] for both (nav_order 0). Data-only; no schema change.

update public.site_themes
set page_templates = jsonb_set(
  page_templates,
  '{0,sections}',
  (page_templates->0->'sections') || '[
    {"id":"d0000001-0001-4000-8000-000000000001","type":"trust","enabled":true,"props":{"heading":"Book with confidence","body":"Direct rates, secure payment, and a real person at the other end.","show_review_score":true,"variant":"badges","items":[{"icon":"🔒","label":"Secure payments"},{"icon":"✅","label":"Verified host"},{"icon":"🏷️","label":"Best-rate guarantee"}]}}
  ]'::jsonb
)
where slug = 'warm'
  and deleted_at is null
  and not (page_templates->0->'sections' @> '[{"type":"trust"}]'::jsonb);

update public.site_themes
set page_templates = jsonb_set(
  page_templates,
  '{0,sections}',
  (page_templates->0->'sections') || '[
    {"id":"d0000002-0001-4000-8000-000000000001","type":"trust","enabled":true,"props":{"heading":"Book with confidence","body":"Best rates, secure payment, and a real person at the other end.","show_review_score":true,"variant":"badges","items":[{"icon":"🔒","label":"Secure payments"},{"icon":"✅","label":"Verified host"},{"icon":"🏷️","label":"Best-rate guarantee"}]}}
  ]'::jsonb
)
where slug = 'coastal'
  and deleted_at is null
  and not (page_templates->0->'sections' @> '[{"type":"trust"}]'::jsonb);
