# Account deletion — lifecycle flow

> How an account leaves the platform: self-service **soft delete** → a 30-day
> **hold** (recoverable) → a **manual, admin-only hard purge**. Steps marked ✅
> were driven end-to-end on the live preview + cloud DB this pass (super_admin
> `wollie@manamarketing.co.za`, test guest `werner@gmail.com`). There is **no
> auto-purge cron** — permanent deletion is always a deliberate admin action.

The ONE place account rows change state is
[`lib/users/accountLifecycle.ts`](../../apps/web/lib/users/accountLifecycle.ts):
`softDeleteUserAccount` / `restoreUserAccount` / `hardPurgeUserAccount`, plus the
constant `DELETED_ACCOUNT_HOLD_DAYS = 30`. Both the self-service and admin paths
funnel through it, so the two stay symmetric.

---

### Step 1 — User deletes their own account ✅
- Trigger: Settings → **Data & privacy** → "Delete account", type email to confirm · Actor: guest/host
- Functions/files: `dashboard/settings/data/DeleteAccountSection.tsx` →
  `deleteAccountAction` (`dashboard/settings/data/actions.ts`) → `softDeleteUserAccount`.
- Safety gate (unchanged): refuses while any **active booking** (`pending`/`pending_eft`/
  `pending_eft_review`/`confirmed`/`checked_in`) or **open refund** exists — settle those first.
  super_admin self-delete is blocked.
- Logic: soft delete — `user_profiles.deleted_at = now`, `is_active = false`; the host row's
  `deleted_at` is set too (listings cascade hidden via existing soft-delete triggers); the auth user is
  **banned ~100y** so they can't sign back in. **Nothing is anonymised or destroyed** — every row is
  retained so the account is fully recoverable. The session is signed out, redirect `/?account_deleted=1`.
- DB writes: `user_profiles` (deleted_at, is_active), `hosts` (deleted_at), `auth.users` (banned_until).
- Verified: admin-path soft delete on `werner` set `deleted_at`, `is_active=false`, email/name **preserved**,
  `banned_until` = 2126. Self-service path is the same helper; the settings copy now states the 30-day hold.
- Next: → Step 2 (admin sees it) or Step 4 (restore).

### Step 2 — Admin sees the account in the Deleted category ✅
- Trigger: admin opens **Users → Deleted** (`/admin/users?seg=deleted`) · Actor: admin
- Functions/files: `admin/users/page.tsx` (the `deleted` segment queries `deleted_at IS NOT NULL`,
  ordered by `deleted_at desc`; a `DeletedCell` shows the deletion date + days left in the hold, or a
  "Purge ready" pill once elapsed). Every other tab hides deleted accounts.
- Verified: `werner` left "All" (8 → 7), Deleted count = 1, row showed `2026/07/12` + "30 days left in hold".
- Next: → Step 3 (purge, once eligible) or Step 4 (restore).

### Step 3 — Admin can also soft-delete from the dossier ✅
- Trigger: admin **Users → [user] → Delete** (reason required) · Actor: admin
- Functions/files: `admin/users/[id]/actions.ts` → `softDeleteUserAction` (audited `user.delete`,
  permission `users.delete`) → `softDeleteUserAccount`. Same helper, same retain-and-hide behaviour (the
  old anonymise-on-delete step was removed so restore is clean).
- Next: → Step 4 (restore) or Step 5 (purge).

### Step 4 — Restore during the hold ✅
- Trigger: admin dossier **Restore** on a deleted account · Actor: admin
- Functions/files: `restoreUserAction` (audited `user.restore`, permission `users.delete`) →
  `restoreUserAccount`: clears `deleted_at`, `is_active = true`, un-hides the host, and **lifts the auth
  ban** so the user can sign in again with their existing password.
- Verified: `werner` restore → `deleted_at` null, `is_active=true`, `banned_until` = none; back in "All"
  (Deleted → 0); audit log shows `user.delete` then `user.restore`.
- Next: account is fully live again.

