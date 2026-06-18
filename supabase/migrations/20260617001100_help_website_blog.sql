-- Migration: Help Centre article for the Website Blog (W11). Ships with the
-- feature per RULES.md §9. Idempotent on slug. Category falls back to any
-- existing category so the FK can't be null pre-seed.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-blog',
  'Adding a blog to your website',
  'Write posts to share news, stories and local guides. Learn how to create, organise and publish blog posts on your site.',
  $html$
<p>The <strong>Blog</strong> tab lets you publish articles on your website — news, local guides, special offers or stories about your place. It's a great way to give guests a reason to visit and to help your site show up in search.</p>

<h3>Writing a post</h3>
<p>Choose <strong>New post</strong> to open the editor. Give it a title, write your content with the formatting toolbar, and optionally add a <strong>cover image</strong>, a short <strong>excerpt</strong> and an <strong>author name</strong>. Everything saves as a draft until you publish it.</p>

<h3>Draft vs published</h3>
<p>A post's status is independent of your site: set it to <strong>Published</strong> and it goes live immediately (as long as your site itself is published); keep it as a <strong>Draft</strong> and only you can see it via Preview. Use <strong>Preview</strong> to check how a post reads before publishing.</p>

<h3>Categories</h3>
<p>Categories are optional and let you group related posts. Add or rename them at the bottom of the Blog tab. Removing a category simply leaves its posts uncategorised — the posts themselves are never deleted.</p>

<h3>Showing posts on your pages</h3>
<p>Add a <strong>Blog preview</strong> section to any page (in the Pages builder) to feature your latest published posts. It always pulls your newest posts automatically, so there's nothing to keep in sync.</p>

<h3>Search appearance</h3>
<p>Each post has a <strong>meta title</strong> and <strong>meta description</strong> under "Search appearance". Leave them blank to fall back to your title and excerpt — or set them to control exactly how the post looks in search results.</p>
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
