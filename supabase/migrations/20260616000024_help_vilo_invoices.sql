-- Migration: Help Centre article — "Your Vilo invoices & receipts"
--
-- Explains the post-payment thank-you page, the auto-issued Vilo invoice, and
-- the Settings → Transaction history tab where past invoices are downloaded.
-- help_articles is DB-backed. Idempotent.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'vilo-invoices-and-receipts',
  'Your Vilo invoices & receipts',
  'After paying for a Vilo subscription or product you get an instant thank-you page with your invoice, and every invoice stays available under Settings → Transaction history.',
  $html$
<p>Whenever you pay Vilo for a subscription or a product, we issue you a tax-style invoice automatically and show you a confirmation straight away.</p>

<h3>The thank-you page</h3>
<p>As soon as your card payment succeeds you land on a confirmation page showing what you bought, the amount (with VAT split out where applicable), your invoice number and the date. You can download the invoice as a PDF right there, and continue to log in or finish creating your account.</p>

<h3>Where to find past invoices</h3>
<p>Open <strong>Settings → Transaction history</strong>. You'll see every payment you've made to Vilo — date, what it was for, the amount and the status — each with a <strong>Download invoice</strong> link. Invoices are issued by the Vilo company entity and are safe to keep for your records or to claim VAT.</p>

<h3>Test payments</h3>
<p>While Vilo is being tested, some transactions may be marked <strong>Test</strong>. These are made with payment-provider test keys, carry no real money, and are kept separate from real billing.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'account'),
  'both',
  'published',
  2,
  now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id,
      audience = EXCLUDED.audience,
      status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes,
      updated_at = now();
