# Smoke Test — 2026-06-14 session

Covers everything built/changed this session. Tick each box; note anything off.

## Logins
- **Host:** `host@vilodemo.com` / `ViloDemo123!`
- **Guest:** `guest@vilodemo.com` / `ViloDemo123!`
- Re-seed if data looks off: from `apps/web` → `pnpm seed:demo`
- ⚠️ Some tests need **a host with 2 businesses** and/or **a completed booking** —
  noted inline. If the demo host has only one business, use the account that owns
  **B10 + Business 2** for the multi-business tests.

---

## 1. Uniform layout (affects every page)
- [ ] Open several dashboard pages (`/dashboard`, `/dashboard/bookings`,
  `/dashboard/ledger`, `/dashboard/guests`, `/dashboard/calendar`,
  `/dashboard/settings`). **Expect:** each fills the width with a **~50px gap**
  on all sides (sidebar / header / right / bottom); no page is narrower/centered
  than the others; **no horizontal scroll**.
- [ ] **Inbox** (`/dashboard/inbox`) is the exception — still **full-bleed** (no
  50px inset, two-pane fills the area).
- [ ] Mobile width (narrow the window): inset shrinks (~24px), content stays usable.
- [ ] Forms (`/dashboard/bookings/new`, quotes new/edit) now span full width —
  confirm they still look OK (flag if any field stretches uncomfortably wide).

## 2. Guest Reputation (NEW — hosts rate guests)
Path: **Dashboard → Guests → open a guest → Reputation tab**
- [ ] Open a guest **with a completed/checked-out booking** → Reputation tab shows
  **"Rate this guest"** enabled.
- [ ] Open a guest **without** a completed stay → button disabled, "Available after
  a completed stay."
- [ ] Open an **email-only** guest (no Vilo account) → "No Vilo account yet" state.
- [ ] Click **Rate this guest** → modal: overall star (required) + summary + the 5
  dimensions (Payments, Communication, Cleanliness, House rules, Integrity) with
  optional notes. Submit → your review appears at top with **Edit / Delete**.
- [ ] **Edit** changes it; **Delete** removes it (confirm modal).
- [ ] Aggregate star + "Rated by N hosts" updates.
- [ ] **Cross-host (needs a 2nd host account + same guest with a completed stay):**
  host A rates → host B's Reputation tab shows it under **"Other hosts"** (anonymised
  "A verified host") and the aggregate reflects both; **B cannot edit A's** review.
- [ ] **Guest never sees it:** log in as the guest → nothing about ratings anywhere.

## 3. Ledger ↔ multi-business (NEW filters)
- [ ] **Ledger** (`/dashboard/ledger`): if the host has >1 business, a **"All
  businesses / …"** selector appears (top-right of the filter row). Pick a business
  → rows, the 5 KPIs, and running balances scope to that business; subtitle shows
  the business name. Pick "All" → everything returns.
- [ ] Single-business host → selector hidden (correct).
- [ ] **Guest Record → Finances tab:** the **Business** selector sits to the right
  of the action buttons (Record payment / Refund / …). Pick a business → the
  transaction list scopes; a note says **the headline balance still reflects all
  businesses**. The big balance at top does **not** change when filtering.
- [ ] (If a listing is assigned to Business 2 with a booking) confirm that booking's
  invoice/payments show under **Business 2** when filtered.

## 4. Finance documents carry the right business
- [ ] Open an invoice (public link or PDF), a quote (page + PDF), a receipt → the
  **"From" block + banking + logo** match the **business that owns the listing**
  (not a generic/host value). Document numbers are per-business
  (e.g. `Q-BUSINESS2-…`).

## 5. Refunds — escalation removed (direct-payment model)
- [ ] `/dashboard/refunds`: **no "Escalated" tab/filter** anywhere; tabs are
  Pending / Approved / Declined / All.
- [ ] Approve a pending refund → records approved + completed; the refund shows
  **who actioned it**. Decline works too.
- [ ] **Guest side** (`/portal` → a trip → Request refund): the helper text says
  refunds are **arranged directly between you and your host** (no "escalate to
  support").

## 6. Targeted bug fixes to verify
- [ ] **iCal feed removal** (`/dashboard/calendar-sync`): add a feed, then remove it
  → only that feed's imported blocks clear; other listings' blocks untouched. (No
  way to remove another host's feed.)
- [ ] **Staff invite** (`/dashboard/staff`): create an invite → the **copyable link**
  goes to `/staff/accept/<token>` and that page loads (not a 404). (Email isn't
  sent yet — that's the deferred email worker.)
- [ ] **Dashboard KPIs** (`/dashboard`): revenue / upcoming / occupancy / unread all
  render real numbers (not all zeros); currency shows the booking's currency.
- [ ] **Notifications**: the bell unread count and `/dashboard/notifications` show
  **only your** notifications; mark-read works.

## 7. Guest portal
- [ ] Log in as guest → `/portal`: overview, **Trips**, **Quotes**, **Inbox**,
  **Reviews**, **Browse**, **Notifications**, **Settings** all load.
- [ ] Bell unread count + `/portal/notifications` show only the guest's own.
- [ ] Book-again / quote accept / message reply each work end-to-end.

## 8. iCal on the live site (after a redeploy)
- [ ] `ICAL_TOKEN_SECRET` is set on Vercel (done). After the **next deploy**, open a
  listing's iCal export URL → it returns a valid `.ics` (not a 500). (Tell me to
  trigger a redeploy if you want this live now.)

---

### Known / expected (NOT bugs)
- "Revenue" on the dashboard = **booked value** (confirmed/checked-in/completed),
  not cash collected — cash lives on Analytics' Cash-position panel.
- Some settings/data pages are English-only (i18n sweep is separate).
- Staff invite email isn't dispatched yet (deferred notification worker).
