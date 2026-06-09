-- Help (RULES.md §9): document quote revisions + the event-sourced conversation
-- timeline now that each lifecycle step is its own card. Appends to the existing
-- "sending-quotes" article (idempotent on the marker text).

UPDATE help_articles
SET
  body_html = body_html || $html$
<h3>The conversation timeline</h3>
<p>Each step of a quote is its own card in the thread, so nothing is overwritten — you and the guest always see the full history:</p>
<ul>
  <li>The guest's <strong>request</strong> card greys to &ldquo;Answered&rdquo; once you send a quote.</li>
  <li>Every <strong>sent</strong> (and revised) quote is its own card. Older versions grey out as &ldquo;Superseded&rdquo; — the figures shown are exactly what was sent at the time.</li>
  <li><strong>Accepted</strong>, <strong>declined</strong> and <strong>converted-to-booking</strong> each add their own card.</li>
</ul>

<h3>Revising a sent quote</h3>
<p>If you edit a quote you've already sent, Vilo asks for a short <strong>reason</strong> for the change. It keeps the previous version intact, bumps the version number, and posts a fresh <strong>revised quote</strong> card (with your reason) so the guest can see what changed and why. The earlier version stays in the thread, greyed out.</p>
<p>A quote is an <strong>estimate</strong> — revising it never touches your books. Money only enters the ledger once the guest accepts and the quote becomes a booking with an invoice. If something needs to change <em>after</em> that, you issue a supplementary invoice or a credit note against the booking rather than editing the quote.</p>
$html$,
  read_time_minutes = 6,
  updated_at = now()
WHERE slug = 'sending-quotes'
  AND body_html NOT LIKE '%Revising a sent quote%';
