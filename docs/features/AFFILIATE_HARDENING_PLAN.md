# Affiliate Program — Hardening & Enrichment Plan

**Status:** PLANNED (2026-07-09). Founder directive: implement this **LAST**, after the
product purchase-lifecycle work. Plan saved so it can be picked up cleanly later.

Goal (founder): the affiliate system must work on **the products the admin creates**,
every user gets **their own unique affiliate link**, tracking is **correct end to end**,
and the whole program is **hardened, refined and enriched** into a first-class feature.

---

## 0. What already exists (audit — do NOT rebuild)

A lot is in place. Migrations `20260616000010`–`20260616000018` + `20260617000001`:

- **Tables:** `affiliate_accounts` (user_id, slug, status, terms_version, payout_threshold,
  default_payout_method, currency, suspend fields), `affiliate_referrals`
  (affiliate_id, referred_user_id/host_id, click_id, source), `affiliate_commissions`
  (entry_type accrual|clawback, kind subscription|setup_fee, base/rate/commission,
  status pending|cleared|voided|paid, billing_period, hold_until, cleared_at, voided_at,
  refund_ledger_id, payout_id, paid_at), `affiliate_payouts` (gross/fee/net, method,
  status, provider, snapshots), `affiliate_payout_methods` + `_fees`, `affiliate_settings`
  (cookie_days, self_referral_blocked, hold days, etc.), `affiliate_marketing` assets.
- **Per-product commission config (SSOT on `products`):** `affiliate_type`
  (none|amount|percent), `affiliate_value`, `affiliate_duration` (once|months|recurring),
  `affiliate_duration_months`, plus a SECOND set for the setup fee
  (`setup_fee_affiliate_type/value`). So commission is ALREADY per-product.
- **Attribution:** `/r/[slug]` route drops a first-party `vilo_ref` cookie
  (aff id + click id + ts); `lib/affiliate/attribution.ts` `bindAffiliateReferral()` binds
  a fresh user to the affiliate on signup — keyed on USER (survives guest→host), self-
  referral guarded, cookie-day windowed, idempotent (UNIQUE referred_user_id), never
  throws into signup.
- **Accrual:** `accrue_affiliate_commission(p_ledger_id)` (SQL RPC) — reads the referral +
  the paid product's `affiliate_*`, computes commission on NET, respects duration
  (once→1 charge, months→N, recurring→∞) via `billing_period`, sets `hold_until`. Called
  today from `confirmProductOrderByReference`, the Paystack webhook `processProductEvent`,
  AND the new PayPal `capturePayPalProductOrder` (this session). **Clawback** on refund
  (`refund_ledger_id`, voids/offsets).
- **Clearing:** cron flips pending→cleared once `hold_until` passes (`20260616000014`).
- **Payouts:** request + admin process RPC (`20260616000016/17`), fees, methods.
- **Balance model:** `lib/affiliate/balance.ts` `summariseCommissions()` (pending/cleared/
  available/inPayout/paid/clawedBack/lifetime).
- **UI:** portal `/portal/affiliates` (overview, products, marketing, payouts) + admin
  `/admin/affiliates` (panel, settings, terms, marketing). Terms gating.
- **Wielo ledger + docs (added 2026-07-09):** commissions (owed) + payouts (paid) surface
  on `/admin/subscriptions/revenue` (Affiliate tab, union adapter, excluded from KPIs) with
  a commission-statement / remittance-advice PDF at `/wielo-commission/[id]`.

---

## 1. Goals restated

1. Affiliate commissions accrue correctly on **every** admin-created product (subscription
   AND one-off), for **every** payment method (Paystack / PayPal / EFT / manual).
2. Every user can get their **own unique affiliate link**, easily copyable, with clear
   "share this" UX + live earnings.
3. **Tracking is correct**: click → cookie → referral bind → accrual → clearing → payout,
   with visibility + integrity at each step.
4. The program is **hardened** (fraud, edge cases, refunds, currency) and **enriched**
   (dashboards, notifications, materials, tiers).

---

## 2. Workstreams (each = a slice; confirm scope before building)

### 2.1 Per-product affiliate config in the admin product editor
- Confirm the product editor (`admin/products/ProductEditor.tsx`) EXPOSES the
  `affiliate_type/value/duration(/_months)` + setup-fee affiliate fields (columns exist;
  the editor may not surface all of them). If not, add a clean "Affiliate commission"
  section per product: type (none/percent/amount), value, duration (once/N months/
  recurring), and the same for the setup fee. Live "affiliate earns X" preview
  (`commissionLabel`). Persist via the product save action (extend the Zod schema).
- Result: admin sets commission per product at creation → it flows through accrual.

