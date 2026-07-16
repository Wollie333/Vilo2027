-- Migration: set free-stock preview images on the theme catalogue.
--
-- The theme picker (dashboard theme gallery) shows `site_themes.preview_image_path`
-- as a plain <img>. Safari shipped a heavy embedded JPEG data URL and Marmalade
-- had none, so the picker looked inconsistent. This points every theme at a light,
-- representative free-stock photo (Unsplash License — free to use, no attribution
-- required), served straight from the Unsplash CDN and cropped to the card ratio.
--
-- Idempotent: a plain UPDATE by slug. Safe to re-run.

update public.site_themes
set preview_image_path = 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&h=750&q=75'
where slug = 'safari';

update public.site_themes
set preview_image_path = 'https://images.unsplash.com/photo-1779216175784-a67b6da108bb?auto=format&fit=crop&w=1200&h=750&q=75'
where slug = 'sabela';

update public.site_themes
set preview_image_path = 'https://images.unsplash.com/photo-1719465263924-eff2bd34fa6c?auto=format&fit=crop&w=1200&h=750&q=75'
where slug = 'oceansview';

update public.site_themes
set preview_image_path = 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&h=750&q=75'
where slug = 'marmalade';
