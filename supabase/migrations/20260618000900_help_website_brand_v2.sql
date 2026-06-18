-- Migration: refresh the website Brand help article for the enterprise build-out
-- Phase 2 (logo style, favicon, contact & social, live preview). Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-brand',
  'Your logo, favicon & brand details',
  'Upload a logo, choose how it shows, add a favicon, and set the contact details and social links that appear in your site footer.',
  $html$
<p>The <strong>Logo &amp; Brand</strong> tab controls how your name and identity appear across every page. A live preview on the right shows your header and footer update as you edit.</p>

<h3>Logo &amp; logo style</h3>
<p>Upload a logo (a transparent PNG looks best), or pick one you've already uploaded with <strong>Choose from library</strong>. Then choose a <strong>logo style</strong>:</p>
<ul>
<li><strong>Wordmark</strong> — your business name as text.</li>
<li><strong>Logo + name</strong> — your logo beside the name.</li>
<li><strong>Icon only</strong> — just the logo mark.</li>
</ul>

<h3>Favicon</h3>
<p>The <strong>favicon</strong> is the small icon shown in browser tabs and bookmarks. Use a square image, at least 64×64 pixels.</p>

<h3>Name &amp; tagline</h3>
<p>Your <strong>site name</strong> appears in the header, footer and search results; the optional <strong>tagline</strong> is a short line shown beneath it.</p>

<h3>Contact &amp; social</h3>
<p>Add a <strong>contact email</strong> and <strong>phone number</strong> and they'll appear in your footer so guests can reach you. Paste full URLs for any <strong>social links</strong> (Instagram, Facebook, X, YouTube, LinkedIn, or another website) — only the ones you fill in are shown.</p>

<p><em>Tip:</em> logo and favicon changes save immediately; name, tagline, contact and social changes save when you click <strong>Save changes</strong>. Everything goes live on your public site after you <strong>Publish</strong>.</p>
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
