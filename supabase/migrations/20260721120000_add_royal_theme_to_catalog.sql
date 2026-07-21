-- Add the Royal Hotel theme to the selectable catalogue (site_themes).
--
-- Royal shipped as a code preset (SITE_PRESETS.royal, the `.wielo-royal` skin +
-- bespoke `.r*` page components) but was never inserted into `site_themes`, so it
-- never appeared in the website wizard / Brand Studio gallery — the picker showed
-- only 4 of the 5 themes. This adds the missing catalogue row; `base` mirrors
-- SITE_PRESETS.royal (champagne-gold on white, Archivo display, medium radius).
--
-- NB: the companion rename (sabela -> hotel) is migration 20260718090000; both are
-- applied to the linked cloud project. Idempotent (on conflict do nothing).

insert into public.site_themes
  (slug, name, base, is_active, is_premium, sort_order, description, preview_image_path)
values (
  'royal',
  'Royal Hotel',
  '{"font":"archivo","label":"Royal Hotel","radius":"md","palette":{"bg":"#FFFFFF","surface":"#FFFFFF","ink":"#1B1915","mute":"#6B655B","line":"#E7E1D6","accent":"#B08948","accentInk":"#FFFFFF","secondary":"#23201B"}}'::jsonb,
  true,
  false,
  6,
  'A grand-hotel treatment — champagne-gold on white, an Archivo display over Manrope, formal section rhythm and an authoritative, ceremonial feel.',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&h=750&q=75'
)
on conflict (slug) do nothing;
