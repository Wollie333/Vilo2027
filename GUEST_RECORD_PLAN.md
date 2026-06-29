# Guests (CRM) — Build Plan  ·  List + Record

**Status:** Planned — ready to build in a fresh session. Scope = List + Record + 20 enhancements +
5 pillar enhancements (A–E) + bulk mailer (Phase 9). Core decisions §9 locked; mailer decisions A–E to
confirm at the start of Phase 9.
**Designs (match exactly — now in-repo, version-controlled):**
- Guests **list** → `apps/web/app/dashboard/guests/_design/guests-list.html`
- Guest **record** → `apps/web/app/dashboard/guests/_design/guest-record.html`
- (`_design` has a leading underscore → ignored by the Next.js App Router; safe to keep alongside the route.)
**Owner area:** Host dashboard. **MVP feature** — schema must be properly aligned, not hacky.
**Created:** 2026-06-06.

---

## 1. Goal & scope

A CRM-style way for hosts to manage everyone who books or enquires:

1. **Sidebar:** new **Guests** destination (right after *Bookings*), with a live count badge.
2. **Guests list** (`/dashboard/guests`) — KPI strip + segmented, filterable, sortable, selectable
   directory. Matches `Guests List.html`.
3. **Guest Record** (`/dashboard/guests/[gkey]`) — identity + verifications, lifetime stat band, tabs
   **Overview / Bookings / Messages / Payments / Notes**, prev/next nav. Matches `Guest Record.html`.
4. **Two-way link** with **Booking Details** (`/dashboard/bookings/[id]`): booking → guest record; each
   booking row on the record → booking page.
5. **Bulk mailer** (Phase 9) — tag/segment-targeted broadcast email, once-a-month cap, POPIA-safe
   unsubscribe + per-guest subscription toggle. Reusable **message templates** for replies and broadcasts.

> **Why this shape** — the plan is built around the four reasons the platform exists: **(1) easy to manage
> any accommodation** (one directory + record), **(2) direct booking, never pay OTA fees** (commission-saved
> metric + "All direct" badges), **(3) own your guest contact info** (capture, contactability prompts,
> CSV/vCard export), **(4) cut the middleman for smooth comms** (Messages, templates, broadcast). Every
> enhancement traces back to one of these — nothing is decoration.

### Project rules that apply (do not skip)
- Renders inside the existing **`ClassicShellFrame`** (header + Gmail sidebar already built); pages
  supply **content only**.
- **Dynamic data only** — never hardcode the mockups' sample values. Where the design shows something we
  don't store (e.g. "Needs: baby cot"), derive from a real field (`bookings.special_requests`) or omit.
- **Modal system** (`Modal`/`FormModal`) for Add guest / Add tag / Block / Export — never `window.confirm`.
- **Brand name** via `<BrandName>` / `useBrandName()` — never hardcode "Wielo".
- **Help Centre article** required (seed `help_articles` migration).
- **Not feature-gated** (core host tool; pre-MVP everything is open anyway).
- **Mutations → Server Actions.** **Every query scopes `host_id`** (RLS + explicit filter; pin the FK on
  `user_profiles` embeds per the dashboard-query-gotchas memory).
- **Migrations:** additive, new files only; regen `packages/types/database.types.ts` (`> file` only —
  never `2>&1`). Pre-MVP allows reshapes, but design this cleanly the first time.

---

## 2. The core model: who is a "guest"? (identity + the `gkey`)

A guest is **not** always a `user_profiles` row. Three origins:
- **Registered** — `bookings.guest_id` set (FK → `user_profiles`). Has account, avatar, languages,
  country, conversations, reviews.
- **Email-only booking contact** — manual bookings, `guest_id NULL`, `guest_email` set. No account,
  no conversations/reviews. The New-Booking past-guest list already dedupes these **by lowercased email**.
- **Manually-added contact** — host clicks **"Add guest"** with no booking yet (new for this feature).

> `user_profiles.id` FKs to `auth.users(id)` → we **cannot** create a `user_profiles` row for a contact
> without an auth user. So "Add guest" writes to a new **`guest_contacts`** table (below), and the
> directory **unions** bookings-derived guests + contacts, deduped by a canonical key.

### Canonical guest key (`gkey`) — one key everywhere
- Registered → **`u_<user_profiles.id>`**
- Email-based (booking contact or manual contact) → **`e_<base64url(lower(email))>`**

