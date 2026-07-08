# Admin Ledger · Support Inbox · Payments · Affiliate — build plan

**Status:** PLANNED. Save point 2026-07-08. Start a FRESH session from this file.

This captures everything the founder asked for after the support-inbox + nav work
landed (commits up to `bfef102b`). Several items were partly explored live this
session; nothing in this file is built yet unless noted "DONE (context)".

---

## 0. Where we are (already shipped — context, do NOT rebuild)

- **Admin Wielo ledger** (`/admin/subscriptions/revenue`) = host-ledger parity:
  `AdminLedgerBoard` + `AdminLedgerList` (`components/finance/AdminLedgerList.tsx`),
  running per-user balance, KPI cards, type tabs, env/user/product/status/date
  filters, CSV, product-driven filter. Model: `lib/billing/wielo-ledger.ts`
  (`WieloTxn` w/ `doc` + `balance`).
- **Unified doc numbering** (migration `20260708140000`): `INV-/RPT-/REF-/CN-/Q-/BK-`,
  global sequences; Wielo docs share host sequences. Wielo credit notes/refunds/
  adjustments minted by `trg_mint_wielo_credit_note` (migration `20260708130000`),
  hosted at `/wielo-credit-note/[token]` (+ `/pdf`); charges → `wielo_invoices`
  (`/wielo-invoice/[token]`).
- **Finance action toolbar** on the ledger (`WieloFinanceModals`): Record payment /
  Issue refund / Credit note / Adjustment / Send payment link. Ledger actions call
  the audited `recordManualLedgerEntryAction`; pay-link uses
  `createWieloPaymentLinkAction` → `createProductOrder` (`lib/billing/product-checkout.ts`).
- **Host↔Wielo support inbox** (migration `20260708150000`): reuses `conversations`/
  `messages` via `channel='platform'`; a fixed "Wielo Support" `user_profiles`
  account is the counterparty. `lib/inbox/platform-thread.ts` owns
  `ensureWieloSupportUser` / `ensureWieloThread` (pinned, seeded welcome, created on
  host inbox load) / `adminPostToHostThread` / `resolveHostByEmail`. Host sees it in
  `/dashboard/inbox`; admin at `/admin/inbox` (`AdminInboxView`, full-bleed, Details
  drawer with host account snapshot). Ledger "Send payment link → to host's inbox"
  via `adminSendPlatformMessageByEmailAction`.
- **Nav cleanup**: admin Inbox under Users; Help & docs + Staff hidden site-wide;
  pay-link builds a real public URL (`NEXT_PUBLIC_APP_URL` / brand domain, never
  localhost); admin inbox Details shows the real product name + net paid to Wielo.

---

## 1. Guest portal: rename "Messages" → "Inbox", move under Overview

- `apps/web/app/[locale]/portal/_components/PortalSidebar.tsx` `MAIN`: the
  `/portal/inbox` item exists but is labelled "Messages" (4th). **Rename to
  "Inbox" and move to position 2 (directly under Overview).** Small, self-contained.
