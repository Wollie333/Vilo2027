-- Migration: extend the Ledger help article with the per-business filter.
-- Idempotent on slug — re-upserts the row from 20260608000007 with one added
-- subsection (and an intro nod) covering the "All businesses / Business…"
-- selector on the Ledger and the guest's Finances tab.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'ledger-account-finance-view',
  'The Ledger: every transaction in one place',
  'Your whole money picture on one page — charges, payments, credits and refunds across every guest and every business. How to read a row, read the five totals, filter (incl. by business), search, manage any transaction, and lock a month for your accountant.',
  $html$
<p>The <strong>Ledger</strong> (under <em>Finances</em> in your dashboard) is the single source of truth for your money. Every charge, payment, deposit, store credit and refund &mdash; across <strong>all</strong> your bookings and guests &mdash; lands here as one row. The per-booking <em>Payments</em> tab and a guest&rsquo;s <em>Finances</em> tab show the very same rows, just filtered down, so the numbers always agree. Run more than one business? You can scope the whole page to just one of them.</p>

<div class="hc-livenote"><span class="hc-dot hc-dot--live"></span> Every transaction across your whole account, updating as money moves.</div>

<h3>The five totals at the top</h3>
<div class="hc-kpis">
  <div class="hc-kpi hc-kpi--amber">
    <div class="hc-kpi__label">Outstanding</div>
    <div class="hc-kpi__value">R2,900</div>
    <div class="hc-kpi__sub">across 1 guest</div>
  </div>
  <div class="hc-kpi hc-kpi--ink">
    <div class="hc-kpi__label">Collected</div>
    <div class="hc-kpi__value">R5,400</div>
  </div>
  <div class="hc-kpi hc-kpi--red">
    <div class="hc-kpi__label">Refunded</div>
    <div class="hc-kpi__value">R0</div>
  </div>
  <div class="hc-kpi hc-kpi--indigo">
    <div class="hc-kpi__label">Credits</div>
    <div class="hc-kpi__value">R300</div>
  </div>
  <div class="hc-kpi hc-kpi--emerald">
    <div class="hc-kpi__label">Net</div>
    <div class="hc-kpi__value">R5,400</div>
  </div>
</div>
<ul class="hc-list">
  <li><strong>Outstanding</strong> &mdash; what guests still owe you, added up across everyone (the sub-line shows how many guests).</li>
  <li><strong>Collected</strong> &mdash; total cash you&rsquo;ve received, by every method.</li>
  <li><strong>Refunded</strong> &mdash; total cash you&rsquo;ve paid back out.</li>
  <li><strong>Credits</strong> &mdash; total store credit you&rsquo;ve granted to guests.</li>
  <li><strong>Net</strong> &mdash; Collected minus Refunded: the cash that actually stayed with you.</li>
</ul>
<p class="hc-caption">With a business selected, these five totals show that business&rsquo;s figures only.</p>

<h3>How to read a row</h3>
<p>Here&rsquo;s exactly what the ledger shows &mdash; a charge, a part-payment, and a pending add-on on one booking:</p>
<div class="hc-scroll">
  <table class="hc-ledger">
    <thead>
      <tr>
        <th>Transaction</th>
        <th>Type</th>
        <th>For</th>
        <th class="hc-amt">Amount</th>
        <th class="hc-bal">Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><div class="hc-txn">Stay &middot; 3 nights</div><div class="hc-ref">VLO-1042</div></td>
        <td><span class="hc-pill hc-pill--sky">Charge</span></td>
        <td><span class="hc-pill hc-pill--ink">Booking</span></td>
        <td class="hc-amt hc-amt--charge">R8,000</td>
        <td class="hc-bal hc-bal--due">R8,000 due</td>
      </tr>
      <tr>
        <td><div class="hc-txn">Deposit received</div><div class="hc-ref">EFT &middot; ref 4471</div></td>
        <td><span class="hc-pill hc-pill--emerald">Deposit</span></td>
        <td><span class="hc-pill hc-pill--ink">Booking</span></td>
        <td class="hc-amt hc-amt--pay">(R5,400)</td>
        <td class="hc-bal hc-bal--due">R2,600 due</td>
      </tr>
      <tr>
        <td><div class="hc-txn">Late checkout <span class="hc-badge-pending"><span class="hc-dot"></span>Pending</span></div></td>
        <td><span class="hc-pill hc-pill--sky">Charge</span></td>
        <td><span class="hc-pill hc-pill--violet">Add-on</span></td>
        <td class="hc-amt hc-amt--charge">R300</td>
        <td class="hc-bal hc-bal--due">R2,900 due</td>
      </tr>
    </tbody>
  </table>
