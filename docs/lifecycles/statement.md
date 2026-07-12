# Statement of account — lifecycle flow

> A bank-style running statement between two parties over a period. It is a pure
> VIEW over an existing ledger — it mints NO document number and stores NO row;
> the shareable link carries a signed payload describing which slice to render,
> and the page re-derives every figure live. Two flavours share one engine:
> **host → guest** and **Wielo → host**. Steps marked ✅ were driven end-to-end
> on the live preview + cloud DB this pass.

Core: `lib/finance/statement.ts` (`loadStatement`), `lib/finance/statement-token.ts`
(sign/verify), `lib/pdf/StatementDocument.tsx` (+ `renderStatementPdf`), the hosted
page `app/[locale]/statement/[token]/{page.tsx,pdf/route.ts}`, and the shared
`components/finance/StatementDialog.tsx`.

---

### Why a statement (financial reasoning)
Invoices/receipts/credit-notes each document ONE event; a statement documents the
**relationship over time**: opening balance brought forward → each charge (+) and
payment/credit (−) → closing balance carried forward. Its job is reconciliation,
a running cash/AR position, and a single audit/dispute document. It must never
create a charge — it only re-presents ledger rows. Amounts are shown gross with a
VAT summary (the conventional treatment); it is explicitly "a summary, not a tax
invoice".

### Step 1 — Generate ✅
- **Host → guest:** Guest record → Finances tab → **Statement** (`GuestRecord.tsx`
  `FinancesPanel`). **Wielo → host:** admin user record → Finance/Ledger panel →
  **Statement** (`UserRecord.tsx` `LedgerPanel`). Both open the shared
  `StatementDialog` (period presets: All activity / This month / Last 3 months /
  This year / Custom range).
- The build action signs an ephemeral token (`signStatementToken`) — payload
  `{ctx, hostId, gkey|userId, from, to, issuedAt, currency}` + HMAC-SHA256
  (secret = `SUPABASE_SERVICE_ROLE_KEY`). No `next_*_number` RPC is called, so the
  global INV/RPT/… sequence is untouched. Reference is display-only:
  `STMT-<short>-<YYYYMMDD>`.
- Verified: host→guest for guest `Beta Karoo Guest`, and Wielo→host for the
  founder account, both from the live UI dialog.

### Step 2 — Derive from the ledger ✅
- **Host → guest** (`buildHostGuestStatement`) reads `fetchHostTransactions({hostId,
  gkey})`. That ledger already models payments as their own rows, so each txn is one
  signed movement `owedEffect * amount` and the running balance follows directly.
  Opening = Σ movements before the period start; closing = last in-period balance.
- **Wielo → host** (`buildWieloHostStatement`) reads `fetchWieloLedger({userId})`,
  excluding affiliate rows. The platform ledger is AR-style (a completed charge is
  billed AND settled in one row), so a paid charge is emitted as a debit **and** an
  offsetting "Payment received" credit — every movement is visible and
  `balance = opening + Σ(charge − payment)` still equals the ledger's authoritative
  outstanding. A refund is a memo pair (net 0). VAT summed from `vat_amount`.
- Verified: host→guest reconciled with the guest's ledger list; Wielo→host showed
  the paid subscription netting to R0 and unpaid product charges accumulating to the
  ledger's outstanding balance.

### Step 3 — View / download ✅
- Hosted page `/statement/<token>` verifies the token, calls `loadStatement`, and
  renders the shared `FinancialDocument` (opening "brought forward" line, one signed
  movement per row with the running balance, Total charges / Total payments &
  credits, closing "Balance due/carried forward", VAT summary).
- `/statement/<token>/pdf` renders `StatementDocument` via `@react-pdf/renderer`
  (classic Date · Description · Amount · Balance table). Note: react-pdf's Helvetica
  has no U+2212 minus glyph — signed amounts use an ASCII hyphen.
- Verified: both page (screenshot) and PDF (rendered) for both flavours.

### Step 4 — Send (optional) ✅ wired
- **Host → guest:** `sendGuestStatementAction` emails the guest the link
  (`sendTransactionalEmail`) and best-effort posts it into the host↔guest thread when
  one exists.
- **Wielo → host:** the dialog reuses the existing audited `sendWieloDocToInbox` +
  `emailWieloDoc` with the minted link.

---

## Notes / edges
- Ephemeral by design: no expiry (a statement link is meant to be kept; it exposes
  only figures the recipient may already see). Past periods are immutable, so a
  shared statement stays stable. Rotating the service key invalidates all links.
- The guest dossier's "Balance due" is a narrower *open-bookings outstanding* metric
  from `fetch_guest_record`; a full-ledger statement's closing balance can legitimately
  differ from it (it includes refunds/forfeits/credits across all bookings).
