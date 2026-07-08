# Admin (Wielo) Ledger — parity with the Host Ledger

**Status:** PLANNED (not started). Save point 2026-07-08. Continue next session.

**Goal (founder ask):** Make the admin Wielo revenue ledger
(`/admin/subscriptions/revenue`) have the **same rules, styling and
functionality as the host ledger** (`/dashboard/ledger`) — including a
**downloadable document on every transaction** — but for Wielo-the-business
(money users pay Wielo: subscriptions, product purchases, refunds, credits,
manual adjustments). Not host↔guest booking money.

---

## 1. Reference — how the HOST ledger works

**Page:** `apps/web/app/[locale]/dashboard/ledger/page.tsx`
→ loads `fetchHostTransactions()` + `txnStats()` (SSOT:
`apps/web/lib/finance/transactions.ts`, model `Txn`) → renders `LedgerBoard`.

**`LedgerBoard.tsx`** (client) — the shell:
- Header: title + `PeriodControl` (closed accounting months).
- **KPIs** (`Kpi` cards): Outstanding, Collected, Refunded, Credits, Net.
- **Filter tabs** with live counts: all / charge / payment / credit / refund /
  **voided** (audit view).
- **Business** filter (server-side scope — changes running balances), **Guest**
  filter, free-text **search** (id / party / date / type / doc number).
- Renders the shared **`LedgerList`**; footer "Showing X of Y…".

**`components/finance/LedgerList.tsx`** (client, SHARED — this is the canonical
row renderer used by the ledger, guest record, booking payments tab):
- Columns: **Transaction** (note + refs), **Date** (sortable), Guest (opt),
  **Type** tag, **For** (category tag), **Amount** (signed + colour), **Balance**
  (running per-guest, opt), **Document**, actions.
- **Document column:** view (hosted page) + **download PDF** + **send link**
  (emails the doc), driven by `e.doc = { kind, number, viewPath, pdfPath }`.
- **`canManage` actions menu** (`TxnActionModal`): mark-received, refund,
  credit-note, void — booking-scoped.
- Doc/link helpers: `@/app/[locale]/dashboard/documents-actions`.

**Model `Txn`** (`lib/finance/transactions.ts`): normalises invoices / payments /
credit-notes / refunds / synthesised booking-charges into one shape with
`doc`, running `balance`, `owedEffect`, `cashEffect`, `voided`, `category`.

---

## 2. Current ADMIN ledger state (`/admin/subscriptions/revenue`)

- Loads `fetchWieloLedger()` + `wieloLedgerStats()` (SSOT:
  `lib/billing/wielo-ledger.ts`, model **`WieloTxn`** — reads `platform_ledger`).
- Already has (added this session): env default = platform Paystack mode + a
  Live/Test/All selector + Test badge; product-name resolution (plan tier →
  product, e.g. "Starter"); MRR/ARR/Collected/Refunded/Net/Paying-hosts KPIs;
  a `ManualEntryForm` (goodwill credit / write-off / adjustment, audited);
  plan/user/status/type filters.
- Rendering is a **bespoke `<ul>` list** (NOT the shared LedgerList styling), and
  **no per-transaction document/download**.

**`WieloTxn` fields:** id, date, type (charge|refund|credit|adjustment), status,
amount (signed), currency, environment, vatAmount, plan, billingCycle, provider,
providerReference, reason, userId, userName, userEmail, hostId, hostHandle.
No `doc`, no running `balance`.

**Wielo documents that exist:** `wielo_invoices` only → `/wielo-invoice/[token]`
(hosted) + `/wielo-invoice/[token]/pdf`. Linked to a ledger row via
`wielo_invoices.ledger_id`. The invoice mint trigger auto-creates one on a
charge insert. **No** Wielo receipt / credit-note / refund PDF exists yet.
`accounting_periods` is **host-scoped only** (`host_id NOT NULL`) — there is no
Wielo-level period concept.

---

## 3. Gaps to close for parity

1. **Styling/rows:** replace the bespoke list with the LedgerList look
   (Transaction / Date / Type / For / Amount / **Balance** / **Document** / menu).
2. **Downloadable document per transaction** (the headline ask):
   - Charges → link the `wielo_invoices` row (by `ledger_id`) → view + download
     PDF (`/wielo-invoice/<token>/pdf`) + copy/send link.
   - Refunds / credits / adjustments → no doc today (decision below).
3. **Running balance** per user (a Wielo "account balance": what the user owes
   Wielo / their credit), analogous to the per-guest balance.
4. **Filter tabs** with counts (all/charge/refund/credit/adjustment) matching the
   host tab styling, keeping the env selector.
5. **Period control** — host uses closed accounting months; Wielo has none.
   Decide: date-range filter, or a Wielo-level periods table (out of scope v1).
