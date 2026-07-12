# Lifecycle — Wielo Support inbox (platform threads)

> The direct line between a user and the Wielo team. Two shapes share ONE model
> (`conversations.channel = 'platform'`), rendered with the same chat components
> as the guest↔host inbox:
> - **Host ↔ Wielo** — `host_id` = the host, `guest_id` = the fixed support user.
> - **Guest ↔ Wielo** — `host_id` = **NULL**, `guest_id` = the real guest.
>
> "Wielo" is always the same branded counterparty (one support `user_profiles`
> row, cached in `platform_settings.wielo_support_user_id`). The admin answers
> every platform thread from `/admin/inbox`.
>
> **Status:** 🟢 driven live end-to-end 2026-07-12 (both directions on a guest
> thread; host thread pre-existing). Admin UI verified via build + DB routing (no
> super-admin session at the time — ⚠️ admin click-through not yet screenshotted).

Key files: `lib/inbox/platform-thread.ts` · `app/[locale]/portal/inbox/**` (guest)
· `app/[locale]/dashboard/inbox/**` (host) · `app/[locale]/admin/inbox/**` (Wielo)
· trigger `on_message_inserted()` (migrations `20260609000003` → `20260712160000`).

---

## Unread routing — the one rule that makes it work

`on_message_inserted()` decides which side a new message is "from", then bumps the
OTHER side's unread (honouring the row's own read flags):

- **Host thread** (`host_id` set): from-host = sender is the host user / staff /
  system → bumps `unread_guest` (the Wielo/admin badge). A Wielo reply bumps
  `unread_host` (the host badge).
- **Guest thread** (`host_id` NULL): from-host = `sender_id <> guest_id` (i.e.
  anyone who isn't the guest = the Wielo side) → a **guest** message bumps
  `unread_host` (**the admin badge**); a **Wielo** reply bumps `unread_guest`
  (the guest badge).

So on a guest thread the admin's unread lives in `unread_host` and the flags
invert (Wielo = the host-side party). Every admin read/write branches on
`host_id === null`.

---

## Step 1 — The thread is ensured (find-or-create, pinned, seeded)
- Trigger: the user opens their inbox · Actor: system
- Functions/files:
  - Host: `dashboard/inbox/page.tsx` → `ensureWieloThread(admin, {host})`
  - Guest: `portal/inbox/layout.tsx` → `ensureWieloGuestThread(admin, userId)`
  - Both resolve the support user via `ensureWieloSupportUser()`.
- Logic: return the existing `channel='platform'` conversation for this
  host/guest, else insert one (`pinned=true`) and seed a welcome message FROM
  Wielo (`read_by_guest=false` for guests / `read_by_host=false` for hosts, so
  the recipient sees an unread). Best-effort — a failure never blocks the inbox.
- DB writes: `conversations` (insert; `channel='platform'`, `pinned=true`,
  guest thread has `host_id=NULL`) · `messages` (welcome; the trigger sets
  `last_message_*` + bumps the recipient's unread).
- Side-effects: status(none) · the welcome bumps `unread_guest` (guest thread) /
  `unread_host` (host thread) via the trigger.
- Next: → Step 2.

## Step 2 — The thread is pinned FIRST in the list
- Trigger: inbox list renders · Actor: system
- Functions/files: `dashboard/inbox/page.tsx` + `portal/inbox/layout.tsx` — after
  mapping rows, `conversations.sort((a,b) => Number(b.isPlatform) - Number(a.isPlatform))`
  (stable sort keeps the rest newest-first).
- Logic: the `channel='platform'` thread is hoisted to index 0, above even other
  pinned conversations.
- DB writes: none (display order only).
- Side-effects: list shows "Wielo Support" first, green **"Wielo"** chip (guest)
  / it renders with the support identity (host).
- Next: → Step 3.

## Step 3 — The user opens the thread
- Trigger: click the thread · Actor: guest | host
- Functions/files:
  - Guest: `portal/inbox/[id]/page.tsx` → `GuestThread` (header "Wielo Support /
    Wielo team" when `channel='platform'`).
  - Host: `dashboard/inbox/[id]` view.
  - On mount: `markGuestConversationReadAction` (guest) / host mark-read.
- Logic: load messages by `conversation_id`; RLS scopes to the participant
  (`guest_manage_conv` / `host_manage_conv`). Wielo's messages align left, the
  user's align right (by `sender_id` vs self).
- DB writes: `messages.read_by_guest=true` (guest) · `conversations.unread_guest=0`.
- Side-effects: status(none) · the user's unread badge clears.
- Next: → Step 4.

## Step 4 — The user sends a message to Wielo
- Trigger: send · Actor: guest | host
- Functions/files: guest `sendGuestMessageAction` (`portal/inbox/actions.ts`) /
  host send action → insert `messages` (`read_by_<self>=true`).
- Logic: ownership re-checked (`guest_id`/`host_id` = the user); the insert fires
  `on_message_inserted()`.
- DB writes: `messages` (insert) · `conversations.last_message_*` + the trigger
  bumps the **admin** side (`unread_host` on a guest thread; `unread_guest` on a
  host thread).
- Side-effects: the thread surfaces as unread in `/admin/inbox`.
- Next: → Step 5.

## Step 5 — Wielo sees it and replies (admin inbox)
- Trigger: admin opens `/admin/inbox` · Actor: system(admin)
- Functions/files: `admin/inbox/page.tsx` lists `channel='platform'` threads,
  joining BOTH `host:hosts` and `guest:user_profiles`. Per thread:
  `isGuest = host_id === null` → counterpart + unread come from the guest
  (`unread_host`) or the host (`unread_guest`); chip "Guest" (sky) / "Host"
  (green); the details drawer shows a guest identity (no account snapshot) or the
  host account snapshot.
- Logic: on open, `adminMarkPlatformReadAction` clears the admin side —
  `unread_host` for guest threads, `unread_guest` for host threads. Reply via
  `adminReplyPlatformAction`, always posted AS "Wielo Support"; the read flags
  invert by `host_id === null` (guest thread → `read_by_host=true,
  read_by_guest=false`).
- DB writes: `messages` (reply) · `conversations` unread cleared on the admin
  side, then the reply bumps the user's side (`unread_guest` on a guest thread).
- Side-effects: the user's unread badge lights up; realtime refresh pushes it to
  their open thread.
- Next: → Step 3 (the user reads + replies; loop).

---

## Verified (2026-07-12)
- Guest thread `ad9a9f1e…` (guest `72811b8e`): auto-created + pinned first with the
  "Wielo" chip + welcome. Guest sent a message → `unread_host=1` (admin badge),
  `unread_guest=0`. A Wielo reply → `unread_guest=1` and appeared in the guest
  thread. Host support thread unchanged.

## ⚠️ Not yet verified / follow-ups
- Admin `/admin/inbox` UI click-through for a guest thread (verified via build +
  DB routing only — needs a super-admin session).
- Rich system cards (`payment_link`, `subscription_upgrade`, pay-card status
  flips) exist for HOST threads only (`adminPostPaymentLinkToHostThread` etc.);
  no guest equivalent yet.
