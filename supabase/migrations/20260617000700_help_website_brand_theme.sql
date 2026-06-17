-- Migration: Help Centre article for the Website Brand & Theme tabs (W7).
-- Ships with the feature per RULES.md §9. Idempotent on slug. Category falls
-- back to any existing category so the FK can't be null pre-seed.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-brand-and-theme',
  'Brand & style your website',
  'Add your logo, name and tagline, then pick a theme and fine-tune the colours, fonts and corners — with a live preview as you go.',
  $html$
<p>The <strong>Brand</strong> and <strong>Theme</strong> tabs control how your hosted website looks. Open your website from <strong>Channels &rarr; Website</strong>, then choose a tab.</p>

<h3>Brand</h3>
<p>Upload your <strong>logo</strong> (a transparent PNG looks best in the header; up to 4&nbsp;MB), set your <strong>site name</strong>, and add an optional <strong>tagline</strong> shown beneath it. These appear across every page of your site. Choose <strong>Save changes</strong> when you're done.</p>

<h3>Theme</h3>
<p>Start from one of five <strong>presets</strong> &mdash; Classic, Modern, Coastal, Warm or Minimal. Then fine-tune:</p>
<ul>
  <li><strong>Accent colour</strong> &mdash; the colour of buttons, links and highlights. Leave it on the preset colour or pick your own.</li>
  <li><strong>Fonts</strong> &mdash; sans-serif, serif, or an elegant serif-heading look. <em>Match preset</em> keeps the preset's own font.</li>
  <li><strong>Corners</strong> &mdash; how rounded buttons and cards are, from square to pill.</li>
</ul>
<p>The <strong>Preview</strong> panel updates live as you change things. Save when you're happy, then use the <strong>Preview</strong> button at the top to see the full site.</p>

<h3>When does this go live?</h3>
<p>Brand and theme changes apply to your site as soon as you publish it. Until then they only show in preview.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  COALESCE(
    (SELECT id FROM help_categories WHERE slug = 'account'),
    (SELECT id FROM help_categories ORDER BY sort_order LIMIT 1)
  ),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
