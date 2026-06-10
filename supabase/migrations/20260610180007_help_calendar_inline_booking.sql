-- Migration: Help Centre (RULES.md §9) — calendar can now select a date range
-- right on the grid and create a booking inline (no page change). Re-upserts
-- the `managing-your-calendar` article with the range-selection + quick-book
-- flow added. Idempotent upsert on slug (the prior article shipped in
-- 20260610170001_help_calendar_manage.sql).

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'managing-your-calendar',
  'Managing your calendar',
  'Tap two days to pick a range, then block those nights or create a booking — right on the calendar, without leaving the page.',
  $html$
<p>Your <strong>Calendar</strong> shows every booking and blocked night across your listings. You can manage availability and create bookings straight from it — for a single night or a whole range.</p>

<h3>Pick a single day</h3>
<p>Tap any date in the month grid. The <strong>Availability</strong> panel on the right shows, for each listing, whether that night is <strong>Open</strong>, <strong>Booked</strong> (with the guest's name) or <strong>Blocked</strong>, with one-tap <strong>Block</strong> / <strong>Open up</strong> and a <strong>Book</strong> shortcut.</p>

<h3>Select a date range</h3>
<p>Tap a <strong>check-in</strong> day, then tap a later <strong>check-out</strong> day — the nights highlight on the grid and a <strong>Selected range</strong> card appears on the right. Tapping on or before the start begins a new selection; the <strong>✕</strong> clears it.</p>
<p>From that card you can:</p>
<ul>
  <li><strong>Block</strong> — hold all those nights off the calendar for the chosen listing (maintenance, owner stays, a seasonal close).</li>
  <li><strong>Create booking</strong> — opens a quick form with the dates already locked.</li>
</ul>
<p>If any night in the range is already booked or blocked, the card tells you and the booking button stays disabled until you pick a free range.</p>

<h3>Create a booking inline</h3>
<p><strong>Create booking</strong> opens a compact form right over the calendar: add the guest's name and email, party size, the nightly rate and cleaning fee (pre-filled from the listing), and how it's being paid — <em>Already paid</em>, <em>Collect later</em> or <em>Send payment link</em>. Save and you stay on the calendar, with the new booking already on the grid. For rooms, add-ons or discounts, use <strong>Open the full editor</strong> to switch to the full New booking wizard with your dates carried over.</p>

<h3>Blocking, the manual way</h3>
<p>Prefer to type the dates? <strong>Block dates</strong> in the top bar opens a dialog to block or re-open a range for a listing. Booked and quote-held nights are always left untouched — cancel the booking or decline the quote to free those.</p>

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
