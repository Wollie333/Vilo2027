-- Migration: Help Centre article for the per-property Channels control (W12).
-- Ships with the feature per RULES.md §9. Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'property-channels',
  'Choosing where a property is published (Channels)',
  'Use the Channels tab to control whether each property shows on the Vilo directory, on your own website, on both, or on neither.',
  $html$
<p>Every property has a <strong>Channels</strong> tab in its editor. A <em>channel</em> is simply a place your property can be published. The two channels work completely independently, so a property can appear on one, both, or neither.</p>

<h3>Vilo Directory</h3>
<p>The <strong>Vilo Directory</strong> switch is the public Vilo listing at <code>/property/your-place</code> — discoverable on Vilo and bookable directly. Turning it on requires your setup to be complete: photos, at least one room, valid banking details and a refund policy. This is the same publish switch shown at the top of the editor.</p>

<h3>Your website</h3>
<p>The <strong>Your website</strong> switch shows the property on your business's own branded Vilo website. You'll only see this switch once the property is attached to a business (Basic info tab) and that business has a website. If it doesn't have one yet, you can create one from the Website area.</p>

<h3>Why two switches?</h3>
<p>Keeping the channels separate lets you, for example, feature a property on your own website while keeping it off the public directory — or the other way around. Whatever you choose, <strong>both channels send guests to the same booking flow</strong>, so your prices and availability always stay perfectly in sync. Nothing about a channel changes how a booking is priced or paid.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  COALESCE(
    (SELECT id FROM help_categories WHERE slug = 'listings'),
    (SELECT id FROM help_categories ORDER BY sort_order LIMIT 1)
  ),
  'host', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
