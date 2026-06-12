-- Migration: Help Centre article for the Businesses management centre — how a
-- host runs multiple legal businesses from one account, assigns listings, and
-- controls which company details print on each guest's quotes/invoices.
-- Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'managing-multiple-businesses',
  'Managing multiple businesses',
  'Run several legal businesses from one account. Add a business with its own address, banking, currency and language; assign listings to it; and every quote and invoice for those listings carries the right company details.',
  $html$
<p>Your Vilo account can hold <strong>more than one business</strong>. A property manager often looks after listings that belong to different legal entities &mdash; each with its own name, VAT number, bank account and invoice details. The <strong>Businesses</strong> tab (under <em>Settings</em>) is where you manage them.</p>

<h3>Your account vs. your businesses</h3>
<ul>
  <li>Your <strong>account</strong> is you, the person who signs in. It holds a <strong>private address</strong> kept for your records only &mdash; it is never shown to guests or printed on any document.</li>
  <li>A <strong>business</strong> is a legal entity that issues documents. Its name, VAT number, company registration, address, logo, currency and language appear on the quotes and invoices for the listings assigned to it.</li>
</ul>

<h3>Add a business</h3>
<p>On the Businesses tab, choose <strong>Add business</strong>. Give it a name, then set its address using the map search &mdash; start typing and pick a suggestion, or drop the pin yourself. Pick the business&rsquo;s <strong>default currency</strong> (used for new listings assigned to it) and <strong>default language</strong> (used for that business&rsquo;s guest documents). You can add the VAT number, company registration and a logo for fully branded invoices.</p>

<h3>The default business</h3>
<p>One business is always your <strong>default</strong>. New listings are assigned to it automatically unless you choose another. Use the &hellip; menu on any business to <strong>Set as default</strong>.</p>

<h3>Banking is per business</h3>
<p>Each business has its own bank accounts. Open a business and add its accounts under <strong>Bank accounts</strong>; the one you mark default is what prints on that business&rsquo;s invoices, quotes and the EFT instructions guests see. Card gateways (your own Paystack / PayPal) stay account-wide on the <em>Card payments</em> tab.</p>

<h3>Assigning listings</h3>
<p>Every listing belongs to exactly one business. When a guest books a listing, the quote and invoice automatically carry that business&rsquo;s details &mdash; so a guest booking a Business&nbsp;A listing gets Business&nbsp;A&rsquo;s invoice, and a guest booking Business&nbsp;B gets Business&nbsp;B&rsquo;s. Your guest list stays in one place across all your businesses; each guest is simply tagged with the businesses they&rsquo;ve booked.</p>

<h3>Archiving</h3>
<p>You can <strong>archive</strong> a business you no longer use. You can&rsquo;t archive your default business, or one that still has listings assigned &mdash; reassign those listings first.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'account'),
  'host', 'published', 4, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
