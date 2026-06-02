-- Migration: Help Centre articles for the financial-documents feature
-- (RULES.md §9) — Quotes, Invoices, and Branding your documents (logo).
-- Credit notes are already covered by 20260602000002. Idempotent.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
VALUES
-- ─── Quotes ──────────────────────────────────────────────────────────
(
  'sending-quotes',
  'Sending quotes to prospective guests',
  'Draw up a branded quote, soft-hold the dates, and send it via WhatsApp, email or your Vilo inbox — then convert it to a booking in one click.',
  $html$
<p>A <strong>quote</strong> lets you price a stay for someone who hasn't booked yet — an enquiry from your inbox, a returning guest, or an off-platform lead. The guest can review and accept it without a Vilo account.</p>

<h3>Create a quote</h3>
<ol>
  <li>Go to <strong>Finances &rarr; Quotes &rarr; New quote</strong>.</li>
  <li>Pick the listing, dates and number of guests.</li>
  <li>Enter the guest's name, email and (optionally) a phone number.</li>
  <li>Set the base amount, cleaning fee and any extra line items.</li>
  <li><strong>Save draft</strong> to keep working, or <strong>Save &amp; send</strong> to issue it.</li>
</ol>

<h3>Sending soft-holds the dates</h3>
<p>The moment you send a quote, Vilo places a <strong>soft hold</strong> on those dates so you don't accidentally double-book while the guest decides. The hold clears automatically if the guest declines or the quote expires (14 days by default).</p>

<h3>Four ways to send</h3>
<p>On the quote's page, the <strong>Share with guest</strong> panel gives you:</p>
<ul>
  <li><strong>WhatsApp</strong> — opens WhatsApp with the quote link pre-written.</li>
  <li><strong>Email</strong> — opens your own mail app with the subject and body ready.</li>
  <li><strong>Vilo inbox</strong> — posts the link straight into your existing message thread with that guest (only if they have a Vilo account and you've messaged before).</li>
  <li><strong>Copy link</strong> — grab the link to paste anywhere.</li>
</ul>
<p>Every link opens a clean, branded quote page where the guest can download a PDF, accept or decline.</p>

<h3>Turning a quote into a booking</h3>
<p>Once the guest is happy, open the quote and click <strong>Convert to booking</strong>. Choose whether it's already <strong>paid</strong> (cash, EFT or off-platform) or <strong>unpaid</strong> (collect later). Converting creates the booking, locks the calendar, and automatically generates the invoice.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'host', 'published', 4, now()
),
-- ─── Invoices ────────────────────────────────────────────────────────
(
  'invoices',
  'Invoices: automatic, branded, always attached',
  'Vilo creates an invoice for every confirmed booking, marks it paid when payment lands, and links it to the booking, payment and any credit notes.',
  $html$
<p>An <strong>invoice</strong> is the record of what a guest owes (or has paid) for a booking. Vilo generates and manages these for you — you rarely create one by hand.</p>

<h3>How invoices are created</h3>
<ul>
  <li>When a booking is <strong>confirmed</strong>, an invoice is generated automatically with its own number, a frozen snapshot of your business details, and every line item (rooms, add-ons, discounts).</li>
  <li>When the booking's payment <strong>completes</strong> — whether that's a card payment, a confirmed EFT, or you marking it paid — the invoice flips to <strong>Paid</strong>.</li>
</ul>

<h3>Where to find them</h3>
<p>Open <strong>Finances &rarr; Invoices</strong> for the full list, or jump to a booking's invoice from the booking page. Each invoice has:</p>
<ul>
  <li>a <strong>detail page</strong> inside your dashboard, and</li>
  <li>a <strong>shareable public link</strong> plus an auto-generated <strong>PDF</strong> the guest can view or download.</li>
</ul>

<h3>Everything is cross-linked</h3>
<p>From an invoice you can jump to its booking, its payment, and any credit notes raised against it — and back again. This keeps the money trail one click apart, end to end.</p>

<h3>Good to know</h3>
<ul>
  <li>Invoices carry your logo and business details automatically (see <em>Branding your documents</em>).</li>
  <li>If you refund a guest, a <strong>credit note</strong> records the money credited back against the invoice.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'payments'),
  'host', 'published', 3, now()
),
-- ─── Branding (logo) ─────────────────────────────────────────────────
(
  'branding-your-documents',
  'Branding your documents with your logo',
  'Add your business logo once and it appears, perfectly sized, on every quote, invoice and credit note PDF and public page.',
  $html$
<p>Your quotes, invoices and credit notes are guest-facing documents — so they carry <strong>your</strong> brand, not just Vilo's.</p>

<h3>Add your logo</h3>
<ol>
  <li>Go to <strong>Settings &rarr; Business &amp; banking</strong>.</li>
  <li>In the business details card, use the <strong>Logo</strong> uploader to pick an image (JPEG, PNG or WebP).</li>
  <li>Vilo automatically resizes it in your browser before uploading, so even a large file lands quickly and renders crisply.</li>
</ol>
<p>A transparent PNG looks best, but any image works. You can replace or remove the logo at any time.</p>

<h3>Where it shows up</h3>
<ul>
  <li>The header of every <strong>quote, invoice and credit note PDF</strong>.</li>
  <li>The public, shareable pages for those documents.</li>
</ul>
<p>If you haven't uploaded a logo yet, documents fall back to a clean lettered mark with your business name, so they always look finished.</p>

<h3>Good to know</h3>
<ul>
  <li>Your business name, contact details and banking info (for EFT) come from the same <strong>Business &amp; banking</strong> settings and appear alongside the logo.</li>
  <li>Invoices and credit notes freeze your details at the moment they're issued, so historical documents stay accurate even if you rebrand later.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'payments'),
  'host', 'published', 2, now()
)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id,
      audience = EXCLUDED.audience,
      status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes,
      updated_at = now();
