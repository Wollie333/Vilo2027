-- Migration: note the bank-account requirement + EFT payment fallback in the
-- payment-gateways Help article (RULES.md §9). Idempotent; appends once.

UPDATE help_articles SET
  body_html = body_html || $html$
<h3>EFT is your safety net</h3>
<p>Your EFT bank account isn&rsquo;t optional — it&rsquo;s the foundation everything
else falls back to:</p>
<ul>
  <li><strong>You can&rsquo;t publish a listing without a default bank account.</strong>
  Add one under Bank accounts first; until then, &ldquo;Go live&rdquo; stays blocked.</li>
  <li><strong>If a card payment can&rsquo;t go through</strong> — Paystack or PayPal is
  down or misconfigured — the booking automatically falls back to <strong>EFT</strong>
  rather than failing. The guest gets your bank details and reference, and the
  booking waits for you to confirm the transfer. You never lose the booking.</li>
</ul>
$html$,
  updated_at = now()
WHERE slug = 'connect-payment-gateways'
  AND body_html NOT LIKE '%EFT is your safety net%';
