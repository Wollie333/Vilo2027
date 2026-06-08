-- Migration: Help Centre article for the Reports "Cash position" panel — the
-- ledger-sourced money section on Analytics & Reports that sits alongside the
-- booked-value KPIs and explains booked (accrual) vs collected (cash).
-- Idempotent on slug.

-- ── Host: Cash position on Analytics & Reports ─────────────────────
INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'reports-cash-position',
  'Booked vs collected: reading the Cash position panel',
  'Why your Analytics revenue and your actual bank balance differ — and how the Cash position panel reads straight from your ledger so the two always reconcile. Collected, Outstanding, Refunded, Net cash and your lifetime collection rate.',
  $html$
<p>Open <em>Analytics &amp; Reports</em> and, just under the headline KPIs, you&rsquo;ll find the <strong>Cash position</strong> panel. It answers a different question from the charts above it, and the difference matters.</p>

<h3>Two honest numbers, not a contradiction</h3>
<ul>
  <li><strong>Booked value</strong> (the <em>Total revenue</em> KPI, RevPAR, ADR, occupancy) is <em>accrual</em> &mdash; the value of confirmed bookings, whether or not the guest has paid yet. It&rsquo;s the right number for occupancy and rate analysis.</li>
  <li><strong>Cash position</strong> is the <em>money</em> &mdash; what has actually landed, what&rsquo;s still owed, and what you&rsquo;ve paid back. It&rsquo;s read from the very same ledger as your <em>Ledger</em> and a booking&rsquo;s <em>Payments</em> tab, so every page agrees to the cent.</li>
</ul>
<p>So a period can show R36&nbsp;250 booked but R20&nbsp;300 collected &mdash; that&rsquo;s not an error, it just means some of those bookings are still to be paid. The panel spells the gap out for you.</p>

<h3>The figures</h3>
<ul>
  <li><strong>Collected</strong> &mdash; cash received in the selected date range (with your all-time total beneath it).</li>
  <li><strong>Outstanding</strong> &mdash; what guests still owe you right now, across the whole account, and how many guests that is. This is a live figure, not period-bound.</li>
  <li><strong>Refunded</strong> &mdash; cash paid back to guests in the period.</li>
  <li><strong>Net cash</strong> &mdash; Collected minus Refunded: what actually stayed with you.</li>
  <li><strong>Lifetime collection</strong> &mdash; the bar and percentage show how much of everything you&rsquo;ve ever billed has been collected versus what&rsquo;s still outstanding.</li>
</ul>

<h3>Acting on it</h3>
<p>If money is outstanding, the panel says how much and across how many guests. Tap <strong>Open ledger</strong> to jump to the full transaction view, filter to who owes you, and send a payment link or record an EFT &mdash; the moment you do, these numbers update.</p>

<h3>Refund rate vs cancellation rate</h3>
<p>Lower down, the <em>Refunds &amp; Cancellations</em> card shows rates <strong>by frequency</strong> (share of bookings), while the <em>Refund rate</em> KPI higher up is <strong>by value</strong> (share of revenue refunded). Both are useful; the labels tell you which is which.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'payments'),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
