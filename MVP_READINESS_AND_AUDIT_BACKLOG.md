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

## ⚡ Quick tasks — ✅ ALL DONE (founder, 2026-07-13, verified live)

All five small fixes shipped + verified live on real data (test host BK-0027
partially-refunded, and BK-0038 cancelled + declined refund). Files:
`dashboard/payments/[id]/page.tsx`, `dashboard/bookings/[id]/BookingDetail.tsx`.

1. ✅ **Refund events on the payment record timeline** — timeline now logs
   requested → approved (by whom) → paid out, AND declined (with the decline
   reason + who declined). Refund query widened to booking-scope + extra columns.
2. ✅ **Transaction reference** — shown in Transaction details ("Reference") and
   appended to the "Funds captured" timeline line (`· ref …`) when captured.
3. ✅ **"Authorised by"** — `payments.recorded_by` and `refund_requests.actioned_by`
   resolved to names via `user_profiles`; shown in Transaction details + timeline.
4. ✅ **Payment-record status indicator** — badge is refund-aware (a captured
   payment reads Part-refunded / Refunded even though `payments.status` stays
   `completed`); `isCaptured` flag fixes the stale "isn't captured yet" copy.
5. ✅ **Booking "closed & handled" indicator** — settlement ribbon on the payment
   record + a header chip on the booking. Terminal + nothing-to-collect + no open
   refund = "Closed & handled". Cancelled/no-show/declined write off the unpaid
   remainder ("Settled · Rx retained · Ry written off"), never "owed to you".

_(Also done 2026-07-13: channel value `vilo`→`wielo` (migration `20260713100000`)
for source accuracy; email footer URL → wielo.co.za.)_

**▶ NEXT: the deep in-depth audits below (Coupons, Add-ons, Media
manager, Reports, Product gating + the guest/host/admin sweep).** Quotes, Specials
& Looking-for are ✅ audited (`docs/lifecycles/`). Coupons is a natural next pick.

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

1. ~~**Quotes** (guest + host)~~ ✅ **AUDITED 2026-07-13/14** — `docs/lifecycles/quotes.md`.
   Deep pass, all live end-to-end. **Critical fix:** `sendQuoteAction` read a non-existent
   column (`quotes.thread_id`) so EVERY send silently aborted — no quote had ever reached
   `sent`; now fixed (`conversation_id` + admin client). **Also fixed/built:** `expire-quotes`
   cron (leaked holds); quote-sent **email** to the guest (new template + event, guest verified
   receiving it); portal accept pay-token hand-off (no dead-end) + detail parity + Overview stat.
   **Enriched:** request-a-quote modal (range picker + room dropdown), inbox card (cover +
   requester's message + suggested/waiting price). Guest-side accept→pay driven live.
2. ~~**Looking-for**~~ ✅ **AUDITED 2026-07-14** — `docs/lifecycles/looking-for.md`.
   Deep pass, driven live host→guest end-to-end. Found the feature **broken at three
   hops**: host browse board (`user_profiles.display_name` — wrong column, 42703 →
   every host saw zero requests); host respond page (`properties.is_active` + a `rooms`
   relation that is `property_rooms` → every host saw "profile isn't live", could never
   quote → now uses the shared `loadQuoteFormListings`); and the quote↔post link
   (`QuoteForm` never put `lookingForPostId` in the submit payload → every sent quote
   had `looking_for_post_id=null` → no response row, no notify, no accept-loop). Also
   fixed: **missing guest email** (`looking_for_quote_received` had no `EMAIL_REGISTRY`
   entry → drained as `no_template`; now → `QuoteSentGuest`); **accept never closed the
   loop** (now sets response `accepted` + post `fulfilled`/`vilo_booking`/booking id);
   **invalid status writes** (`cancelled`/`flagged` absent from CHECK — migration
   `20260714120000`). Minor: quota `=== false` no-op, `updateQuotaAction` year-wipe,
   single-quote mark-viewed. **Open gaps (founder call):** saved-search alert matcher +
   region-digest/expiry-notify drainers are unbuilt (crons populate queues, nothing
   drains them).
3. ~~**Coupons**~~ ✅ **AUDITED 2026-07-16** — `docs/lifecycles/coupons.md`. Full-matrix
   pass: creation/validity/limits + stacking (stacks with seasonal/add-ons, NOT deals —
   intentional) + server re-price all verified. **Fixed:** invoices never itemized the
   coupon discount even though both renderers already read `line_items.discount_amount`
   (migration `20260716130000` adds `discount_amount`+`coupon_code`; verified via ROLLBACK).
   By-design edges (gate stub, anon per-guest cap, ZAR-only currency, no admin UI) documented.
4. ~~**Specials (deals)**~~ ✅ **AUDITED 2026-07-13** — `docs/lifecycles/specials.md`.
   Verified live: server re-pricing (client never trusted), VAT-inclusive display
   (flat + per-night), sold-out enforcement (3 layers), window/min-max-night guards,
   race-safe quantity cap, **seasonal-aware savings**. **Fixed:** `expire_specials()`
   was never scheduled → cron added (`20260713110000`). Refreshed 2 seed deals whose
   `was_price` ignored the active winter seasonal. Open founder calls (not bugs):
   suppress trivial "1% off" badges · per-host slug vs global `/deal/[slug]` · no
   publish/expiry notification.
5. ~~**Add-ons**~~ ✅ **AUDITED 2026-07-16** — `docs/lifecycles/addons.md`. Money layer
   SOUND: double-charge guard holds (survived the coupon-line migration), both paths
   (quote + host/guest post-booking) charge once, guest add-ons re-priced server-side.
   Open (founder call): **G7 refundability** (no per-add-on refundable flag / per-line
   refund). Residual: rare null-addon-invoice edge case; guest post-booking whole-listing-only.
6. ~~**Media manager**~~ ✅ **AUDITED 2026-07-16** — `docs/lifecycles/media-manager.md`.
   Works, but NOT a unified SSOT — read-only aggregator over 3 buckets + `property_photos`/
   `website_media`/`brand` JSONB; no cross-surface reuse, no reference-check on delete, no
   quota. **Fixed:** misleading delete-confirm copy (claimed safe cascade; actually orphans).
   SSOT unification (unify buckets · cross-surface picker · reference-counting · quota) is a
   documented backlog EPIC — not MVP-blocking (per-surface upload/delete work).
7. ~~**Reports**~~ ✅ **DONE 2026-07-15/16** (comprehensive both surfaces). Host: functional
   filters, in-depth booking analytics, revenue breakdown, website traffic, region filter,
   quote-only scoped report, wide PDF/XLSX exports. Admin: payment/VAT/take-rate/geography/
   booking-status, retention & LTV, cohort retention/NRR, subscriber movement. Fixed a broken
   `fetch_looking_for_stats` RPC. See CHANGELOG 2026-07-15/16.
8. ~~**Product feature gating**~~ ✅ **AUDITED 2026-07-16** (clean). SSOT `hostHasFeature`
   (fail-closed) + canonical `check_feature_permission` across 32 files; no hardcoded plan
   logic. Open only via the pre-MVP switch (`PRE_MVP_FEATURES_OPEN`) + all-enabled
   `plan_features` seed. To go paid: flip the switch + configure `plan_features` per plan.

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
