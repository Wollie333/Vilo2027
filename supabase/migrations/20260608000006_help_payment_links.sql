-- Migration: Help Centre article for shareable pay-now links — the Vilo-hosted
-- /pay/[token] page a host can send a guest to settle an unpaid booking by card
-- (host's own Paystack) or EFT. Host audience, payments category. Idempotent.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'send-a-payment-link',
  'Send a guest a payment link',
  'Every unpaid booking has a secure pay-now link you can copy or send by WhatsApp or email. The guest pays by card (straight to your Paystack) or EFT — no account needed.',
  $html$
<p>Whenever a booking still owes money, Vilo creates a secure <strong>payment link</strong> for it automatically. Send it to the guest and they can pay online in a couple of taps &mdash; the money goes straight to you.</p>

<h3>Where to find it</h3>
<p>Open the booking and go to the <strong>Payments</strong> tab. While there&rsquo;s an outstanding balance you&rsquo;ll see a <strong>Payment link</strong> panel with the amount due and three ways to share it:</p>
<ul>
  <li><strong>Copy</strong> &mdash; copies the link to paste anywhere (your own message, a thread, an SMS).</li>
  <li><strong>Send on WhatsApp</strong> &mdash; opens WhatsApp with a ready-written message (and the guest&rsquo;s number if we have it).</li>
  <li><strong>Email the link</strong> &mdash; opens a pre-filled email to the guest.</li>
</ul>

<h3>What the guest sees</h3>
<p>The link opens a clean Vilo page showing the stay, the amount due and a <strong>Pay by card</strong> button. They don&rsquo;t need a Vilo account. Payment is taken on <em>your own connected Paystack account</em>, so funds settle directly to you and Vilo takes no cut. If you haven&rsquo;t connected Paystack, the page shows your EFT banking details and reference instead.</p>

<h3>What happens after they pay</h3>
<ul>
  <li>Card payments confirm the booking immediately, block the dates, and mark the invoice paid.</li>
  <li>EFT payments stay pending until you confirm the transfer on the Payments tab.</li>
  <li>The link keeps working until the balance is cleared, then it simply shows &ldquo;paid&rdquo;.</li>
</ul>

<h3>Good to know</h3>
<ul>
  <li>To take card payments you must <strong>connect your Paystack account</strong> first (Settings &rarr; Banking &amp; payments).</li>
  <li>The link is unguessable and unique to the booking &mdash; only someone you send it to can use it.</li>
  <li>The amount always reflects what&rsquo;s still owed, so a part-paid booking shows only the remaining balance.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'payments'),
  'host', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
