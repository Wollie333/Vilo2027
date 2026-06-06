# Guest Record (CRM) — Build Plan

**Status:** Planned — ready to build in a fresh session.
**Design reference:** `C:\Users\Wollie\Downloads\Guest Record.html` (build the record page to match it exactly).
**Owner area:** Host dashboard.
**Created:** 2026-06-06.

---

## 1. Goal & scope

Give hosts a CRM-style **relationship view of each guest** so managing accommodation + guests is
smoother. Three deliverables:

1. **Sidebar:** add a new **Guests** destination in the host dashboard nav (right after *Bookings*).
2. **Guests list** (`/dashboard/guests`) — searchable/sortable directory of everyone who has booked
   or enquired, with lifetime value, stays, last/next stay, rating, reliability. *(No mockup supplied
   — build consistent with the Bookings list + the unified shell theme.)*
3. **Guest Record** (`/dashboard/guests/[gkey]`) — the per-guest page that matches the supplied design:
   identity header + verifications + lifetime stat band + tabs **Overview / Bookings / Messages /
   Payments / Notes**, with prev/next guest nav.
4. **Two-way link** with **Booking Details** (`/dashboard/bookings/[id]`, the operational per-stay view):
   the booking page links up to the guest record; each booking row on the guest record links down to
   the booking page.

This is a **new feature** (organisational), so it must respect the project rules below.

### Project rules that apply (do not skip)
- **Unified shell:** the page renders inside the existing `ClassicShellFrame` (header + Gmail sidebar
  already built). The page only provides the **content** (sub-header + identity + tabs).
- **Dynamic data only** — never hardcode the sample values from the mockup. Every number/string comes
  from the DB. Where the design shows data we don't store (e.g. "Needs: Baby cot"), derive it from real
  fields (booking `special_requests`) or omit the row — do not invent.
- **Modal system:** "Add tag", "Block guest", "Export guest data" use the canonical `Modal`/`FormModal`
  shell — never `window.confirm` or a raw Dialog.
- **Brand name:** render via `<BrandName>` / `useBrandName()` — never hardcode "Vilo".
- **Help article:** ship a matching Help Centre article (DB-backed `help_articles` seed migration).
- **Feature gating:** Guests CRM is a **core host tool — not gated** (and pre-MVP everything is open on
  free anyway). No `check_feature_permission` wiring.
- **Mutations** go through Server Actions; **all queries scope `host_id`** (RLS + explicit filter — see
  the dashboard-query-gotchas memory: pin FK on `user_profiles` embeds, filter host_id explicitly).
- **Migrations:** additive, new files only, never edit an applied migration. Regenerate
  `packages/types/database.types.ts` after schema changes (`> file` only — never `2>&1`, it corrupts
  the file).

---

## 2. The hard part: who is a "guest"? (identity + routing)

A guest is **not** always a `user_profiles` row. Two kinds exist:
- **Registered guest** — `bookings.guest_id` is set (FK → `user_profiles`). Has account, avatar,
  languages, country, conversations, reviews.
- **Email-only contact** — manual bookings where `guest_id IS NULL` but `guest_email` is set. No account,
  no conversations, no reviews. The New-Booking past-guest list already dedupes these **by lowercased
  email** (`apps/web/app/dashboard/bookings/new/page.tsx`).

### Unified guest key (`gkey`)
Define one stable key used for routing and aggregation:
- Registered → the `user_profiles.id` (uuid) string.
- Email-only → `e_` + base64url(lowercased email).

The list page emits the correct `gkey` per guest; the record page parses it:
- looks like a uuid → resolve by `guest_id`.
- starts with `e_` → decode → resolve by email.

### Merge rule (important)
A registered guest may also have older **manual** bookings under the same email (guest_id null). The
record query must union both:
```
WHERE host_id = :host
  AND deleted_at IS NULL
  AND (
        guest_id = :guest_id
     OR (guest_id IS NULL AND lower(guest_email) = :email)
      )
```
For an email-only guest, only the second branch applies.

---

## 3. Data model — what exists vs. what's new

