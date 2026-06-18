-- Migration: refresh the website Theme help article for enterprise build-out
-- Phase 3 (visual presets, accent swatches, typography cards, corners, full-site
-- live preview). Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-theme',
  'Choosing your website theme',
  'Pick a preset look, then fine-tune the accent colour, typography and corner style — with a full live preview of your real home page.',
  $html$
<p>The <strong>Theme</strong> tab controls the look and feel of your whole website. Everything you change here previews instantly on your real home page on the right, and you can flip between desktop and phone views.</p>

<h3>Presets</h3>
<p>Start by picking a <strong>preset</strong> — Classic, Modern, Coastal, Warm, Minimal or the dark Nightfall. Each sets a coordinated palette, font and corner style. Picking a preset clears any custom tweaks so you get its intended look.</p>

<h3>Accent colour</h3>
<p>The <strong>accent</strong> drives buttons, links and highlights. Choose one of the quick colours or pick any <strong>custom colour</strong> — we automatically use black or white text on top so it stays readable.</p>

<h3>Typography</h3>
<p>Choose a <strong>font</strong> style — sans-serif, serif, elegant serif headings, geometric grotesk, or full editorial serif — or leave it on <em>Match preset</em>.</p>

<h3>Corners</h3>
<p><strong>Corners</strong> set how rounded buttons, cards and images are, from square to pill.</p>

<p><em>Tip:</em> theme changes apply to every page — home, rooms, about and blog — and go live once you <strong>Publish</strong>. Use <strong>Reset to preset</strong> to drop your custom tweaks and return to the preset's defaults.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  COALESCE(
    (SELECT id FROM help_categories WHERE slug = 'account'),
    (SELECT id FROM help_categories ORDER BY sort_order LIMIT 1)
  ),
  'host', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
