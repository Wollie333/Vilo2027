# Affiliate Program — Launch Readiness (default + multi-competition)

> **Goal:** a default affiliate programme + the ability to run **multiple competitions at once**,
> with the **Founding Race** (flat 60%, live) 100% ready, tested from guest/host/admin/partner, and
> money- and security-safe. Target: **launch Friday**.
>
> This is the living test contract. Each item carries a checkbox; we drive them all green.
> Grounded in three code sweeps (notifications, money+scoring pipeline, security+ledger) —
> findings summarised inline.

---

## 0. Verdict from the code sweeps

- **Money is safe by construction.** The commission rate is snapshotted **server-side at click**
  (`app/r/[slug]/route.ts` → `affiliate_clicks.commission_snapshot` → `affiliate_referrals.commission_snapshot`),
  accrual reads the snapshot (not live config), and **no admin edit ever re-rates `cleared`/`paid`
  money.** The Founding Race being **flat 60%** is the fully-protected case.
- **Security is well-hardened.** No cross-partner read/write vector; no portal action trusts a
  client-supplied `affiliateId` (all derive the account from the session); RLS own-read on every
  affiliate table; every admin money mutation is `requirePermission`-gated + audited; ledger amounts
  are server-recalculated and idempotent (DB unique constraints).
- **Real gaps exist** — a handful, none catastrophic. Listed in §5, classified launch-blocker vs after.

---

## 1. Seeded test accounts (logins for browser testing)

Password for all seeded demo accounts unless noted: **`WieloDemo123!`** (demo) / **`WieloStarter123!`** (affiliate).

| Role | Email | Password | Notes |
|---|---|---|---|
| **Admin (founder / super_admin)** | `wollie333@gmail.com` (also `wollie@manamarketing.co.za`) | founder-known | seeded into `platform_staff` as super_admin |
| **Staff — Finance** (2nd staff, for role tests) | `finance@wielodemo.com` | `WieloDemo123!` | role `finance`; has `subscriptions.edit` → settles payouts + gets payout pings. Seed: `scripts/seed-staff-finance.mjs` |
| **Host** | `host@wielodemo.com` | `WieloDemo123!` | demo host |
| **Guest** | `guest@wielodemo.com` | `WieloDemo123!` | demo guest |
| **Affiliate partner** | `affiliate-partner@wielostarter.com` | `WieloStarter123!` | partner slug `wollie-steenkamp` |
| **Referred hosts (campaign)** | `camp-host-a/b/c@wielostarter.com` | `WieloStarter123!` | for competition referrals |
| **Referred hosts (default)** | `ref-host-a…d@wielostarter.com` | `WieloStarter123!` | for default-program referrals |

- **Live Founding Race:** slug `founding-race`, id `752ec2d6-2e8f-4672-80f4-70d2bc3b5fba`, **flat 60%, active**.
- UUIDs for partner account / campaign are runtime `gen_random_uuid()` — query by slug when needed.
- **We may need a 2nd non-super-admin staff account** (e.g. a `finance` or `support_agent` role) to prove
  role-scoped admin notifications + permission boundaries. Flag to seed if not present.

---

## 2. Flows — what SHOULD happen

### 2A. Default programme

**Partner (`/portal/affiliates` or `/dashboard/affiliates`)**
1. Become a partner → account `pending` → activation checklist (agreement signed + email confirmed) → `active`.
2. Get the permanent default link `/r/<slug>`; link builder for any page/product (copy + QR + stats).
3. Share → a click drops the `vilo_ref` cookie (first-touch wins, 90-day window).
4. Referred host pays → commission accrues at the **per-product** rate × tier bonus → `pending` (hold) → `cleared`.
5. Balance shows cleared vs pending; request payout above threshold → admin settles → remittance doc + notification.

**Guest / Host touchpoints** — a referred user signs up (bind once, forever); when they pay/subscribe the
partner earns. Host activation (first live listing) is the competition scoring event (§2B), not default.

**Admin (`/admin/affiliates`)** — Affiliates list + per-partner record (funnel, commissions, payouts),
Payouts queue (settle), Tiers/Settings, Marketing, Terms (pull from Legal-docs SSOT).

### 2B. Competition (the Founding Race, and future concurrent ones)

**Admin setup (campaign workspace)** — Overview dashboard, guided **Setup** (Basics · Commission · Scoring ·
Prizes · Host trial), **Rules** (bind a published Legal-docs doc), **Entries** (per-entrant metrics + drill-in),
Metrics, Standings, Results, Marketing, Email. Launch = status→active (kickoff notification fires).