### Reuse as-is (no change)
- `bookings` — `guest_id`, `guest_name/email/phone`, `status`, `check_in/out`, `nights`,
  `guests_count`, `total_amount`, `currency`, `special_requests`, `cancelled_at`, `cancelled_by`,
  `created_at`. Revenue/“stays” status set = `('confirmed','checked_in','completed')` (matches the app).
  Guest cancellations = `status = 'cancelled_by_guest'`.
- `user_profiles` — `full_name, email, phone, avatar_url, bio, country, languages[],
  preferred_cities[], is_lead, created_at` ("guest since"), `deleted_at`.
- `conversations` + `messages` — for the Messages tab. Reuse `sendMessageAction`
  (`apps/web/app/dashboard/inbox/actions.ts`). Conversations are keyed by `guest_id` (so email-only
  guests have none → Messages tab shows an empty state).
- `payments` — `amount, currency, method, status, booking_id, captured_at, refunded_amount,
  provider_reference`. Join via `booking_id`.
- `reviews` — `rating, guest_id, listing_id, body, created_at, is_published`. Avg rating left by guest.
- `refund_requests` — `guest_id, booking_id, status` (not strictly needed; cancellations come from
  `bookings.status`).
- `booking_notes` — per-stay notes (shown on Booking Details, not here).
- `listing_photos` — guest record booking rows + “usual listing” thumbnail (cover = min `sort_order`).

### NEW — migrations to add (additive)
1. **`guest_notes`** (guest-level internal notes — the Notes tab). Must support email-only guests, so
   key on both id and email:
   ```sql
   CREATE TABLE public.guest_notes (
     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     host_id     uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
     guest_id    uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
     guest_email text,
     author_id   uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
     body        text NOT NULL,
     created_at  timestamptz NOT NULL DEFAULT now(),
     CHECK (guest_id IS NOT NULL OR guest_email IS NOT NULL)
   );
   CREATE INDEX idx_guest_notes_host_guest ON guest_notes(host_id, guest_id);
   CREATE INDEX idx_guest_notes_host_email ON guest_notes(host_id, lower(guest_email));
   -- RLS: host manages their own (host_id IN (select id from hosts where user_id = auth.uid()));
   --      admin read via user_profiles.role = 'super_admin' (NOT user_role — that column doesn't exist).
   ```
2. **`guest_tags`** (the "VIP" tag + "Add tag" action). Same dual-key shape:
   ```sql
   CREATE TABLE public.guest_tags (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     host_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
     guest_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
     guest_email text,
     label text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (guest_id IS NOT NULL OR guest_email IS NOT NULL)
   );
   -- unique-ish per (host, guest, label); RLS same as guest_notes.
   ```
   *"Returning" is derived (stays > 1), not a stored tag. "Blocked" can be a reserved tag label, or a
   `is_blocked`/`blocked_at` column — see Open Decisions.*