The `gkey` is the route param, the dedupe key in the list RPC, and the key column on all host-scoped CRM
tables (`guest_contacts`, `guest_notes`, `guest_tags`, `guest_flags`). Deterministic → trivially parseable
(`u_` → resolve by `guest_id`; `e_` → decode → resolve by email).

### Merge rule (record + stats)
A registered guest may have older **manual** bookings under the same email. Stats/lists union both:
```
WHERE host_id = :host AND deleted_at IS NULL
  AND ( guest_id = :guest_id
        OR (guest_id IS NULL AND lower(guest_email) = :email) )
```
Email-only guest → only the second branch. **Edge case:** if an email-only guest later registers, their
`gkey` flips from `e_…` to `u_…`, orphaning notes/tags — acceptable for MVP; note a future reconcile job.

---

## 3. Data model — reuse vs. new (aligned MVP schema)

### Reuse as-is
- `bookings` — `guest_id`, `guest_name/email/phone`, `status`, `check_in/out`, `nights`, `guests_count`,
  `total_amount`, `currency`, `channel` (`direct|airbnb|booking|expedia|other` — already added),
  `special_requests`, `cancelled_at`, `cancelled_by`, `created_at`.
  - Realized "stays" status set = `('confirmed','checked_in','completed')` (matches the app).
  - **In-house** = `status='checked_in'` OR (`status` in realized set AND `check_in <= today < check_out`).
  - **Guest cancellations** = `status='cancelled_by_guest'`.
  - **Via OTA** = any booking with `channel <> 'direct'`.
- `user_profiles` — `full_name, email, phone, avatar_url, bio, country, languages[],
  preferred_cities[], is_lead, created_at` ("guest since"), `deleted_at`.
- `conversations` + `messages` (Messages tab; reuse `sendMessageAction` from `inbox/actions.ts`;
  conversations keyed by `guest_id` → email-only/contacts have none → empty state).
- `payments` (`amount, currency, method, status, booking_id, captured_at, refunded_amount,
  provider_reference`) — join via `booking_id`.
- `reviews` (`rating, guest_id, listing_id, body, created_at, is_published`) — avg rating left.
- `listing_photos` — booking-row + "usual listing" thumbnail (cover = min `sort_order`).

### NEW — migrations (additive, host-scoped)
The `gkey`-scoped CRM tables (1–4, 6) share the shape `(host_id, gkey text, …)` with RLS
`host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid())` and admin read via
`user_profiles.role = 'super_admin'` (**not** `user_role`). `guest_broadcasts` (7) and
`message_templates` (8) are host-scoped only (no `gkey`). Same RLS shape on all of them.

1. **`guest_contacts`** — manually-added guests (the "Add guest" button) and host-editable CRM fields.
   ```sql
   CREATE TABLE public.guest_contacts (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     host_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
     gkey text NOT NULL,                         -- e_<base64url(email)> (manual contacts must have email)
     full_name text,
     email text,
     phone text,
     country text,
     notes text,                                 -- optional free text on create
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (host_id, gkey)
   );
   CREATE INDEX idx_guest_contacts_host ON guest_contacts(host_id);
   ```
2. **`guest_notes`** — Notes tab (internal, host-only).
   ```sql
   CREATE TABLE public.guest_notes (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     host_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
     gkey text NOT NULL,
     author_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
     body text NOT NULL,
     is_pinned boolean NOT NULL DEFAULT false,    -- powers the Overview "Pinned note"
     created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX idx_guest_notes_host_gkey ON guest_notes(host_id, gkey);
   ```
3. **`guest_tags`** — the VIP tag + "Add tag"/bulk-tag. ("Returning"/"New" are derived, not stored.)
   ```sql
   CREATE TABLE public.guest_tags (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     host_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
     gkey text NOT NULL,
     label text NOT NULL,                         -- e.g. 'VIP'
     created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (host_id, gkey, label)
   );
   CREATE INDEX idx_guest_tags_host_gkey ON guest_tags(host_id, gkey);
   ```
4. **`guest_flags`** — Block guest (and room for future per-guest flags).
   ```sql
   CREATE TABLE public.guest_flags (
     host_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
     gkey text NOT NULL,
     is_blocked boolean NOT NULL DEFAULT false,
     blocked_at timestamptz,
     blocked_reason text,
     PRIMARY KEY (host_id, gkey)
   );
   ```
