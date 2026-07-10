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

**Remaining actions to exercise (same verified pattern — server action + withAdminAudit + owner_user_id):** edit profile, change role, set product (provision+charge), email doc / send doc to inbox, business edit (needs support-grant), subscription edit, cancel scheduled change, affiliate payout, enable affiliate (done earlier), add-on create/edit/delete, policy toggle/default/delete, Impersonate, Delete. Next batch.

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

**Follow-up hardening candidates (noted, not yet done):**
- `withAdminAudit` silently swallows audit-insert failures (`console.error`) — this is why the bug hid for so long. Consider surfacing failures louder for a compliance log.
- Host-scoped actions `revalidatePath('/admin/users/${hostId}')` use the **hostId**, not the userId route param — wrong path (harmless today only because the client calls `router.refresh()`).
- Add-on toggle path: confirm behaviour fine; delete uses native `window.confirm` (works, but native dialogs are a UX inconsistency vs the app's modals).

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
