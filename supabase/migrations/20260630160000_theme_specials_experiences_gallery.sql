-- Give every theme the SAME canonical page set: add the designed Specials,
-- Experiences and Gallery pages to each theme's page_templates (they were only
-- being filled by generic default spines via mergeStandardPages). Each page uses
-- the theme's section types so it renders in that theme's design (specials_preview
-- → the theme's special cards; highlights with image_path → image experience
-- cards on themes that support them, icon tiles otherwise; gallery → the mosaic).
-- Idempotent: each page is appended only if the theme doesn't already have that
-- kind. Oceans View already ships an Experiences page, so it only gains Specials +
-- Gallery.

-- ── SAFARI ────────────────────────────────────────────────────────────────
update public.site_themes
set page_templates = page_templates || '[
  {"kind":"specials","slug":"specials","title":"Specials","nav_label":"Specials","nav_order":5,"show_in_nav":true,"sections":[
    {"id":"sf-sp-hero","type":"hero","enabled":true,"props":{"compact":true,"eyebrow":"Specials","headline":"Offers from the lodge","subheadline":"Seasonal rates and direct-booking offers — the price you see is the price you pay.","align":"left","variant":"split_right","height":"medium"}},
    {"id":"sf-sp-list","type":"specials_preview","enabled":true,"props":{"heading":"Current offers","max":12}},
    {"id":"sf-sp-cta","type":"cta","enabled":true,"tone":"dark","props":{"heading":"Your dates, under wide skies","body":"Book direct for the best rate and first pick of the season.","button_label":"Check availability","button_href":"/rooms","variant":"banner"}}
  ]},
  {"kind":"experiences","slug":"experiences","title":"Experiences","nav_label":"Experiences","nav_order":6,"show_in_nav":true,"sections":[
    {"id":"sf-ex-hero","type":"hero","enabled":true,"props":{"compact":true,"eyebrow":"Experiences","headline":"Days in the bush","subheadline":"Everything is included, and nothing is compulsory. Your ranger shapes each day around the weather and the wildlife.","align":"left","variant":"split_right","height":"medium"}},
    {"id":"sf-ex-cards","type":"highlights","enabled":true,"tone":"dark","props":{"heading":"On the reserve","variant":"grid","items":[
      {"title":"Game drives","body":"Dawn and dusk on the reserve with an expert guide and tracker.","image_path":"https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=1100&q=80"},
      {"title":"Walking safaris","body":"Step down from the vehicle and read the bush on foot with an armed guide.","image_path":"https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1100&q=80"},
      {"title":"Boma dining","body":"Long tables, open coals and Limpopo wines under a sky thick with stars.","image_path":"https://images.unsplash.com/photo-1504675099198-7023dd85f5a3?w=1100&q=80"}
    ]}},
    {"id":"sf-ex-gallery","type":"gallery","enabled":true,"props":{"heading":"Moments from the reserve"}},
    {"id":"sf-ex-cta","type":"cta","enabled":true,"tone":"dark","props":{"heading":"Plan your stay around it","body":"Reserve your dates and we will take care of the rest.","button_label":"Check availability","button_href":"/rooms","variant":"banner"}}
  ]},
  {"kind":"gallery","slug":"gallery","title":"Gallery","nav_label":"Gallery","nav_order":7,"show_in_nav":true,"sections":[
    {"id":"sf-gl-hero","type":"hero","enabled":true,"props":{"compact":true,"eyebrow":"Gallery","headline":"A look around the lodge","align":"left","variant":"split_right","height":"medium"}},
    {"id":"sf-gl-grid","type":"gallery","enabled":true,"props":{"heading":""}},
    {"id":"sf-gl-cta","type":"cta","enabled":true,"tone":"dark","props":{"heading":"Like what you see?","body":"Check availability and book your stay directly.","button_label":"Check availability","button_href":"/rooms","variant":"banner"}}
  ]}
]'::jsonb
where slug = 'safari'
  and not exists (select 1 from jsonb_array_elements(page_templates) e where e->>'kind' = 'specials');

