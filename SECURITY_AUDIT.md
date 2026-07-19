# Per-Feature Security Audit — "a user can only access their own stuff"

Founder directive (2026-07-19): verify **every feature**, one at a time, that a user
cannot access another user's data — at all three layers (RLS data / SECURITY DEFINER
RPCs / server actions) — and **prove the deny path** by impersonating a different tenant.

## Method (per feature)
1. List the feature's tables + RPCs + server actions.
2. Confirm RLS policies scope by owner (host_id / user_id / guest_id) for SELECT + writes.
3. **Prove deny:** impersonate a DIFFERENT tenant and attempt to read/write the feature's
   data → must return 0 rows / `permission denied` / `NOT_AUTHORIZED`.
4. Confirm the owner's own access still works (don't over-lock).
5. Verdict + any fix.

## Test tenants
- **Host A (owner):** host `7b4c377e-…`, user `66fe4644-…` (wollie@manamarketing.co.za)
- **Host B (attacker):** host `0b111111-…101`, user `e56bd2a5-…` (host1@wielostarter.com)
- **Guest:** user `ba16f3fc-…` (guest@wielostarter.com)
- Impersonate in `supabase db query --linked`: `BEGIN; SET LOCAL request.jwt.claims=
  '{"sub":"<uid>","role":"authenticated"}'; SET LOCAL ROLE authenticated; <query>; ROLLBACK;`

## Structural baseline (done — cross-cutting, all features)
- ✅ **RLS enabled on every tenant table** (only PostGIS `spatial_ref_sys` off). 14 tables are
  RLS-on + zero-policy = deny-all (service-role-only internal queues/config) — safe.
- ✅ **No permissive policies** — every write policy scopes by owner or `auth.role()='service_role'`.
- ✅ **SECURITY DEFINER RPC IDOR pass** (commits `df29251e`, `06b7a5a4`) — owner-scoped RPCs
  guarded / locked to service_role; deny paths proven.
- ✅ **Server-action IDOR pass** (`417896c9`) — ~300 mutations; money/portal/admin clean; 4 gaps fixed.

## Feature checklist — ALL PROVEN (deny-path tested by tenant impersonation)
Proof method per row: as attacker Host B (or unrelated user), count/UPDATE/INSERT the
victim's rows → 0 visible, 0 hacked, INSERT rejected by RLS; owner keeps own access.

| # | Feature | Tables | Result |
|---|---|---|---|
| — | Specials | specials, special_addons, special_view_events | ✅ live + security (RPCs guarded) |
| — | Add-ons | addons, property_addons, booking_addons, quote_addons | ✅ live + security |
| 1 | Booking | bookings, booking_rooms, booking_addons, blocked_dates, booking_notes | ✅ owner 23; B reads/updates 0; guest 0 foreign |
| 2 | Payments / Ledger | payments, invoices, credit_notes, platform_ledger, host_payment_gateways | ✅ B sees 0 incl **gateway creds**; UPDATE 0 hacked |
| 3 | Policy / Refunds | policies, policy_snapshots, refund_requests, refunds | ✅ refund_requests host/guest-scoped; B 0 |
| 4 | Quotes | quotes, quote_addons | ✅ B 0 read, 0 update-hacked |
| 5 | Guest CRM | host_contacts, guest_notes, guest_ratings | ✅ B 0 |
| 6 | Looking-For | looking_for_posts, _quotes, _passes, _alerts | ✅ posts guest-scoped+public; passes/alerts host-scoped (actions hardened `417896c9`) |
| 7 | Reviews | reviews, external_reviews, external_review_sources | ✅ B 0 (published are public by design) |
| 8 | Coupons | coupons | ✅ B 0 read; UPDATE 0 hacked; INSERT→RLS violation |
| 9 | Subscriptions | subscriptions | ✅ B 0; UPDATE 0 hacked |
| 10 | Affiliate | affiliate_accounts, _payouts, _payout_methods | ✅ B 0 (incl payout banking) |
| 11 | Calendar sync | ical_feeds | ✅ B 0 (property→host scoped) |
| 12 | Statement | (derived; HMAC-signed token, no table) | ✅ by-design (token = capability, secret=SERVICE_ROLE_KEY) |
| 13 | Support inbox | conversations, messages | ✅ B 0 (guest/host scoped) |
| 14 | Onboarding / Identity | hosts, businesses, user_profiles | ✅ businesses B 0; profiles only own+**guests-with-relationship** (control: unrelated=0); hosts public-identity only (no email/phone) |
| 15 | Media manager | property_photos, property_seasonal_pricing | ✅ B 0 (property→host; published public) |
| 16 | Access details | property_access, property_room_access | ✅ B 0 (check-in codes isolated) |
| 17 | Account deletion | data_requests | ✅ B 0 (GDPR requests) |
| 18 | Drafts | form_drafts | ✅ B 0 (user-scoped) |
| 19 | Seasonal pricing | property_seasonal_pricing | ✅ B 0 |
| 20 | Websites / builder | host_websites | ✅ B 0 |
| 21 | Staff / team | staff_members, staff_invites | ✅ B 0 |
| 22 | Notifications | in_app_notifications | ✅ B 0 (user-scoped) |
| + | Guest credits | guest_credit_ledger | ✅ B 0 |

## Verdict
**Every feature: a different tenant cannot read or write the owner's data.** No new
vulnerability found in this data-layer pass — the RLS policies were already correctly
owner-scoped everywhere; the real holes (RLS-bypassing RPCs, 4 server actions) were
closed in the earlier passes (`df29251e`, `06b7a5a4`, `417896c9`). The one policy that
looked broad (host reads a guest's profile) is correct + relationship-gated (proven by a
control: unrelated user → 0). Write-deny (UPDATE 0 rows, INSERT → RLS violation) also proven.
