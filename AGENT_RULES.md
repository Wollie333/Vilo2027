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

### 4.5 A listing cannot go live without a valid bank account
"Valid" = a **default, non-archived** `eft_banking_details` row for the host (`is_default = true AND is_archived = false`). Use the single source of truth `hostHasValidEft(hostId)` in `apps/web/lib/payments/eft.ts` — never re-implement the predicate. Enforced at two layers: the app gate in `togglePublishAction` (friendly error) **and** the DB trigger `trg_listing_requires_bank` on `listings` (fires on the `is_published` false→true transition). Both must stay in place.

### 4.6 Payments always fall back to the host's EFT account
If a card gateway (Paystack / PayPal) fails or isn't usable at payment time, the booking must degrade to manual **EFT** rather than failing — keep the booking + any reserved inventory, set `payment_method = 'eft'` and status `pending_eft`, and send the guest to the booking's awaiting-transfer view. Because §4.5 guarantees every live listing's host has a valid default account, this fallback is always available. Never delete a booking solely because a gateway call threw.

### 4.7 The payment ledger is the single source of truth for booking money — wire INTO it, never around it
`apps/web/lib/payments/ledger.ts` owns what a booking has been **paid**, what it **owes**, and how overpayment becomes guest store credit. **Never re-implement or fork this maths, and never directly set `bookings.balance_due` / `payment_status` from a payment flow.** Instead:
- Read "paid so far" via `sumCompletedPaid(admin, bookingId)`.
- After any payment row changes status (created, completed, voided, refunded), call `recomputeBookingPaymentState(admin, bookingId)` to derive + persist `balance_due` + `payment_status`, and `postOverpaymentCredit(...)` for excess.
- Record money received via the ledger's entry points (e.g. `recordBookingPayment`) so `kind` + `currency` + caps stay consistent.

If the ledger is missing something a feature needs, **extend `ledger.ts` itself** (add a function there) so it stays the one place — do not compute booking balances inline in an action, page, webhook, or trigger. Any new pay path (guest checkout, signed-in pay, the `/pay/[token]` link, host manual entry) must funnel its money state through this module.

### 4.8 Guest booking payments charge the HOST's own gateway, never the platform key
A guest paying for a booking (card) must settle to the **host's** connected Paystack account so funds reach the host directly (Vilo takes 0%). Use the single source of truth `getHostPaystack(hostId)` in `apps/web/lib/payments/host-paystack.ts` to load + decrypt the host's secret, and pass it to **both** `initializeTransaction` and `verifyTransaction`. The platform `PAYSTACK_SECRET_KEY` is reserved exclusively for Vilo's own subscription billing — never use it to charge a booking. Because host-account transactions can't be confirmed by the platform webhook, the **success/return page `verifyTransaction` (with the host key) is the authoritative confirmation** for direct-host card payments. No usable host card rail → fall back to EFT per §4.6. All "pay an existing booking" flows must funnel through `startBookingPayment` in `apps/web/lib/payments/pay-booking.ts`.

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

## 8. Multi-Agent Coordination & Anti-Wipe Safety

**This repo is worked on by more than one agent at a time.** Other Claude Code sessions, autonomous-loop runs, the founder's own edits, and `--isolation worktree` branches all share the same tree. You are **never** alone in this workspace. Treat in-progress work that you did not create as another collaborator's session — not as noise to clean up.

These rules exist because feature work has been silently wiped at least twice (notification system on 2026-05-25, help-centre on 2026-05-25 evening) — ~30+ files and hours of effort gone in a single sweep. Re-coding from scratch is a real cost. Don't be the cause of the next incident.

### 8.1 Never wipe files you did not create

If you encounter any of the following, **stop and ask the user before touching them**:
- Untracked files or directories not listed in `CURRENT_TASK.md`
- Modified files where the change isn't yours
- Branches, stashes, worktrees, or commits you didn't create
- New routes, components, migrations, or tables you don't recognise

Pausing for 30 seconds beats wiping hours of someone else's work.

### 8.2 Never run sweeping git operations unprompted

The following commands wipe in-progress work across the tree. **They must never be run unless the user explicitly requested them in the current session**, with the scope clearly stated:

- `git reset --hard`
- `git checkout .` / `git checkout -- .` / `git restore .`
- `git clean -fd` / `git clean -xfd`
- `git stash drop` / `git stash clear`
- `git branch -D <branch>` on a branch you didn't create
- `git worktree remove --force`
- `git push --force` (any variant) to a shared branch