**Partner** — opts in / uses the competition signup+referral link → hosts arriving through it are **stamped
with the competition rate at click**. Portal shows per-referral rate (never a blended headline), score, rank,
and the public leaderboard. Rate is **permanent** even after the race ends.

**Host (referred)** — signs up via the competition link → binds to that partner+campaign → on first **live
listing** the partner scores 1 point (nightly recompute) and `campaign_referral_activated` fires.

**Admin close** — auto at `ends_at` (cron) or manual "Close now" → `compute_campaign_results` (placings,
milestones, Fast Start, monthly net-change) → admin **reviews** on Results → **Publish** (awards floor prizes,
records cash prizes as `owed`, notifies winners) → **settle** each cash prize (paid/void) → payout **sweep**.

---

## 3. Notification matrix + the admin/staff bell

**How it works today:** one dispatcher `dispatchEvent` → three sinks (email queue, push queue, in-app RPC).
In-app rows live in `in_app_notifications` (keyed by `user_id`, RLS `auth.uid()`), rendered by the shared
`NotificationBell` + `useNotifications` — mounted for **host** (dashboard layout) and **guest** (portal layout).

| Event | Trigger | Recipient |
|---|---|---|
| `affiliate_commission_earned` | DB trigger on `affiliate_commissions` insert | partner |
| `affiliate_payout_paid` | payout settle action | partner |
| `campaign_partner_enrolled` | activation | partner |
| `campaign_referral_activated` | first live listing | partner |
| `campaign_milestone_hit` | daily cron sweep | partner |
| `campaign_kickoff` / `standings_digest` / `ending_soon` | launch / daily cron | partner |
| `affiliate_campaign_won` | results publish | partner (winner) |
| `campaign_pause_changed` | pause/resume action | partner |

**THE GAP:** the **admin chrome has no notification bell**. Staff (`platform_staff.user_id`) are auth users in
the **same id space** as `in_app_notifications.user_id`, and RLS is role-agnostic (`auth.uid()`), so:

- [x] **N1 — DONE + live-verified.** Mounted the shared `<NotificationBell viewAllHref="/admin/notifications" />`
  in `admin/layout.tsx`; created `/admin/notifications` view-all page (reuses `NotificationsList`). Zero DB/hook
  changes — same table, same styling. Bell shows in the admin header; dropdown + tabs render.
- [x] **N2 — payout event DONE + live-verified.** New reusable `lib/notifications/notifyStaff.ts` (fans an
  in-app row to active `platform_staff`, optional permission filter, best-effort). Wired **payout requested** →
  staff with `subscriptions.edit` (`portal/affiliates/actions.ts`). Verified: the ping landed in the admin bell,
  unread, under the Payments tab, deep-linking to the payouts queue.
  - [ ] **N2-follow-ups** (periodic/rare, quick): **competition auto-closed / results-ready** (via the daily
    campaign-comms worker) and **refund→clawback landed** (via the clawback path). Not blockers.
- [x] **N3 — verified for super_admin.** Bell + view-all confirmed for the founder (multi-role → combined feed).
  ⚠️ Only **1 active `platform_staff`** exists — need a **2nd non-super-admin staff account** (e.g. finance) to
  prove role-scoped delivery + permission boundaries (S11/S13).

---

## 4. Scenario test matrix (run in real browser; founder logs in)

Legend: 🟢 pass · 🔴 fail · ⚪ not run. "Login" = whose session.

| # | Scenario | Login | Expected | Status |
|---|---|---|---|---|
| S1 | Partner portal loads; default link + per-referral rates shown (never blended) | partner | correct rates, no blended headline | ⚪ |
| S2 | Default referral → charge → accrual pending → clear (via harness) reconciles portal ↔ admin | partner+admin | numbers tie across portal/admin/ledger | ⚪ |
| S3 | Competition click stamps 60% at click; signup after "would-be" end still 60% | partner | referral `commission_snapshot` = 60% | ⚪ |
| S4 | Host referred via competition link → first live listing → +1 score (nightly) + activation notif | host+partner | score increments, notif fires | ⚪ |
| S5 | Public leaderboard + portal race view match `campaign_active_listings` | anon+partner | same ranking | ⚪ |
| S6 | Admin edits LIVE Founding Race (flat rate/prizes/dates) → **no** change to earned money | admin | cleared/paid untouched; new referrals get new rate | ⚪ |
| S7 | Admin close → compute → review → publish → winners notified → settle cash prize → audit rows | admin | Results correct, prizes settle, audited | ⚪ |
| S8 | Payout request → admin settle → remittance doc + `affiliate_payout_paid` notif | partner+admin | doc minted, notif delivered | ⚪ |
| S9 | Refund a referred charge → proportional clawback → balance drops correctly | admin | clawback row, balance correct | ⚪ |
| S10 | **Two competitions active at once**; closing A does not wrongly sweep B's entrants | admin | sweep scoped to A (see §5-B) | ⚪ |
| S11 | Permissions: a non-super-admin staff role sees only permitted admin actions | staff | gated correctly | ⚪ |
| S12 | Partner A cannot see/act on Partner B's data (route + action) | partner | blocked | ⚪ |
| S13 | Admin bell: staff receive + read notifications, same styling as host/guest | admin/staff | bell works | ⚪ |
| S14 | Self-referral blocked; a partner referring their own account earns nothing | partner | no accrual | ⚪ |

