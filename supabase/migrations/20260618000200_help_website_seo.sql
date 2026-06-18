-- Migration: Help Centre article for website SEO (W14). Ships with the feature
-- per RULES.md §9. Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-seo',
  'Helping your website get found (SEO)',
  'Set your site title, description and social sharing image, control search-engine indexing, and verify with Google Search Console.',
  $html$
<p>The <strong>SEO</strong> tab controls how your website appears in Google and when someone shares it on social media. Good titles and descriptions help the right guests find and click through to your site.</p>

<h3>Search appearance</h3>
<p>The <strong>page title</strong> is the headline shown in search results — keep it under about 60 characters. The <strong>meta description</strong> is the short summary beneath it. The live preview shows roughly how your listing will look on Google. Leave these blank and we'll fall back to your site name and tagline.</p>

<h3>Social sharing image</h3>
<p>The <strong>share image</strong> appears when your site is posted to social media or messaging apps. A wide image around 1200×630 pixels works best. If you don't set one, your logo is used.</p>

<h3>Indexing controls</h3>
<p><strong>Allow search engines to index this site</strong> is on by default. Turn it off while you're still building so your site stays out of Google until you're ready. <strong>Generate a sitemap</strong> helps search engines discover all your pages — leave it on unless you have a reason not to.</p>

<h3>Google Search Console</h3>
<p>To track how your site performs in Google, verify it in <strong>Google Search Console</strong>. Paste the verification token they give you into the field provided, save, and publish — Google will then be able to confirm you own the site.</p>

<p><em>Tip:</em> SEO settings only take effect on your live site after you <strong>Publish</strong>.</p>
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
