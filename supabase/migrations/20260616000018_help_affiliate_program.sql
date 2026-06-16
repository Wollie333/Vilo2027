-- Migration: Help Centre article — "How the affiliate programme works"
--
-- Explains the user-facing affiliate programme (any account can join, 30-day
-- cookie, per-product commission on net paid, refund hold, payouts with the
-- processor fee deducted). help_articles is DB-backed. Idempotent.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'how-affiliate-program-works',
  'How the affiliate programme works',
  'Earn commission by referring people to Vilo. Share your link, track signups and earnings, and get paid out by EFT, Paystack or PayPal.',
  $html$
<p>Anyone with a Vilo account can join the affiliate programme. You promote Vilo's products with your own referral link, and you earn commission whenever someone you referred buys one.</p>

<h3>Getting started</h3>
<p>Open <strong>Affiliates</strong> from your menu and accept the affiliate terms. You'll get a unique referral link (you can customise the end of it) and access to your dashboard, the product links and the marketing material.</p>

<h3>How referrals are tracked</h3>
<p>When someone clicks your link, a cookie attributes them to you for <strong>30 days</strong>. The moment they create a Vilo account, they're linked to you permanently — so even if they subscribe later, the referral still counts. You can't refer yourself.</p>

<h3>How commission is calculated</h3>
<p>Each product has a commission rate set by Vilo (a percentage or a fixed amount), shown on the <strong>Affiliate products</strong> page. You earn that rate on the <strong>net amount the customer actually pays</strong> — after any discount, excluding VAT. Some products pay commission once, others for several months, others for as long as the customer stays subscribed.</p>

<h3>When you get paid</h3>
<p>New commission starts as <strong>pending</strong> while the refund window passes (so refunds can be accounted for). After that it becomes <strong>cleared</strong> and counts towards your available balance. If a sale is later refunded, the related commission is reversed.</p>

<h3>Requesting a payout</h3>
<p>Once your available balance reaches your payout threshold, request a payout from the <strong>Payouts</strong> tab. Choose EFT, Paystack or PayPal. Each method has a processor fee that is <strong>deducted from your payout</strong> — you'll see the exact gross, fee and net before you confirm. An admin reviews and pays out, and the status updates as it's processed.</p>

<h3>Marketing material</h3>
<p>The <strong>Marketing</strong> tab has banners and images you can download, plus ready-to-paste embed code that already includes your referral link — drop it straight onto your site.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'account'),
  'both',
  'published',
  3,
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
