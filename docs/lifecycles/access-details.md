# Access details — lifecycle flow

> How a guest gets the door code. **Two independent schedules that are easy to
> confuse** — the access card + email (lead-time based, pure SQL) and the day-before
> check-in reminder (hourly, HTTP worker). They fail differently — read the table.
>
> Steps marked ✅ were traced through code; ⚠️/🔴 mark what is unproven or broken.

## The two schedules — don't conflate them

| | **Access card + stay-details email** | **Check-in reminder** |
|---|---|---|
| Cron | `send-access-cards` — `*/15 * * * *` | `drain-checkin-reminders` — `10 * * * *` |
| Mechanism | **pure in-DB SQL** — `send_due_access_cards()` | `net.http_post` → Next.js route |
| Vault needed | **none** ✅ | `checkin_reminder_worker_url` ✅ **created 2026-07-16** |
| Timing | **`send_lead_minutes` before check-in** (default 60) | **check_in == tomorrow** |
| Status today | works | ✅ unblocked — ⚠️ unproven (needs a real booking) |
| Migration | `20260605000001` → current def `20260712120000` | `20260707150000` |

**Until 2026-07-16 the reminder was dead.** Its DO block reads Vault
`checkin_reminder_worker_url`, which **no migration creates** — a manual one-time
`vault.create_secret` documented only in the migration header, and it had never been
run. Unset → `RAISE NOTICE` + return: no error, no row, no alert. The secret now exists.

⚠️ **Still unproven:** with 0 bookings nothing is ever due, so the cron early-returns and
reports `succeeded` exactly as it did while broken. **A green run proves nothing here.**

**Blast radius is narrow:** only the day-before nudge is lost. The access card and
`stay_details_guest` email do **not** depend on Vault at all — they're emitted by
in-DB SQL and delivered by `drain-email-queue`, whose secrets *are* set.

---

## Tables

**`property_access`** — one row per property, PK = `property_id` (was
`listing_access`, `20260603000001`; renamed `20260617000100`):
`check_in_method` · `check_in_instructions` · `gate_code` · `door_code` ·
`wifi_network` · `wifi_password` · **`send_lead_minutes`** int NOT NULL **DEFAULT 60**,
`CHECK BETWEEN 15 AND 10080` (`20260712120000`).

RLS: **host-manage only, no anon/guest SELECT** — deliberate, because `properties` is
publicly readable and RLS is row- not column-level. The guest reads access details
only through the trip page, via the service role, after the booking is verified as theirs.

**`property_room_access`** — PK `room_id`, the same six fields, **no
`send_lead_minutes`** (lead is property-level only). Per-field fallback to
`property_access`.

**`bookings.access_card_sent_at`** — the once-only idempotency stamp
(`20260605000001`).

---

### Step 1 — Host fills in the Guest Access tab ✅
- Trigger: Property → edit → Guest Access · Actor: host
- Functions/files: `properties/[id]/edit/tabs/GuestAccessTab.tsx` (`AccessForm`) →
  `saveListingAccessAction` (`edit/actions.ts`) → upsert `property_access`
  `onConflict:'property_id'`. Blank strings → `null`.
- Lead-time control: a `<select>` over `ACCESS_LEAD_OPTIONS` (60/120/180/360/720/
  1440/2880/4320 min). Note the DB + zod allow **15–10080**, so 15–59 and >4320 are
  valid but unreachable through the UI — intentional headroom, not a bug.
- Next: → Step 2.

### Step 2 — The card + email go out, `send_lead_minutes` before check-in ✅
- Trigger: cron `send-access-cards`, `*/15 * * * *` · Actor: system
- Functions/files: `send_due_access_cards()` — current definition
  `20260712120000_configurable_access_send_time.sql`.
- Logic: select bookings where the check-in instant is
  `BETWEEN now() - interval '12 hours' AND now() + COALESCE(pa.send_lead_minutes, 60) minutes`,
  `status IN ('confirmed','checked_in')`, and **`access_card_sent_at IS NULL`**.
  Check-in instant = `(check_in || check_in_time)` pinned `AT TIME ZONE
  'Africa/Johannesburg'`.
