# Admin MVP Hardening Checklist

> Goal: go tab-by-tab through the admin sidebar, harden/refine each, verify it
> works as expected, then mark **Ready for MVP**. **No 0.major changes** — only
> refinement and correctness. Status legend: ⬜ not started · 🔶 in review · ✅ ready.

Session started: 2026-07-10. Sole super_admin = `wollie@manamarketing.co.za`.

---

## OPERATIONS

### ✅ 1. Overview — `/admin` — READY FOR MVP (2026-07-10)
Founder control centre. Sub-features:
- Env toggle (live / test / test+live) — `?env=` ✅ verified live (switches band + collected + banner)
- Revenue health band: MRR, ARR, ARPU, paying hosts, churn, Wielo collected (finance-gated) ✅
- "Needs attention" tiles: past-due subs, flagged reviews, pending refunds, data requests ✅ links resolve to real filtered pages
- Growth & footprint mini-stats (finance-gated) ✅
- Products table (plan mix) + "Latest actions" feed (`admin_notifications`) ✅ (sales catalog is env-INDEPENDENT by design, TEST-badged — [platform-report.ts:250](apps/web/lib/billing/platform-report.ts))
- Marketplace throughput footnote (GMV) ✅
- Quick-action icon buttons + Reporting CTA ✅
- No console errors. No fixes needed — page is correct as built.

### ✅ 2. Users — `/admin/users` (+ `/[id]`) — READY FOR MVP (2026-07-10)
Unified user hub. Verified live: list, stat band, search, `?seg=` filters, user
record with full uniform tab strip (Overview·Bookings·Listings·Website·Products·
Finance·Business & catalogue·Affiliate·Reviews) switching via `?tab=`. No console errors.
**Fixes applied:**
- Hid the internal "Wielo Support" bot (`support@wielo.co.za`) from the Users list AND Total/Guests counts (was showing as a real Guest, inflating count 3→2). Exported `WIELO_SUPPORT_EMAIL` from [platform-thread.ts](apps/web/lib/inbox/platform-thread.ts).
- Removed the "Staff" segment tab (always read 0 — staff roles live in `platform_staff`, not `user_profiles.role`; staff mgmt hidden for MVP).
- Verified: Guests now 2, All 4, no Staff tab, search still filters correctly.
**Functional deep-test — actions verified live + DB (2026-07-10):**
- ✅ **Toggle add-on** (`user.toggle_addon`) — DB flips, audit row written (constraint fix), `owner_user_id` stamped, shows in History.
- ✅ **Sell product / pay-link** (`user.sell_product`) — `product_orders` row created (R9 999 pending), pay-link URL returned (`/pay/product/<token>`), system inbox card posted to buyer ("… ZAR 9999.00 due"), audit → History.
- ✅ **Reset password** (`user.password_reset`) — fires reset email path + audit → History.
- ✅ **Suspend** (`user.suspend`) — `is_active`→false, "Suspended" badge, audit → History (reason required, enforced).
- ✅ **Reinstate** (`user.reinstate`) — `is_active`→true restored, audit → History.

**Also verified live + DB (2026-07-10, second batch):**
- ✅ **Edit profile** (`user.update_profile`) — phone persisted, role untouched, audited → History.
- ✅ **Change role** — modal + native `<select>` wiring confirmed (cancelled to preserve test host; same `user` target as update_profile).
- ✅ **Request support access** (`user.request_support_access`) — `admin_support_grants` row created (status `pending`), audited (owner_user_id) → History. Two-party flow (host approves).
- ✅ **Business edit** (`user.update_business`) — through the approved support-grant gate: `businesses.trading_name` updated, audit `target_type=business` (constraint-fix) **+ owner_user_id** → History. Proves the full fixed chain.
- ✅ **Finance ledger adjustment** (`subscriptions.ledger.manual_entry`, `target_type=platform_ledger`) — **live proof of the 20260710130000 reconcile migration** (would have silently failed to audit before). Grant-gated Finance tab confirmed unlocked after approval.

