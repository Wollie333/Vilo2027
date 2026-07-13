# Wielo — MVP readiness & deep-audit backlog

> **Save point: 2026-07-13.** A founder-facing map of (1) what is **shipped and
> MVP-ready for beta testers**, and (2) the **deep in-depth audits still owed** on
> the remaining features. "MVP-ready" here means: built, `build`/`lint` green,
> and **verified working live** (real evidence — not "should work"). Anything not
> in the ready list needs the same treatment as the financial sweep before we
> hand it to beta testers.
>
> Start a new session from this file. Test host `host@wielotest.com`
> (host_id `0b111111-…111`), super_admin `wollie@manamarketing.co.za`. DB truth
> via `scratchpad/sbenv.sh`. Login-for-verify = service-role magic link →
> LOCAL `/auth/confirm` (see memory).

---

## ⚡ Quick tasks — start the next session here (founder, 2026-07-13)

Small, well-scoped fixes to knock out first before the big audits:

1. **Refund entry missing on the payment record timeline** — when a refund is
   accepted OR declined, the refund event does **not** appear in the transaction
   timeline on the **payment record** (`/dashboard/payments/[id]`). Add it so the
   payment record shows the full, accurate history (charge → payment → refund
   requested → approved/declined → completed).
2. **Show the transaction reference** in the payment record's transaction details
   (the `provider_reference` / EFT ref / Paystack-PayPal txn id we now capture).
3. **"Authorised by" field** on the payment record — who recorded / authorised the
   payment (and, for refunds, who approved/declined) — `recorded_by` /
   `actioned_by` → resolve to a name.
4. **Payment-record status indicator** — a clear UI badge showing the payment is
   **done/settled** vs **still open/pending** (and refunded/partially-refunded).
5. **Booking "closed & handled" indicator** — a UI state on the booking showing it
   is fully closed and handled (completed / cancelled-settled / forfeited /
   fully-refunded), so a host can see at a glance that nothing is outstanding.

_(Done 2026-07-13: channel value `vilo`→`wielo` (migration `20260713100000`) for
source accuracy; email footer URL → wielo.co.za.)_

---

## ✅ Shipped & MVP-ready (verified live)

### Money & finance (deeply audited this cycle)
- **Booking payments** — Paystack (card) · Manual EFT · PayPal, signed webhook,
  deposit/balance split, pending→completed reconciliation, per-payment receipts.
  Provider transaction IDs recorded (incl. EFT "Mark received") + displayed.
- **Ledger** — one transaction model (`fetchHostTransactions`); host `/dashboard/ledger`,
  per-guest Finances, per-booking Payments all agree. Running balances re-derived.
- **VAT** — net→VAT→gross on VAT-registered listings; guest sees inclusive; invoices
  split; statements sum real VAT. Re-derived (15/15).
- **Documents** — INV/RPT/REF/CN/Q/BK/FRF, one global sequence per type (host+Wielo
  share), no dup numbers; hosted pages + PDFs (locale-prefixed).
- **Refunds & credit notes** — policy-% of amount PAID (G5), refund reconciled to
  actual cash moved, no double-count.
- **Cancellation accounting** — SARS-correct credit-note reversal, host refund
  override in the cancel dialog, retained = revenue, outstanding written off.
- **Forfeiture (no-show)** — retained-as-revenue, FRF statement, on the same engine.
- **Statements** — host→guest & Wielo→host bank-style, ephemeral signed link, PDF.
- **Commission-saved** (vs OTA), **admin Payments/Ledger** (Wielo revenue).
- Repeatable probe: `apps/web/scripts/verify-financial-sweep.mjs`.
- Lifecycle doc: `docs/lifecycles/payments-ledger.md`.

### Booking lifecycle
- Guest checkout (card/EFT/PayPal), host booking board, accept/decline/cancel/
  no-show/check-in/out, calendar block, policy snapshot frozen at booking, guest
  + host notifications, check-in reminder, access card + stay-details email.
- Onboarding wizard (8 steps incl. seasons) + seasonal pricing through the booking
  engine. Docs `docs/lifecycles/onboarding.md`, `pricing-seasonal.md`, `booking.md`.

### Guest portal
- Trips list + trip detail with live money ledger, policies-as-booked, pay-now CTA,
  receipts, inbox (guest↔host + guest↔Wielo support), reviews.

### Admin
- 20 admin tabs verified (users incl. deleted/restore/purge, listings, moderation,
  flagged content, payments, ledger/revenue, subscriptions, settings, audit log,
  notifications, data requests). `ADMIN_MVP_CHECKLIST.md`.

