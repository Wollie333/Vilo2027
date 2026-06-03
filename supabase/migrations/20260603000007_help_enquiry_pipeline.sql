-- Migration: Help Centre article (RULES.md §9) for guest quote requests + the
-- host inbox pipeline. Explains how a visitor requests a quote from a listing,
-- how it lands as a draft-quote card in the inbox, and how the pipeline folders
-- (New quote → Quote sent → Negotiating → Accepted → Declined → Lost) work.
-- Idempotent upsert on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'enquiry-pipeline-inbox',
  'Turn enquiries into bookings with the inbox pipeline',
  'Guests request a quote from your listing; it lands in your inbox as a draft quote you complete and send — tracked through a simple pipeline.',
  $html$
<p>Every listing has a <strong>Request a quote</strong> button. When a visitor sends a request, Vilo does three things automatically:</p>
<ul>
  <li>Creates (or reuses) a lightweight <strong>guest contact</strong> from their name, email and phone — no account required on their side.</li>
  <li>Opens a thread in your <strong>Inbox</strong> at the <strong>New quote</strong> stage, with the guest's message.</li>
  <li>Drafts a <strong>quote</strong> from their dates and party, auto-priced as a starting point — you stay in full control of pricing.</li>
</ul>

<h3>Completing &amp; sending the quote</h3>
<p>Open the thread and use the <strong>draft quote card</strong> in the right-hand panel to open the quote. Adjust the host-only fields — price, cleaning fee, add-ons, discount, deposit terms and policy — then <strong>send</strong>. The guest gets a link to view and accept it; visitors can never change your prices or policies.</p>

<h3>The pipeline</h3>
<p>The Inbox sidebar has a <strong>Pipeline</strong> section that sorts threads by deal stage:</p>
<ul>
  <li><strong>New quote</strong> — a fresh request awaiting your quote.</li>
  <li><strong>Quote sent</strong> — you've sent the quote (set automatically when you send).</li>
  <li><strong>Negotiating</strong> — move it here while you go back and forth.</li>
  <li><strong>Accepted</strong> — the guest accepted (set automatically); accepting converts to a booking.</li>
  <li><strong>Declined</strong> / <strong>Lost</strong> — didn't go ahead.</li>
</ul>
<p>Stages move on their own as the quote progresses, and you can drag a thread to any stage yourself from the pipeline controls in the thread.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