---

## 5. Fixes found (prioritized)

**Launch-relevant (single flat competition Friday):**
- [x] **F1 · verified green** — `loadCampaignResults` reads `affiliate_campaigns.results` (jsonb); **zero**
  app references to the dead `affiliate_campaign_results` table. No fix needed.
- [ ] **F2 · founder action** — Ensure `BANKING_CIPHER_KEY` is set in every env with real payout PII (optional
  by design; unset = plaintext account numbers). `lib/crypto/banking.ts`. **Ops, not code.**
- [x] **N1–N3** — admin/staff notification bell — DONE (§3), payout event live-verified.

**Multi-competition hardening (needed for "run several at once"):**
- [ ] **F3 · sweep scope** — `finalize_ended_campaigns` / `closeCampaignNowAction` call
  `sweep_affiliate_payouts()` **platform-wide**; closing one competition sweeps other competitions' entrants'
  small balances early. Scope the sweep to the closing campaign's participants.
- [x] **F4 · ladder recompute vs snapshot — DONE (migration `20260804020000`, needs `db push`).** Decided:
  HONOR the referral snapshot. `recompute_affiliate_campaign_rates` now re-rates each pending ladder row using
  ITS OWN `affiliate_referrals.commission_snapshot->'bands'` (fallback live), matching accrual — so a live-band
  edit no longer overrides the locked-at-referral rate. Flat/inherit untouched; Founding Race unaffected.
- [x] **F5 · date-edit guard — DONE (code, TS-only, not live-verified).** `updateCampaignAction` refuses a
  start/end date change on a **live** campaign unless re-submitted with `confirmDateShift` (returns
  `needsConfirm:"date_shift"`); `CampaignBuilder` shows an on-brand "Shift the scoring window?" confirm →
  "Save anyway". Draft/ended campaigns edit freely. Earned rates unaffected (fairness-only guard). tsc+lint green.

**Finance-audit completeness (before real cash-out at scale):**
- [x] **F6 · audit swept payouts — DONE (migration `20260804010000`, needs `db push`).** `create_affiliate_payout`
  now writes one `admin_audit_log` row per payout created under `p_bypass_threshold` (i.e. every sweep):
  `action='affiliate.payout_swept'`, `target_type='affiliate_payout'`, `admin_id=NULL` (system/cron), payload =
  affiliate/method/gross/fee/net/count. Normal partner-requested payouts unchanged.
- [ ] **F7 · out-of-transaction audit** — `withAdminAudit` writes the audit row after the mutation; a failure
  leaves a money mutation unlogged. Consider same-transaction (Edge Function) auditing for finance actions.

---

## 6. "All circles green" launch checklist

- [ ] All S1–S14 scenarios 🟢 (or explicitly deferred with reason)
- [ ] F1, F2 done; N1–N3 done and live-verified
- [ ] Founding Race: setup complete, rules bound+published, leaderboard live, kickoff notif verified
- [ ] Money reconciles across partner portal ↔ admin ↔ `platform_ledger` on a full referral→payout cycle
- [ ] Refund→clawback cycle correct
- [ ] `pnpm build` + `pnpm lint` green; `node scripts/audit-wiring.mjs` clean
- [ ] Multi-competition: two active at once behave independently; close scoping (F3) verified
- [ ] Docs/CHANGELOG updated; branch merged per founder

---

## 7. Proposed execution order (toward Friday)

1. **N1 admin bell mount** (tiny, high value) → **F1 verify** → **F2 config check**.
2. **Browser scenarios S1–S9, S12, S14** on the live Founding Race + seeded partner (founder logs in).
3. **N2/N3** admin events + verify (S13).
4. **F3 sweep scope** + **S10** two-competition test (the multi-competition goal).
5. **F6** audit swept payouts. **F4/F5** ladder+date guards (before running ladder competitions).
6. Final checklist §6 → merge → launch.