- (The guest portal inbox route already exists + is full-bleed; guests don't get a
  Wielo platform thread — that's host-only. This task is nav only.)

## 2. Payment link in the inbox = a rich `payment_link` system CARD (not plain text)

- `components/inbox/ChatMessageWall.tsx` ALREADY renders a pay card for
  `m.isSystem && m.systemEvent === 'payment_link'` (title + body + a button using
  `m.attachmentUrl`). Currently the admin sends the link as a **plain text** body via
  `adminSendPlatformMessageByEmailAction`.
- **Do:** add a dedicated action (e.g. `adminSendPaymentLinkToInboxAction({ email,
  url, productName, amount, currency })`) that inserts a message with
  `is_system_message=true, system_event='payment_link', attachment_url=url,
  body="<Product> — <amount> due"`, posted AS the Wielo Support account (mirror
  `adminPostToHostThread` but system-flagged). Wire `WieloFinanceModals`
  "Send to host's inbox" to it (pass the product name + amount it already has).
- **Refine card wording for the Wielo→host direction.** The card text is tuned for
  host↔guest ("Payment link sent" for `viewer==='host'`). In the Wielo thread the
  HOST is the payer, so for a platform thread show "Payment request from Wielo" +
  a "Pay now" button regardless of viewer. Either branch on a new prop or on the
  thread channel. Keep host↔guest rendering byte-identical.
- Make it look neat/professional (icon, product line, amount, single primary Pay
  button) — same visual weight as the host→guest pay card.

## 3. Beautiful standalone product pay page (`/pay/product/[token]`)

- Current page is bare. **Mirror the guest pay page** `app/[locale]/pay/[token]/page.tsx`
  (brand header "Wielo · Secure payment", a summary card, "Amount due", a pay panel,
  a paid/receipt state) — but for a Wielo PRODUCT order instead of a booking.
  - Header: `{brandName} · Secure payment`; H1 "Pay for {product_name}".
  - Summary card: product name, buyer email, amount, order reference; Wielo issuer
    identity (from `getWieloBusinessProfile` / `wielo_business` settings) as "Billed
    by Wielo".
  - Amount-due block + `PayButton` (Paystack) + EFT block (existing
    `platform_payment_settings` EFT fields, already wired in the current page).
  - Paid state: reuse/keep the existing rich `Receipt` component (already shows the
    Wielo invoice) OR align it to the guest paid state.
- Keep the settle-on-return logic (`confirmProductOrderByReference`) intact.
- Reuse `formatMoney`, brand helpers, and the same Tailwind vocabulary as the guest
  page so they feel like one product.

## 4. Ledger pay-link picker must include ALL sellable admin products

- **Bug:** the picker uses `getSubscriptionProducts()` (`lib/products/getProducts.ts`)
  which filters `type='subscription' AND is_active AND is_visible`. The founder's new
  product **"Wielo StayFlow Web-design"** is `type='one_off'`, `is_visible=false` →
  excluded, so it can't be sent.
- **Do:** add `getSellableProducts()` in `getProducts.ts` — `is_active=true`, ANY
  `type` (subscription + one_off), IGNORE `is_visible` (visibility gates the PUBLIC
  pricing page, not internal admin selling). Return id/name/price/currency/type.
- Use it for the **payment-link picker** (`revenue/page.tsx` → `payableProducts`).
  Group or label by type if helpful (e.g. "Subscriptions" vs "One-off"). Keep the
  ledger's TYPE filter (`productFilters`) as-is (that's for filtering rows by plan).
- Result: admin creates any product in `/admin/products` → it's immediately
  selectable to send as a pay link.

## 5. Payment recording parity with the HOST ledger (manual · Paystack · PayPal)

- Founder: "the same payment recording in the host ledger should apply for manual,
  Paystack or PayPal" on the Wielo ledger.
- Today: Wielo charges settle via Paystack (`startProductPaystack` seeds a pending
  `platform_ledger` row keyed by `provider_reference`; `confirmProductOrderByReference`
  + the `paystack-webhook` `processProductEvent` flip it to completed → invoice minted).
  Manual entries via `recordManualLedgerEntryAction`. **PayPal is NOT wired for Wielo
  product orders.**