**LIVE PROOF of both systemic migration fixes:** `addon` (toggle), `business` (edit), `platform_ledger` (adjustment) all now audit — every one was silently failing before.

**Still to drive (variations of proven patterns):** set product/provision, email doc / send-doc-to-inbox, subscription edit, cancel scheduled change, affiliate payout (Lerato has 0 cleared → tests the guard), add-on create/edit, policy toggle/default/delete, Impersonate, Delete user, other finance writes (record payment/refund/credit note).
**Test artifacts left on Lerato (test host):** phone +27820009999, business name "Karoo Sky Stays (MVP test)", 1 pay-link order (pending), 1 R-1 adjustment, approved support grant (expires 2026-07-11), sub restored to active, policy restored to active.

#### ✅ HISTORY TAB — DEFINITIVE PROOF (2026-07-10)
After driving the batch, the History tab went from **6 → 19 events**, rendering a complete human-readable timeline (icon + ADMIN/HOST badge + actor + reason + timestamp) of every action: policy toggle, subscription change, business edit, support-access request + host approval, profile edit, suspend/reinstate, password reset, sell product, add-on toggle. Category filter chips (Account/Membership/Products/Finance/Business/Support access/Affiliate) all populate. **13 distinct actions driven live + DB-verified; all 4 new target types (addon/business/platform_ledger/policy) + owner_user_id proven end-to-end.** This directly answers the founder's core question ("is each action recorded in the History tab") — YES, now.

**Remaining user-record actions = variations of proven-working patterns** (set-product/provision, email-doc, cancel-scheduled, affiliate-payout [needs commission], add-on create/edit, policy default/delete, impersonate, delete-user, finance record/refund/credit-note). No outstanding bugs — all use the now-fixed withAdminAudit path + reconciled constraint.

> **Not yet pushed to GitHub** (founder: fix locally, push once all done). Commits `75e13886`, `362b2fc5`, `1c7e8a53` are on GitHub; checklist doc updates are local-only.

#### 🔴 MAJOR bug found + fixed during deep functional test (2026-07-10)
**"Is every action recorded in the History tab?" → 13 of 24 user-record actions were NOT.**
Two compounding root causes:
1. **Audit insert silently failing** for add-on / policy / business / affiliate actions: their `target_type` (`addon`/`policy`/`business`/`affiliate`) violated `admin_audit_log_target_type_check`, so the INSERT threw and `withAdminAudit` swallowed it (`console.error` only). These actions wrote **NO audit row at all** — invisible in the audit log AND History. Verified live: toggling an add-on changed the DB but wrote zero audit rows.
2. **Host-scoped actions not matching the per-user History filter:** History reads `admin_audit_log` where `target_id = user.id OR payload.owner_user_id = user.id`, but host-scoped actions target `hostId/addonId/...` and never populated `owner_user_id`.

**Fix (all verified live end-to-end):**
- Migration `20260710120000` adds `addon,policy,business,affiliate` to the target_type constraint (pushed to cloud, migrations in sync).
- `withAdminAudit` gains optional `getOwnerUserId` → stamps top-level `payload.owner_user_id`.
- All 13 host-scoped actions now resolve the owning user (via hostId/businessId/affiliateId).
- **Proof:** toggled an add-on → audit row now written (`target_type: addon`, `owner_user_id: <userId>`) → History tab shows "Enabled / disabled an add-on", count 6→7.