5. **Verification columns** on `user_profiles` (nullable, additive) so the record's chips are honest:
   ```sql
   ALTER TABLE user_profiles
     ADD COLUMN phone_verified_at timestamptz,
     ADD COLUMN id_verified_at    timestamptz;
   ```
   Render: **Email confirmed** = registered account exists (Supabase verified email at signup) → show for
   any `u_` guest. **Phone/ID verified** → show chip only when the column is set; never show a red
   "unverified". No KYC flow built now — columns are display-ready for later.

6. **`guest_marketing`** — per-guest, per-host marketing subscription state (powers the bulk mailer).
   Opt-out model for existing guests (POPIA existing-customer basis) + a working unsubscribe.
   ```sql
   CREATE TABLE public.guest_marketing (
     host_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
     gkey text NOT NULL,
     email text NOT NULL,
     is_subscribed boolean NOT NULL DEFAULT true,   -- existing-customer opt-out (every email carries unsubscribe)
     unsub_token uuid NOT NULL DEFAULT gen_random_uuid(),
     source text,                                   -- 'booking' | 'manual' | 'import'
     subscribed_at   timestamptz NOT NULL DEFAULT now(),
     unsubscribed_at timestamptz,
     PRIMARY KEY (host_id, gkey)
   );
   CREATE UNIQUE INDEX idx_guest_marketing_token ON guest_marketing(unsub_token);
   ```
   > **Lazy rows.** A guest counts as *subscribed* when there is **no** row OR `is_subscribed = true`.
   > Rows are minted on demand — first per-guest toggle, or at send time for each recipient (to issue an
   > `unsub_token`). No backfill needed.
7. **`guest_broadcasts`** — INSERT-only send log (also enforces the once-a-month limit).
   ```sql
   CREATE TABLE public.guest_broadcasts (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     host_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
     subject text NOT NULL,
     body text NOT NULL,                            -- sanitized HTML/markdown body
     audience text NOT NULL,                        -- 'all' | '<tag label>' | '<segment key>'
     recipient_count int NOT NULL DEFAULT 0,
     status text NOT NULL DEFAULT 'sent',           -- 'sent' | 'failed'
     created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
     sent_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX idx_guest_broadcasts_host_sent ON guest_broadcasts(host_id, sent_at DESC);
   ```
8. **`message_templates`** — reusable canned snippets for replies **and** broadcasts (enhancement **C**;
   serves Pillar 4 — smooth direct comms). Not guest-scoped — host-owned, reusable everywhere.
   ```sql
   CREATE TABLE public.message_templates (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     host_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
     title text NOT NULL,                           -- 'Check-in details'
     body  text NOT NULL,                           -- supports {first_name}
     channel text NOT NULL DEFAULT 'both',          -- 'message' | 'email' | 'both'
     sort_order int NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX idx_message_templates_host ON message_templates(host_id, sort_order);
   ```
   Seed 3–4 starter templates per host (check-in details, thank-you, review request, return offer) so the
   feature is useful on day one — no blank slate.

