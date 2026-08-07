# Wielo — Current Task

> Reset at the start of every session. This is the session contract.

## 🟢 SAVE POINT (2026-08-06) — **BILLING VAT + AFFILIATE PAYING + ACTIVATION PLAN — SHIPPED & LIVE** ⬅ START HERE

**`main` == `origin/main` == `e640c58`** (pushed, Vercel READY on prod). `tsc` + `pnpm lint` GREEN
throughout. Migrations `20260806210000` … `20260806260000` applied to the linked cloud DB. Founder
logged in as admin for live verification.

### ✅ Done this session (all live-verified against the cloud DB / logged-in UI)
1. **Setup wizard reskin + hardening** — matched the Add-ons/Specials shell (no width cap, identity
   bar, 288px ProgressRing rail, icon-tile nav); mobile rail = vertical stack; publish banner gated on
   setup completion; pulled signup avatar/bio/languages through; step/gate + data-loss fixes; photo
   `sort_order` trigger, replace-restore atomicity, business `requireName`, non-atomic auth-email fix.
2. **Affiliate "paying" correctness** — root cause was TWO bugs: a stale plan allowlist AND the
   `subscriptions.plan` column reading `'free'` on a paid host. `lib/affiliate/paying.ts`
   `isPayingSubscription` now keys on **`product_id`** (free tier = null), threaded into all 4
   surfaces; Metrics funnels (`campaign_funnel`/`program_affiliate_funnel`, migs `230000`+`240000`)
   count paying off the same product_id signal. VERIFIED: admin PAID CUSTOMERS 0→1 (Petrus = Starter),
   portal ACTIVE REFERRED HOSTS 0→1. Also hardened silent click-log + `bindAffiliateReferral` swallows.
3. **Paid-sub `plan='free'` root fix** — activation derives plan from `product.plan_key ?? slug` but
   the FK to `plans()` only allows free/basic/pro/business; the catalogue rename left paid products
   `plan_key NULL` + non-key slugs → silent 'free'. Mig `250000`: set `plan_key='pro'` on every paid
   membership + backfill live subs; `activateMappedPlan` now falls back to 'pro' (+logs) for an
   unresolvable membership key, never 'free'. VERIFIED: all paid subs now `plan='pro'`, 0 stale.
4. **VAT wired onto the platform ledger (both modes)** — the mint-invoice trigger already computed VAT
   correctly for inclusive + exclusive but left `platform_ledger.vat_amount` NULL. Mig `260000`: the
   trigger now writes `vat_amount = v_vat` back onto the ledger row (reconciled with the invoice by
   construction; commission = `amount − vat_amount` = ex-VAT net in both modes). Host dashboard invoice
   page now reads the stored `vat_amount` (was re-deriving + double-counting the discount). Charge
   GROSSING (adds VAT on top in exclusive) confirmed on the live paths: `createProductOrder` (purchase),
   `subscription-renewal` (renewals), and admin manual charges (catalog price only — overrides never
   grossed). VERIFIED live (temp config + test charge, reverted + cleaned up): registered@15% R115 →
   `vat_amount 15` (sub 100/total 115); unregistered → 0. Wielo VAT currently: `vat_number ''` (off),
   `vat_mode 'exclusive'`, rate 15.

### ⚠️ Known / remaining (money paths — DO with live provider test charges, do not guess)
- **Secondary charge rails not yet grossed**: native `plans`-based checkout (`startSubscriptionCheckout`
  — likely legacy, superseded by product flow), **PayPal recurring**, **Paystack webhook auto-renewal**
  (likely dead if renewals are the app-driven `subscription-renewal` cron). Each needs a Paystack/PayPal
  **test-mode** charge to confirm the webhook preserves the grossed amount before grossing. The LIVE
  purchase/renewal/admin/booking paths already gross.
- Both live membership products (Starter + Standard) now map to `plan='pro'` (per-product features come
  from `product_features`, so this is only the tier label). If they must be distinct feature TIERS,
  create real `plans` rows + `plan_features` instead of aliasing to 'pro'.
- Host booking VAT keys off the **listing's** `vat_number` (Pricing tab), NOT the business/account VAT
  number — confirm that's the intended field if a host expects an account-level toggle.

### ▶️ Likely next
Run the collaborative VAT provider-rail test (Paystack/PayPal test mode → one membership purchase with
VAT enabled → verify webhook grosses + `vat_amount` end-to-end), then gross/retire the 3 secondary
rails. Optionally fix activation to set `plan` per-product if distinct tiers are wanted.
