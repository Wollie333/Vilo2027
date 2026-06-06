-- Migration: Help Centre articles for the payment ledger, deposits, store
-- credit, and post-booking add-on transactions. Idempotent on slug.

-- ── Host: payments, deposits, balance, credit + add-ons ────────────
INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'booking-payments-deposits-credit',
  'Payments, deposits, balance & store credit',
  'How one booking tracks a deposit and balance as a payment ledger, how to record manual EFT, how overpayment becomes store credit, and how add-ons added after booking are invoiced.',
  $html$
<p>Every booking carries a <strong>payment ledger</strong> on its <em>Payments</em> tab &mdash; one booking, many payment entries &mdash; instead of a single all-or-nothing payment. This is how deposits, balances, extra charges and refunds all live together.</p>

<h3>From quote to booking</h3>
<p>When a guest accepts a quote, <strong>one</strong> booking is created for the full amount with a first ledger entry called <strong>Deposit</strong> (the deposit you set on the quote). If the quote was &ldquo;pay in full&rdquo;, that entry equals the total; &ldquo;reserve only&rdquo; seeds no deposit.</p>

<h3>Recording manual EFT</h3>
<ul>
  <li><strong>Mark received</strong> &mdash; when the deposit (or any pending entry) reflects in your account, click <em>Received</em>. The first received payment confirms the booking, blocks the calendar and issues the invoice.</li>
  <li><strong>Record a payment</strong> &mdash; add the balance or any other payment by hand (amount + optional reference). Multiple payments are fine.</li>
  <li><strong>Paid / Balance due</strong> &mdash; the tab always shows what&rsquo;s in and what&rsquo;s still owed, derived straight from the ledger.</li>
</ul>

<h3>Overpayment &rarr; store credit</h3>
<p>If a guest pays more than they owe, the extra is never lost &mdash; it&rsquo;s posted automatically as <strong>store credit</strong> held for that guest with you. When they have a balance on another booking, use <strong>Apply store credit</strong> to settle it.</p>

<h3>Add-ons after a booking</h3>
<p>On the <em>Add-ons</em> tab you can add extras (a late checkout, a transfer, an extra room) to a confirmed booking. Each add-on is its own transaction: it joins the booking, raises the total, and gets <strong>its own invoice</strong>. Choose <em>Mark as paid now</em> if you took the money there and then, otherwise it&rsquo;s added to the balance to collect later. Guests can also add extras themselves from their trip page &mdash; those land on the balance for you to confirm.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'payments'),
  'host', 'published', 4, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();

-- ── Guest: add extras to your trip ─────────────────────────────────
INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'add-extras-to-your-trip',
  'Adding extras to your trip',
  'Add extras like transfers or a late checkout to a booking you already have. They go onto your balance for your host to confirm.',
  $html$
<p>Already booked and want to add something? Open the trip from <strong>My trips</strong> and look for <strong>Add an extra to your trip</strong>. Pick an extra your host offers and tap <em>Add</em>.</p>
<ul>
  <li>The extra is added to your booking and a separate invoice is created for it.</li>
  <li>The amount goes onto your <strong>balance due</strong> &mdash; your host confirms the payment (e.g. by EFT) the same way as the rest of your stay.</li>
  <li>You&rsquo;ll see every extra listed on your receipt, with the ones you added marked <em>You added</em>.</li>
</ul>
<p>Extras can be added while your booking is upcoming or in progress. If you don&rsquo;t see the option, your host hasn&rsquo;t set up any extras for that stay &mdash; just message them.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'guest', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
