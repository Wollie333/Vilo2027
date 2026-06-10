-- Migration: Help Centre (RULES.md §9) — removing / archiving a policy.
-- Removing a policy now shows where it's used + how many live bookings rely on
-- it, lets the host reassign those listings to a replacement (or the default),
-- and archives rather than deletes so existing bookings keep their terms.
-- Idempotent upsert on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'removing-a-policy',
  'Removing a policy safely',
  'What happens to your listings and live bookings when you remove a policy — and how to reassign cleanly.',
  $html$
<p>You can remove any custom policy you've created. (The built-in presets — Flexible, Moderate, Strict, Non-refundable — can't be removed, only duplicated.) Removing is designed to never break anything that's already booked.</p>

<h3>What you'll see</h3>
<p>When you press <strong>Remove</strong>, we show you the impact first:</p>
<ul>
  <li><strong>How many places</strong> the policy is assigned to (listings and room overrides).</li>
  <li><strong>How many live bookings</strong> currently rely on it.</li>
</ul>

<h3>Live bookings are always safe</h3>
<p>Every booking stores its own snapshot of the policy at the moment it was made. Removing a policy <strong>never</strong> changes the terms or refund a guest was promised — those bookings keep exactly what they were booked under.</p>

<h3>Reassign the listings</h3>
<p>If the policy is assigned anywhere, choose what those listings should use instead:</p>
<ul>
  <li><strong>My default policy</strong> (recommended) — each listing falls back to your default for that type.</li>
  <li><strong>A specific policy</strong> — pick another of your active policies to take over.</li>
</ul>

<h3>Archived, not deleted</h3>
<p>Removed policies are <strong>archived</strong>: they disappear from your library and can't be assigned again, but they're kept on file so older bookings' records stay intact. If the policy you removed was your default, we automatically promote another one so every listing stays covered.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'listings'),
  'host',
  'published',
  2,
  now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id,
      audience = EXCLUDED.audience,
      status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes,
      updated_at = now();