### 2.2 Accrual coverage audit (every settle path)
- Verify `accrue_affiliate_commission` is invoked on ALL money-in paths that should earn:
  Paystack confirm ✅, webhook ✅, PayPal capture ✅, **EFT mark-paid** (admin) ❓,
  **manual ledger entry** ❓, subscription RENEWALS (recurring duration) ❓.
- Add the missing calls so a referred purchase always accrues, regardless of method.
- Confirm one-off products accrue (kind=setup_fee vs subscription) and duration=once works.

### 2.3 Unique affiliate link — generation + UX
- Every user can BECOME an affiliate (accept terms → `affiliate_accounts` row + unique
  `slug`). Confirm slug generation is collision-safe + user-editable-once (vanity).
- Portal: prominent "Your link" card — `https://<domain>/r/<slug>` — copy button, QR,
  per-product deep links (`/r/<slug>?p=<product-slug>` → lands on that product's pay/pitch
  page with attribution), share-to-social. Live clicks + conversions + earnings.
- **FOUNDER REQ (2026-07-11): link off ANY page, not just products.** Affiliates must be
  able to build their unique link for ANY destination on the system — a marketing/system
  page (launch, home, explore, deals, pricing, …), a specific listing, OR any product.
  Build an **affiliate link builder**: (1) curated page picker of promotable pages,
  (2) paste-any-on-site-path field (validated `startsWith('/')`), (3) product picker. Each
  yields `/r/<slug>?next=<path>` (the route ALREADY honours `?next=` + logs `landing_path`)
  with copy + QR + per-destination click/conversion stats. So a promoter of the launch page
  makes their link off `/launch`; of the home page off `/`; etc.
- Marketing assets (`affiliate_marketing`) surfaced with the link pre-embedded.

### 2.4 Tracking integrity + observability
- Click logging: does `/r/[slug]` record a click row (for CTR/analytics)? If not, add a
  lightweight `affiliate_clicks` (aff id, slug, ts, ua, ref, product) for funnel metrics.
- Attribution window + last-click vs first-click policy (currently first bind wins via
  UNIQUE) — confirm this is the intended model; document it.
- Cross-device / logged-in attribution: bind on signup only today; consider binding on
  first authenticated purchase if a cookie is present but no referral row yet.
- Admin visibility: per-affiliate funnel (clicks → signups → purchases → commission).

### 2.5 Refunds / clawbacks / integrity
- Verify a refund on a referred purchase voids/offsets the commission (clawback path)
  across ALL refund routes (host refund vs Wielo product refund vs manual credit).
- Negative-balance handling on payouts (clawback after payout) — document + guard.
- Self-referral + obvious fraud (same-card, disposable email) — extend `affiliate_settings`
  guards; hold window is the first line of defence.

### 2.6 Payout hardening
- Payout request flow: threshold gate, method + destination capture, fee snapshot,
  admin approve → mark paid → remittance advice (PDF done). Confirm idempotency + that a
  payout only draws `cleared` + `available` (not pending/in-payout).
- Payout statuses on the Wielo ledger (done) + notify the affiliate on paid.

### 2.7 Enrichment
- Notifications/emails: "you earned R X", "commission cleared", "payout sent" (reuse the
  email + inbox-card infra from the purchase-lifecycle work).
- Affiliate statements (monthly) — batch the per-commission statement into a period PDF.
- Optional: tiers / bonus rates, leaderboards, referral goals.

---

## 3. Decisions to confirm with founder (before building)
- **Attribution model:** first-click-wins (current) vs last-click. Cookie window (default
  30d) — keep?
- **Who can be an affiliate:** any registered user, or approval-gated?
- **Commission base:** NET (current, ex-VAT/fees) vs gross — confirm.
- **Recurring commission:** for subscription products, earn on every renewal
  (duration=recurring) or first N months only? (config exists per product.)
- **Setup-fee commission:** separate rate (columns exist) — keep dual config?
- **Self-referral / fraud:** how strict at MVP?

## 4. Build order (when picked up — LAST, after purchase-lifecycle)
1. 2.1 per-product config UI (unblocks admin setting commissions).
2. 2.2 accrual coverage audit + fill gaps (correctness foundation).
3. 2.3 unique-link UX (the visible feature).
4. 2.4 tracking integrity/observability.
5. 2.5 refunds/clawbacks + 2.6 payouts hardening.
6. 2.7 enrichment (notifications, statements, tiers).

Each slice: tsc + lint + `pnpm build` green; verify live (portal + admin, temp super_admin
grant → revoke); commit + push. Reuse the purchase-lifecycle email + inbox-card infra.

See memory: [[project-ledger-payments-affiliate-plan]] (ledger surfacing + statements already
done), [[reference-platform-support-inbox]].
