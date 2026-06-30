-- Add a designed "Experiences" page to the Oceans View theme's page_templates so
-- the theme preview + applied sites show the design's big IMAGE experience cards
-- (.exps) instead of the generic icon-tile spine. The highlights items carry
-- image_path URLs, which the Oceans View render layer renders as .exps cards
-- (it falls back to icon tiles only when items have no images). Idempotent:
-- appends the experiences page only if the theme doesn't already have one.
update public.site_themes
set page_templates = page_templates || '[
  {
    "kind": "experiences", "slug": "experiences", "title": "Experiences",
    "nav_label": "Experiences", "nav_order": 5, "show_in_nav": true,
    "sections": [
      {"id": "ov-exp-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "Experiences", "headline": "Days you won''t want to end", "subheadline": "From the first swim to the last sundowner, here is everything waiting beyond your room.", "align": "left", "variant": "split_right", "height": "medium"}},
      {"id": "ov-exp-cards", "type": "highlights", "enabled": true, "props": {"heading": "On and off the sand", "variant": "grid", "items": [
        {"title": "Three pools & the sea", "body": "Two heated pools, a lap pool and a private path straight onto the sand.", "image_path": "https://images.unsplash.com/photo-1576675784201-0e142b423952?w=1100&q=80"},
        {"title": "Sea-to-table dining", "body": "The morning catch on the evening menu, and sundowners with the best view on the bay.", "image_path": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1100&q=80"},
        {"title": "Spa & wellness", "body": "Ocean-air treatments, a sauna, and morning yoga on the deck.", "image_path": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1100&q=80"},
        {"title": "On the water", "body": "Kayaks, paddleboards and sunset cruises straight from our jetty.", "image_path": "https://images.unsplash.com/photo-1502933691298-84fc14542831?w=1100&q=80"},
        {"title": "The beach club", "body": "Long lunches, cocktails and a DJ as the sun goes down.", "image_path": "https://images.unsplash.com/photo-1530053969600-caed2596d242?w=1100&q=80"},
        {"title": "Explore the coast", "body": "Guided walks, tidal pools and the village just along the bay.", "image_path": "https://images.unsplash.com/photo-1468413253725-0d5181091126?w=1100&q=80"}
      ]}},
      {"id": "ov-exp-gallery", "type": "gallery", "enabled": true, "props": {"heading": "A taste of it"}},
      {"id": "ov-exp-cta", "type": "cta", "enabled": true, "props": {"heading": "Plan your stay around it", "body": "Reserve your dates and we will help with the rest.", "button_label": "Book a room", "button_href": "/rooms", "variant": "banner"}}
    ]
  }
]'::jsonb
where slug = 'oceansview'
  and not exists (
    select 1
    from jsonb_array_elements(page_templates) e
    where e->>'kind' = 'experiences'
  );
