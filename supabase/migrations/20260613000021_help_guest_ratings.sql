-- Migration: Help Centre article — "How guest ratings work"
--
-- Explains the host → guest reputation feature (cross-host, internal,
-- one-editable-review-per-host, the five dimensions). help_articles is
-- DB-backed. Idempotent: re-runs update in place.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'how-guest-ratings-work',
  'How guest ratings work',
  'Rate a guest after their stay and see how other hosts have rated them. A shared, host-only reputation network — guests never see it.',
  $html$
<p>Guest ratings are the mirror image of the reviews guests leave you. After a completed stay, you can rate a guest — and because reputation is shared across the platform, you also see how <strong>every other host</strong> has rated that same guest. It helps you decide who to welcome with confidence.</p>

<h3>Who can see it</h3>
<p>Guest ratings are <strong>strictly host-only</strong>. Guests never see their rating, never get notified, and cannot read what any host wrote. Only verified hosts can see them, and the platform's admins for moderation.</p>

<h3>When you can rate a guest</h3>
<p>You can rate a guest once their stay is <strong>completed</strong> (or marked <strong>no-show</strong> — a no-show is high-value signal for other hosts). Until then the <strong>Rate this guest</strong> button stays disabled.</p>
<p>Guests who booked without a Vilo account (for example, imported from another channel by email only) can't be rated yet — ratings attach to a guest's Vilo identity, so the Reputation tab shows a "no Vilo account yet" note for them.</p>

<h3>What you rate</h3>
<p>You give one <strong>overall star</strong> (1–5, required) and a short written summary. You can optionally rate five dimensions, each with a short note:</p>
<ul>
  <li><strong>Payments</strong> — did they pay on time and in full?</li>
  <li><strong>Communication</strong> — were they responsive and clear?</li>
  <li><strong>Cleanliness</strong> — did they leave the place in good order?</li>
  <li><strong>House rules &amp; respect</strong> — did they respect your rules and property?</li>
  <li><strong>Integrity</strong> — were they honest and straightforward?</li>
</ul>

<h3>One living review per guest</h3>
<p>You keep a single, editable review per guest — not one per stay. As you host someone again, update your review to reflect the latest. You can edit or delete your own review at any time. You can only ever see, not change, what other hosts wrote.</p>

<h3>The aggregate</h3>
<p>The star at the top of a guest's Reputation tab is the average overall rating across every host who has rated them, with a count of how many hosts contributed. It updates the moment any host adds or changes their rating.</p>

<h3>Please rate fairly</h3>
<p>Because other hosts rely on what you write, keep it factual and fair. Describe what happened, not how you felt. Ratings carry weight — treat them the way you'd want yours treated.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'reviews'),
  'host',
  'published',
  3,
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