- **Do:**
  1. **PayPal on the product pay page** — add a PayPal option (mirror the host
     booking PayPal on `/pay/[token]` + `lib/payments/pay-booking.ts` capture flow,
     but with Wielo's platform PayPal creds). On capture → complete the pending
     `platform_ledger` charge (same reference anchor) → invoice mints automatically.
  2. **Method on the ledger row** — ensure `platform_ledger.provider` reflects
     manual/paystack/paypal/eft and the ledger + documents render the method (the
     host ledger shows a method; `AdminLedgerList` should too).
  3. Confirm the EFT path (order marked paid by admin) also completes the ledger row
     + mints the invoice.
- Net: whichever way money arrives (manual, Paystack, PayPal, EFT), the ledger row +
  financial doc + running balance update automatically and identically — exactly like
  the host booking ledger.

## 6. Payment automation must be end-to-end automatic (Paystack + manual)

- Founder: "the system must SEE when the user actually pays via Paystack, and the
  ledger + financial documents happen automatically, and the balance-due calculations
  work automatically; the same when an admin applies an amount manually."
- Mostly already true (webhook + confirm + mint trigger; manual entry mints too).
  **Verify + harden:**
  - The `paystack-webhook` is deployed and `platform_payment_settings.paystack_mode`
    (test/live) matches the key used to init — so a real payment is detected.
  - `product_orders.status` → `paid`, `platform_ledger` charge → `completed`,
    `wielo_invoices` minted, and the Wielo ledger balance flips pending→settled — all
    with NO manual step. Test end-to-end with the Paystack TEST key.
  - "Balance due" surfaces (pending charge shows "due" on the ledger + ideally on the
    pay page/host account). Confirm the running-balance semantics in
    `wielo-ledger.ts` (`owedContribution`) are correct for a pending product charge.

## 7. Affiliate system → records on the SAME Wielo ledger

- Founder: "we have an affiliate system… this should also be a record in the ledger
  when money is OWED to the user AND when the commission was PAID OUT. All on the same
  ledger."
- **Schema (exists):** `affiliate_accounts`, `affiliate_commissions`
  (`affiliate_id, referred_host_id, product_id, source_ledger_id, entry_type, kind,
  commission_amount, currency, status, billing_period, hold_until, cleared_at,
  voided_at, refund_ledger_id, payout_id, paid_at`), `affiliate_payouts`,
  `affiliate_referrals`, `affiliate_settings`, `affiliate_payout_methods/_fees`.
  `accrue_affiliate_commission(p_ledger_id)` already links a commission to a Wielo
  charge (`source_ledger_id`).
- **Goal:** the Wielo revenue ledger should ALSO show the affiliate money flow, per
  user:
  - **Commission accrued (owed)** — when a referred host pays Wielo, the referrer is
    OWED a commission (a liability). Show it as a ledger entry against the AFFILIATE's
    account (a negative/`credit`-style "Affiliate commission owed", with a doc/ref).
  - **Commission paid out** — when a payout clears (`affiliate_payouts`), show the
    payout as a ledger entry (money out to the affiliate).
- **Design decision to confirm with founder:** the current `platform_ledger` models
  money **user→Wielo** (charges/refunds/credits/adjustments). Affiliate money is
  **Wielo→user** (a liability + a payout). Options:
  - (a) **Adapter/union model** — keep `platform_ledger` as-is and have
    `fetchWieloLedger` UNION in affiliate rows (from `affiliate_commissions` +
    `affiliate_payouts`) as new `WieloTxn` types (`commission` / `payout`), each with
    its own doc + sign, so they appear on the same ledger without polluting the
    revenue tables. (Recommended — least destructive, keeps affiliate SSOT intact.)
  - (b) Post real `platform_ledger` rows for commissions/payouts (a new `type`) —
    simpler rendering, but duplicates the affiliate ledger + risks double-counting in
    revenue KPIs.
  - → Lean (a). Add `WieloTxn` types `commission_owed` (−, liability) + `commission_paid`
    (payout out), adapt from the affiliate tables, exclude from the revenue KPIs
    (MRR/collected/net) but show in a dedicated "Affiliate" tab/section + per-user
    balance ("Wielo owes this affiliate R X").
- Documents: a commission statement / remittance advice PDF is a nice-to-have
  (mirror the credit-note doc pattern); confirm scope with founder.

---

## 8. Suggested build order (fresh session)

1. **#1 portal Inbox nav** (trivial) + **#4 sellable-products picker** (small, unblocks
   the founder's immediate "can't select my product").
2. **#2 pay-link inbox card** (rich `payment_link` system message + wording).
3. **#3 product pay page redesign** (mirror guest pay page) — the professional landing.
4. **#5 PayPal parity + method-on-row** for Wielo product orders.
5. **#6 verify Paystack/manual automation** end-to-end (test key) — likely mostly
   confirmation + small hardening.
6. **#7 affiliate-on-the-ledger** (biggest; confirm the adapter model + doc scope with
   founder first).

Each slice: tsc + lint + `pnpm build` green; verify live BOTH host + admin (temp
super_admin grant on `platform_staff`, then revoke — sole real super_admin =
`wollie@manamarketing.co.za`); commit + push to main.

## 9. Gotchas / notes (from this session)

- **Finance/admin pages are gated** (`requirePermission`). To verify locally, temp-add
  a `platform_staff` super_admin row for `host@wielotest.com` (user
  `1899ee6c-463a-4910-a733-aa598a7b1fc1`), screenshot, then DELETE it.
- **Restart the dev/preview server after editing server actions** (HMR won't recompile
  them) — the pay-link URL fix only took effect after a restart.
- **Next dev fetch-cache** (`.next/cache/fetch-cache`) can serve stale reads for
  `force-dynamic` pages across restarts — `rm -rf apps/web/.next/cache/fetch-cache` if
  a value looks stale. Prod renders fresh.
- **Run prod SQL** via `supabase db query --linked` (cached creds; no service-role key
  in `.env.local`). Apply migrations with `supabase db push --linked`; regen types
  with `supabase gen types typescript --linked > packages/types/database.types.ts`
  (stdout only, never `2>&1`).
- **Payment-link domain**: local fallback is `https://wielo.co.za` (codebase
  convention); prod uses `NEXT_PUBLIC_APP_URL`. Confirm the real prod domain with the
  founder if it differs.
- Products live: **Starter** (sub, pro, R599, visible), **Beta** (sub, business, R0,
  visible), **Wielo StayFlow Web-design** (one_off, R5999, NOT visible ← the one that
  couldn't be picked).
- See memory: [[reference-platform-support-inbox]], [[reference-doc-numbering-scheme]],
  [[project-admin-ledger-parity]], [[reference-admin-state-and-products-cache]].
