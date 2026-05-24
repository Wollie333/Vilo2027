# Vilo Platform — Agent Rules & Guardrails

**Version:** 1.1
**Last Updated:** May 2026
**Read this file before touching any code.**

These rules exist to protect the platform, the data, and the users. They are non-negotiable. If a rule feels like it's blocking you from doing the right thing, stop and ask — don't work around it.

---

## 1. Security Rules — Absolute

### 1.1 Never expose the service_role key to the client
The `SUPABASE_SERVICE_ROLE_KEY` is **server-side only**. It bypasses all RLS policies.
- ✅ Use it inside Supabase Edge Functions
- ✅ Use it in Next.js Server Actions and Route Handlers
- ❌ Never import it in any component, hook, or client-side file
- ❌ Never prefix it with `NEXT_PUBLIC_`

### 1.2 Never trust the client for price calculations
All payment amounts must be **calculated server-side** in the Edge Function. The client sends intent (listing, dates, guests) — never the amount.

### 1.3 Always verify webhook signatures before processing
- **Paystack:** Verify `x-paystack-signature` (HMAC SHA-512) before any DB writes
- **PayPal:** Verify via PayPal Webhook Verification API before any DB writes
- Return `200` immediately, then process async — never let webhooks time out
- Log all raw webhook payloads to `payments.provider_response` for audit

### 1.4 Never bypass RLS
- All client-side queries go through the `anon` Supabase client with JWT
- If a query fails due to RLS, fix the RLS policy or route through a server action — never switch to service_role on the client

### 1.5 Banking details are sensitive
- `eft_banking_details.account_number` must be encrypted at application layer before storage
- Never log banking details
- Only expose EFT banking details via Edge Function — never via direct PostgREST query from the client

---

## 2. Database Rules

### 2.1 Never hard-delete these records
Soft delete only (`deleted_at` timestamp): `user_profiles`, `hosts`, `listings`, `bookings`

### 2.2 Never edit an existing migration file
Always create a new one: `supabase migration new <name>`

### 2.3 Always store amounts with currency
No bare `amount` column without a `currency` column beside it.

### 2.4 Always generate TypeScript types after schema changes
```bash
supabase gen types typescript --local > packages/types/database.types.ts
```

### 2.5 Never hard-delete blocked dates imported from external iCal feeds
When a calendar sync removes dates from an external feed (e.g. a booking was cancelled on Airbnb), delete only the `blocked_dates` rows where `source = 'ical'` AND `ical_feed_id` matches. Never bulk-delete all blocked dates for a listing — manual blocks and Vilo bookings must be preserved.

### 2.6 iCal export tokens are per-listing secrets
Each listing has a unique `ical_export_token` in the `ical_feeds` table. This token is part of the public feed URL. Rotating the token breaks any external calendar that has already subscribed. Only rotate on explicit host request. Never log or expose this token in error messages.

### 2.7 These tables are append-only (INSERT only — no UPDATE or DELETE)
- `admin_audit_log`
- `subscription_history`
- `policy_snapshots`
- `refund_status_history`

---

## 3. Feature Permission Rules

### 3.1 Always use check_feature_permission RPC — never hardcode plan logic
```typescript
// ✅ CORRECT
const { data } = await supabase.rpc('check_feature_permission', {
  p_host_id: hostId,
  p_feature_key: 'instant_booking'
});

// ❌ WRONG
if (subscription.plan === 'pro') { ... }
```

### 3.2 Feature gates must exist at both API and UI layer
Never rely on UI-only gating. Always enforce server-side in the Edge Function too.

### 3.3 Upgrade prompts are inline — never blocking modals

### 3.4 Pre-MVP feature-gate policy — every feature open to `free` while testing
While the platform has no real users and no subscription management UI, **every gateable feature must be available on the `free` plan** so the founder can smoke-test end-to-end. Build features knowing that in the future these will narrow to per-plan permissions — but for now, ship open.

**When you ship a new gated feature:**
1. **Pick a feature key** (snake_case, e.g. `banking_details`, `seasonal_pricing`).
2. **Seed it in `plan_features`** with `is_enabled = true` across every plan (`free`, `basic`, `pro`, `business`) — mirror the INSERT pattern in `20260524000001_quotes_invoices_addons.sql` and `20260525000001_banking_and_business_details.sql`.
3. **Wire the RPC at the page + Server Action layer** so the gate infrastructure exists and works — DO NOT remove the `check_feature_permission` calls when you write new code. Future-you needs them in place.
4. **For now, the gate must always pass for free plan users.** Acceptable patterns: (a) make `assertFeatureEnabled()` return `true` with a comment pointing back at this rule, (b) skip the early-return upgrade block, OR (c) leave the gate active and rely on the `plan_features` seed — but only if you've verified the user actually has an active `subscriptions` row, which most free hosts won't until subscription management lands.
5. **Don't add the upgrade card / paywall UI yet.** When Phase 3 (subscription management) lands, the gate code is already in place — flip one row in `plan_features` per plan and the upgrade card pattern from `apps/web/app/dashboard/seasonal-pricing/page.tsx` can be reused.

**Why this policy exists:** without subscription onboarding, hosts created via `handle_new_user` don't get a `subscriptions` row, so `check_feature_permission` returns `is_enabled = false` regardless of what's in `plan_features`. Strict gating blocks the founder from testing their own platform.

**This policy expires at MVP launch.** When real users + subscription management ship, narrow the per-plan flags then.

---

## 4. Booking & Payment Rules