> ⚠️ **Migration-drift caution** (migration-repair-drift memory): after writing migrations, `supabase db
> push --linked` and **verify against the live DB with a service-role probe** — don't trust `migration
> list`. Use `role = 'super_admin'` in admin RLS. Regen types.

---

## 4. Server data layer (RPCs + actions)

### RPCs
- **`fetch_host_guests(p_host_id, p_segment, p_search, p_listing_id, p_channel, p_min_rating, p_sort,
  p_limit, p_offset)`** → the list. Builds the unified directory: `UNION` of
  (a) distinct guests from `bookings` (registered + email-only) and (b) `guest_contacts`, deduped by
  `gkey`. Per guest returns: `gkey, guest_id, name, email, phone, avatar_url, channel (latest),
  segment flags (is_vip,is_returning,is_new,is_ota,is_inhouse,**is_lapsed,is_all_direct**), is_verified,
  **has_email,has_phone**, total_stays, total_nights, lifetime_value, **direct_value, est_fees_saved**,
  currency, first_stay, last_stay, last_status, next_stay {date,listing}, avg_rating, review_count`.
  Plus the **tab counts** (all/vip/returning/new/ota/**lapsed**) and **KPI block** (total_guests,
  new_last_30, returning_count, repeat_rate, avg_ltv, total_ltv, avg_rating, review_count, staying_this_month,
  **direct_value, est_fees_saved** (Pillar 2 — direct revenue × OTA fee rate, §9.E), **missing_contact_count**
  (Pillar 3 — guests with no email or no phone)) and a **total_count** for pagination + the sidebar badge.
  - `segment` filter: `vip` = has 'VIP' tag; `returning` = stays>1; `new` = stays<=1; `ota` = any OTA booking;
    **`lapsed`** = last stay > 6 months ago AND no upcoming stay (enhancement **D**, feeds the mailer audience).
  - **`is_all_direct`** = every booking `channel='direct'` (drives the "All direct" badge, Pillar 2).
  - `sort`: `recent` (recently active — in-house/upcoming first, else last activity desc), `value`,
    `stays`, `name`.
  - Consider returning KPIs/tab-counts from a **separate** light RPC `fetch_host_guests_summary` so they
    don't recompute per page.
- **`fetch_guest_record(p_host_id, p_guest_id, p_guest_email)`** → record identity + the 5 stat-band
  numbers (stays/nights, lifetime value + avg/stay, avg rating + review count, cancellations + reliability,
  next stay {in N days, dates, listing}), tags, verification, blocked. Applies the merge rule.
- Tab lists (Bookings/Payments/Messages/Notes/Overview) via host_id-scoped **Server-Component selects**
  with the merge-rule WHERE (see §3 record details in the prior plan; unchanged).

### Server Actions
- `addGuestContactAction({name,email,phone,country,notes})` → insert `guest_contacts` (compute `gkey`).
- `addGuestNoteAction(gkey, body)` / `deleteGuestNoteAction(id)` / `pinGuestNoteAction(id)`.
- `addGuestTagAction(gkey, label)` / `removeGuestTagAction(id)` / `bulkTagAction(gkeys[], label)`.
- `blockGuestAction(gkey, reason)` / `unblockGuestAction(gkey)` → upsert `guest_flags`.
- `exportGuestsAction(filters | gkeys[])` → CSV blob (list export + bulk export).
- Messages reply → reuse `sendMessageAction` (targets the most recent conversation; disabled with
  "Start in inbox" when none).

### Bulk mailer — broadcast email (NEW, MVP-lean, POPIA-safe)
The host picks an audience (everyone, a tag like *VIP*, or the current segment), writes one email, and sends.
Capped to **once per calendar month** so guests never get spammed. Every send is server-recomputed,
deduped by email, and skips unsubscribed/no-email guests. Resend is invoked **only from an Edge Function**
(per CLAUDE.md email rule).

- **RPC `count_broadcast_recipients(p_host_id, p_audience)`** → `{ eligible, no_email, unsubscribed }` so the
  composer shows "Will send to **N** · 3 skipped (no email) · 2 unsubscribed" *before* sending.
- **RPC `can_send_broadcast(p_host_id)`** → `{ allowed, last_sent_at, next_allowed_on }` (true unless a row
  exists in `guest_broadcasts` for the current calendar month). Drives the disabled state + "Next broadcast
  available on <date>" message.
- **Edge Function `send-guest-broadcast`** (Deno + Resend):
  1. Auth → resolve host. 2. Re-check `can_send_broadcast` server-side (never trust the client).
  3. Re-resolve recipients from the unified directory for `p_audience`; keep only `email IS NOT NULL` and
     **subscribed** (no `guest_marketing` row with `is_subscribed=false`); dedupe by lowercased email.
  4. Upsert a `guest_marketing` row per recipient to mint `unsub_token`.
  5. Send via Resend **batched** (≤100/req), each email wrapped in the branded template, with a one-click
     unsubscribe footer `{APP_URL}/unsubscribe/<unsub_token>` **and** a `List-Unsubscribe` header.
  6. Insert one `guest_broadcasts` log row (`recipient_count`, `status`). Return `{ sent, skipped }`.
  - **Sender (MVP):** from the platform's verified Resend domain (e.g. `hello@<brand-domain>`), **reply-to =
    host's email**, display name = host brand. Custom per-host sending domains are a later add.
- **Public unsubscribe** `apps/web/app/unsubscribe/[token]/route.ts` (or page) — no login: flips
  `guest_marketing.is_subscribed=false`, stamps `unsubscribed_at`, shows a simple "You're unsubscribed"
  confirmation. Supports `List-Unsubscribe-Post` one-click.

### Server Actions (mailer)
- `setGuestSubscriptionAction(gkey, subscribed)` → upsert `guest_marketing` (per-guest toggle on the record).
- `sendBroadcastAction({audience, subject, body})` → invokes the `send-guest-broadcast` Edge Function;
  surfaces `MONTHLY_LIMIT_REACHED` with `next_allowed_on` so the modal can explain the block. `audience`
  accepts `'lapsed'` (enhancement **D**) so a host can one-click win-back the right people.

### Message templates — actions (enhancement C)
- `listMessageTemplatesAction(channel?)` · `saveMessageTemplateAction({id?,title,body,channel})` ·
  `deleteMessageTemplateAction(id)`. Used by the Messages-reply composer **and** `BroadcastModal`; a
  `{first_name}` token is substituted at send time. Managed in **Settings → Templates** (simple list +
  add/edit), seeded with 3–4 starters per host.

### Contact export — vCard (enhancement E, Pillar 3)
- `exportGuestsAction` (already planned) honours the active filters/segment (enhancement #10) and adds a
  per-guest **vCard** download (`exportGuestVcardAction(gkey)`) — "your list, yours to keep".

---

## 5. UI build — files

### Sidebar (1 edit)
`apps/web/app/dashboard/_components/Sidebar.tsx` — add to `MAIN` right after Bookings:
`{ href: "/dashboard/guests", label: "Guests", icon: Users, match: "prefix" }` (import `Users`). **Live count
badge** (decision §9.6 = include now): thread `fetch_host_guests_summary.total_count` through the dashboard
layout into the nav item.

### Guests list — `/dashboard/guests` (match `Guests List.html`)
- `page.tsx` (Server: auth → host → summary RPC + first page of `fetch_host_guests` from `searchParams`).
- `_components/GuestsHeader.tsx` — title + summary subline (all-time · VIP · staying this month) + **Export**
  + **Add guest** (opens `AddGuestModal`).
- `_components/GuestKpiStrip.tsx` — 5 cards: Total guests (+new last 30 · +missing-contact count, **B**),
  Repeat-guest rate (+returning), Avg lifetime value (+total LTV), **Direct revenue (~OTA fees saved, A)**,
  Avg rating left (+review count).
- `_components/GuestsTable.tsx` (Client) — the whole table card:
  - **Segment tabs** All/VIP/Returning/New/Via OTA/**Lapsed** with counts (Lapsed = enhancement **D**).
  - **Quick-filter chips**: "Staying now" (#7).
  - **Filter row**: listings · channels · rating · "More filters"; **density** toggle (comfortable/compact,
    client-only); **sort** menu (recent/value/stays/name).
  - **Sticky, sortable column header**; sortable on Guest(name)/Stays/Lifetime.
  - **Rows** exactly per design: select checkbox; avatar (photo or initials) + in-house dot; name +
    verified badge; subline = channel (if OTA) + email; **Segment tag** (VIP green / Returning indigo /
    New sky / Via OTA gray) + left edge colour bar; Stays + nights; Lifetime value; Rating (stars or "—");
    **Last/next stay** badges (In-house sky / Cancelled red / upcoming amber+date / else last date + note +
    listing); **contactability chips** ("no email"/"no phone", **B**); **"All direct"** badge (**A**, Pillar 2);
    hover quick actions (Message → inbox, copy email/phone #1, Open profile → record). Row click → record.
  - **Bulk bar** on selection: N selected · Tag · Export (CSV) · Clear. (No bulk Message in v1 — §9.3.)
  - **Footer**: "Showing X of N" + pagination (server-side via `searchParams`).
  - **Empty state** per design.
- `_components/AddGuestModal.tsx` — `FormModal` (name/email/phone/country/notes) → `addGuestContactAction`.
- Filters/sort/segment/page live in the **URL** (`?seg=&sort=&listing=&channel=&rating=&q=&page=`) so the
  server re-queries and state is shareable; density + selection are client-only.

> Mirror the Bookings list server/client split (`apps/web/app/dashboard/bookings/page.tsx` +
> `BookingsBoard.tsx`) and reuse `formatMoney`, the unified `thin-scroll`, and brand tokens.

### Guest Record — `/dashboard/guests/[gkey]` (match `Guest Record.html`)
Unchanged from the prior plan: `page.tsx` (resolve gkey → record RPC + tab selects in parallel; 404 if no
data for host+guest), plus `_components/`: `GuestRecordSubheader` (back / breadcrumb / prev-next),
`GuestIdentityHeader` (avatar+verification badge, name+tags, contact row, verification chips, actions:
Message / Call `tel:` / More → New booking for guest / Add tag / Export / Block), `GuestStatBand` (5 stats
incl. dark "Next stay" tile), `GuestTabs` (URL `?tab=`), and panels `Overview / Bookings / Messages
(reuse inbox bubbles) / Payments / Notes (composer)`.

### Enhancements (in-scope) — 20 low-effort / high-value, woven into the phases above
All ride on data already loaded (bookings/payments/reviews/notes/tags/flags) — no new tables. Ease-of-use
first: each one removes a click or a moment of doubt for the host.

**Identity & at-a-glance (Phase 5)**
1. Click-to-copy on email & phone (icon on row hover + record).
2. `mailto:` · `tel:` · WhatsApp (`wa.me/<digits>`) action links.
3. "Guest since" relative label (e.g. "2 yrs · since Mar 2024") from `created_at`.
4. Deterministic pastel initials-avatar colour hashed from `gkey`.
5. Blocked-guest treatment: red left-bar + "Blocked" pill + muted row (earns the display-only flag).

**List power-ups — client-only (Phase 3 / 4)**
6. Relative last/next-activity times ("3 days ago" / "in 5 days").
7. "Staying now" quick-filter chip (uses `is_inhouse`).
8. "Arriving soon" count in the KPI subline.
9. Sticky bulk bar + "select all N matching" (beyond current page) for bulk tag/export.
10. CSV export honours the active segment/search/filters (exports the *visible* list).
11. Distinct empty states: "no guests yet" vs "no matches".

**Record tabs — squeeze existing joins (Phase 6)**
12. Lifetime-value mini bar/sparkline bucketed by year (existing payments).
13. Cancellation/reliability badge ("2 cancellations · 92% reliable") from booking statuses.
14. Average lead time ("books ~18 days ahead").
15. Preferred listing ("Usually stays: Sea View Loft") — most-booked.
16. Next-stay countdown on the dark tile ("Arrives in 5 days").
17. Notes show pin + author + timestamp (fields already exist).
18. Tag colour map (VIP/Repeat/Corporate fixed colours; grey fallback).

**Cross-feature glue (Phase 7)**
19. "New booking for this guest" — More-menu prefill into the New-Booking wizard.
20. Booking-detail → guest backlink upgraded with avatar + segment pill inline.

### Pillar enhancements (A–E) — make the platform's promise visible
These directly serve the four reasons the platform exists (ease of management · save OTA fees · own guest
contact info · smooth direct comms). All ride on data already loaded except **C** (one new table).

- **A · Commission saved (Pillar 2)** — `GuestKpiStrip` gains a card *"R142,300 direct · ~R21,300 saved in
  OTA fees"* (`direct_value` + `est_fees_saved` from the summary RPC). Per-guest **"All direct"** badge when
  `is_all_direct`. The single most on-brand metric — visible every time Guests opens. *(Phase 3.)*
- **B · Contactability (Pillar 3)** — subtle **"no email" / "no phone"** chips on rows from `has_email`/
  `has_phone`; KPI subline "8 guests missing contact details". Turns the directory into a prompt to capture
  the asset. *(Phase 3.)*
- **C · Message templates (Pillar 4)** — a **template picker** ("Insert template ▾") in the Messages-reply
  composer **and** `BroadcastModal`; managed in **Settings → Templates**. Seeded starters so it's useful
  immediately. *(Phase 6 for reply picker + Settings; Phase 9 for broadcast picker.)*
- **D · Win-back / Lapsed (Pillar 1+4)** — a **"Lapsed"** segment chip on the list (`is_lapsed`) and a
  matching **audience** in the mailer, so the host can see *and* re-engage dormant guests in two clicks.
  *(Phase 3 chip; Phase 9 audience.)*
- **E · Own-your-list export (Pillar 3)** — filtered CSV (enhancement #10) **+ per-guest vCard** download,
  framed "this is your guest list — yours to keep". *(Phase 4.)*

### Bulk mailer UI — `_components/BroadcastModal.tsx` (Phase 9)
A single, calm `FormModal` opened from a **"Email guests"** button on the list header (beside Export):
- **Audience** picker: *All subscribed* · *By tag* (VIP …) · *Current segment*. Live line under it:
  "Will send to **N** · 3 skipped (no email) · 2 unsubscribed" from `count_broadcast_recipients`.
- **Subject** + **Body** — deliberately simple: a clean textarea with light formatting and an optional
  `{first_name}` merge token; rendered inside the branded email wrapper. (No drag-drop builder for MVP —
  ease of use over power.)
- **Monthly-limit aware:** if `can_send_broadcast.allowed = false`, the Send button is disabled and the
  modal explains "You've sent this month's broadcast — next one available on <date>." A small **Recent
  broadcasts** list (subject · audience · recipients · date) sits below for reassurance/history.
- Confirm → `sendBroadcastAction` → success toast ("Sent to N guests"). Every email carries the unsubscribe
  footer automatically.
- **Per-guest control:** subscription toggle + "Subscribed/Unsubscribed" chip on the Guest Record identity
  block (`setGuestSubscriptionAction`), so hosts can honour a verbal opt-out instantly.

### Booking Details two-way link (1 edit)
`apps/web/app/dashboard/bookings/[id]/page.tsx` — in the guest block add "View guest record →" →
`/dashboard/guests/<gkey>` (compute gkey from the booking's guest_id/guest_email).

---

## 6. Phased build order (commit + push after each; build + lint green every time)

- **Phase 1 — Schema:** `guest_contacts`, `guest_notes`, `guest_tags`, `guest_flags`, `message_templates`
  (+ seed starters) + `user_profiles` verification columns + RLS; push + live-DB verify; regen types.
  (`guest_marketing` + `guest_broadcasts` land in Phase 9.) Commit.
- **Phase 2 — RPCs:** `fetch_host_guests` (+ summary) and `fetch_guest_record`; service-role probe against
  the demo host (correct shapes, sane numbers, segment counts). Commit.
- **Phase 3 — Sidebar + Guests list:** nav item **+ live count badge** (§9.6); list page; KPI strip; table
  with segments, sort, density, pagination, search, row → record, quick actions, empty state. (Filters +
  bulk + Add guest = Phase 3b if large.) Commit.
- **Phase 4 — Add guest + filters + bulk + export:** `AddGuestModal`, listing/channel/rating filters
  (core only — §9.4), selection + **bulk Tag/Export** (no bulk Message — §9.3), list Export. Commit.
- **Phase 5 — Guest Record shell:** route, sub-header, identity header, stat band, tab scaffold (Overview).
  Commit.
- **Phase 6 — Record tabs:** Bookings, Payments, Messages (bubbles + reply **+ template picker, C**), Notes
  (composer/pin). Build **Settings → Templates** manager (list/add/edit/delete) here. Commit.
- **Phase 7 — Two-way link + record actions:** Booking Details ↔ record link; Add tag / Block / Export;
  "New booking for guest" prefill. Commit.
- **Phase 8 — Help article + polish:** seed `help_articles`; empty states (email-only/contact, no messages,
  no payments); mobile responsive; demo-data sanity pass; CHANGELOG + CURRENT_TASK. Commit.
- **Phase 9 — Bulk mailer:** `guest_marketing` + `guest_broadcasts` migrations (regen types);
  `count_broadcast_recipients` + `can_send_broadcast` RPCs; `send-guest-broadcast` Edge Function (Resend,
  batched, unsubscribe link + monthly cap); public `/unsubscribe/[token]` route; `BroadcastModal` +
  per-guest subscription toggle; Help article for broadcasts. Live-send test to a seeded test inbox. Commit.

> The 20 enhancements are **not** a separate phase — each is tagged to the phase that already touches that
> surface (see §5 Enhancements). Build them inline; they're minutes each.

---

## 7. Edge cases / empty states
- **Email-only guest / manual contact:** initials avatar; only "Email confirmed" chip if registered, else
  none; **no Messages**, no reviews; Notes/Tags/Block still work (keyed by `gkey`). "Message" routes to
  New Booking / inbox start.
- **Registered guest + manual bookings same email** → merge rule unions both.
- **Deleted guest** (`user_profiles.deleted_at`) → keep history; mark inactive.
- **No next stay** → "Next stay" tile shows "None scheduled".
- **Mixed-currency lifetime value** → v1 sums in the host's default currency (usually ZAR); note assumption.
- **Segments overlap** (a VIP can also be Returning) — tabs are filters, not a partition; counts reflect each.
- **Broadcast compliance (POPIA)** — every marketing email **must** carry a working one-click unsubscribe +
  `List-Unsubscribe` header; recipients are always re-resolved server-side and unsubscribed/no-email guests
  are skipped; the once-a-month cap is enforced in the Edge Function, not just the UI. Unsubscribe is
  irreversible by the host (only the guest, or the host honouring a request via the per-guest toggle).
- **Broadcast with zero eligible recipients** → Send disabled with "No guests match / none subscribed yet."

## 8. Verify (Definition of Done)
- `pnpm build` + `pnpm lint` clean. No `console.log`. Types regenerated.
- Live-DB probe: both RPCs return correct, non-zero data + segment counts for the demo host.
- Click-through: Guests list → segment/sort/search/filter → open a guest → 5 tabs → open a booking →
  back-link returns to the guest. Add guest → appears in list. Block/tag/note persist.
- Help article visible. CHANGELOG + CURRENT_TASK updated.

---

## 9. Decisions — LOCKED (confirmed 2026-06-06)
1. **VIP definition** — ✅ **Manual `'VIP'` tag only** for v1. No auto-flagging; auto-suggest is a later
   enhancement. (`is_vip` segment = "has a 'VIP' tag" — nothing derived from value/stays.)
2. **"Block guest" enforcement** — ✅ **Display-only** for v1. Store `guest_flags.is_blocked` and surface a
   "Blocked" badge everywhere; do **not** block bookings/messages yet. Soft-enforce in New Booking later.
3. **Bulk Message** — ✅ **Deferred.** Phase 4 ships **bulk Tag + bulk Export** only. Bulk Message is a
   later add.
4. **"More filters"** — ✅ **Core filters only** now: **listings · channels · rating**. The "More filters"
   set (date range, has-review, cancelled-before) is deferred.
5. **Mixed-currency LTV** — ✅ **Host default currency** (usually ZAR); note the assumption in the UI.
   Per-currency breakdown deferred.
6. **Sidebar count badge** — ✅ **Include now.** Live guest count on the **Guests** nav item, fed by the
   summary RPC threaded through the dashboard layout. (Promotes §5's "optional" badge to in-scope.)

### Bulk mailer — decisions LOCKED (confirmed 2026-06-06)
A. **Consent default** — ✅ **Opt-out for booking guests** (subscribed by default, POPIA existing-customer
   basis, every email carries a working unsubscribe). **Manual contacts** must tick an "I have consent to
   email this person" checkbox on **Add guest** before they're emailable.
B. **Monthly window** — ✅ **Calendar month** (one broadcast per host per calendar month; "next available
   on the 1st").
C. **Composer richness** — ✅ **Simple** (subject + body + `{first_name}` merge token) inside the branded
   email wrapper. No drag-drop builder for MVP.
D. **Sender identity** — ✅ **Platform verified domain + reply-to = host email**, display name = host brand.
   Per-host custom sending domains are a later add.

### Pillar-enhancement decision — LOCKED
E. **OTA fee rate for "commission saved" (enhancement A)** — ✅ **Single platform constant 15%** for MVP
   (typical OTA host commission), always shown with a "~" and an info tooltip ("estimated vs typical OTA
   fees"). Promote to a host-setting later, not now.

---

### Key file references (for the build session)
| Asset | Path |
|---|---|
| Designs (in-repo) | `apps/web/app/dashboard/guests/_design/guests-list.html`, `…/guest-record.html` |
| Sidebar nav | `apps/web/app/dashboard/_components/Sidebar.tsx` |
| Bookings list (mirror server/client split) | `apps/web/app/dashboard/bookings/page.tsx` + `BookingsBoard.tsx` |
| Booking detail (link) | `apps/web/app/dashboard/bookings/[id]/page.tsx` |
| New booking past-guest dedupe | `apps/web/app/dashboard/bookings/new/page.tsx` |
| Inbox bubbles + send action | `apps/web/app/dashboard/inbox/InboxView.tsx`, `inbox/actions.ts` |
| Payments query pattern | `apps/web/app/dashboard/payments/page.tsx` |
| Reviews | `apps/web/app/dashboard/reviews/page.tsx` |
| Money/format · Modal shell | `apps/web/lib/format.ts` · `apps/web/components/ui/modal*.tsx` |
| DB types (regen target) · schema doc | `packages/types/database.types.ts` · `supabase_database.md` |
