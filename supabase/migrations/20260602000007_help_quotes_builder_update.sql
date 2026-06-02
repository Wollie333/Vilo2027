-- Migration: refresh the "Sending quotes" Help article (RULES.md §9) now that
-- the builder can pull in real rooms + catalog add-ons and price from the live
-- calendar. Idempotent upsert on the existing slug.

UPDATE help_articles SET
  excerpt = 'Build a branded quote — whole listing or specific rooms, priced from your live calendar with your catalog add-ons — soft-hold the dates, send it, and convert it to a booking.',
  body_html = $html$
<p>A <strong>quote</strong> lets you price a stay for someone who hasn't booked yet — an enquiry from your inbox, a returning guest, or an off-platform lead. The guest can review and accept it without a Vilo account.</p>

<h3>Create a quote</h3>
<ol>
  <li>Go to <strong>Finances &rarr; Quotes &rarr; New quote</strong>.</li>
  <li>Pick the listing, dates and number of guests. (You'll only ever see your own listings, rooms and add-ons here.)</li>
  <li>Choose <strong>Whole listing</strong> or <strong>Specific rooms</strong>. For a per-room quote, tick the rooms and set each room's guest count.</li>
  <li>Click <strong>Price from calendar</strong> — Vilo prices the stay through the same engine the guest checkout uses, so seasonal and weekend rates are baked in and the quote matches what a booking would charge. You can still fine-tune the amounts.</li>
  <li>Add extras: tick <strong>add-ons from your catalog</strong> or add free-form <strong>custom line items</strong> (early check-in, pet deposit, etc.).</li>
  <li><strong>Save draft</strong> to keep working, or <strong>Save &amp; send</strong> to issue it.</li>
</ol>

<h3>Sending soft-holds the dates</h3>
<p>The moment you send a quote, Vilo places a <strong>soft hold</strong> on those dates (and the specific rooms) so you don't accidentally double-book while the guest decides. The hold clears automatically if the guest declines or the quote expires (14 days by default).</p>

<h3>Four ways to send</h3>
<p>On the quote's page, the <strong>Share with guest</strong> panel gives you:</p>
<ul>
  <li><strong>WhatsApp</strong> — opens WhatsApp with the quote link pre-written.</li>
  <li><strong>Email</strong> — opens your own mail app with the subject and body ready.</li>
  <li><strong>Vilo inbox</strong> — posts the link straight into your existing message thread with that guest (if they have a Vilo account and you've messaged before).</li>
  <li><strong>Copy link</strong> — grab the link to paste anywhere.</li>
</ul>

<h3>Turning a quote into a booking</h3>
<p>Once the guest is happy, open the quote and click <strong>Convert to booking</strong>. Choose whether it's already <strong>paid</strong> (cash, EFT or off-platform) or <strong>unpaid</strong> (collect later). Converting creates the booking, locks the calendar, freezes the cancellation policy onto the booking, and automatically generates the invoice — exactly as a direct booking would.</p>
$html$,
  read_time_minutes = 5,
  updated_at = now()
WHERE slug = 'sending-quotes';