### 4.1 Booking status follows a strict state machine
```
pending → confirmed | declined | cancelled_by_guest | expired
confirmed → checked_in | cancelled_by_host | cancelled_by_guest
checked_in → completed
```
Any other transition throws an error.

### 4.2 Date blocking is handled by DB trigger
The `trigger_booking_confirmed` trigger inserts `blocked_dates` rows. Do not duplicate this logic in Edge Functions.

### 4.3 Refund amounts cannot exceed the original payment
Validate `approvedAmount <= payment.amount` before calling any provider API.

### 4.4 EFT banking details masked in all non-EFT contexts
Only expose when `payment_method = 'eft'` and status is `pending_eft` or `pending_eft_review`.

---

## 5. Code Quality Rules

- No `any` in TypeScript — use `unknown` + narrow, or generated DB types
- All forms use React Hook Form + Zod
- All mutations go through Server Actions or Edge Functions — not direct `.insert/update/delete()` from client components
- All Realtime subscriptions must be cleaned up on unmount
- User-facing errors use toast notifications — never `alert()` or raw `console.error()`
- Full errors logged to Sentry, never shown raw to users

---

## 6. Admin Rules

### 6.1 Every super admin action must be logged to admin_audit_log before completing
Include: `admin_id`, `action`, `target_type`, `target_id`, `payload` (before/after state), `ip_address`

### 6.2 Impersonation sessions tracked in impersonation_sessions
Record `started_at` and `ended_at`. Tag all actions during impersonation with both `admin_id` and `impersonating` user id.

### 6.3 platform_settings changes take effect immediately
No cache. Test in staging before production.

### 6.4 Super admin & Vilo staff RBAC — capability checks via DB, not code
The control centre (`/admin`) is gated by the `platform_staff` table — never
by hardcoded role checks in app code. Always call `has_admin_permission(key)`
(RPC) via `requirePermission()` from `apps/web/lib/admin/`. The permission
catalog lives in `admin_permissions`; grants live in `admin_role_permissions`.

Staff inheritance: a `super_admin` row gets every permission. New roles are
seeded in the RBAC migration (`20260525000002_create_platform_staff_rbac.sql`)
— add a permission, then map it to the relevant roles in the same migration.
Never grant `super_admin` to a colleague; create a focused role instead.

### 6.5 MFA (AAL2) required for admin access
`is_super_admin()` and `has_admin_permission()` both require `auth.jwt() ->> 'aal' = 'aal2'`.
Staff cannot reach `/admin` until they enrol TOTP. If you're locked out, run
`supabase/scripts/grant-super-admin.sql` as a break-glass recovery.

### 6.6 Reason required on destructive admin actions
Refunds, cancellations, suspensions, and forced plan changes must collect a
free-text reason and persist it in `admin_audit_log.payload.reason`. Use the
`withAdminAudit({ requireReason: true })` wrapper. Actions without a reason
throw `AdminReasonRequired` before any DB write.

### 6.7 View-only impersonation
Impersonation (`/admin/as/[userId]/...`) is structurally read-only — those
routes contain no mutation actions. Do not add server actions that mutate
under that subtree. To edit on a user's behalf, use the direct `/admin/...`
edit URLs which run through `withAdminAudit`.

### 6.8 Finance and moderation actions must be atomic
For `payments.refund`, `subscriptions.edit`, `bookings.cancel`, and
`users.suspend`, route the mutation through a Supabase Edge Function that
wraps `BEGIN ... INSERT INTO admin_audit_log ... COMMIT` in a single
transaction. Other audited actions may use the eventual-consistency path
in `withAdminAudit`.

---

## 7. Claude Code Terminal Rules

### 7.1 Always read CURRENT_TASK.md before writing any code
```bash
cat CURRENT_TASK.md
```
If it's empty or stale, ask the user to fill it in first.

### 7.2 Use --continue to resume sessions
```bash
claude --continue
```
Never start a fresh session mid-task — it loses context and causes drift.

### 7.3 Only use --dangerously-skip-permissions on reviewed, scoped tasks
Safe for well-scoped UI/component tasks. Never use it for:
- Payment or webhook handlers
- Database migrations
- Anything touching secrets or `.env` files

### 7.4 Ask before installing new packages
State what it is, why it's needed, and whether an existing package covers it. Wait for confirmation before `pnpm add`.

### 7.5 Ask before creating new database tables or columns
Confirm the design first. Never create a migration as part of a larger task without explicit go-ahead.

### 7.6 Run build + lint before ending any session
```bash
cd apps/web && pnpm build && pnpm lint
```

### 7.7 Regenerate types after any schema change
```bash
supabase gen types typescript --local > packages/types/database.types.ts
```
Commit in the same commit as the migration.

### 7.8 Commit at the end of every complete task
```bash
git add .
git commit -m "feat: description"
```
If incomplete, use `wip:` prefix. Never leave uncommitted work at end of session.

### 7.9 No console.log in committed code
```bash
grep -r "console.log" apps/web/src apps/mobile
```

### 7.10 Never touch files outside CURRENT_TASK.md scope without asking
If the task correctly requires touching something unlisted — stop, explain, wait for go-ahead.

---

## 8. When to Stop and Ask

- Task requires a schema change not explicitly requested
- About to write an Edge Function touching payments or bookings
- Unsure which subscription plan a feature belongs to
- Task involves deleting data
- File to touch is not in `CURRENT_TASK.md`
- Something conflicts with a rule in this file

Asking takes 30 seconds. Reverting a bad decision takes hours.

---

*These rules apply to every file, every session, every task. No exceptions.*
