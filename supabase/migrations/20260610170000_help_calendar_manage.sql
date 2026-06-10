-- Migration: Help Centre (RULES.md §9) for the now-interactive Calendar.
-- The calendar is no longer display-only: from the Calendar a host can block
-- and open up individual nights, block a whole date range, and start a new
-- booking with the listing + check-in already filled in. This adds one host
-- article describing those actions. Idempotent upsert on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'managing-your-calendar',
  'Managing your calendar',
  'Block nights, open them up again, and start a booking straight from the calendar — for one day or a whole range.',
  $html$
<p>Your <strong>Calendar</strong> shows every booking and blocked night across your listings. You can also manage availability and start bookings right from it — no need to go anywhere else.</p>

<h3>Pick a day</h3>
<p>Tap any date in the month grid to select it. The <strong>Availability</strong> panel on the right then shows, for each listing, whether that night is <strong>Open</strong>, <strong>Booked</strong> (with the guest's name) or <strong>Blocked</strong>.</p>

<h3>Block or open a single night</h3>
<ul>
  <li>On an open night, press <strong>Block</strong> to hold it off the calendar.</li>
  <li>On a night you've blocked yourself, press <strong>Open up</strong> to free it again.</li>
</ul>
<p>Nights that are <strong>booked</strong>, or <strong>on hold</strong> for a pending quote, can't be blocked or opened here — cancel the booking or decline the quote first. Nights blocked by a connected calendar (e.g. Airbnb) are managed from <em>Sync &amp; rates</em>.</p>

<h3>Block a date range</h3>
<p>Press <strong>Block dates</strong> in the top bar to hold off several nights at once — handy for maintenance, owner stays or a seasonal close. Choose the listing, pick a <strong>From</strong> and <strong>To</strong> date, and apply. Switch the toggle to <strong>Open nights</strong> to release a range you blocked earlier. Booked and quote-held nights inside the range are always left untouched.</p>

<h3>Start a booking from a day</h3>
<p>On any open night, press <strong>Book</strong> to open the New booking wizard with that listing and check-in date already filled in — just set the check-out and guest details. You can also use <strong>New booking</strong> in the top bar to start from scratch.</p>

<p>Manual blocks are private to you and never charge anyone — they simply stop a night being booked. See <em>“How direct bookings work”</em> for taking payment on a stay.</p>
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
