-- Migration: extend the "Sending quotes" Help article (RULES.md §9) for the new
-- edit + version-history behaviour. Idempotent upsert appends an editing section.

UPDATE help_articles SET
  body_html = body_html || $html$
<h3>Editing a quote (and version history)</h3>
<p>Need to change something after a quote has gone out? Open the quote and click
<strong>Edit</strong>. You can adjust the dates, rooms, add-ons, custom lines and
notes, then save.</p>
<ul>
  <li>Editing a quote that's already been <strong>sent</strong> keeps a copy of the
  previous version — you'll see a <strong>Version history</strong> list on the quote
  with each prior version's date, total and its own PDF.</li>
  <li>The quote (and its PDF) always shows the latest version; older versions stay
  available read-only so you have a full record of what the guest saw at each step.</li>
</ul>
$html$,
  updated_at = now()
WHERE slug = 'sending-quotes'
  AND body_html NOT LIKE '%Version history%';