-- ── SABELA ────────────────────────────────────────────────────────────────
update public.site_themes
set page_templates = page_templates || '[
  {"kind":"specials","slug":"specials","title":"Specials","nav_label":"Specials","nav_order":5,"show_in_nav":true,"sections":[
    {"id":"sb-sp-hero","type":"hero","enabled":true,"props":{"compact":true,"eyebrow":"Specials","headline":"Offers from the reserve","subheadline":"Seasonal rates and direct-booking offers — booked direct, with zero fees.","align":"left","variant":"split_right","height":"medium"}},
    {"id":"sb-sp-list","type":"specials_preview","enabled":true,"props":{"heading":"Current offers","max":12}},
    {"id":"sb-sp-cta","type":"cta","enabled":true,"tone":"dark","props":{"heading":"Your safari begins with a single message","body":"Book direct for the best rate and first pick of the season.","button_label":"Plan your safari","button_href":"/rooms","variant":"banner"}}
  ]},
  {"kind":"experiences","slug":"experiences","title":"Experiences","nav_label":"Experiences","nav_order":6,"show_in_nav":true,"sections":[
    {"id":"sb-ex-hero","type":"hero","enabled":true,"props":{"compact":true,"eyebrow":"Experiences","headline":"The reserve, unhurried","subheadline":"Twice-daily game drives, walks, and long evenings by the fire — shaped around you.","align":"left","variant":"split_right","height":"medium"}},
    {"id":"sb-ex-cards","type":"highlights","enabled":true,"tone":"dark","props":{"heading":"On the reserve","variant":"grid","items":[
      {"icon":"Sunrise","title":"Twice-daily game drives","body":"Dawn and dusk on open vehicles with an expert guide and tracker."},
      {"icon":"Footprints","title":"Guided walks","body":"Read the tracks on foot, the bush at its smallest and wildest."},
      {"icon":"Flame","title":"The table & the fire","body":"Long dinners under the stars, the boma fire, and stories that run late."}
    ]}},
    {"id":"sb-ex-gallery","type":"gallery","enabled":true,"props":{"heading":"The reserve, in fragments"}},
    {"id":"sb-ex-cta","type":"cta","enabled":true,"tone":"dark","props":{"heading":"Your safari begins with a single message","body":"Reserve your dates and we will take care of the rest.","button_label":"Plan your safari","button_href":"/rooms","variant":"banner"}}
  ]},
  {"kind":"gallery","slug":"gallery","title":"Gallery","nav_label":"Gallery","nav_order":7,"show_in_nav":true,"sections":[
    {"id":"sb-gl-hero","type":"hero","enabled":true,"props":{"compact":true,"eyebrow":"Gallery","headline":"The reserve, in fragments","align":"left","variant":"split_right","height":"medium"}},
    {"id":"sb-gl-grid","type":"gallery","enabled":true,"props":{"heading":""}},
    {"id":"sb-gl-cta","type":"cta","enabled":true,"tone":"dark","props":{"heading":"Come see it for yourself","body":"Check availability and book your stay directly.","button_label":"Plan your safari","button_href":"/rooms","variant":"banner"}}
  ]}
]'::jsonb
where slug = 'sabela'
  and not exists (select 1 from jsonb_array_elements(page_templates) e where e->>'kind' = 'specials');

-- ── OCEANS VIEW (already has Experiences — add Specials + Gallery) ─────────
update public.site_themes
set page_templates = page_templates || '[
  {"kind":"specials","slug":"specials","title":"Specials","nav_label":"Specials","nav_order":6,"show_in_nav":true,"sections":[
    {"id":"ov-sp-hero","type":"hero","enabled":true,"props":{"compact":true,"eyebrow":"Specials","headline":"Offers on the bay","subheadline":"Seasonal rates and direct-booking offers — book direct for the best rate.","align":"left","variant":"split_right","height":"medium"}},
    {"id":"ov-sp-list","type":"specials_preview","enabled":true,"props":{"heading":"Current offers","max":12}},
    {"id":"ov-sp-cta","type":"cta","enabled":true,"props":{"heading":"Your room by the sea is waiting","body":"Book direct for the best rate on the bay.","button_label":"Book a room","button_href":"/rooms","variant":"banner"}}
  ]},
  {"kind":"gallery","slug":"gallery","title":"Gallery","nav_label":"Gallery","nav_order":7,"show_in_nav":true,"sections":[
    {"id":"ov-gl-hero","type":"hero","enabled":true,"props":{"compact":true,"eyebrow":"Gallery","headline":"Postcards from the bay","align":"left","variant":"split_right","height":"medium"}},
    {"id":"ov-gl-grid","type":"gallery","enabled":true,"props":{"heading":""}},
    {"id":"ov-gl-cta","type":"cta","enabled":true,"props":{"heading":"Like what you see?","body":"Check availability and book your stay directly.","button_label":"Book a room","button_href":"/rooms","variant":"banner"}}
  ]}
]'::jsonb
where slug = 'oceansview'
  and not exists (select 1 from jsonb_array_elements(page_templates) e where e->>'kind' = 'specials');