</div>
<ul class="hc-list">
  <li><strong>Type</strong> &mdash; what the entry is: Charge, Payment, Deposit, Credit applied, Credit note or Refund.</li>
  <li><strong>For</strong> &mdash; what the money was about: Booking, Add-on, Store credit or Refund.</li>
  <li><strong>Amount</strong> &mdash; charges and refunds (they raise what a guest owes) print plain; payments and credits (they lower it) print in <em>(parentheses)</em>, standard accounting style.</li>
  <li><strong>Balance</strong> &mdash; the running figure for that guest <em>after</em> this entry: how much is due, how much credit they hold, or settled when it&rsquo;s square.</li>
  <li><strong>Document</strong> &mdash; the invoice, receipt, credit note or refund document, ready to open or download as a PDF.</li>
</ul>

<h3>Every entry is colour-tagged</h3>
<p>The <strong>Type</strong> tells you what happened to the money:</p>
<div class="hc-pills">
  <span class="hc-pill hc-pill--sky">Charge</span>
  <span class="hc-pill hc-pill--emerald">Payment</span>
  <span class="hc-pill hc-pill--emerald">Deposit</span>
  <span class="hc-pill hc-pill--indigo">Credit applied</span>
  <span class="hc-pill hc-pill--indigo">Credit note</span>
  <span class="hc-pill hc-pill--red">Refund</span>
</div>
<p>The <strong>For</strong> tells you what it was about:</p>
<div class="hc-pills">
  <span class="hc-pill hc-pill--ink">Booking</span>
  <span class="hc-pill hc-pill--violet">Add-on</span>
  <span class="hc-pill hc-pill--indigo">Store credit</span>
  <span class="hc-pill hc-pill--red">Refund</span>
</div>

<h3>Paid vs balance, at a glance</h3>
<div class="hc-money">
  <div class="hc-money__row"><span>Collected</span><strong>R5,400</strong></div>
  <div class="hc-progress"><div class="hc-progress__fill"></div></div>
  <div class="hc-money__row"><span>Balance due</span><strong class="hc-due">R2,900</strong></div>
</div>
<p class="hc-caption">The same paid-vs-due picture appears on each booking&rsquo;s Payments tab &mdash; always derived from the ledger, never typed in by hand.</p>

<h3>Find anything fast</h3>
<div class="hc-pills">
  <span class="hc-pill hc-pill--solid">All <span class="hc-count">128</span></span>
  <span class="hc-pill hc-pill--ink">Charges <span class="hc-count">54</span></span>
  <span class="hc-pill hc-pill--ink">Payments <span class="hc-count">61</span></span>
  <span class="hc-pill hc-pill--ink">Refunds <span class="hc-count">2</span></span>
  <span class="hc-pill hc-pill--ink">Credits <span class="hc-count">7</span></span>
  <span class="hc-pill hc-pill--red">Voided <span class="hc-count">4</span></span>
</div>
<ul class="hc-list">
  <li><strong>Filter pills</strong> &mdash; each carries a live count; the <em>Voided</em> pill shows only when you have voided entries.</li>
  <li><strong>Business dropdown</strong> &mdash; if you run more than one business, scope the page to one of them. It re-reads the ledger for that business, so the five totals and every running balance reflect that business alone.</li>
  <li><strong>Guest dropdown</strong> &mdash; narrow the whole page to one guest.</li>
  <li><strong>Search</strong> &mdash; matches a document or booking number, guest name, the note, the type, and the date (type &ldquo;7 Jun 2026&rdquo; or &ldquo;2026-06-07&rdquo;).</li>
  <li><strong>Date sort</strong> &mdash; tap the <em>Date</em> header to flip newest-first / oldest-first. The balances stay correct either way.</li>
