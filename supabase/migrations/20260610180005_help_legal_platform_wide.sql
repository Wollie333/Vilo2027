-- Migration: Help Centre (RULES.md §9) — booking terms & privacy are now
-- platform-wide, Vilo-authored documents, not host-editable policies. This
-- article explains where they went and what hosts still control.
-- Idempotent upsert on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'booking-terms-and-privacy',
  'Booking terms & privacy',
  'Booking terms and the privacy notice are written and maintained by the platform — you don''t draft these yourself.',
  $html$
<p>Your <strong>Policies</strong> cover the three things that are genuinely yours to set: your <strong>cancellation &amp; refund terms</strong>, your <strong>check-in / check-out</strong> details, and your <strong>house rules</strong>. These attach to your listings and are snapshotted onto every booking.</p>

<h3>What about booking terms and privacy?</h3>
<p>The <strong>booking terms &amp; conditions</strong> and the <strong>privacy notice (POPIA)</strong> are written and maintained by the platform and apply uniformly to every host and guest. You won't find them in your Policies list because they aren't yours to edit — that keeps the legal wording consistent and compliant for everyone.</p>

<h3>Where guests see them</h3>
<p>Guests can read the current booking terms and privacy notice from the site footer and at checkout, where they confirm the cancellation policy and accept the terms before paying. The exact version a guest agreed to is recorded against their booking.</p>

<p>So: focus your policy work on refunds, check-in and house rules — the terms and privacy are handled for you.</p>
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