If you believe one of these is genuinely required, ask first and itemise what will be lost.

### 8.3 Stage commits by name — never `git add -A` or `git add .`

When committing, stage **only** the files your task produced. Other agents' unstaged or untracked work must stay outside your commit so they can resume where they left off.

✅ Correct:
```bash
git add apps/web/app/admin/help apps/web/lib/help supabase/migrations/20260525000010_help_center.sql
git commit -m "feat(help): …"
```

❌ Banned:
```bash
git add -A          # may sweep another agent's WIP into your commit
git add .           # same problem
git commit -am "…"  # same problem
```

If you must touch many paths, list them explicitly or use a narrow glob. When in doubt, run `git status --short` before staging and verify every line.

### 8.4 Verify disk state before starting non-trivial work

At the start of any task that will create or modify more than a handful of files, run:

```bash
git status
git log --oneline -5
ls apps/web/app/dashboard/<feature>/ 2>/dev/null
ls apps/web/app/admin/<feature>/   2>/dev/null
```

If you see unfamiliar files in the area you're about to work in, surface them to the user before continuing. They are probably half-built work from another session that you'll either collide with or accidentally erase.

### 8.5 Commit early, commit often

Going more than ~30 minutes of feature work without a checkpoint commit is the single biggest source of loss in this repo. After every cohesive batch of files (a migration + its types, a component cluster, an admin CRUD surface), make a `wip:` commit:

```bash
git add <those-specific-files>
git commit -m "wip(help): articles editor + tiptap toolbar"
```

You can squash later with `git rebase -i`. **Uncommitted changes are not safe** — another agent's `git checkout`, `git reset`, or worktree prune can erase them in one keystroke. Committed work is recoverable via reflog even after a hard reset.

### 8.6 For large multi-file features, suggest a worktree

When the user asks for a feature that will span 20+ files, touch shared infra (sidebars, migrations, generated types, RBAC, audit-log schemas, layout files), or take more than an hour, **proactively suggest running in an isolated worktree**:

```bash
git worktree add ../vilo-feature-help feat/help-center
cd ../vilo-feature-help
# do the work here; merge to main when ready
```

This physically isolates your changes from concurrent sessions on `main`. Skip this overhead for small targeted edits (<10 files, no shared-infra touches).

### 8.7 If you discover your work has been wiped, stop and tell the user

If files you previously wrote are gone from disk:
1. **Do not silently re-create them.** Surface the incident to the user immediately — they need to know another agent is racing yours.
2. **Try to recover first.** Wiped work often survives in git plumbing:

```bash
git reflog                      # find the commit that held the work
git stash list                  # check for stashed snapshots
git fsck --lost-found           # dangling commits/blobs from rolled-back work
git worktree list               # the work may live in a sibling worktree
git log --all --oneline -- <file>
```

3. Recovering from the reflog or a stash is usually faster than rebuilding from scratch. Only re-code from memory if recovery genuinely fails.

### 8.8 Treat shared-infra files as contested

These files are touched by almost every feature and are the most likely collision points:

- `apps/web/app/admin/_components/AdminSidebar.tsx`
- `apps/web/app/dashboard/_components/Sidebar.tsx`
- `apps/web/lib/admin/requirePermission.ts` (the `PermissionKey` union)
- `apps/web/lib/admin/withAdminAudit.ts` (the `AuditTargetType` union)
- `packages/types/database.types.ts`
- `apps/web/app/sitemap.ts`
- The `supabase/migrations/` timestamp sequence
- `CURRENT_TASK.md`, `CHANGELOG.md`

When editing any of these, **re-read the file immediately before editing** (don't rely on a Read from earlier in the session — another agent may have added an entry in between). After committing, **verify on disk** with `git diff HEAD~1 -- <file>` that your additions survived.

---

## 9. When to Stop and Ask

- Task requires a schema change not explicitly requested
- About to write an Edge Function touching payments or bookings
- Unsure which subscription plan a feature belongs to
- Task involves deleting data
- File to touch is not in `CURRENT_TASK.md`
- You see unfamiliar files, branches, or untracked work in the area you're about to touch (§8.1)
- About to run a sweeping git command (§8.2)
- Something conflicts with a rule in this file

Asking takes 30 seconds. Reverting a bad decision takes hours.

---

*These rules apply to every file, every session, every task. No exceptions.*