- Per booking, in one iteration: insert the **access card** into `messages`
  (`is_system_message`, `system_event='access_details'`, `read_by_guest=false`;
  conversation = the quote's thread → an existing open host↔guest thread → a new one),
  **and** enqueue the **`stay_details_guest`** email. Then stamp
  `access_card_sent_at = now()` → once per booking, both channels together.
- 🔑 The queued email payload is only `{booking_id}` — **no secrets travel through the
  queue**; the drain re-resolves them with the service role.
- Email: `emails/templates/StayDetailsGuest.tsx` (package is repo-root **`emails/`**,
  not `packages/emails`), registry `lib/email/registry.ts`, resolver
  `stayDetailsGuestResolver` (`lib/email/resolvers/booking.ts`), which re-reads
  `property_access` + `property_room_access` and merges per-field. Transactional — no
  category, so it ignores notification preferences.
- DB writes: `messages`, `email_queue`, `bookings.access_card_sent_at`.

### Step 3 — The day-before reminder ✅ unblocked, ⚠️ never yet exercised
- Trigger: cron `drain-checkin-reminders`, `10 * * * *` · Actor: system
- Functions/files: `20260707150000_checkin_reminder_cron.sql` →
  `app/api/checkin-reminder-worker/route.ts`.
- Logic: Vault `checkin_reminder_worker_url` + `email_worker_secret` → POST the route
  (bearer `EMAIL_WORKER_SECRET`, constant-time compare; unset → every request 401s).
  The route selects ≤100 bookings where `status='confirmed'` AND `check_in ==
  tomorrow` AND not deleted, and dispatches to **both** host
  (`check_in_reminder_host`) and guest (`check_in_reminder_guest`).
- **The worker is its own idempotency gate** (`alreadyReminded()` against
  `notification_delivery_log`), because in-app is not de-duped by `dispatchEvent`.
- `check_in_reminder_guest` is **push + in-app only — no email template**, by design.
- ✅ `checkin_reminder_worker_url` created 2026-07-16 → `https://wielo.co.za/api/checkin-reminder-worker`. ⚠️ Unproven until a real booking has `check_in = tomorrow`.

### Step 4 — The guest sees the details on the trip page ✅
- Functions/files: `portal/trips/[id]/page.tsx` — fetch via `createAdminClient()`
  *after* the booking is verified as this guest's.
- **The unlock rule:**
  ```ts
  accessUnlocked =
    now >= checkInWithTime - accessLeadMs &&
    ["confirmed","checked_in","completed","checked_out"].includes(booking.status)
  ```
  with `accessLeadMinutes = listingAccess?.send_lead_minutes ?? 60`.
- 🔑 **Gated on status + time — NOT on payment.** A `confirmed` booking with an
  outstanding balance still unlocks. This **contradicts the `20260712110000` migration
  header** ("when a booking is confirmed **+ paid**"); status-only is the real
  behaviour. Decide which is intended.
- `checkInWithTime` is hard-pinned to `+02:00` because `check_in_time` is SA
  wall-clock — a previous bug parsed it as server-local and unlocked ~2h late.
- **Gated fields:** `gate_code`, `door_code`, `wifi_password` → replaced by a locked
  pill. **Always visible:** `check_in_method`, `wifi_network`, `check_in_instructions`.
- The cron and the page read the **same** `send_lead_minutes`, so the email and the
  unlock stay in lockstep by design.

---

## Gaps (each verified, none fixed)

1. ✅ **FIXED — `drain-checkin-reminders` never fired** (Vault `checkin_reminder_worker_url`
   missing; created 2026-07-16). ⚠️ Still unproven end to end — see the top of this doc.
2. ✅ **FIXED — room access could not be saved.** `RoomAccessSection.tsx` used
   `zodResolver(listingAccessSchema)` but registered **no** `send_lead_minutes` field.
   `20260712120000` added that key to the **shared** schema as **required**, so
   `handleSubmit` failed validation on a field that wasn't on the form, `onSubmit`
   never fired, and with no field there was no `<FormMessage/>` to say why — **"Save
   room access" silently did nothing.** The server agreed: `updateRoomAccessAction`
   re-parsed with the same schema, so even a hand-crafted call got *"Some fields look
   wrong"* — while never writing `send_lead_minutes`, because `property_room_access`
   has no such column. The field was demanded and discarded.
   Fixed by splitting the schema: **`roomAccessSchema = listingAccessSchema.omit({
   send_lead_minutes: true })`**, used by both the form and the action. Locked with
   11 unit tests (`edit/accessSchemas.test.ts`) whose first case proves the old
   pairing fails. **Root cause worth remembering: a shared schema gained a
   parent-level required field while a child form reused it.** Keep them split.
3. **Timezone mismatch between the two schedules.** `send_due_access_cards()` computes
   check-in in `Africa/Johannesburg`; the reminder worker computes "tomorrow" in
   **UTC**. For SA (UTC+2) they disagree for 2 hours each day around the date boundary,
   so a booking can be reminded a day early/late at the edges. Dedupe keeps it to one
   send, so the effect is a shifted reminder, not a duplicate.
4. **Status filters differ.** The worker takes `status='confirmed'` only; the SQL cron
   takes `('confirmed','checked_in')`. An early-checked-in booking gets the card but no
   reminder.
5. **Batch cap with no overflow signal.** The worker caps at 100 with no pagination;
   >100 check-ins tomorrow silently drops the remainder for that run. It self-heals on
   the next hourly tick via dedupe, but nothing warns that the cap was hit.
6. **Stale comments** — `20260712110000` and `20260605000001` still say "≈1h before
   check-in" / hardcode 60, superseded by the configurable lead.

## Operational notes

To turn the day-before reminder on:
`SELECT vault.create_secret('https://wielo.co.za/api/checkin-reminder-worker',
'checkin_reminder_worker_url', '');` — `email_worker_secret` is already set. Then
confirm `cron.job_run_details` shows the worker being posted rather than the
early-return.

## Related

`booking.md` (already cross-references `property_access.send_lead_minutes` — don't
duplicate it) · `reviews.md` (the same Vault-soft-skip failure mode) ·
[[feedback-feature-lifecycle-docs]].
