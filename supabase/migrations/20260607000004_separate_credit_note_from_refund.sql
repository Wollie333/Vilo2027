-- Migration: Separate credit notes from refunds (standard bookkeeping).
--
-- A refund and a credit note are DISTINCT accounting events:
--   • a refund returns actual cash to the guest (money leaves the bank);
--   • a credit note reduces/cancels an invoice and grants store credit
--     (no cash moves).
-- A guest normally gets ONE or the other, never both for the same amount.
--
-- The old design auto-issued a credit note ('refund_auto') whenever a refund
-- completed, which double-represented the event (a Refund row AND a Credit
-- note row for the same money on the same booking). This drops that automation
-- so a refund is just a refund; credit notes are only ever created
-- deliberately by the host (origin='manual'). Pre-MVP: safe to wipe the
-- auto-created rows.

-- ─── 1. Drop the auto-create-on-refund trigger + function ──────────────
DROP TRIGGER IF EXISTS trigger_refund_completed_credit_note ON refund_requests;
DROP FUNCTION IF EXISTS on_refund_completed_create_credit_note();

-- ─── 2. Remove the auto-issued credit notes (test data only, pre-MVP) ──
DELETE FROM credit_notes WHERE origin = 'refund_auto';

-- ─── 3. Credit notes are host-created only from now on ─────────────────
ALTER TABLE credit_notes DROP CONSTRAINT IF EXISTS credit_notes_origin_check;
ALTER TABLE credit_notes
  ADD CONSTRAINT credit_notes_origin_check CHECK (origin IN ('manual'));
ALTER TABLE credit_notes ALTER COLUMN origin SET DEFAULT 'manual';

COMMENT ON COLUMN credit_notes.origin IS
  'Always ''manual'' — credit notes are created deliberately by the host, never auto-issued from a refund (a refund and a credit note are separate events).';

-- ─── 4. Correct the Help Centre article (refunds ≠ credit notes) ───────
UPDATE help_articles
SET
  excerpt = 'Choose how a refund is paid out — Paystack, PayPal, EFT or manual — and how a credit note differs from a refund.',
  body_html = $html$
<p>When you process a refund, Vilo lets you choose <strong>how</strong> the money goes back to the guest. A refund and a credit note are two different things — see below.</p>

<h3>Choosing the payout method</h3>
<p>On both the <strong>Refunds</strong> queue (when you approve a guest request) and the <strong>Issue refund</strong> panel on a booking, you'll pick one of:</p>
<ul>
  <li><strong>Paystack (card)</strong> — refunded automatically to the card the guest paid with, via the provider.</li>
  <li><strong>PayPal</strong> — refunded automatically through PayPal.</li>
  <li><strong>EFT / bank transfer</strong> — you send the money yourself by bank transfer; Vilo marks it as paid and notifies the guest.</li>
  <li><strong>Manual / other</strong> — cash or any other arrangement you settle outside the platform.</li>
</ul>
<p>The method defaults to however the guest originally paid, which is usually what you want — a refund normally goes back the way it came. EFT and Manual are flagged as host-sent in the audit trail; Paystack and PayPal are provider transactions.</p>

<h3>Refund vs credit note — they are not the same</h3>
<p>Standard bookkeeping keeps these separate, and so does Vilo:</p>
<ul>
  <li><strong>Refund</strong> — actual cash goes back to the guest (money leaves your account). It appears on the ledger as a <em>Refund</em>.</li>
  <li><strong>Credit note</strong> — a document that reduces an invoice and gives the guest <strong>store credit</strong> to spend later. No cash leaves your account. It appears on the ledger as a <em>Credit note</em>.</li>
</ul>
<p>You choose one or the other for a given situation — a guest should not receive both a refund and a credit note for the same amount. (If you ever see both on one booking for the same value, treat it as a red flag and check it.)</p>

<h3>Credit notes</h3>
<p>You'll find them under <strong>Finances → Credit Notes</strong>. Open a booking's <strong>Payments</strong> tab and use <strong>Issue credit note</strong> (or <strong>Credit this</strong> on a payment) to credit an amount with your own reason (e.g. a goodwill gesture), without sending cash. Each credit note carries its own number ({handle}-CNYYYY-NNNN), a frozen snapshot of the host and guest details, and the credited line items. You can cancel a credit note if it was raised in error.</p>

<h3>Good to know</h3>
<ul>
  <li>Provider (Paystack / PayPal) refund automation is finalised at launch; the chosen method is always recorded so the audit trail and the guest's notification are correct.</li>
  <li>A credit note never exceeds the invoice total.</li>
  <li>Credit notes appear on the related invoice page as well as in the Credit Notes list.</li>
</ul>
$html$,
  read_time_minutes = 4,
  updated_at = now()
WHERE slug = 'refund-methods-and-credit-notes';
