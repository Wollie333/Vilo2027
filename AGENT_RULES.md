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