3. **Verification columns** on `user_profiles` (nullable, additive) so the design's chips are honest:
   ```sql
   ALTER TABLE user_profiles
     ADD COLUMN phone_verified_at timestamptz,
     ADD COLUMN id_verified_at    timestamptz;
   ```
   Render rules: **Email confirmed** = registered account exists (Supabase auth verified the email on
   signup) → show for any `guest_id`. **Phone/ID verified** → show chip only when the column is set;
   otherwise omit (don't show a red "unverified" unless we decide to). No KYC flow is built now — these
   are display-ready columns for later.

> ⚠️ Migration-drift caution (see the migration-repair-drift memory): after writing migrations, **push
> with `supabase db push --linked` and verify against the live DB** (a service-role probe). Do not trust
> `migration list` alone. Use `role = 'super_admin'` in admin RLS, never `user_role`.

---

## 4. Server data layer

Prefer two PostgreSQL RPCs for the aggregations (consistent with the analytics work), plus plain
Server-Component selects for the tab lists.

- **`fetch_host_guests(p_host_id, p_search, p_sort, p_limit, p_offset)`** → for the list page.
  Aggregates bookings grouped by `COALESCE(guest_id::text, 'e_'||lower(guest_email))`. Returns per guest:
  `gkey, guest_id, name, email, phone, avatar_url, total_stays, total_nights, lifetime_value,
  first_stay, last_stay, next_stay, review_count, avg_rating, guest_cancellations, is_returning`.
  Sort options: last stay, lifetime value, stays, name. Search across name/email/phone.
  Also return a total count for pagination + the sidebar badge.
- **`fetch_guest_record(p_host_id, p_guest_id, p_guest_email)`** → identity + the 5 stat-band numbers
  (total stays/nights, lifetime value + avg/stay, avg rating + review count, cancellations + reliability,
  next stay {in N days, dates, listing}). Applies the **merge rule** from §2.
- **Tab lists via Server Component selects** (host_id-scoped, merge-rule WHERE):
  - Bookings tab → bookings + listing name/cover, ordered desc, mapped to rows linking to
    `/dashboard/bookings/[id]`.
  - Payments tab → payments joined via booking_id (only this guest's bookings); KPIs lifetime paid /
    avg per stay / outstanding.
  - Messages tab → conversations + messages for `guest_id` (empty state if email-only).
  - Notes tab → `guest_notes` for this guest.
  - Overview → derived: next stay (from record RPC), recent activity timeline (union of booking
    created/confirmed, reviews left, cancellations — newest 5), preferences (usual listing = most
    booked; travels-with from latest booking `guests_count`/breakdown; languages/country from profile;
    needs = latest booking `special_requests` if present), pinned note (latest guest_note).

### Server Actions (mutations)
- `addGuestNoteAction(gkey, body)` / `deleteGuestNoteAction(noteId)`.
- `addGuestTagAction(gkey, label)` / `removeGuestTagAction(tagId)`.
- `blockGuestAction(gkey)` — see Open Decisions (tag vs column).
- Messages reply → reuse `sendMessageAction` (needs a `conversation_id`; reply targets the most recent
  conversation with this guest, else disabled with “Start in inbox”).
- Export guest data → server action returning a CSV/JSON blob (bookings + payments + notes).

---

## 5. UI build — files

### Sidebar (1 small edit)
- `apps/web/app/dashboard/_components/Sidebar.tsx` — add to `MAIN` right after Bookings:
  `{ href: "/dashboard/guests", label: "Guests", icon: Users, match: "prefix" }` (import `Users`).
  Optional count badge from `fetch_host_guests` total (via the layout) — nice-to-have, can defer.

### Guests list — `/dashboard/guests`
- `apps/web/app/dashboard/guests/page.tsx` (Server Component: auth → host → `fetch_host_guests`).
- `apps/web/app/dashboard/guests/_components/GuestsList.tsx` (Client: search box, sort dropdown,
  paginated rows; each row → `/dashboard/guests/[gkey]`). Mirror the Bookings list pattern
  (`apps/web/app/dashboard/bookings/page.tsx` + `BookingsBoard.tsx`).

### Guest Record — `/dashboard/guests/[gkey]` (match the mockup exactly)
- `apps/web/app/dashboard/guests/[gkey]/page.tsx` (Server Component: resolve gkey → run record RPC +
  tab selects in parallel; 404 if no bookings/notes for this host+guest).
- `_components/GuestRecordSubheader.tsx` — back to "All guests", breadcrumb, prev/next guest (prev/next
  derived from the list order; pass neighbouring gkeys or compute via RPC).
- `_components/GuestIdentityHeader.tsx` — avatar (+verification badge), name + tags (VIP/Returning),
  contact row (email/phone/location/languages/guest-since), verification chips, actions (Message, Call
  `tel:`, More menu → New booking for guest / Add tag / Export / Block).
- `_components/GuestStatBand.tsx` — 5 stats incl. the dark "Next stay" tile.
- `_components/GuestTabs.tsx` (Client) — Overview / Bookings / Messages / Payments / Notes; tab state in
  the URL (`?tab=`) so it survives refresh and prev/next.
- Tab panels: `OverviewPanel`, `BookingsPanel`, `MessagesPanel` (reuse inbox bubble markup from
  `InboxView.tsx`), `PaymentsPanel`, `NotesPanel` (add-note composer → `addGuestNoteAction`).
- Reuse: `formatMoney` (`lib/format.ts`), `<BrandName>`, Modal shell for Add tag / Block / Export.

### Booking Details two-way link (1 edit)
- `apps/web/app/dashboard/bookings/[id]/page.tsx` — in the guest block, add a "View guest record →"
  link to `/dashboard/guests/<gkey>` (compute gkey from the booking's guest_id or guest_email).

---

## 6. Phased build order (commit + push after each; build + lint green every time)

- **Phase 1 — Schema:** migrations for `guest_notes`, `guest_tags`, `user_profiles` verification
  columns; RLS; regen types; push + live-DB verify. Commit.
- **Phase 2 — RPCs:** `fetch_host_guests` + `fetch_guest_record`; verify against the demo host with a
  service-role probe (non-zero, correct shapes). Commit.
- **Phase 3 — Sidebar + Guests list:** nav item + list page/components. Commit.
- **Phase 4 — Guest Record shell:** route, sub-header, identity header, stat band, tab scaffold
  (Overview first). Commit.
- **Phase 5 — Tabs:** Bookings, Payments, Messages (reuse bubbles + reply), Notes (composer + actions).
  Commit.
- **Phase 6 — Two-way link + actions:** Booking Details ↔ Guest Record link; Add tag / Block / Export
  via Modal; "New booking for guest" prefill. Commit.
- **Phase 7 — Help article + polish:** seed `help_articles` entry; empty states (email-only guest, no
  messages, no payments); mobile responsive; demo-data sanity pass. Commit.

---

## 7. Edge cases / empty states to handle
- **Email-only guest:** no avatar (initials), no verification chips except none, **no Messages**,
  no reviews; Notes/Tags still work (keyed by email). "Message" button routes to New Booking / inbox
  start rather than a dead thread.
- **Guest with account but manual bookings under same email** → merge rule unions both.
- **Guest deleted** (`user_profiles.deleted_at`) → still show historical bookings; mark as inactive.
- **No next stay** → "Next stay" tile shows "—/None scheduled".
- **Currency:** a guest could have bookings in mixed currencies — sum per-currency or assume host
  default; confirm in Open Decisions (default: host's listing currency, usually ZAR).

## 8. Verify (Definition of Done)
- `pnpm build` + `pnpm lint` clean (web app). No `console.log`.
- Live-DB probe confirms both RPCs return correct, non-zero data for the demo host.
- Click-through: Bookings list → a guest → all 5 tabs → open a booking → back-link returns to guest.
- Help article visible in Help Centre. Types regenerated. CHANGELOG + CURRENT_TASK updated.

---

## 9. Open decisions to confirm at the start of the build
1. **Block guest** — reserved tag label `"Blocked"` vs a real `user_profiles.is_blocked`/`blocked_at`
   column with enforcement (prevent new bookings). *Recommend:* start with a column + soft enforcement.
2. **Guests list design** — no mockup supplied; OK to build it consistent with the Bookings list + the
   unified theme? (Recommend yes.)
3. **Mixed-currency lifetime value** — sum in host default currency vs. per-currency breakdown.
   *Recommend:* host default (ZAR) for v1, note the assumption.
4. **Sidebar count badge** — include the live guest count on the nav item now, or defer? (Minor.)
5. **Verifications** — confirm we only ever show *positive* chips (verified), never a red "unverified".

---

### Key file references (for the build session)
| Asset | Path |
|---|---|
| Design | `C:\Users\Wollie\Downloads\Guest Record.html` |
| Sidebar nav | `apps/web/app/dashboard/_components/Sidebar.tsx` |
| Bookings list (mirror) | `apps/web/app/dashboard/bookings/page.tsx` + `BookingsBoard.tsx` |
| Booking detail (link) | `apps/web/app/dashboard/bookings/[id]/page.tsx` |
| New booking past-guest dedupe | `apps/web/app/dashboard/bookings/new/page.tsx` |
| Inbox bubbles + send action | `apps/web/app/dashboard/inbox/InboxView.tsx`, `inbox/actions.ts` |
| Payments query pattern | `apps/web/app/dashboard/payments/page.tsx` |
| Reviews | `apps/web/app/dashboard/reviews/page.tsx` |
| Money/format | `apps/web/lib/format.ts` |
| DB types (regen target) | `packages/types/database.types.ts` |
| Schema doc | `supabase_database.md` |
