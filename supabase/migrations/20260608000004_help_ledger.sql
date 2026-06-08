-- Migration: Help Centre article for the account-wide Ledger — the single
-- finance view of every transaction (charges, payments, credits, refunds)
-- across the whole account, with KPIs, filters, per-row actions, voids and
-- accounting-period locks. Idempotent on slug.

-- ── Host: the account-wide Ledger ──────────────────────────────────
INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'ledger-account-finance-view',
  'The Ledger: every transaction in one place',
  'Your whole money picture on one page — charges, payments, credits and refunds across every guest. How to read a row, read the five totals, filter and search, manage any transaction, and lock a month for your accountant.',
  $html$
<p>The <strong>Ledger</strong> (under <em>Finances</em> in your dashboard) is the single source of truth for your money. Every charge, payment, deposit, store credit and refund &mdash; across <strong>all</strong> your bookings and guests &mdash; lands here as one row. The per-booking <em>Payments</em> tab and a guest&rsquo;s <em>Finances</em> tab show the very same rows, just filtered down, so the numbers always agree.</p>

<h3>The five totals at the top</h3>
<ul>
  <li><strong>Outstanding</strong> &mdash; what guests still owe you, added up across everyone (the sub-line shows how many guests).</li>
  <li><strong>Collected</strong> &mdash; total cash you&rsquo;ve received, by every method.</li>
  <li><strong>Refunded</strong> &mdash; total cash you&rsquo;ve paid back out.</li>
  <li><strong>Credits</strong> &mdash; total store credit you&rsquo;ve granted to guests.</li>
  <li><strong>Net</strong> &mdash; Collected minus Refunded: the cash that actually stayed with you.</li>
</ul>

<h3>How to read a row</h3>
<ul>
  <li><strong>Type</strong> &mdash; what the entry is: <em>Charge</em>, <em>Payment</em>, <em>Deposit</em>, <em>Credit applied</em>, <em>Credit note</em> or <em>Refund</em>.</li>
  <li><strong>For</strong> &mdash; what the money was about: <em>Booking</em>, <em>Add-on</em>, <em>Store credit</em> or <em>Refund</em>.</li>
  <li><strong>Amount</strong> &mdash; charges and refunds (which raise what a guest owes) print plain; payments and credits (which lower it) print in <em>(parentheses)</em>, standard accounting style.</li>
  <li><strong>Balance</strong> &mdash; the running figure for that guest <em>after</em> this entry: how much is <em>due</em>, how much <em>credit</em> they hold, or <em>settled</em> when it&rsquo;s square.</li>
  <li><strong>Document</strong> &mdash; the invoice, receipt, credit note or refund document, ready to open or download as a PDF.</li>
</ul>

<h3>Find anything fast</h3>
<ul>
  <li><strong>Filter pills</strong> &mdash; <em>All</em>, <em>Charges</em>, <em>Payments</em>, <em>Refunds</em>, <em>Credits</em>, each with a live count. A <em>Voided</em> pill appears only when you have voided entries.</li>
  <li><strong>Guest dropdown</strong> &mdash; narrow the whole page to one guest.</li>
  <li><strong>Search</strong> &mdash; matches a document or booking number, guest name, the note, the type, and the date (type &ldquo;7 Jun 2026&rdquo; or &ldquo;2026-06-07&rdquo;).</li>
  <li><strong>Date sort</strong> &mdash; tap the <em>Date</em> header to flip newest-first / oldest-first. The balances stay correct either way.</li>
</ul>

<h3>Manage any transaction from its row</h3>
<p>The <strong>&hellip;</strong> menu on every row gives you the same money actions you&rsquo;d find on the booking itself, without leaving the Ledger:</p>
<ul>
  <li><strong>Record payment</strong> &mdash; log a manual EFT or other payment against that booking.</li>
  <li><strong>Mark as received</strong> &mdash; on a pending EFT entry, confirm the money has landed. The first received payment confirms the booking, blocks the calendar and issues the invoice.</li>
  <li><strong>Issue refund</strong> &mdash; pay cash back out.</li>
  <li><strong>Give credit note</strong> &mdash; grant store credit the guest can spend on a future booking with you.</li>
  <li><strong>Add a charge</strong> &mdash; bill an extra against the booking.</li>
  <li><strong>Open / download / send / email document</strong> &mdash; share the invoice, receipt or credit note straight to the guest, or jump to the booking.</li>
</ul>

<h3>Voiding &mdash; correct without deleting</h3>
<p>Nothing is ever erased. <strong>Void transaction</strong> reverses an entry while keeping it on record with your reason &mdash; it shows struck-through under the <em>Voided</em> pill (an audit trail), and drops out of your live totals. This is how you fix a mistake cleanly.</p>

<h3>Close a month for your accountant</h3>
<p>Use <strong>Periods</strong> (top-right) to <em>close</em> a month once it&rsquo;s reconciled. After that, no transaction dated in that month can be created or voided &mdash; you&rsquo;d post a correcting entry in the open month instead. You can <em>reopen</em> a closed month at any time, and both the close and the reopen are written to the audit trail. This keeps your books accountant-safe.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'payments'),
  'host', 'published', 5, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
