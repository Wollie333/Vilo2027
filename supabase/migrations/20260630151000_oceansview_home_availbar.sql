-- Insert the design's availability bar (booking_search → .availbar) right under
-- the hero on the Oceans View home page, so the theme preview + applied sites
-- show the signature search bar from the design. Idempotent: only inserts when
-- the home page doesn't already carry a booking_search section. jsonb_insert at
-- {sections,1} places it after the hero (index 0).
update public.site_themes
set page_templates = (
  select jsonb_agg(
    case
      when page->>'kind' = 'home'
       and not (page->'sections' @> '[{"type":"booking_search"}]'::jsonb)
      then jsonb_insert(
        page,
        '{sections,1}',
        '{"id":"ov-home-availbar","type":"booking_search","enabled":true,"props":{}}'::jsonb
      )
      else page
    end
  )
  from jsonb_array_elements(page_templates) page
)
where slug = 'oceansview'
  and exists (
    select 1
    from jsonb_array_elements(page_templates) p
    where p->>'kind' = 'home'
      and not (p->'sections' @> '[{"type":"booking_search"}]'::jsonb)
  );
