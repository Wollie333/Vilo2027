# Lifecycle — Affiliate programme

> One affiliate identity per USER (`affiliate_accounts.user_id`), open to any
> authenticated account. Reached inside whichever shell the user is in — guests at
> `/portal/affiliates`, hosts at `/dashboard/affiliates` (same program, shared
> `components/affiliate/AffiliateShell.tsx`). Refer people to Wielo → earn
> per-product commission → request a payout.
>
> **Status:** 🟢 access-per-shell shipped + verified 2026-07-12 (CHANGELOG #65).
> Commission/accrual/clawback/tiers/ledger shipped earlier (migrations
> `20260711100000`–`130000`); ⚠️ that end of the chain is documented from code +
> memory, not re-driven live in this doc.

Key files: `lib/affiliate/account.ts` · `attribution.ts` · `commission.ts` ·
`balance.ts` · `tiers.ts` · `fees.ts` · `notify.ts` · `app/r/[slug]/route.ts` ·
`app/[locale]/portal/affiliates/**` + `app/[locale]/dashboard/affiliates/**` ·
`portal/affiliates/actions.ts`.

---

## Step 1 — Join the programme (accept terms)
- Trigger: user opens the affiliate area without an account · Actor: any user
- Functions/files: `AffiliateShell` → `getAffiliateForUser(admin, user.id)`; if
  none → `AffiliateTermsGate`; accept → `acceptAffiliateTermsAction`
  (`portal/affiliates/actions.ts`).
- Logic: no host check — any authenticated user qualifies. Accepting stamps the
  terms version.
- DB writes: `affiliate_accounts` (insert; `user_id`, `slug`, `status='active'`,
  `accepted_at`, terms version).
- Side-effects: gate replaced by the affiliate dashboard.
- Next: → Step 2.

## Step 2 — Reach the dashboard in the right shell
- Trigger: user clicks "Affiliates" · Actor: guest | host
- Functions/files: guest sidebar → `/portal/affiliates`; host sidebar → `/dashboard/affiliates`.
  Both layouts render `AffiliateShell({basePath, crumbLabel})`; `dashboard/affiliates/*`
  pages RE-EXPORT the portal page bodies. `AffiliateNav` builds tab hrefs from
  `basePath`; cross-links use `AffiliateBaseLink` (self-detects base).
- Logic: same program + gate + screens; only the base path + breadcrumb differ, so
  each entity stays in its own chrome.
- DB writes: none.
- Side-effects: host stays in the dashboard shell (was previously thrown into the
  guest portal); guest stays in the portal shell.
- Next: → Step 3.

## Step 3 — Grab the referral link (per page / product)
- Trigger: user copies a link · Actor: affiliate
- Functions/files: `portal/affiliates/page.tsx` + `_components/AffiliateLinkBuilder`
  / `ReferralLinkCard`; base link `/(<origin>)/r/<account.slug>`; the builder
  appends `?next=<path>` or a product path. Slug editable via
  `updateAffiliateSlugAction`.
- Logic: every link carries the affiliate's slug; products list their own
  commission + a ready link.
- DB writes: none (slug edit writes `affiliate_accounts.slug`).
- Side-effects: shareable link + QR + WhatsApp/Email deep-links.
- Next: → Step 4.

## Step 4 — A referred visitor clicks (attribution)
- Trigger: someone opens `/r/<slug>` · Actor: prospect
- Functions/files: `app/r/[slug]/route.ts` sets the `vilo_ref` cookie
  (`REF_COOKIE`, `attribution.ts`) and redirects to `?next` (default home).
- Logic: attribution window = 30 days from click; the cookie binds a later signup.
- DB writes: click/visit tracking row (⚠️ exact table not re-verified here) ·
  cookie set client-side.
- Side-effects: funnel "Clicks" increments.
- Next: → Step 5.

## Step 5 — The visitor signs up (bound to the affiliate)
- Trigger: cookie'd visitor creates an account · Actor: prospect → referred user
- Functions/files: `bindAffiliateReferral(...)` (`attribution.ts`) on signup.
- Logic: the referred user is attributed to the affiliate and remains theirs once
  the account exists.
- DB writes: an `affiliate_referrals`-style row linking `affiliate_id` → referred
  user (⚠️ table name from code, not re-driven here).
- Side-effects: funnel "Signups" increments.
- Next: → Step 6.

## Step 6 — A referred purchase accrues commission
- Trigger: the referred user pays for a product/subscription · Actor: system(webhook/settle)
- Functions/files: `commission.ts` (`computeCommission`, per-product amount/percent),
  ledger integration migrations `20260711110000`–`130000`; earned notification via
  a DB trigger (`20260711130000`) + `lib/affiliate/notify.ts`.
- Logic: commission = product's rate on the NET the referred customer paid; held
  until the refund window passes, then payable. Recurring products pay for life.
- DB writes: commission rows (keyed by `affiliate_id`) · `platform_ledger` /
  `wielo_credit_notes` entries (full ledger integration).
- Side-effects: notification("affiliate earned") · funnel "Paid customers" +
  "Lifetime earned" update.
- Next: → Step 7 (payout) or Step 6b (clawback).

## Step 6b — A refund/chargeback claws back the commission
- Trigger: the referred sale is refunded/charged back · Actor: system
- Functions/files: clawback (`20260711100000`, proportional + floor).
- Logic: reverses the related commission proportionally; abuse suspension voids
  pending commission.
- DB writes: reversing commission/ledger rows.
- Side-effects: balance decreases; statement reflects the reversal.
- Next: → Step 7.

## Step 7 — Request a payout
- Trigger: cleared balance ≥ threshold, user requests · Actor: affiliate
- Functions/files: `savePayoutMethodAction` (`affiliate_payout_methods`; EFT /
  Paystack / PayPal) → `requestAffiliatePayoutAction` → RPC `create_affiliate_payout`
  (atomic). Balance from `getAffiliateBalance` / `summariseCommissions`
  (`balance.ts`); the processor fee is deducted (`fees.ts`).
- Logic: only cleared (past-refund-window) commission is payable; threshold gate.
- DB writes: `affiliate_payouts` (via the RPC) · marks the included commissions.
- Side-effects: payout appears on `/…/affiliates/payouts`; admin processes it in
  `/admin/affiliates`.
- Next: — (loop; more referrals accrue).

---

## Verified (2026-07-12)
- Access-per-shell: host → `Dashboard › Affiliates` with `/dashboard/affiliates/*`
  tabs; guest → `Portal › Affiliates` with `/portal/affiliates/*` tabs; both render
  the full overview + products. Joining the programme (terms accept) works.

## ⚠️ Documented from code, not re-driven live here
- The referral → attribution → accrual → clawback → payout chain (Steps 4–7) was
  shipped + hardened earlier (see memory `project-affiliate-hardening-plan`, demo
  on affiliate `wollie-steenkamp`); this doc names the files but did not re-run
  each step live. Re-drive + confirm the exact tracking table names when next
  touched.