6. **canManage actions** — Wielo equivalents: refund a charge, issue a
   credit/adjustment (ManualEntryForm already covers manual credit/adjustment;
   a per-row "refund"/"void" action would match the host menu).

---

## 4. Recommended architecture

**Option A (recommended): generalise `LedgerList` to a document-agnostic row
model.** Extract a minimal `LedgerRow` interface (title, sub, date, typeTag,
categoryTag, amount, balance?, doc?, meta[]) that BOTH `Txn` and `WieloTxn` can
adapt to. Feed the admin ledger via a `wieloTxnToRow()` adapter. Pros: one
canonical renderer, true visual parity, future ledgers reuse it. Cons: careful
refactor so the host ledger is byte-for-byte unchanged (guard with the existing
host-ledger behaviour + a visual diff).

**Option B (faster, more duplication): new `AdminLedgerList` + `AdminLedgerBoard`**
mirroring the host components but typed to `WieloTxn`. Pros: zero risk to the host
ledger. Cons: two components to keep in sync.

→ **Lean Option A** for a true "same functionality" result; fall back to B if the
host `Txn` coupling (bookingId/guest/TxnActionModal) proves too entangled.

---

## 5. Data-model work (`lib/billing/wielo-ledger.ts`)

- Extend `fetchWieloLedger` to resolve each row's **document**: left-join
  `wielo_invoices` (by `ledger_id`) → `{ kind:'invoice', number:invoice_number,
  viewPath:'/wielo-invoice/<token>', pdfPath:'/wielo-invoice/<token>/pdf' }`.
  Add `doc: WieloDoc | null` to `WieloTxn`.
- Add **running balance** per `userId` (oldest→newest, charge +, payment/credit −)
  in `fetchWieloLedger`, mirroring `fetchHostTransactions`'s balance pass. Decide
  the sign convention (Wielo is the creditor).
- Product-name + plan-tier already resolved on the page; consider moving that
  into the model so all ledger consumers (Payments, host Transactions) share it.

---

## 6. Downloadable documents

- **v1:** charges show the linked invoice (view + PDF + copy-link). This already
  works end-to-end (`/wielo-invoice/[token]/pdf` verified). Reuse the host's
  `documents-actions` copy/send pattern where possible.
- **Refunds / credits / adjustments:** no PDF today. **Decision needed** — either
  (a) show "—" for now, or (b) generate Wielo **credit-note / refund** PDFs
  (new hosted routes + PDF docs, mirroring the host's CreditNoteDocument). (b) is
  a follow-on phase.
- **Optional:** a **CSV export** of the filtered ledger (host ledger doesn't have
  one, but useful for Wielo accounting) — nice-to-have.

---

## 7. Task breakdown (next session)

1. **Model:** add `doc` (invoice join) + running per-user `balance` to
   `WieloTxn`/`fetchWieloLedger`; unit-sanity vs current KPIs.
2. **Renderer:** implement Option A adapter (or `AdminLedgerList`) so admin rows
   use the LedgerList styling incl. the **Document** column (view/download/send).
3. **Board:** rework `revenue/page.tsx` (or a new `AdminLedgerBoard`) to the
   host-style shell — KPI cards, filter tabs w/ counts, keep env selector +
   user/plan filters + search; add per-user balance column.
4. **Docs:** wire invoice download per charge; decide refund/credit doc handling.
5. **Manage actions (optional, parity):** per-row refund/void via an admin action
   (audited) — or defer, since ManualEntryForm covers manual credit/adjustment.
6. **Verify live** (founder's MFA account — the test host is finance-gated):
   ledger renders with test data, each charge downloads its invoice, balances +
   KPIs correct, env toggle works, styling matches the host ledger.

## 8. Decisions to confirm with founder

- Refund/credit/adjustment documents: skip (show "—") for v1, or build Wielo
  credit-note/refund PDFs now?
- Running balance: per-user Wielo account balance — confirm that's the intended
  "balance", or prefer a simple cumulative net column?
- CSV export: wanted?
- Period control: date-range filter for v1 (no Wielo month-close), OK?

## 9. Gotchas / notes

- Finance admin pages (`payments.view` / `subscriptions.edit`) sit behind a gate;
  the test host `host@wielotest.com` gets bounced to /dashboard — **verify with
  the real super_admin account** (founder confirmed theirs opens).
- HMR does NOT reliably recompile server components/actions — `rm -rf
  apps/web/.next` + restart when a change doesn't show.
- Keep the host ledger untouched/visually identical if generalising LedgerList.
- Env default already follows `platform_payment_settings.paystack_mode`.
- Test data currently present: 2 test Starter charges (R599) + 2 test invoices.
