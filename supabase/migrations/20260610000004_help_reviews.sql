-- Migration: Help Centre articles for the reviews feature (host + guest).
-- Idempotent on slug.

-- ─── Host: how reviews work ───────────────────────────────────────────────
INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'how-reviews-work',
  'How reviews work',
  'Guests who paid for and completed a stay are invited to review it 5 minutes after checkout. Reviews go live straight away — you can reply publicly, but you cannot edit or delete them.',
  $html$
<p>Reviews build the trust that wins you direct bookings. Here is exactly how they flow on the platform.</p>

<h3>Who can leave a review</h3>
<p>Only a guest who <strong>paid for and completed</strong> a real stay can review it. The link is unique to that booking, so reviews can&rsquo;t be faked or left by someone who never stayed.</p>

<h3>When the request goes out</h3>
<p>When you mark a booking <strong>checked out</strong>, we wait 5 minutes and then automatically invite the guest to review &mdash; by email, an in-app notification, and a message in your chat thread with them. Need to nudge a guest yourself? Open the booking and use the <strong>Review link</strong> card to copy the link or send it via WhatsApp, email or the chat thread.</p>

<h3>Photos</h3>
<p>Guests can add up to six photos to their review. They appear on your public listing alongside the written review, and on your Reviews dashboard.</p>

<h3>Replying</h3>
<p>You can post one public <strong>response</strong> to any review from your Reviews dashboard, and edit it later. A thoughtful reply &mdash; even to a glowing review &mdash; shows future guests you&rsquo;re engaged.</p>

<h3>What you can&rsquo;t do</h3>
<p>You cannot change or remove the rating or wording of a guest&rsquo;s review &mdash; that keeps reviews honest and trustworthy. If a review breaks the content rules (false claims, personal attacks, or it&rsquo;s about a booking that never happened), use <strong>Flag</strong> on the review and our team will look into it.</p>

<h3>Your rating</h3>
<p>Published reviews roll up into your listing&rsquo;s star rating automatically. If a review is later removed by moderation, your average updates to match.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'reviews'),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();

-- ─── Guest: leaving a review ──────────────────────────────────────────────
INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'leaving-a-review',
  'Leaving a review for your stay',
  'After you check out we send you a link to rate your stay, write a few words and add photos. Your review goes live right away and can''t be edited afterwards.',
  $html$
<p>Your honest review helps future guests and rewards great hosts. Here&rsquo;s how it works.</p>

<h3>Getting the link</h3>
<p>About 5 minutes after the host marks your stay as checked out, we email you a review link and drop one into your chat thread and notifications. You&rsquo;ll also find a <strong>Write review</strong> button under <em>Reviews</em> in your account for any completed stay.</p>

<h3>What you can add</h3>
<ul>
  <li>An overall star rating (required).</li>
  <li>Optional category ratings &mdash; cleanliness, communication, check-in, accuracy, location and value.</li>
  <li>A written review and who you travelled with.</li>
  <li>Up to six photos (JPEG, PNG or WebP, max 8&nbsp;MB each).</li>
</ul>

<h3>Good to know</h3>
<ul>
  <li>Only guests who paid for and completed a stay can review it.</li>
  <li>Your review publishes immediately and <strong>can&rsquo;t be edited</strong> once submitted &mdash; so write what you&rsquo;d want a fellow traveller to read.</li>
  <li>The host can reply publicly, but can&rsquo;t change or delete what you wrote.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'reviews'),
  'guest', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
