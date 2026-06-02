-- Migration: Help Centre article — connect your own Paystack & PayPal
-- (RULES.md §9). Explains how a host plugs in their own gateway credentials so
-- booking payments settle directly to them (Vilo takes 0%), the statement
-- descriptor, default currency, and the "request a payment" link. Idempotent.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'connect-payment-gateways',
  'Accept payments with your own Paystack & PayPal',
  'Connect your own gateway accounts so booking payments land directly in your bank — Vilo never takes a cut.',
  $html$
<p>Vilo lets you accept card payments through <strong>your own</strong> Paystack and PayPal accounts. Money settles directly to you and <strong>Vilo takes 0%</strong> — we only charge a subscription for the platform. You set this up under <strong>Settings &rarr; Banking &amp; business &rarr; Payment gateways</strong>.</p>

<h3>Which gateway for which currency</h3>
<ul>
  <li><strong>Paystack</strong> &mdash; cards &amp; instant EFT in <strong>ZAR</strong>. The default for South African guests.</li>
  <li><strong>PayPal</strong> &mdash; international cards in <strong>USD</strong>. Your ZAR prices are converted automatically at the daily exchange rate.</li>
  <li><strong>EFT</strong> &mdash; manual bank transfer, set up separately under Bank accounts.</li>
</ul>
<p>Your <strong>default currency</strong> (ZAR or USD) decides which gateway a guest sees first; they can switch between the gateways you&rsquo;ve enabled.</p>

<h3>Connecting Paystack</h3>
<ol>
  <li>In your Paystack dashboard, open <strong>Settings &rarr; API Keys &amp; Webhooks</strong>.</li>
  <li>Copy your <strong>public key</strong> (<code>pk_live_…</code>) and <strong>secret key</strong> (<code>sk_live_…</code>).</li>
  <li>Paste both into Vilo and click <strong>Connect &amp; validate</strong>. We check the keys with Paystack before saving — invalid keys are rejected.</li>
</ol>

<h3>Connecting PayPal</h3>
<ol>
  <li>At <strong>developer.paypal.com</strong>, create (or open) a <strong>REST API app</strong>.</li>
  <li>Copy the <strong>Client ID</strong> and <strong>Secret</strong>, pick <strong>Live</strong> or <strong>Sandbox</strong>, and paste them into Vilo.</li>
</ol>

<h3>Statement descriptor</h3>
<p>On Paystack you can set a short <strong>statement descriptor</strong> &mdash; the word that appears on the guest&rsquo;s bank statement for a payment to you (e.g. <em>SEASIDE VILLA</em>). Keep it under 22 characters; banks truncate longer text. Final display depends on the guest&rsquo;s bank, but Vilo always sends it through.</p>

<h3>Your keys are safe</h3>
<ul>
  <li>Secrets are <strong>encrypted at rest</strong> and never shown again &mdash; you&rsquo;ll only ever see the last 4 characters.</li>
  <li>Leave the secret field blank when editing to keep the stored key.</li>
  <li>Disable a gateway to hide it at checkout without deleting your keys.</li>
</ul>

<h3>Take a payment right now</h3>
<p>Once Paystack is connected, use <strong>Request payment</strong> to generate a shareable Paystack link for any amount. Send it to a guest and the funds land straight in your account &mdash; handy for deposits before the full guest checkout is live.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'payments'),
  'host', 'published', 4, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id,
      status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes,
      updated_at = now();
