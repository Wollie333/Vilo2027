-- Migration: Help Centre article — "Refund payout methods & credit notes"
-- (RULES.md §9). Covers choosing how a refund is paid out and what credit
-- notes are / how they're created. Categorised under Payments. Idempotent.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'refund-methods-and-credit-notes',
  'Refund payout methods & credit notes',
  'Choose how a refund is paid out — Paystack, PayPal, EFT or manual — and understand the credit note that records it.',
  $html$
<p>When you process a refund, Vilo lets you choose <strong>how</strong> the money goes back to the guest, and records every refund as a credit note against the original invoice.</p>

<h3>Choosing the payout method</h3>
<p>On both the <strong>Refunds</strong> queue (when you approve a guest request) and the <strong>Issue refund</strong> panel on a booking, you'll pick one of:</p>
<ul>
  <li><strong>Paystack (card)</strong> — refunded automatically to the card the guest paid with, via the provider.</li>
  <li><strong>PayPal</strong> — refunded automatically through PayPal.</li>
  <li><strong>EFT / bank transfer</strong> — you send the money yourself by bank transfer; Vilo marks it as paid and notifies the guest.</li>
  <li><strong>Manual / other</strong> — cash or any other arrangement you settle outside the platform.</li>
</ul>
<p>The method defaults to however the guest originally paid, which is usually what you want — a refund normally goes back the way it came. EFT and Manual are flagged as host-sent in the audit trail; Paystack and PayPal are provider transactions.</p>

<h3>Credit notes</h3>
<p>A <strong>credit note</strong> is a document that records money credited back to a guest against an invoice. You'll find them under <strong>Finances → Credit Notes</strong>.</p>
<ul>
  <li><strong>Automatic</strong> — the moment a refund completes, a credit note is created for the refunded amount, linked to that booking's invoice.</li>
  <li><strong>Manual</strong> — open any invoice and click <strong>Create credit note</strong> to credit an amount with your own reason (e.g. a goodwill gesture), without processing a card refund.</li>
</ul>
<p>Each credit note carries its own number ({handle}-CNYYYY-NNNN), a frozen snapshot of the host and guest details, and the credited line items. You can cancel a credit note if it was raised in error.</p>

<h3>Good to know</h3>
<ul>
  <li>Provider (Paystack / PayPal) refund automation is finalised at launch; the chosen method is always recorded so the audit trail and the guest's notification are correct.</li>
  <li>A credit note never exceeds the invoice total.</li>
  <li>Credit notes appear on the related invoice page as well as in the Credit Notes list.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'payments'),
  'host',
  'published',
  4,
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
