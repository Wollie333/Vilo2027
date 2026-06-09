-- Migration: refresh the "Sending quotes" Help article (RULES.md §9) for the
-- redesigned quote builder — a single-column, 3-step response flow (Confirm the
-- stay / Your price / Terms & your reply), an Itemised-vs-Single-total price
-- mode, and a guest-facing preview shown before anything is sent. Idempotent
-- upsert on the existing slug.

UPDATE help_articles SET
  excerpt = 'Respond to a quote request in three quick steps — confirm the stay, set your price (itemised or a single total), agree the terms — then preview exactly what the guest receives before you send.',
  body_html = $html$
<p>A <strong>quote</strong> lets you price a stay for someone who hasn't booked yet — an enquiry from your inbox, a returning guest, or an off-platform lead. The guest can review and accept it without a Vilo account.</p>

<h3>Responding to a request</h3>
<p>When a guest asks for a price, open the request and you'll see <strong>their original message</strong> and what they asked for (listing, dates, party, any add-ons) in a card at the top. Below it, your response is laid out in three quick steps.</p>

<h3>Step 1 — Confirm the stay</h3>
<ol>
  <li>Check the <strong>guest</strong> details. As you type a name, Vilo suggests your returning guests so you can pre-fill their email and phone.</li>
  <li>Confirm the <strong>listing &amp; room</strong>. Hit <strong>Change</strong> to pick a different listing, or switch between <strong>Whole listing</strong> and <strong>Specific rooms</strong>.</li>
  <li>Hit <strong>Adjust</strong> to change the dates on the calendar or the guest party. (You'll only ever see your own listings, rooms and add-ons here.)</li>
</ol>

<h3>Step 2 — Your price</h3>
<ul>
  <li><strong>Itemised</strong> (default): each line is editable. Use <strong>Re-price from calendar</strong> to price the stay through the same engine the guest checkout uses, so seasonal and weekend rates are baked in. Add a <strong>Custom line</strong>, an <strong>add-on from your library</strong>, or a <strong>Discount</strong> — each shows as its own line.</li>
  <li><strong>Single total</strong>: give one price for the whole stay with no line-by-line breakdown — handy for bespoke or negotiated pricing.</li>
</ul>
<p>The totals strip shows what the <strong>guest pays</strong>, the <strong>average per night</strong>, and <strong>your payout</strong> — there's no Vilo commission, so you keep it all.</p>

<h3>Step 3 — Terms &amp; your reply</h3>
<ol>
  <li>Choose how long to <strong>hold the price</strong> (24 hours, a few days, or right up to check-in).</li>
  <li>Set what the guest pays to accept: a <strong>deposit</strong> (with the balance due a set number of days before check-in), the <strong>full amount</strong>, or <strong>reserve only</strong>.</li>
  <li>Write a short <strong>personal reply</strong> — quick-insert buttons drop in check-in details, your cancellation policy, or directions.</li>
</ol>

<h3>Preview before you send</h3>
<p>Click <strong>Review &amp; send</strong> and you'll see the quote <em>exactly</em> as the guest will receive it — the branded summary, your message, the breakdown and the accept-and-pay button. Nothing is sent until you confirm.</p>

<h3>Sending soft-holds the dates</h3>
<p>The moment you send a quote, Vilo places a <strong>soft hold</strong> on those dates (and the specific rooms) so you don't accidentally double-book while the guest decides. The hold clears automatically if the guest declines or the quote expires.</p>

<h3>Turning a quote into a booking</h3>
<p>Once the guest accepts and pays, Vilo converts the quote into a confirmed booking automatically — locking the calendar, freezing the cancellation policy onto the booking, and generating the invoice. You can also convert it yourself from the quote's page (marking it paid or unpaid) for off-platform deals.</p>
$html$,
  read_time_minutes = 5,
  updated_at = now()
WHERE slug = 'sending-quotes';
