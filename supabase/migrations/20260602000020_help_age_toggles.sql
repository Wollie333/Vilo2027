-- Migration: note the children/infants/pets allow toggles in the age-pricing
-- Help article (RULES.md §9). Idempotent; appends once.

UPDATE help_articles SET
  body_html = body_html || $html$
<h3>Turning a category off</h3>
<p>Each of children, infants and pets has an <strong>on/off toggle</strong> in the
room's Age &amp; pet pricing card. Switch one <strong>off</strong> and that option
disappears from checkout and quotes entirely — guests simply can't book it (e.g.
an adults-only room, or no pets). Switch it <strong>on</strong> to set its
per-night rate. Off by default for nothing — every category starts on.</p>
$html$,
  updated_at = now()
WHERE slug = 'age-and-pet-pricing'
  AND body_html NOT LIKE '%Turning a category off%';