### Step 5 — Manual hard purge after the hold 🚚
- Trigger: admin dossier **Delete forever** — DISABLED until `deleted_at` is ≥ 30 days old · Actor: admin
- Functions/files: `purgeUserAction` (audited `user.purge`, permission `users.delete`) →
  `hardPurgeUserAccount` → `app_purge_user_account` RPC (FK-safe child→parent delete) + `auth.admin.deleteUser`.
  Guards: target must be deleted, past the hold (`isPurgeEligible`), and not a super_admin.
- Irreversible — this is the ONLY place user data is truly destroyed. No cron runs it.
- Verified: the gate is verified live (fresh delete → button disabled + "unlocks in 30 days"). The purge
  *execution* is verified as of 2026-07-16 (`20260716230000`) against an account holding every blocking
  row type — see "Erasure order" below. The >30-day click itself was NOT re-driven (no eligible account
  exists without back-dating a seed user, which would destroy it).
- Next: account and all its rows are gone; the email frees up for re-signup.

---

## Erasure order — `app_purge_user_account`

⚠️ **This RPC had never been exercised against a realistic account, and was broken.** Until
`20260716230000` it raised on any account holding a **forfeit statement, a credit note, a Looking-For
post or a Looking-For response** — so those accounts simply could not be erased, and the POPIA/GDPR
obligation went unmet. The claim above that it was "previously proven" was false: the earlier evidence
only ever covered accounts with none of those rows.

The delete order is **derived from the live FK graph**, not by inspection. Every RESTRICT/NO ACTION edge
reachable from `user_profiles`/`hosts` must be cleared, deepest first:

```
set app.allow_policy_snapshot_purge + app.allow_forfeit_statement_purge   (both immutability triggers)
UPDATE looking_for_posts SET fulfilled_booking_id = NULL   -- third parties: sever, never delete
forfeit_statements → credit_notes                          -- credit_notes BEFORE invoices
refund_status_history → refunds → refund_requests          -- all BEFORE payments
payments → policy_snapshots → reviews → invoices
looking_for_responses → quotes → looking_for_posts         -- quotes sit BETWEEN the two
bookings → properties → host_feature_overrides → hosts
admin/staff hats → data_requests
```

**Traps this order encodes** (each one is a real FK, verified live):
- `credit_notes.invoice_id` is **NOT NULL RESTRICT** → credit notes must die before invoices.
- `forfeit_statements` + `credit_notes` RESTRICT **both** `bookings` **and** `hosts`.
- `looking_for_responses.quote_id` → `quotes` is NO ACTION, and `quotes.looking_for_post_id` →
  `looking_for_posts` is NO ACTION → **quotes must die between responses and posts**.
- `looking_for_posts.fulfilled_booking_id` → `bookings` is NO ACTION and belongs to *another guest*.
  It is **SET NULL, not deleted** — a third party's post is not ours to erase.
- `looking_for_posts.guest_id` CASCADEs from `user_profiles`, but `quotes.looking_for_post_id` blocks
  that cascade → a **guest** who received quotes could not be deleted either, outside the RPC entirely.
  Their posts + the quotes on them are now cleared inside it, before `auth.users` is deleted.
- `looking_for_post_unlocks` CASCADEs from both `hosts` and `looking_for_posts` → needs no handling.

**How it was verified** (rehearsal in `BEGIN; … ROLLBACK;` on live): build an account that is both host
and guest, holding a booking, payment, invoice, credit note, forfeit statement, its own LF post, a quote
on that post from *another* host, an LF response, and a *third party's* post pointing at its booking.
Then `app_purge_user_account` + `DELETE FROM auth.users`, and assert. Negative control first: the OLD
function fails with `23503 credit_notes_invoice_id_fkey`. The new one erases everything, leaves the third
party's user, host and post intact, and severs only the booking reference.

---

## Notes / edges
- The separate **"Request account deletion"** control on the same settings page is the formal POPIA
  `data_requests` queue (admin-fulfilled, `admin/data-requests`) — a different, async path that still
  anonymises. F2 only reworked the *immediate* self-service delete.
- Restore clears `hosts.deleted_at` for the user's host row; a host that was independently soft-deleted
  before account deletion is an unlikely edge not specially handled (pre-MVP).
