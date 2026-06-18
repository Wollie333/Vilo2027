-- Migration: Help Centre article for the website Overview & traffic dashboard
-- (enterprise build-out Phase 1). Ships with the feature per RULES.md §9.
-- Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-overview',
  'Your website Overview & visitor stats',
  'Understand the Overview tab: your live address, set-up checklist, visitor traffic, top pages, booking-click conversion and what needs your attention.',
  $html$
<p>The <strong>Overview</strong> tab is the home base for your website. It shows whether your site is live, what still needs doing, and — once you publish — how much traffic it gets.</p>

<h3>Your address &amp; quick actions</h3>
<p>At the top you'll see your site's web address. Use <strong>Visit site</strong> to open it, <strong>Copy link</strong> to share it, and <strong>Edit pages</strong> to jump into the builder. Drafts auto-save as you edit; changes only go live when you <strong>Publish</strong>.</p>

<h3>Set-up checklist</h3>
<p>The checklist tracks the key steps — brand, theme, pages, rooms, SEO and publishing. Each item links straight to the tab where you finish it, and ticks itself off automatically as you go.</p>

<h3>Visitor stats</h3>
<p>Once your site is published, the traffic panel shows real visitor numbers — this is <strong>separate</strong> from your property/channel analytics and only measures your hosted website. You'll see:</p>
<ul>
<li><strong>Visitors</strong> — unique people who viewed your site (counted privately, without cookies).</li>
<li><strong>Pageviews</strong> — total pages opened.</li>
<li><strong>Booking clicks</strong> — how many visitors clicked a "Book" button, and the <strong>booking-click rate</strong> (clicks ÷ visitors).</li>
</ul>
<p>Switch between <strong>7, 30 and 90 days</strong>, and compare against the previous period with the up/down change indicators. <strong>Top pages</strong>, <strong>traffic sources</strong> (where visitors came from) and a <strong>device</strong> split (desktop vs mobile) round out the picture.</p>

<h3>Needs attention</h3>
<p>This panel flags anything worth fixing — unpublished changes, an unverified custom domain, blog posts missing SEO, or rooms hidden from your site — and links you straight to where you can resolve it.</p>

<p><em>Privacy:</em> website stats are first-party and cookieless — we never track visitors across sites or store personal information, and we honour "Do Not Track".</p>
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