</ul>

<h3>Filtering by business</h3>
<p>Each transaction belongs to a business &mdash; the one that owns the booking&rsquo;s listing. The <strong>business dropdown</strong> on the Ledger lets you see only that business&rsquo;s money, and the same control sits on a guest&rsquo;s <em>Finances</em> tab when that guest has booked across more than one of your businesses.</p>
<div class="hc-callout hc-callout--green">
  <span class="hc-callout__tag hc-callout__tag--green">Good to know</span>
  <div class="hc-callout__body">On a guest record, the headline <strong>balance always reflects every business</strong> &mdash; the total the guest owes you (or the credit they hold) across all of them. The business filter only scopes the <em>list of transactions</em> below it, so you can read one business&rsquo;s activity without losing the true overall balance.</div>
</div>

<h3>Manage any transaction from its row</h3>
<p>The <strong>&hellip;</strong> menu on every row gives you the booking&rsquo;s money actions without leaving the Ledger:</p>
<div class="hc-actions">
  <div class="hc-action"><b>Record payment</b><span>Log a manual EFT or other payment against the booking.</span></div>
  <div class="hc-action"><b>Mark as received</b><span>Confirm a pending EFT landed — the first one confirms the booking.</span></div>
  <div class="hc-action"><b>Issue refund</b><span>Pay cash back out to the guest.</span></div>
  <div class="hc-action"><b>Give credit note</b><span>Grant store credit they can spend on a future stay.</span></div>
  <div class="hc-action"><b>Add a charge</b><span>Bill an extra against the booking.</span></div>
  <div class="hc-action"><b>Open / send document</b><span>Share the invoice, receipt or credit note with the guest.</span></div>
</div>

<h3>Voiding &mdash; correct without deleting</h3>
<div class="hc-scroll">
  <table class="hc-ledger">
    <tbody>
      <tr class="hc-row--void">
        <td><div class="hc-txn">Deposit received</div><div class="hc-ref">Voided &mdash; recorded on the wrong booking</div></td>
        <td><span class="hc-pill hc-pill--emerald">Deposit</span></td>
        <td><span class="hc-pill hc-pill--ink">Booking</span></td>
        <td class="hc-amt hc-amt--pay">(R5,400)</td>
        <td class="hc-bal hc-bal--settled">&mdash;</td>
      </tr>
    </tbody>
  </table>
</div>
<div class="hc-callout hc-callout--red">
  <span class="hc-callout__tag hc-callout__tag--red">Audit-safe</span>
  <div class="hc-callout__body"><strong>Nothing is ever erased.</strong> Void reverses an entry while keeping it on record with your reason &mdash; it shows struck-through under a <span class="hc-pill hc-pill--red">Voided</span> tag and drops out of your live totals. That&rsquo;s how you fix a mistake cleanly.</div>
</div>

<h3>Close a month for your accountant</h3>
<div class="hc-periods">
  <div class="hc-month"><span class="hc-dot hc-dot--open"></span> Jun 2026 <span class="hc-month__state hc-open">Open</span></div>
  <div class="hc-month"><span class="hc-dot hc-dot--closed"></span> May 2026 <span class="hc-month__state hc-closed">Closed</span></div>
</div>
<div class="hc-callout hc-callout--green">
  <span class="hc-callout__tag hc-callout__tag--green">Periods</span>
  <div class="hc-callout__body">Use <strong>Periods</strong> (top-right) to <em>close</em> a month once it&rsquo;s reconciled. After that, no transaction dated in that month can be created or voided &mdash; you&rsquo;d post a correcting entry in the open month instead. You can <em>reopen</em> a closed month any time, and both the close and the reopen are written to the audit trail.</div>
</div>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'payments'),
  'host', 'published', 5, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
