# Communications — UI Design Brief

> For the founder to design against. Build follows the approved design (pixel-perfect),
> the same way the affiliate manager was built. Grounded in the **real** notification
> registry (`apps/web/lib/notifications/registry.ts`) so mockups use true message names
> and data fields.

---

## 1. What this is

**One place to manage every message Wielo sends** — email, push, and in-app. It replaces
three scattered admin surfaces that do overlapping jobs today:

- **Broadcasts** (`/admin/broadcasts`) — site-wide announcements/banners
- **Send to users** (`/admin/notifications`) — one-off message to picked users + history
- **Email templates** (`/admin/emails`) — read-only template catalogue + delivery health

**Core principle — one model, many lenses.** There is a single store of "what messages
exist and how they behave." The global **Communications** hub is the full view; the
competition **Email tab** is the *same data filtered to one campaign*. Editing a message
in either place edits the same thing — no second system, no drift.

---

## 2. Where it lives

- **Global:** admin sidebar → **Communications** (Platform section), replacing the three
  entries above with one.
- **Contextual:** an **Email** tab inside each competition (sits next to *Marketing* in
  the campaign dashboard tab row: Overview · Metrics · Standings · Results · Partners ·
  Marketing · **Email** · Rules & prizes).

---

## 3. Top-level structure — 3 tabs

| Tab | Purpose | Nature |
|---|---|---|
| **A. Automated messages** | The system's event-triggered messages (booking, affiliate, competition, etc.). On/off, channels, edit copy, preview, health. | The new source of truth |
| **B. Send & Broadcast** | Manual sends — one-off message to an audience **and** standing banners, merged into one compose flow + history. | Ad-hoc |
| **C. Delivery health** | Queue depth, sent/failed in last 24h, failure log. | Monitoring |

---

## 4. Tab A — Automated messages  *(the biggest new surface)*

**Layout:** a searchable list, **grouped by area**. Each group is a labelled section:

`Bookings · Guests · Payments & refunds · Reviews · Subscription · Account · Quotes ·
Messages · Looking For · Affiliates · Competitions`
*(Website comms are deferred — do not design them yet.)*

**Row anatomy (one per message):**
- Message name + one-line description ("New booking request → host")
- **Channel pills** — Email / Push / In-app — each independently on/off
- **Master on/off** switch
- Mini health stat — "sent 42 · 0 failed (24h)" or "never sent"
- Actions — **Edit** · **Preview**

**Edit drawer/panel (opens from a row):**
- **Subject** field (email)
- **Intro block** — a short editable paragraph. *The rest of the email stays branded and
  fixed* — designer should show the editable zone vs. the locked branded frame.
- Channel toggles (Email / Push / In-app)
- **Preview pane** — renders the email with sample data, plus how the push + in-app look
- **Reset to default** (falls back to the built-in copy)
- Save

**States to design:** on · off · partial (some channels off) · never-sent · has-failures ·
edited-from-default (show a small "customised" marker).

**Filters:** by area, by channel, by status. Search by name.

---

## 5. Tab B — Send & Broadcast (merged)

One compose flow that covers both "message some users" and "announce to everyone":

- **Audience** — Everyone · Segment (Hosts / Guests / Partners / Competition participants) ·
  Specific users (multi-select picker with search)
- **Delivery kind** — one-off message · standing banner (banner adds start/end dates)
- **Channels** — Email / Push / In-app
- **Content** — Title, Body, optional Link (label + URL), Severity (info/default/high/critical)
- **Preview** across the chosen channels, then Send / Schedule
- **History** — list of past sends: audience, channels, when, delivered/opened counts, status

---

## 6. Competition Email tab  *(the scoped lens — the near-term priority)*

Same components as Tab A, **pre-filtered to this competition**, split into two blocks:

**Event emails (fire on something happening):**
- Partner enrolled — "You're in the Founding Race" *(new)*
- A referred host activated a listing *(new)*
- Milestone hit — "First to 10 🏆" *(new)*
- Commission earned *(exists)*
- Payout sent *(exists)*
- Paused / restored in the competition *(exists)*
- Competition won — results published *(exists)*

**Scheduled sequence (fire on a clock):**
- Kickoff / launch announcement *(new)*
- Standings digest — "You're #3" — with a **cadence picker** (e.g. weekly Mondays / monthly) *(new)*
- Ending soon — "2 weeks left" — with a **lead-time picker** (e.g. 14 days before end) *(new)*

**Nice-to-have visual:** a small horizontal **sequence timeline** — Kickoff → weekly digest
→ ending-soon → results — so the admin sees the whole arc at a glance. Each row keeps its
own on/off + edit + preview + (for scheduled) timing control.

---

## 7. Real data each message can show  *(so mockups aren't lorem-ipsum)*

- **Affiliate/competition emails** carry: partner first name, money amount (e.g. "R 89.90"),
  competition name, and a detail line (product name / payout method / prize summary).
- **Standings digest** (new) will carry: partner rank, score (live listings), leader gap,
  competition name, weeks remaining.
- **Milestone** (new): milestone label, prize amount.
- **Booking/guest/host** messages carry: guest first name, listing name, dates, amounts.

Design the cards/emails to flex around a first name that may be missing (fallback to a
neutral greeting) — the data is real and sometimes sparse.

---

## 8. Design system

- Follow `DESIGN_SYSTEM.md` brand tokens and the existing **admin console** visual language
  (the affiliate admin chrome + `components/affiliate/affiliate-manager.css`, and the inner
  tab pattern already used by the campaign dashboard).
- **Responsive / mobile-aware** — admin is used on phones too; the message list and toggles
  must work at mobile width.
- Include **empty**, **loading**, and **error** states for each surface.

---

## 9. Full message inventory to design for  *(from the live registry)*

Group the Automated-messages tab exactly like this. `[NEW]` = template to be created;
everything else already exists and just needs the management row.

- **Bookings (host):** new request · confirmed · cancelled · check-in reminder
- **Bookings (guest):** confirmed · declined · forfeited (no-show) · cancelled · check-in reminder
- **Payments & refunds:** EFT instructions · EFT proof received · EFT refund sent · refund
  request · refund approved · refund declined · refund completed · refund override
- **Reviews:** review request (guest) · new review (host)
- **Subscription:** welcome · renewing soon · payment failed · account restricted · credits added
- **Account:** welcome host · listing published · account suspended · staff invite
- **Quotes:** quote request (host) · quote sent (guest)
- **Messages:** new message
- **Looking For:** quote received · post expiring · new post in region · quote viewed ·
  quote accepted · quote declined
- **Affiliates:** commission earned · payout sent
- **Competitions:** paused/restored · competition won · partner enrolled `[NEW]` ·
  referral activated `[NEW]` · milestone hit `[NEW]` · kickoff `[NEW]` · standings digest
  `[NEW]` · ending soon `[NEW]`
- **Admin (manual — belong in Tab B):** broadcast · individual message · digest

---

## 10. Out of scope (defer)

- **All website/site-builder comms** (e.g. website enquiry) — separate sub-branch.
- **Full body/layout editing** of email templates — Communications edits **subject + intro**
  only; the branded frame stays fixed.
- The global-hub build order comes **after** the competition/affiliate system is finished —
  but you can design the whole thing now.

---

## 11. Build order (for reference, not for you to design around)

1. Commission foundation (60% snapshot, 25% default, campaign-end fix) — no UI.
2. Prizes/leaderboard cleanup — minimal UI.
3. **Competition Email tab** (this brief, §6) — first UI build.
4. Global Communications hub (§3–5) + merge Broadcasts/Send-to-users — after the above.
