-- Migration: Help Centre article for website blog (public features, Phase 8).
-- Ships with the feature per RULES.md §9. Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-blog',
  'Running your blog',
  'Write posts, feature your best content, schedule publication, and share via RSS.',
  $html$
<p>Your website includes a full blog — share news, local guides, seasonal updates, or behind-the-scenes stories to keep guests engaged and help your site rank in search.</p>

<h3>Creating a post</h3>
<p>On the <strong>Blog</strong> tab, click <strong>New post</strong>. Give it a title, write your content, and add a cover image. Posts start as <strong>Draft</strong> so you can work on them without publishing.</p>

<h3>Publishing</h3>
<p>When you're ready, change the status to <strong>Published</strong> and the post appears on your live site immediately. Blog posts render live (not from the publish snapshot), so there's no need to re-publish your whole site.</p>

<h3>Scheduling posts</h3>
<p>Set the status to <strong>Scheduled</strong> and pick a date and time. The post goes live automatically when that time arrives — great for planning content ahead of busy periods.</p>

<h3>Featured posts</h3>
<p>Mark a post as <strong>Featured</strong> to pin it to the top of your blog index and any blog preview section. Featured posts appear first, then everything else in date order.</p>

<h3>Authors</h3>
<p>Create reusable author profiles with a name, photo, and short bio. Select an author on each post — they'll appear in an author card at the bottom, building trust and personality.</p>

<h3>Categories</h3>
<p>Group posts by category (e.g. "Things to do", "News", "Recipes"). Visitors can filter by category, and related posts from the same category appear at the end of each article.</p>

<h3>RSS feed</h3>
<p>Your blog includes an RSS feed at <code>/feed.xml</code>. Guests or aggregators can subscribe to get new posts automatically. The feed updates whenever you publish.</p>

<h3>SEO</h3>
<p>Each post has its own <strong>Search appearance</strong> section: meta title, meta description, and excerpt. Fill these in so your posts look great in search results and social shares.</p>
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
