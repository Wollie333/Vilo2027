-- Migration: Help Centre article (RULES.md §9) for the guest Security settings
-- tab — changing sign-in email and password. Idempotent upsert on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'change-your-email-and-password',
  'Change your email and password',
  'Update your sign-in email or set a new password from Settings → Security.',
  $html$
<p>Your sign-in details live under <strong>Settings &rarr; Security</strong> in your portal.</p>

<h3>Changing your email</h3>
<ul>
  <li>Enter your new email address and tap <strong>Update email</strong>.</li>
  <li>We send a <strong>confirmation link to the new address</strong> &mdash; your email only changes once you click it. This keeps your account safe if you mistype.</li>
  <li>Until you confirm, you keep signing in with your current email.</li>
</ul>

<h3>Changing your password</h3>
<ul>
  <li>Enter a new password (at least 8 characters) and confirm it, then tap <strong>Update password</strong>.</li>
  <li>The change takes effect immediately &mdash; you&rsquo;ll use the new password next time you sign in.</li>
  <li>Forgot your current password? Use <strong>Forgot password</strong> on the sign-in screen to reset it by email.</li>
</ul>
<p>If you ever spot sign-in activity you don&rsquo;t recognise, change your password straight away and contact support.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'account'),
  'guest', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
