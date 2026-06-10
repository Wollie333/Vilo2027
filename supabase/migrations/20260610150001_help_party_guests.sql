-- Migration: Help Centre article — party guests become their own guest records,
-- plus the booking Guests tab and the guest record Relationships tab.
-- Per RULES.md §9 (every feature ships its article). Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'party-guests-and-relationships',
  'Party guests & relationships',
  'Everyone named on a booking becomes their own guest record you can contact directly — and you can see who travelled together.',
  $html$
<p>When a guest books, they can add the rest of their party. Vilo turns each named person into a real, contactable guest — not just a line on the booking — and remembers who travelled together.</p>

<h3>The Guests tab on a booking</h3>
<p>Open any booking and go to the <strong>Guests</strong> tab. You'll see the lead booker plus everyone else named on the booking. Each party member with an email is their own guest record — click their name to open it, message them, or add notes and tags, exactly like any other guest.</p>
<p>Need to add someone yourself? Tap <strong>Add guest</strong>, enter their <strong>name and email</strong> (both required so you can actually reach them), and they're added to the party and given their own record straight away.</p>

<h3>Why name &amp; email are required</h3>
<p>A guest record is keyed by email, so every added guest needs one. That's what lets you contact each person individually later, keep their stay history, and avoid duplicates if they book again. Party members are created when the booking is <strong>confirmed</strong>.</p>

<h3>The Relationships tab on a guest record</h3>
<p>Open a guest and go to <strong>Relationships</strong> to see everyone they've travelled with. If Sipho books and adds Thandi to the party, both records link to each other — each showing “travelled with” and the booking they share. It works from either side, so you always see the full picture of who comes together.</p>

<h3>On the booking confirmation</h3>
<p>The guest also sees their party listed on their booking confirmation page under <em>Your details</em>, so everyone knows who's on the reservation.</p>

<h3>Tips</h3>
<ul>
  <li>Only guests with an email become their own record — that's the address you'll use to reach them.</li>
  <li>Adding the same email twice won't create a duplicate; it updates the existing guest.</li>
  <li>Relationships are built automatically from bookings — there's nothing extra to set up.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
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