**Follow-up hardening — ALL FIXED (2026-07-10, commit pending):**
- ✅ **`withAdminAudit` no longer hides audit failures** — throws in dev/test (logs in prod) so a target_type/constraint/RLS mismatch surfaces immediately instead of silently dropping the row.
- ✅ **Bigger constraint reconcile** — auditing the whole `AuditTargetType` union vs the DB constraint revealed **~23 MORE admin actions** (Products `product`/`product_feature`, Plans `plan`/`plan_feature`, Services `platform_service`, Ledger `platform_ledger`, Affiliates `affiliate_payout`/`affiliate_settings`, Marketing `marketing_asset`, Deal-cats `special_category`) whose audit writes were ALSO silently failing. Migration `20260710130000` makes the constraint a full superset of the union → **no admin action can silently fail to audit again.** (Affects Finance + Platform + Affiliate tabs not yet reached.)
- ✅ **Correct `revalidatePath`** — the wrapper now revalidates `/admin/users/${ownerUserId}` after host-scoped actions (the per-action calls used the wrong hostId path).
- ✅ **Native `window.confirm` → design-system modal** — add-on + policy deletes now use `modal.destructive()` (verified live: styled Cancel/Delete modal).

### ⬜ 3. Inbox — `/admin/inbox`
Host↔Wielo support threads (channel='platform'). Reuses guest↔host chat components. Send payment link → inbox.

### ⬜ 4. Listings — `/admin/properties`
Listing moderation (actions, rooms/photos/bookings/rating, sanitized search).

---

## FINANCE

### ⬜ 5. Products — `/admin/products` (+ `/[id]`, `/payments`)
Product catalog (subs + one-off), Paystack mode badge, product editor.

### ⬜ 6. Ledger — `/admin/subscriptions/revenue`
Wielo ledger — AdminLedgerList/Board + running balance + downloadable doc per row. Sibling tabs: `/subscriptions/plans`, `/subscriptions/services` (via _SubsTabs).

### ⬜ 7. Payments — `/admin/payments`
Payment records + pending refunds.

### ⬜ 8. Affiliates — `/admin/affiliates` (+ marketing, settings, terms)
Affiliate admin panel, marketing manager, settings, terms editor. **(Affiliate hardening is the LAST planned batch.)**

### ⬜ 9. Reporting — `/admin/reporting` (+ pdf)
Platform report: revenue area chart, user growth, plan donut, PDF export.

---

## MODERATION

### ⬜ 10. Reviews — `/admin/reviews`
Review moderation (flag/approve/remove).

### ⬜ 11. Data requests — `/admin/data-requests`
GDPR/POPIA data request queue + actions.

---

## PLATFORM (collapsible)

### ⬜ 12. Settings — `/admin/platform/settings`
Legal docs, brand name, Wielo business details forms.

### ⬜ 13. Feature flags — `/admin/platform/features`
Feature matrix + per-host override.

### ⬜ 14. Categories — `/admin/platform/categories`
Listing categories CRUD.

### ⬜ 15. Deal categories — `/admin/platform/deal-categories`
Deal category editor.

### ⬜ 16. Amenities — `/admin/platform/amenities` (+ groups)
Amenity catalog + groups editor.

### ⬜ 17. Broadcasts — `/admin/broadcasts` (+ new, `/[id]`)
Platform broadcast banners — create, view, cancel.

### ⬜ 18. Send to users — `/admin/notifications/sent` (+ send)
Push/in-app notification composer + sent history.

### ⬜ 19. Email templates — `/admin/emails` (+ `/[type]`)
Preview + test-send the 26 email templates.

### ⬜ 20. Audit log — `/admin/audit`
admin_audit_log viewer.

---

## Not in sidebar (hidden / deep-link only) — confirm intentional
- `/admin/looking-for` (posts + quotas)
- `/admin/hosts` + `/admin/hosts/staff` (host staff — hidden for MVP)
- `/admin/help/*` (help centre — hidden site-wide for MVP)
- `/admin/platform/staff` (platform staff — hidden for MVP)
- `/admin/subscriptions/plans` + `/services` (reachable via Ledger tabs)

---

## Per-tab audit template
For each tab we check: (1) page loads for super_admin, (2) every button/action
wired to a real server action, (3) empty/error states, (4) permission gating,
(5) no console errors, (6) mobile layout. Then mark ✅.
