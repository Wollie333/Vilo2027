-- Rename the theme formerly known as "Sabela Lodge" to "Hotel" (founder rename).
-- Identity-only: the slug/name/label become `hotel` / "Hotel" so the theme is
-- identified consistently with the code (SITE_PRESETS.hotel, .wielo-hotel skin,
-- hotel_* blueprints). The Hotel *design* is reworked separately.
--
-- Content is preserved: this touches only the theme catalogue row and the
-- `preset` pointer on any site already using it — never a host's seeded pages,
-- section content, or images (the "theme change = look only, content stays" rule).
-- Idempotent (no-op once renamed, and safe if the row is already gone).

update public.site_themes
   set slug = 'hotel',
       name = 'Hotel',
       base = case
                when base ? 'label' then jsonb_set(base, '{label}', '"Hotel"'::jsonb)
                else base
              end
 where slug = 'sabela'
   and not exists (select 1 from public.site_themes t2 where t2.slug = 'hotel');

-- Point any site currently on the `sabela` preset at the new slug (keeps their
-- content; only the theme identity changes).
update public.host_websites
   set theme = jsonb_set(theme, '{preset}', '"hotel"'::jsonb)
 where theme ->> 'preset' = 'sabela';
