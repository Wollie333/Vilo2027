-- Migration: Help Centre article for the Website CMS (create-site flow + builder
-- shell). Ships with the feature per RULES.md §9. Idempotent on slug. Category
-- falls back to any existing category so the FK can't be null pre-seed.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'build-your-website',
  'Build your website',
  'Create a branded, hosted website for your business — at your own web address — built straight from your property and room data, with every Book button feeding your existing booking engine.',
  $html$
<p>Your <strong>Website</strong> is a branded, hosted site for one of your businesses. It pulls live from the properties and rooms you already manage on {brand}, so it never goes stale, and every <em>Book</em> button sends guests into your normal booking flow &mdash; commission-free.</p>

<h3>Create your website</h3>
<p>Open <strong>Channels &rarr; Website</strong>. Pick a <strong>web address</strong> (your subdomain, e.g. <code>your-place.vilo.site</code>) and choose <strong>Create website</strong>. We seed a starter <em>Home</em> and <em>About</em> page and connect your properties + rooms automatically.</p>

<h3>One website per business</h3>
<p>Each business gets its own website. If your account has several businesses, you'll see a card for each &mdash; create or manage them independently.</p>

<h3>Your set-up checklist</h3>
<p>The website Overview shows what's left to do: set your brand &amp; logo, pick a theme, build your home page, choose which rooms to show, and finally publish. Until you publish, your site stays private &mdash; use <strong>Preview</strong> to see it as you build.</p>

<h3>Custom domains</h3>
<p>You can connect your own domain (like <code>www.your-place.co.za</code>) later from the Domain tab.</p>
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
