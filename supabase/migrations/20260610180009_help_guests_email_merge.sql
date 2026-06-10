-- Migration: Help Centre — refresh the Guests (CRM) article to spell out the
-- one-record-per-email guarantee (matches 20260610180008 directory email-merge +
-- the canonical upsertHostContact writer). Idempotent on slug; never edits the
-- original 20260606000004_help_guests_crm.sql.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'guests-crm',
  'Your guest directory (CRM)',
  'Everyone who books or enquires, in one place — lifetime value, segments, tags, notes, messages and exports. Built around owning your guest relationships and saving OTA fees.',
  $html$
<p><strong>Guests</strong> (in the sidebar, right after Bookings) is your CRM: every person who has booked or enquired, plus anyone you add by hand. It pulls together their stays, spend, ratings, messages and your private notes so you can look after returning guests and win back the ones who&rsquo;ve gone quiet.</p>

<h3>The list</h3>
<ul>
  <li><strong>KPI strip</strong> &mdash; total guests, repeat-guest rate, average lifetime value, <strong>direct revenue with an estimate of the OTA fees you saved</strong>, and average rating left.</li>
  <li><strong>Segments</strong> &mdash; All, VIP, Returning, New, Via OTA and <strong>Lapsed</strong> (no stay in 6 months and nothing upcoming). VIP simply means the guest carries a <em>VIP</em> tag.</li>
  <li><strong>Search, filter &amp; sort</strong> &mdash; by name/email/phone, by listing, channel or rating; sort by recent activity, lifetime value, stays or name. Everything lives in the URL, so a filtered view is shareable.</li>
  <li><strong>Contactability</strong> &mdash; rows flag <em>no email</em> / <em>no phone</em> so you can capture the details you&rsquo;re missing, and an <em>All direct</em> badge celebrates guests who never cost you a commission.</li>
</ul>

<h3>One guest, one record</h3>
<p>A guest is matched on their <strong>email address</strong>. Whenever the same email turns up again &mdash; a second booking, an enquiry, or a contact you add by hand &mdash; Vilo updates that existing guest instead of creating a duplicate, and links the new booking to them. So someone who books twice stays a <strong>single record</strong> with their full history in one place. If they later create an account, their earlier email-only activity folds into it automatically.</p>

<h3>Add a guest</h3>
<p>Use <strong>Add guest</strong> to save a contact who hasn&rsquo;t booked yet. Email is required (it&rsquo;s how guests are matched). If the email is already on file, your details are merged into the existing guest rather than added as a new one. Tick the consent box if you have permission to email them &mdash; that&rsquo;s required before they can receive broadcasts (POPIA).</p>

<h3>Bulk actions &amp; export</h3>
<p>Select rows to <strong>Tag</strong> or <strong>Export</strong> them. The <strong>Export</strong> button downloads a CSV of the current filtered list &mdash; your guest list is yours to keep. You can also export a single guest as a vCard from their record.</p>

<h3>The guest record</h3>
<p>Open any guest for their full record:</p>
<ul>
  <li><strong>Identity</strong> &mdash; contact details, verification, tags, and quick <em>Message</em> / <em>Call</em> actions. The <strong>More</strong> menu adds: new booking for this guest, add a tag, export a vCard, and block (a display-only flag for now).</li>
  <li><strong>Stat band</strong> &mdash; stays &amp; nights, lifetime value, average rating, cancellations &amp; reliability, and the next stay with a countdown.</li>
  <li><strong>Tabs</strong> &mdash; Overview (next stay, recent activity, insights, pinned note), Bookings, Messages (reply with reusable templates), Payments, and Notes (host-only, pin the important one).</li>
</ul>
<p>Every booking links to its guest record, and every booking on the record links back &mdash; so you can move between the two in a click.</p>

<h3>Message templates</h3>
<p>Save replies once under <strong>Inbox &rarr; templates</strong> and reuse them from the inbox, a guest&rsquo;s Messages tab, and broadcasts. Use <code>{{guest_name}}</code>, <code>{{listing_name}}</code>, <code>{{check_in}}</code> and <code>{{check_out}}</code> as merge tokens.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'host', 'published', 4, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