### Moderation & support
- **Report listings, deals & users** — one modal, categorised admin triage.
- **Help/support** buttons → the user's **Wielo Support** inbox thread (`/support`).

### Platform / brand
- Wielo primary logo across app + emails; header slogan removed; brand renders
  "Wielo" everywhere user-facing (UI/emails/PDF/metadata).
- Affiliate system (commissions, clawback, ledger, statements, tiers).
- Wielo commerce model (products, multi-sub, auto-ledger, buyer txn history).
- Signup hardening (Turnstile, HIBP, rate-limit, email verify).
- Calendar/iCal sync (both directions, per-room, SA presets) — live in prod.

---

## 🟡 Built — but owed a DEEP in-depth audit before beta

Each of these EXISTS and works at a surface level, but has **not** had the
exhaustive re-derivation + live end-to-end verification the money layer just got.
Audit like the financial sweep: drive every path live (guest + host + admin),
re-derive every calc, confirm every notification/email/ledger side-effect, cover
the edge/branch cases, fix what's wrong, and record a `docs/lifecycles/<feature>.md`.

1. **Quotes** (guest + host) — request → build → send → accept → convert to booking;
   pricing (seasonal/VAT/add-ons/coupons), doc numbering (Q-####), expiry, PDF,
   notifications, and the guest sign-in-to-quote path.
2. **Looking-for** — public post → host quote → guest accept; `fulfilled_via`
   accounting, notifications, the intent-survives-login path.
3. **Coupons** — creation, validity windows, per-code/per-guest limits, stacking
   with seasonal/specials/add-ons, server-side re-price, ledger + invoice lines.
4. **Specials (deals)** — create → publish → public `/deal/[slug]` → book; date
   modes, price modes, quantity/redemption caps, savings math, categories,
   go-live/book-by windows, VAT.
5. **Add-ons** — quote add-ons vs post-booking add-ons, per-listing/room scoping,
   pricing + VAT, invoicing (no double charge — fixed this cycle, but audit the
   full matrix), refundability decision (G7 still open).
6. **Media manager** — as the **single source of truth** for the host's media bank
   (listing/room photos, website assets, brand assets): upload, reuse across
   surfaces, deletion safety, storage limits per plan.
7. **Reports** — every KPI + chart re-derived (revenue, occupancy, channel mix,
   savings, cash position, property performance, CSV/PDF exports).
8. **Product feature gating** — `check_feature_permission` at UI **and** edge/server
   layers for every gated feature × plan; confirm the pre-MVP short-circuit
   (`AGENT_RULES §3.4`) is the only thing opening features, and map what each plan
   really unlocks before pricing goes live.

**Also owed (full guest/host/admin sweep):** website builder/CMS + published
render parity (Principle #9), reviews chain (delay 5→60 min still pending),
notifications/push matrix, subscriptions lifecycle (upgrade/pause/cancel/proration),
inbox (all channels), search, host settings (banking/business/VAT), data
requests/GDPR purge.

---

## 🔴 Open decisions / known gaps (founder call)

- **Paid-cancellation accounting** is DONE (credit-note engine). But confirm the
  founder is happy with: retained = revenue, outstanding written off, refund via
  the dialog override. (Legacy fixture BK-0038 predates the engine — prune at wipe.)
- **Add-on refundability (G7)** — flag add-ons refundable vs not; per-line refund.
- **Legal text freeze (G8/G9)** — freeze accepted T&C *text*, split host-legal vs
  Wielo-terms acknowledgements at checkout.
- **Paystack/PayPal sandbox E2E** — the test host has no gateway keys, so the card
  rail (`/pay` deposit toggle, webhook) is unproven end-to-end. Provide test keys.
- **Pre-launch data wipe** — prune MVP-* / fixture bookings, duplicate active
  subscription row, stale refund artifacts.
- **Ops config before production** — VAT number, SWIFT, `PAYMENT_CIPHER_KEY`,
  Turnstile keys, Vault worker URLs/secrets, email-worker cron, redeploy
  paystack-webhook.

---

## How to run an audit (the pattern that worked)

1. Map the feature end-to-end (Explore): components, server actions, DB writes,
   triggers, notifications.
2. Pull live data (`scratchpad/sbenv.sh`) and **re-derive every number**
   independently; write a `scripts/verify-<feature>.mjs` probe.
3. Drive it **live** on the preview for guest + host + admin; fix every gap.
4. Verify in BOTH the builder/canvas AND the live/published render (Principle #9).
5. Record `docs/lifecycles/<feature>.md` (Principle #12) and update this file.
