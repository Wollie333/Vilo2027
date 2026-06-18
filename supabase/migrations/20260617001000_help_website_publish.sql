-- Migration: Help Centre article for the Website Publish workflow (W10). Ships
-- with the feature per RULES.md §9. Idempotent on slug. Category falls back to
-- any existing category so the FK can't be null pre-seed.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-publishing',
  'Publishing your website',
  'Your edits stay private until you publish. Learn how publishing works, how to push changes live, and how to take your site offline.',
  $html$
<p>Everything you build in the website editor is saved as a <strong>draft</strong>. Visitors only ever see your <strong>published</strong> version, so you can keep editing safely without anything changing on your live site until you're ready.</p>

<h3>Preview before you publish</h3>
<p>Use the <strong>Preview</strong> button at the top of the editor to see exactly how your site looks with your latest edits — including unpublished changes. Preview is private to you.</p>

<h3>Publishing</h3>
<p>When you're happy, choose <strong>Publish</strong>. This copies your current draft — pages, brand, theme and your chosen rooms — to the live site in one step. If you've published before and have new edits, the button reads <strong>Publish changes</strong>.</p>
<p>The status indicator next to the button tells you where you stand: <em>Not published</em>, <em>Unpublished changes</em>, or <em>All changes published</em>. The Overview tab shows the same status and when you last published.</p>

<h3>Prices are always live</h3>
<p>Publishing freezes how your site <em>looks</em>, but never your prices. When a guest books, the amount is always recalculated on our servers from your live rates and availability.</p>

<h3>Taking your site offline</h3>
<p>Choose <strong>Take offline</strong> to hide your site from visitors. Your pages and your last published version are kept — publish again at any time to bring it straight back.</p>
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
