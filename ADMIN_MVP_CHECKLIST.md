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
**Not exercised (state-changing / risky on real accounts):** Suspend, Delete, Role, Reset password, Impersonate — wired, left untested. Flag if you want these driven.

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
