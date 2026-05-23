# Vilo Platform — Changelog

**Format:** One entry per completed session. Add entries at the top (newest first).
**Updated by:** Claude Code at the end of every session (see `RULES.md` → Definition of Done).

---

## How to Add an Entry

Copy this template and fill it in at the end of every session:

```
## [DATE] — [Phase X] — [Short description of what was built]

### Built
- [Feature or fix 1]
- [Feature or fix 2]

### Changed
- [Any existing behaviour that changed]

### Migrations
- [Migration filename if DB was touched]

### Notes
- [Decisions made, gotchas, anything next session needs to know]

### Commit
- `feat: description` — [short git hash]
```

---

## 2026-05-23 — Phase 2 — /dashboard/calendar availability view

### Built
- **`/dashboard/calendar`** — Server Component three-month rolling view
  of every blocked date for the selected listing. RLS-bound. Empty
  state with "New listing" CTA when the host has none.
- **`CalendarMonth`** — Server presentational. Mo-first weekday layout,
  7×N grid. Per-cell colouring: booking dates render with
  `bg-brand-primary` (and the booking_id is tooltipped), manual blocks
  render with `bg-brand-line`. Today gets a `ring-2 ring-brand-dark`.
- **`ListingPicker`** (Client) — `<select>` of the host&rsquo;s listings;
  navigates to `/dashboard/calendar?listing={id}` on change. Picks the
  first listing if none specified.
- **Legend** card at the bottom describes the three states and notes
  that manual block/unblock UI lands later (this slice is read-only;
  bookings auto-block via the existing `trigger_booking_confirmed`).

### Notes
- **Sidebar Calendar nav target now resolves.** Was a 404 before.
- **No new packages.** No `react-big-calendar`; the calendar is a
  ~120-line plain Tailwind grid. Lightweight, no client JS needed for
  rendering (Server Component).
- **`pnpm --filter web build`** passes — 28 routes, calendar 621 B.
  `pnpm --filter web lint` zero warnings.

### Deferred
- Drag-to-block dates / manual unblock UI — next slice once we wire the
  block/unblock Server Actions.
- Year view, multi-listing overlay.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 2 — /explore directory search page

### Built
- **`/explore`** — guest-facing Server Component lists every published
  listing (RLS `public_read_published`) with URL-driven filters: `where`
  (text matched ilike against name + city + province), `guests` (min
  `max_guests`), `type` (accommodation_type or "all accommodation"),
  `sort` (newest / price_asc / price_desc / rating). Cards mirror the
  homepage style — hero photo with hover zoom, Instant pill, Verified
  pill, rating, price + /night. 24-card cap; pagination is a later
  slice.
- **`SearchBar`** (Client) — destination input + guests select + Search
  button. Submits to `/explore?where=…&guests=…` preserving the current
  type + sort. Bubbles via the chrome at the top of the page; the
  existing homepage SearchHero already points at `/explore`.
- **`TypeChips`** (Client) — sticky `top-16` row beneath the search bar:
  All stays · Self-catering · B&B · Guesthouse · Lodge · Hotel. Active
  state via `chip-active`; links preserve the rest of the search params.
- **Empty state** — dashed card with helpful copy ("Try a different
  city…") when zero results.

### Notes
- **No Edge Function.** The full `directory-search` Edge Function from
  PHASE_PLAN.md (full-text + Mapbox proximity + ranked caching) lands
  in a later slice. For now a direct Supabase query is plenty for the
  expected dataset.
- **No new packages, no migrations.** Filter logic is plain PostgREST
  `.or` + `.eq` + `.gte` + `.order`.
- **Homepage Hero `<form action="/explore">`** already worked; the
  `Where` field name was `where`, which matches this page&rsquo;s param
  name — so the homepage search now lands a real page instead of 404.
- **`pnpm --filter web build`** passes — 27 routes, `/explore` 3.66 kB.
  `pnpm --filter web lint` zero warnings.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 2 — /[handle] host public profile page

### Built
- **`apps/web/app/[handle]/page.tsx`** — top-level dynamic route at
  `viloplatform.com/{handle}`. Fetches the host via RLS
  `public_read_active_hosts` (only `is_active=true` + `deleted_at IS
  NULL`), then their published listings + each listing&rsquo;s hero photo.
  Reuses guest chrome (`SiteHeader` + `SiteFooter`). 404 via `notFound()`
  if no host matches.
- **Reserved-handle guard** — hard-coded set (`login`, `register`,
  `dashboard`, `booking`, `booking-management`, `change-log`, `cookies`,
  `privacy`, `terms`, `status`, `listing`, `signup`, `auth`, `explore`,
  `api`) returns null from `loadHost` so a maliciously-handled host
  can&rsquo;t shadow real routes. Belt-and-braces — Next.js prefers
  static segments anyway, and the DB CHECK on `handle` enforces format.
- **Header card** — large circular avatar (initials fallback), display
  name, verified badge, `viloplatform.com/{handle}` mono URL, rating +
  review count, listing count, bio. Sits on a dot-grid background.
- **Listings grid** — same card shape as `/dashboard/listings` but
  guest-facing: hero photo, hover zoom, name, type + city, base price.
  Each card links to `/listing/{slug}`.

### Notes
- **`generateMetadata`** — title `${display_name} · Vilo` + bio for the
  share preview.
- **No new packages, no migrations.** Uses the existing RLS path.
- **`pnpm --filter web build`** passes — 26 routes, `/[handle]` at
  2.21 kB. `pnpm --filter web lint` zero warnings.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1/2 — Listings management (/dashboard/listings + /new)

### Built
- **`/dashboard/listings`** — Server Component grid of every listing the
  host owns (RLS `host_manage_own_listings`, soft-deleted rows excluded).
  Card per listing: hero photo (or Home icon placeholder), Draft/Published
  status pill, name + type + city/province, base price + /night, Edit link
  and View (new tab) link for published rows. "+ New listing" CTA in
  header and empty state.
- **`/dashboard/listings/new`** — auth-guarded Server page that also
  bounces to `/signup/host` if no `hosts` row. Renders a Client form for
  name + listing_type (Accommodation vs Experience cards) + nested
  accommodation/experience type picker, matching the onboarding wizard&rsquo;s
  step 2+3 UX so hosts learn the pattern once.
- **`createListingAction`** Server Action — uses user-bound client (RLS
  `host_manage_own_listings` allows INSERT once the host row exists),
  inserts the listing as draft (`is_published=false`; slug auto-generated
  by `trigger_listing_slug`), then `redirect()` to
  `/dashboard/listings/[id]/edit` so the host lands straight in the
  full editor.
- **Schemas** colocated at `/new/schemas.ts` — same cross-field listing-type
  refinement pattern used in `/signup/host`.

### Notes
- **Sidebar nav target now resolves.** `/dashboard/listings` was a 404 in
  the chrome; it now has a real destination. Active-state highlight
  works for both list + edit URLs via the `match: "prefix"` rule already
  in `Sidebar.tsx`.
- **No new packages, no migrations.** Uses the existing RLS path and the
  `generate_listing_slug` trigger from Phase 0.
- **`pnpm --filter web build`** passes — 25 routes. `pnpm --filter web
  lint` zero warnings.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 2 — Host booking dashboard (/dashboard/bookings)

### Built
- **`/dashboard/bookings`** — Server Component list of every booking the
  host owns (RLS `host_manage_own_bookings`). Newest first, 50 cap. Table
  shows reference (link to detail), guest name + headcount, listing,
  check-in → check-out + nights, total + payment_status, status pill.
- **`StatusFilter`** — Client URL-driven pill row: All · Pending · Confirmed
  · Checked in · Completed · Cancelled. Each pill shows a live count
  badge pulled from a parallel `select status` query. The "Cancelled"
  filter rolls up `cancelled_by_host`, `cancelled_by_guest`, `declined`,
  `expired`, `no_show`.
- **`StatusPill`** — shared `bookings.status` → label + tone helper.
  Eleven states mapped to amber / green / emerald / indigo / red / slate.
- **Empty state** — dashed card with the calendar-check icon when no
  bookings match.

- **`/dashboard/bookings/[id]`** — full detail page. Header: listing name
  + status pill + reference + state-aware action buttons. Body grid:
  - Left: Trip card (dates, nights, guests, payment method/status,
    special requests if set), Timeline card (booked / confirmed / checked
    in / checked out / cancelled — formatted en-ZA datetime, em-dash for
    empty).
  - Right: Guest card (avatar + name + email + phone; a disabled
    "Message guest (Inbox slice)" button placeholding the inbox), Amount
    card (base, cleaning, total breakdown), "View public listing" link.

- **`BookingActions`** (Client) — state-machine UI:
  - **pending** → Confirm (primary) + Decline (with `window.confirm`).
  - **confirmed** → Mark check-in + Cancel.
  - **checked_in** → Mark check-out + Cancel.
  - **completed / cancelled / declined / expired** → no buttons.

- **`apps/web/app/dashboard/bookings/actions.ts`** — five Server Actions
  (`confirmBookingAction`, `declineBookingAction`, `cancelBookingAction`,
  `checkInBookingAction`, `checkOutBookingAction`) that all funnel into
  one `applyTransition` helper. The helper:
  1. SELECTs the booking via the user-bound client (RLS-bound to the host).
  2. Validates the transition is legal against
     `AGENT_RULES.md` §4.1&rsquo;s state machine (e.g. can&rsquo;t
     check-in a pending booking).
  3. UPDATEs with `status`, `previous_status` (preserving the prior
     value), timestamp field (`confirmed_at` / `cancelled_at` etc.),
     and `.eq("status", booking.status)` for optimistic concurrency.
  4. `revalidatePath` on both the detail and the list.

### Notes
- **DB triggers already handle the side effects.** When status flips to
  `confirmed`, `trigger_booking_confirmed` inserts `blocked_dates` rows
  and bumps host/listing booking counters. When it flips to a cancelled
  state, `on_booking_cancelled` deletes those `blocked_dates`. Actions
  here don&rsquo;t duplicate that work per `AGENT_RULES.md` §4.2.
- **No admin client used.** The host owns the row via
  `host_manage_own_bookings`, so the user-bound `createServerClient()` is
  sufficient. Service-role stays scoped to the guest-side booking
  creation only.
- **Sidebar Bookings nav target now resolves.** Previously 404; now
  active-state highlights when on `/dashboard/bookings[*]`.
- **`pnpm --filter web build`** passes — 23 routes;
  `/dashboard/bookings` 829 B, `/dashboard/bookings/[id]` 3.25 kB.
  `pnpm --filter web lint` zero warnings.

### Deferred (next slices)
- **Inbox + messaging** — the "Message guest" CTA is disabled.
- **24-hour auto-cancel cron** — `pg_cron` job already exists in
  `20260501000014_create_cron_jobs.sql`; wiring it up to schedule is a
  Phase-2 host-protection slice.
- **Booking emails** — guest gets nothing today after the host confirms.
  Lands next slice (Resend or Supabase default for first cut).

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 2 — Booking flow + Paystack init + webhook

### Built
- **`/listing/[slug]/book`** — Server Component requires auth (redirects to
  `/login?next=…` if signed-out), fetches the listing via RLS
  `public_read_published`, validates URL search params (from / to / guests)
  server-side, and refuses to render the form until dates are valid. Reuses
  the guest `SiteHeader` + `SiteFooter` for chrome.
- **`BookingForm`** (Client) — three stacked panels: Trip details (dates
  read-only from search params, guests `<select>` capped at `max_guests`),
  Payment (Paystack selected — PayPal/EFT flagged "after launch"),
  Cancellation policy + ack checkbox. Sticky right rail shows
  per-night × nights, cleaning fee, total, and "Reserve and pay" CTA
  (disabled until ack ticked). Footer line shows the email the booking
  will be made under.
- **`createBookingAction`** Server Action:
  1. `auth.getUser()` via user-bound client.
  2. Re-fetch listing (RLS-public) — refuses unpublished, missing price,
     or guest count above `max_guests`.
  3. Server-side date + price recalc (per `AGENT_RULES.md` §1.2 — never
     trust the client). Enforces `min_nights`.
  4. **Admin client** (`createAdminClient` — new) inserts `bookings`
     (status=pending, payment_status=pending; `reference` auto-generated
     by the DB default `VILO-YYYY-XXXXXX`) and `payments` (status=pending).
     Admin client is required because no RLS path lets a guest INSERT
     bookings — `host_manage_own_bookings` is host-only and there's no
     `guest_create` policy.
  5. Calls `initializeTransaction` (new `apps/web/lib/paystack.ts`).
  6. Stashes Paystack's returned reference on the payment row for
     idempotency. Rolls back booking + payment on any init failure so
     retry works.
  7. `redirect(authorization_url)` — guest leaves Vilo for Paystack.
- **`apps/web/lib/paystack.ts`** — thin server-side wrappers for
  `/transaction/initialize` and `/transaction/verify`. Converts ZAR Rand
  amounts to kobo (×100) only at the Paystack boundary per
  `CONVENTIONS.md` §9.1. Throws on non-200 responses.
- **`apps/web/lib/supabase/admin.ts`** — `createAdminClient()` using
  `SUPABASE_SERVICE_ROLE_KEY`. **Server-side only**; sanity-checks the env
  vars and throws if missing.
- **`/booking/[id]/success`** — Server Component, dynamic. Reads the
  booking (RLS `guest_read_own_bookings`), falls back to
  `verifyTransaction(reference)` if the webhook hasn&rsquo;t landed yet
  and mirrors the same status flip via admin client (still idempotent via
  the `payment.status='pending'` filter). Shows reference, listing,
  dates, nights, guests, total. "Confirming your payment…" state when
  pending; "You&rsquo;re booked" when settled.
- **`/booking/[id]/failed`** — Server Component showing reference + listing
  + "Try again" link back to the listing.
- **`supabase/functions/paystack-webhook/index.ts`** — Edge Function.
  Verifies `x-paystack-signature` via HMAC SHA-512 against
  `PAYSTACK_SECRET_KEY` (per `AGENT_RULES.md` §1.3). Returns 200
  immediately and processes async. Logs the full raw payload to
  `payments.provider_response` for audit. Idempotency: skips DB writes
  when `payment.status !== 'pending'`. On `charge.success` flips payment
  to `completed` and booking to `confirmed` (DB trigger
  `trigger_booking_confirmed` inserts `blocked_dates` automatically per
  `AGENT_RULES.md` §4.2 — no duplication). On `charge.failed` flips both
  to failed.

### Notes
- **User action required before live testing:**
  1. Sign up for Paystack (test mode is free).
  2. Paste test public + secret keys into Doppler `dev` config:
     `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY` (already
     declared in `.env.example`). Push the sync so Vercel + Edge Functions
     get them.
  3. `supabase functions deploy paystack-webhook --no-verify-jwt`.
  4. In the Paystack dashboard add the deployed function URL as the
     webhook URL (test + live). The Edge Function already uses
     `PAYSTACK_SECRET_KEY` for HMAC verification, so no separate
     `PAYSTACK_WEBHOOK_SECRET` is needed for Paystack (the secret IS the
     key per their docs).
- **Service role key.** Now in active use server-side. Confirmed it stays
  out of any `NEXT_PUBLIC_` env var and is only imported in
  `lib/supabase/admin.ts`. Per `AGENT_RULES.md` §1.1.
- **No new packages.** `fetch` + `node:crypto` only.
- **No new migrations.** Booking creation uses admin client to bypass
  the missing guest-INSERT RLS — clean enough for now; if we later want
  to remove the admin dependency, add a `guest_create_bookings` policy
  with `WITH CHECK (guest_id = auth.uid())`.
- **`pnpm --filter web build`** passes — 21 routes:
  `/listing/[slug]/book` at 7.81 kB, `/booking/[id]/success` + `/failed`
  at 2.21 kB each. `pnpm --filter web lint` zero warnings.

### Deferred (next slices)
- **Host booking dashboard** (Phase 2) — `/dashboard/bookings` list +
  confirm/decline/cancel actions.
- **Booking emails** — guest confirmation + host new-booking notification
  via Resend or Supabase default email.
- **PayPal + manual EFT** payment methods.
- **Policy snapshot** at booking creation (`snapshot_booking_policies`)
  — DB function exists; calling it from the action lands when the Policy
  Manager UI does (Phase 2/3).

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 2 — /listing/[slug] public detail page

### Built
- **`/listing/[slug]`** — public Server Component that fetches a published
  listing by slug (RLS `public_read_published` enforces `is_published=true
  AND is_suspended=false AND deleted_at IS NULL`), joins `hosts!inner`, and
  parallel-loads `listing_photos` + `listing_amenities`. 404s via `notFound()`
  if no row matches. Reuses the guest chrome (`UtilityBar` + `SiteHeader` +
  `SiteFooter` from the homepage), so it sits seamlessly alongside `/`.
- **Page sections** — title strip (type pill, name, city/province, rating,
  guest capacity) · `PhotoGallery` (5-up grid: hero left, 4 small right;
  empty-state for no photos) · 4 quick-fact tiles (bedrooms / bathrooms /
  min nights / check-in) · description prose · `HostCard` (avatar with
  initials fallback, display_name, verified badge, handle, bio, "Message"
  CTA stub) · `AmenitiesList` (20-key icon grid with lucide-react mapping)
  · "Things to know" policies (check-in/out, cancellation policy with
  blurb, house rules if set).
- **`BookingWidget`** (Client) — sticky right-rail card. Per-night price +
  rating, instant-book pill, date-input check-in/check-out, guests
  `<select>` capped at `max_guests`. Client-side price calculator
  (subtotal = base_price × nights, +cleaning_fee when nights > 0; total
  shown when dates picked). "Reserve" links to
  `/listing/[slug]/book?from=…&to=…&guests=…` (next-slice route, currently
  404s). Disabled state until dates valid.
- **`generateMetadata`** — title `{name} · {city, province} · Vilo` +
  description from listing body for SEO + share previews.

### Changed
- **Editor (`Editor.tsx`)** — Publish toggle row now includes a "View
  public" button (visible when `is_published && slug`) opening
  `/listing/[slug]` in a new tab. Hosts can preview what guests see
  immediately after publishing.
- **Dashboard listings panel (`/dashboard/page.tsx`)** — each row gets a
  "View" link (published listings only) next to "Edit". The listings query
  now also pulls `slug`.
- **Homepage `FeaturedListings`** — mock cards now point at
  `/listing/[slug]` (was `/explore/[slug]`). The route prefix is real; the
  slugs themselves are still placeholders until `directory-featured` ships
  in Phase 2 and pulls real hosts.

### Notes
- **Deferred from spec (flagged inline):** photo lightbox, full-screen
  gallery, availability calendar, reviews section, share button + QR
  code, Mapbox approximate-location map, `pricing-preview` Edge Function.
  None block a guest from seeing a listing.
- **RLS verified** — `public_read_published` lets anon read published
  listings; `listing_photos` and `listing_amenities` inherit access via
  their listing FK + RLS rules in `20260501000011_create_rls_policies.sql`.
  No new policies needed.
- **`pnpm --filter web build`** passes — 18 routes, `/listing/[slug]` at
  3.92 kB / 99.9 kB first-load JS. `pnpm --filter web lint` zero
  warnings.

### Out of scope (next slice)
- **Booking flow + Paystack** (Phase 2) — `/listing/[slug]/book` page,
  `booking-create` Edge Function, Paystack init + webhook, success/failed
  pages. This is the MVP-critical next slice.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — Dashboard chrome (Sidebar + Topbar + MobileBottomNav)

### Built
- **`apps/web/app/dashboard/layout.tsx`** — Server Component that wraps every
  route under `/dashboard/*` with the chrome from `Dashboard.html`. Auth-guarded
  (redirect `/login?next=/dashboard`), pre-fetches the user&rsquo;s `hosts` row
  + `listings` count + active `subscriptions.plan` and threads them into the
  Sidebar so each render lands without a client roundtrip.
- **`Sidebar.tsx`** (Client — `usePathname`) — full sidebar per the design:
  brand mark + "Host dashboard" subtitle, workspace switcher (host
  display_name + plan, or "Set up host profile" CTA for un-onboarded), quick
  search button (⌘K placeholder), 3 nav sections (Main: Overview / Bookings
  / Inbox / Calendar / Listings / Reviews / Payments · Connect: Channels /
  Calendar sync / Staff · Tools: Reports / Invoices / Refunds), Settings +
  Help footer, dark-emerald plan card at the bottom showing the host&rsquo;s
  current plan with a link to `/dashboard/settings/subscription`.
- **`Topbar.tsx`** — date label + page title (currently fixed "Dashboard";
  per-page title slot lands next slice), search button, "This month" date
  range, notifications bell with red unread dot, "New booking" CTA, plus
  `AvatarMenu` (initials + dropdown).
- **`AvatarMenu.tsx`** (Client — uses existing shadcn `DropdownMenu`) —
  Profile / Settings / Sign out. Sign out wires to the existing
  `signOutAction` from `(auth)/actions.ts` via `useTransition`.
- **`MobileBottomNav.tsx`** (Client — `usePathname`) — `lg:hidden` fixed-
  bottom 5-button tray: Home · Bookings · Inbox · Listings · More. Active
  state pill matches sidebar style.
- **`VLogo.tsx`** (dashboard-scoped, `compact` prop for the topbar mobile
  logo) — duplicated rather than imported across routes to keep dashboard
  chrome self-contained.

### Changed
- **`apps/web/app/dashboard/page.tsx`** — stripped its own auth check + the
  wrapper `<main>` (layout owns both now). Reformatted as a sequence of
  sections that drop straight into the layout&rsquo;s content slot: welcome
  strip (host first name + handle, or "Welcome to Vilo" for un-onboarded),
  onboarding banner (unchanged behavior), listings card (now with a "See all"
  link to `/dashboard/listings`), empty-state card for hosts with zero
  listings. Removed the old "Signed in" pill + redundant "Welcome to Vilo"
  header (the layout handles identity at the topbar).
- **`apps/web/app/dashboard/listings/[id]/edit/page.tsx`** — removed the
  duplicate "← Dashboard" header strip and the `<main>` wrapper. The Sidebar
  + Topbar are the sole navigational chrome now.
- **`Editor.tsx`** — dropped its own page padding (`px-5 py-8 lg:px-8
  lg:py-10`) since the dashboard layout already adds it. Internal max-width
  and section padding stay.

### Removed
- **`apps/web/app/dashboard/SignOutButton.tsx`** — superseded by
  `AvatarMenu`&rsquo;s Sign out item.

### Notes
- **Most sidebar nav targets don&rsquo;t exist yet** — Bookings, Inbox,
  Calendar, Listings, Reviews, Payments, Settings, the Connect/Tools
  sections all link to `/dashboard/{...}` routes that 404 today. They
  land slice-by-slice as the MVP fills out. The chrome shipping ahead is
  intentional: visual progress, real routes follow.
- **`/signup/host` deliberately stays outside the dashboard layout** — a
  wizard works better full-screen without sidebar/topbar distractions.
- **Per-page title in the topbar is deferred.** Currently the topbar always
  reads "Dashboard". Next slice can thread a title via React Context or a
  `params.json` convention. Not blocking — the page body already includes
  its own h1.
- **No new packages.** Uses the already-installed shadcn `DropdownMenu`
  primitive for the avatar menu.
- **`pnpm --filter web build`** passes — 18 routes. `/dashboard` page
  weight dropped from 1.33 kB → 311 B because the chrome moved to the
  layout. `pnpm --filter web lint` zero warnings.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — Listing editor (8 tabs) live

### Built
- **`/dashboard/listings/[id]/edit`** — full 8-tab listing editor per
  `PHASE_PLAN.md` Phase 1 → Listing Editor (Accommodation — Basic).
  Server Component (`page.tsx`) guards auth, fetches the listing
  (RLS-bound to the owner via `host_manage_own_listings`), and pre-loads
  amenities + photos. Client `Editor.tsx` owns tab navigation + the
  Publish toggle; each tab is its own file managing its own RHF form:
  - **Basic info** — name, type picker (accommodation-type or
    experience-type per `listings.listing_type`), plain Textarea
    description (Tiptap deferred).
  - **Photos** — single-file upload via Supabase Storage
    `listing-photos/{listing_id}/{uuid}.{ext}`; thumbnail grid with
    hover-Trash to delete; "Add a photo" tile triggers a hidden file
    input. JPEG/PNG/WebP only, max 8 MB. Drag-and-drop multi-upload
    is deferred.
  - **Location** — address fields (line1/2, city, province dropdown of
    SA provinces, postal code) + optional manual latitude/longitude.
    Mapbox pin is deferred.
  - **Rooms & capacity** — bedrooms, bathrooms, max_guests, min/max
    nights.
  - **Amenities** — checkbox grid of 20 curated options
    (WiFi/Kitchen/Pool/Braai/Pet-friendly/etc.) backed by
    `listing_amenities` table (wipe-and-reinsert on save).
  - **Pricing** — base_price, optional weekend_price + cleaning_fee,
    currency (ZAR default).
  - **Policies** — check_in_time + check_out_time (HTML `<input
    type="time">`), cancellation policy radio (Flexible / Moderate /
    Strict — three cards using `listings.cancellation_policy`), house
    rules. Full Policy Manager (versioning + snapshots) is deferred.
  - **Booking settings** — instant_booking toggle + a "Payment methods"
    info card pointing to Phase 2 work.
- **`saveListingPatchAction`** Server Action — takes a partial Zod-validated
  listings row, ownership-checks via a `hosts!inner ( user_id )` join, then
  updates. Each tab calls it with its slice.
- **`replaceAmenitiesAction`** — delete-then-insert pattern keyed by
  `listing_id`. **`uploadListingPhotoAction`** — file validation + Storage
  upload + `listing_photos` row insert + `revalidatePath`. On row-insert
  failure, best-effort removes the storage object. **`deleteListingPhotoAction`**
  — removes the row + the storage object. **`togglePublishAction`** —
  pre-publish guard (name + base_price + max_guests required) then
  updates `is_published`.
- **`assertOwnership` helper** in `actions.ts` — single source of truth
  for the ownership check, called by every mutating action.

### Changed
- **`apps/web/app/dashboard/page.tsx`** — each listing row in the host
  list now has an "Edit →" link to the new editor. Helper copy updated.
- **`apps/web/app/dashboard/listings/[id]/edit/schemas.ts`** — numeric
  form fields (location lat/lng, rooms counts, pricing amounts) are
  defined as `numericString` (a `z.string().refine(...)` validator)
  rather than `z.coerce.number().or(z.literal(""))`. Cleaner RHF types,
  and the per-tab submit handlers convert strings to `number | null`
  before calling the action.

### Notes
- **RLS verified** — storage policies for `listing-photos` allow uploads
  only where the path starts with a `listing_id` the user owns; listing
  rows are gated by `host_manage_own_listings`; amenities + photos
  inherit ownership via `listing_id`. The user-bound Supabase client
  handles all mutations.
- **`pnpm --filter web build`** passes — 18 routes, the editor at
  12.3 kB / 159 kB first-load JS. `pnpm --filter web lint` zero warnings.
- **Deferred from spec (flagged inline in the editor):** Tiptap rich-text
  description, Mapbox location pin, drag-and-drop multi-photo upload,
  full Policy Manager UI. None of these block a publishable listing.

### Out of scope (next slice)
- **Dashboard chrome** — the user supplied a `Dashboard.html` design that
  should wrap all logged-in routes (`/dashboard`, `/signup/host`,
  `/dashboard/listings/[id]/edit`). Refactor lands in the next slice as
  a shared `(app)` route-group layout.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase Plan + Track 5 — Parallel execution tracks defined; /privacy, /terms, /cookies shipped

### Built
- **`PHASE_PLAN.md` v1.3** — added "Parallel Execution Tracks" section
  defining 6 tracks (Main Line · Email Templates · iCal Booking Sync ·
  Public Directory · Legal & Marketing · Mobile) with disjoint file
  ownership, rules of engagement, and a shared-zone protocol so multiple
  Claude Code agents can work in parallel without colliding.
- **Track 5 first session — legal page shells.** `/privacy`, `/terms`, and
  `/cookies` Server Components rendering with the homepage `SiteHeader`
  and `SiteFooter`, plus a shared `LegalPage` helper at
  `apps/web/app/_components/legal/LegalPage.tsx`. All three pages
  prerender as static (2.2 kB each).

### Changed
- `apps/web/app/_components/home/SiteFooter.tsx` — bottom-strip Terms /
  Privacy / Cookies links now point at the real routes instead of `#`.
  POPIA left as `#` until the data-deletion flow lands in Phase 5.

### Notes
- Page content is structural placeholder marked `DRAFT — pending legal
  review`. Real wording comes from counsel before public launch.
- **Cross-track finding for Track 1:** `apps/web/app/dashboard/listings/`
  exists as untracked WIP in the working tree (never committed). The
  build fails on `main` because `Editor.tsx` can't resolve its tab
  imports. Track 5 worked around it via temporary stash; Track 1 needs to
  resolve before any further parallel session is started. See
  `CURRENT_TASK.track-5.md` for details.
- Branch: `track/5-legal-pages`. Does not merge to `main` directly —
  user merges via PR or fast-forward per Track 5 protocol.

### Commits
- `docs(phase-plan): add parallel execution tracks section`
- `feat(legal): /privacy, /terms, /cookies page shells (track 5)`

---

## 2026-05-23 — Phase 1 — Host onboarding wizard + dashboard banner

### Built
- **`/signup/host` 5-step wizard** per `PHASE_PLAN.md` Phase 1 → Host
  Onboarding. Server Component (`page.tsx`) guards auth (redirects to
  `/login?next=/signup/host` if signed-out) and bails if the user already
  has a `hosts` row (redirects to `/dashboard`). Client `Wizard.tsx` holds
  step state internally with one `useForm` per step:
  1. **Your details** — `full_name` (required) + `phone` (optional).
  2. **Listing type** — accommodation vs experience cards; nested
     accommodation-type / experience-type pickers per the DB CHECK enums.
  3. **First listing** — `display_name` (drives the auto-generated host
     handle), listing `name`, optional `description`.
  4. **Plan** — three cards. Only "Free" is selectable; "Pro" and "Business"
     are visibly locked with an "After launch" pill (subscription billing
     lands in Phase 3).
  5. **Welcome** — checklist of what&rsquo;s about to happen, a
     responsiveness acknowledgement checkbox, then "Create my host profile".
- **`finalizeOnboardingAction`** Server Action (`actions.ts`) does the
  inserts in order: `user_profiles.update` (full_name, phone) →
  `hosts.insert` (display_name; handle auto-generated by
  `trigger_host_handle`) → `listings.insert` (host_id, listing_type,
  accommodation_type|experience_type, name, description; defaults to
  `is_published=false`) → `subscriptions.insert` (plan=free, status=active).
  On listing-insert failure, best-effort deletes the orphan `hosts` row so
  the wizard can be retried. On subscription-insert failure, the wizard
  continues silently — the host/listing are valid and the subscription can
  be backfilled.
- **Step indicator** above the card — numbered pills, completed steps get
  a check, current step gets a ring.
- **`StepIndicator`, `PersonalDetailsStep`, `PropertyTypeStep`,
  `FirstListingStep`, `PlanStep`, `WelcomeStep`** — all inline components
  inside `Wizard.tsx` to keep the slice in one file.

### Changed
- **`apps/web/app/dashboard/page.tsx`** — now reads the user&rsquo;s hosts
  row and the 5 newest listings. If no hosts row, renders a "Finish setting
  up your host profile" banner linking to `/signup/host`. If hosts row
  exists, shows the Vilo handle and a Published/Draft listing list.
- **`apps/web/app/booking-management/_components/SiteHeader.tsx`** — V logo
  now links to `/` so users can return to the directory home from the host
  marketing page. Tiny chore, separate commit (`3a86926`).

### Notes
- **RLS verified before building** — `hosts` and `subscriptions` use
  `host_manage_own*` policies (FOR ALL USING `user_id = auth.uid()` /
  `host_id = get_my_host_id()`), so the user-bound Supabase client can
  insert directly. `user_profiles` UPDATE pins the `role` value
  (`role = (SELECT role FROM user_profiles WHERE id = auth.uid())`) — the
  wizard doesn&rsquo;t try to flip role to `host`. Until JWT-claims hooks
  land, host-vs-guest is detected by hosts-row presence.
- **No new migrations.** Existing `generate_host_handle` and
  `generate_listing_slug` triggers do the slug/handle derivation.
- **No new packages.** Uses existing `react-hook-form`, `@hookform/resolvers`,
  `zod`, `sonner`, `lucide-react`, and the shadcn `Card`/`Form`/`Input`/
  `Textarea`/`Checkbox` primitives already installed.
- **Welcome toast** — `?welcome=1` on `/dashboard` triggers a client-side
  Sonner success toast via a tiny `WelcomeToast` Client Component
  (`useEffect` + `toast.success`). Auto-clears after the default duration.
- **`pnpm --filter web build`** passes — 15 routes (slice's 14 +
  `/signup/host` at 4.53 kB). `pnpm --filter web lint` zero warnings.

### Out of scope (next slices)
- Listing editor (Accommodation Basic) — 8 tabs per `PHASE_PLAN.md` Phase 1.
  Hosts can&rsquo;t flip a listing from Draft to Published yet.
- Google OAuth, JWT custom claims hook — remaining Phase 1 Auth items.
- Real subscription billing — Phase 3.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — New homepage / = directory landing

### Built
- **`/` rewritten** as the guest-facing directory landing per the canonical
  emerald design at `Main Home.html`. 13 sections in order:
  `UtilityBar` (dark thin bar — language, currency, "List your property") ·
  `SiteHeader` (sticky nav with gradient-SVG V logo + tagline; reveals a
  compact "Anywhere · Any week · Guests" search button after the hero scrolls
  past, with `nav-elevated` shadow) · `Hero` (full-bleed Unsplash image with
  dark `hero-veil` overlay, headline, 4-input search card that GETs to
  `/explore`, 6 popular-search chips, 4-stat row in white) ·
  `CategoryChips` (sticky `top-16` row of 11 chips with active state +
  Filters button on the right) · `TrendingDestinations` (6 destination
  cards, 4:5 aspect, gradient bottom overlay) · `FeaturedListings` (8
  listing cards with image, instant-book/featured badge, heart toggle,
  rating, location, detail and price; "Show all 2 348 stays" CTA) ·
  `TrustPillars` (4 cards — No fees, Verified hosts, Talk to host, Honest
  cancellations) · `BrowseByType` (6 large 16:10 type cards) ·
  `DealsBanner` (Summer-deal image card + brand-gradient Group-stays card)
  · `RecentReviews` (3 review cards with rating, body, avatar, 4.83 stat)
  · `AppNewsletter` (newsletter capture + iOS/Android download tiles) ·
  `HostCTA` (dark-emerald section linking to `/booking-management` — two
  CTAs: "List your property" deep-linked to `#cta`, "See how Vilo works") ·
  `SiteFooter` (4 link columns: Explore / Guests / Hosts / Company; social
  SVGs; "All systems operational" links to `/change-log`).
- **Three Client Components only** — `SiteHeader` (scroll listener for
  sticky-search reveal), `CategoryChips` (active-chip state), `HeartButton`
  (per-listing saved toggle). Everything else is a Server Component.
- **New `VLogo`** that takes `size` (px) + `gradientId` (so multiple
  instances on the same page don't collide on the SVG `<defs>` id).
  Replaces the simple-V version used by the old marketing homepage.

### Changed
- **`apps/web/app/globals.css`** — added directory-page utilities to the
  existing `@layer utilities`: `.hero-veil` (gradient overlay),
  `.hscroll` (scrollbar-none), `.num` (tabular numerals alias),
  `.card-img` (hover zoom paired with `.group`), `.chip-active`,
  `.nav-elevated` (sticky-nav shadow).
- **`apps/web/app/status/page.tsx`** — updated to the new `VLogo` API
  (`size` + `gradientId` instead of `className`). Same visual size (40 px).

### Removed
- **`apps/web/app/_components/home/{Hero,Features,HowItWorks,Pricing,SiteHeader,SiteFooter,VLogo}.tsx`** —
  the marketing-style components from the earlier "Marketing homepage v1"
  entry. Their content has been superseded twice: visually by
  `/booking-management` (which has its own component set), and structurally
  by this new directory homepage which uses entirely different sections.
  Replaced in-place with the new directory components under the same
  `_components/home/` directory.

### Notes
- **Palette is canonical emerald** — no `tailwind.config.ts` changes. The
  design file (`Main Home.html`) was authored against our existing
  `brand-*` tokens.
- **Unsplash images via plain `<img>`** with `loading="lazy"` and the
  `eslint-disable-next-line @next/next/no-img-element` pragma. Avoids
  `next.config.js` image domain configuration; matches the approach used
  in `/booking-management`.
- **Header tagline** ("Direct stays. Direct hosts.") visible at `sm+` only
  to keep the mobile nav clean.
- **Search card POSTs to `/explore`** (not yet built — placeholder route
  for Phase 2 directory work). The form will degrade gracefully to a 404
  on submit until that page lands.
- **`pnpm --filter web build`** passes — 14 routes. `/` first-load JS now
  100 kB (was 96.1 kB; +4 kB for the three small Client Components).
  `pnpm --filter web lint` zero warnings.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — /booking-management marketing page + /change-log

### Built
- **`/booking-management`** — full marketing page translating the canonical
  emerald design at `Vilo Home Page (2).html`. 13 sections in order:
  `SiteHeader` (sticky nav with gradient-SVG V logo) · `Hero` (split layout
  with URL grabber form, social-proof avatars, and a stacked mockup column
  containing a browser dashboard, a floating mobile inbox card, and a
  "commission saved" stat tile) · `TrustMarquee` (auto-scrolling brand strip)
  · `ValueProp` + interactive `EarningsCalculator` (range slider that
  computes Airbnb 18% / Booking 22% / Vilo flat R499 net amounts and the
  annual savings vs Airbnb) · `Features` (6 cards) · `HowItWorks` (4 steps
  with dashed connectors) · `ProductShowcase` (iPhone-frame mockup of a
  Vilo listing detail) · `DirectoryStrip` (4 verified-host cards) ·
  `Pricing` (3-tier with `Monthly | Annual SAVE 20%` toggle and Free-tier
  strip) · `Testimonials` (1 dark featured + 2 white) · `Comparison`
  (Vilo vs Airbnb vs Booking.com vs DIY table) · `FAQ` (6 native
  `<details>` accordion items) · `FinalCTA` (claim-your-URL form on the
  primary-emerald section) · `PageFooter` (dark-emerald, 4 link columns,
  social SVGs, status dot linking to /change-log).
- **`/change-log`** — Server Component that reads `CHANGELOG.md` at build
  time, parses each `## DATE — Phase X — Title` entry into structured
  sections, and renders them as cards in the booking-management visual
  style. Falls back to a GitHub link if the file can't be read on the host.
  Footer "Changelog" link and the status-line `v1.0.0` link both point here.

### Changed
- **`apps/web/app/globals.css`** — added a `@layer components` block with
  the design's custom CSS: `marquee-track` keyframes, `details[open]
  .acc-icon` rotation, `.step-line::after` dashed connector,
  `.vilo-range` slider track/thumb styling (WebKit + Mozilla), `.dotgrid`
  utility (22px variant of the existing 18px `.bg-dot-grid`), `.ribbon`,
  `.avatar`, `.chrome-dot`, `.num-display`, `.brand-gradient`.

### Notes
- **Palette is the canonical emerald `brand-*` set** — no new tokens needed.
  The earlier forest+amber design (`Vilo Home Page.html` / `(1).html`) was
  superseded by the (2) revision which uses our existing tokens exactly.
- **Two Client Components only** — `EarningsCalculator` (controlled range +
  text input) and `Pricing` (billing toggle). Everything else is a Server
  Component. The interactive calculator port preserves the design's
  formatting rules (`en-ZA` with space thousands separator,
  `Math.round(Math.abs(n))` to match the original JS).
- **Images come from `images.unsplash.com` via plain `<img>` tags** — no
  `next/image` domain config needed. Each `<img>` carries the
  `eslint-disable-next-line @next/next/no-img-element` pragma.
- **No new packages.** All icons via the already-installed `lucide-react`,
  all SVG logos inlined.
- **`pnpm --filter web build`** passes — 14 routes (slice 3's 12 +
  `/booking-management` + `/change-log`). `/booking-management` first-load
  JS 100 kB, `/change-log` prerendered statically at build time so first
  load is 96.1 kB. `pnpm --filter web lint` zero warnings.
- **CTAs wire to existing routes** — Hero + FinalCTA forms `action="/register"`,
  nav "Log in" → `/login`. URL handle isn't read yet — that lands when the
  host onboarding wizard ships.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — Auth slice 3: magic link sign-in

### Built
- **Magic link sign-in** added to `/login` as a second tab next to "Password" (shadcn
  `Tabs`). The Magic-link pane has a single email field; submit fires
  `magicLinkAction`, which calls
  `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: ${origin}/auth/confirm, shouldCreateUser: false } })`.
  On success the pane swaps in an inline sent-state ("If an account exists for
  X, a sign-in link is on its way. It expires in 1 hour.") with a "Send another
  link" button to reset.
- **`shouldCreateUser: false`** — magic-link form is sign-in only. New users go
  through `/register`. Stops the magic-link surface from quietly minting accounts
  with no ToS acceptance and no `handle_new_user` trigger context.
- **One new Server Action** in `apps/web/app/(auth)/actions.ts`: `magicLinkAction`.
  Like `forgotPasswordAction`, it swallows Supabase errors and always returns
  `{ ok: true }` to the client — anti-enumeration. Real failures (rate limit,
  SMTP) still produce a toast via the existing `friendlyAuthError` path.
- **One new Zod schema** in `apps/web/app/(auth)/schemas.ts`: `magicLinkSchema`
  (email only, mirrors `forgotPasswordSchema`).

### Changed
- **`LoginForm.tsx`** restructured into a single Client Component containing the
  shared card (header, verify banner, footer "Don't have an account?" link) and
  two inline panes — `PasswordPane` (unchanged behavior) and `MagicLinkPane` (new)
  — switched by shadcn `Tabs`. Each pane owns its own RHF instance so the two
  forms don't interfere.

### Notes
- **No `/auth/confirm` change needed.** Existing Route Handler already accepts
  `type=magiclink` (it's in Supabase's `EmailOtpType` union) and the default
  `next=/dashboard` lands users in the right place.
- **No middleware change needed.** Magic-link sign-in lives at `/login` which is
  already in `AUTH_ROUTES`, so signed-in users are still bounced to `/dashboard`
  before they ever see the tab.
- **`pnpm --filter web build`** passes — 12 routes, `/login` first-load JS now
  152 kB (was 146 kB; +6 kB for the tabs + magic-link form). `pnpm --filter web
  lint` zero warnings.
- **Out of scope:** changing the magic-link email template (still Supabase
  default), throttling client-side (Supabase enforces SMTP rate limits).

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — Auth slice 2: password reset flow

### Built
- **`/forgot-password`** (`apps/web/app/(auth)/forgot-password`) — email-only form
  that calls `forgotPasswordAction`, which fires
  `supabase.auth.resetPasswordForEmail` with
  `redirectTo: ${origin}/auth/confirm?next=/reset-password`. Always redirects to
  `/forgot-password?sent=1` regardless of whether the email exists, to avoid
  account-enumeration leaks. The "sent" state renders a `SentNotice` card with a
  back-to-sign-in link.
- **`/reset-password`** (`apps/web/app/(auth)/reset-password`) — Server Component
  guard that redirects to `/forgot-password` if there's no session, then renders a
  Client form with password + confirm-password. Submit calls `resetPasswordAction`
  which re-checks the session, calls `supabase.auth.updateUser({ password })`, and
  redirects to `/dashboard`.
- **Two new Server Actions** in `apps/web/app/(auth)/actions.ts`:
  `forgotPasswordAction`, `resetPasswordAction`.
- **Two new Zod schemas** in `apps/web/app/(auth)/schemas.ts`:
  `forgotPasswordSchema`, `resetPasswordSchema` (>=8 char password, match refine).

### Changed
- **`apps/web/lib/supabase/middleware.ts`** — added `/forgot-password` to
  `AUTH_ROUTES` so authenticated users hitting it get bounced to `/dashboard`.
  `/reset-password` is intentionally NOT in `AUTH_ROUTES` — it relies on the
  short-lived recovery session that `/auth/confirm` issues via `verifyOtp`.

### Notes
- **Reuses existing `/auth/confirm` Route Handler.** That handler already accepts a
  `next` query param; the recovery flow piggybacks on it instead of duplicating
  verifyOtp logic.
- **Account-enumeration protection.** `forgotPasswordAction` doesn't surface
  Supabase errors to the client — it always redirects to the "check your inbox"
  state. The error path is logged server-side by Supabase but not exposed.
- **`pnpm --filter web build`** passes — 12 routes generated. `pnpm --filter web
  lint` zero warnings.
- **Out of scope:** custom email template (still Supabase default), rate-limiting
  the request endpoint (Supabase enforces ~3/hour on the free SMTP plan).

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — Auth slice 1: /login + /register live

### Built
- **`/login`** (`apps/web/app/(auth)/login`) — email + password, "Forgot password?" link
  (`/forgot-password` — page lands next sub-session), "Create one" link to `/register`,
  inline field errors (RHF + Zod), pending state, post-register verification banner
  when `?verify=1` is present.
- **`/register`** (`apps/web/app/(auth)/register`) — email + password + confirm-password
  + ToS checkbox linking `/terms` and `/privacy` (legal pages land in Phase 5), inline
  field errors, pending state. On success Supabase fires the default verification email
  and the page redirects to `/login?verify=1`.
- **`/dashboard`** (`apps/web/app/dashboard`) — stub Server Component that reads
  `auth.getUser()`, shows the signed-in email and a sign-out button. Real dashboard
  lands later in Phase 1.
- **`/auth/confirm`** (`apps/web/app/auth/confirm/route.ts`) — Route Handler that
  consumes Supabase's `token_hash` + `type` and calls `verifyOtp`, then redirects to
  `/dashboard` (or `/login?verify=failed` on error).
- **Server Actions** (`apps/web/app/(auth)/actions.ts`) — `loginAction`,
  `registerAction`, `signOutAction`. All re-validate input with Zod server-side, call
  the `@supabase/ssr` server client, map Supabase error messages to user-friendly
  toasts, then `redirect()` on success.
- **Shared `(auth)` layout** — centered card on the brand dot-grid background, Vilo
  logo mark in the header, "Back to site" link.
- **Sonner `<Toaster richColors position="top-center" />`** wired into the root
  `apps/web/app/layout.tsx` so any Client Component can `toast.error` / `toast.success`
  per CONVENTIONS.md §8.1.
- **Schemas** (`apps/web/app/(auth)/schemas.ts`) — `loginSchema` and `registerSchema`
  with email lowercasing, >=8 char password, password-match refinement, and
  ToS-must-be-true rule. Colocated rather than in `packages/schemas` since they are
  single-consumer for now (per CONVENTIONS.md §6.2).

### Changed
- **`apps/web/lib/supabase/middleware.ts`** — `updateSession` now also enforces route
  protection: authenticated users hitting `/login` or `/register` are redirected to
  `/dashboard`; unauthenticated users hitting `/dashboard*` are redirected to `/login`.
  Single `supabase.auth.getUser()` call drives both the session refresh and the
  redirect logic.
- **`apps/web/app/layout.tsx`** — added `<Toaster />` import and render so toasts work
  app-wide.

### Notes
- **`pnpm --filter web build`** passes — 9 routes generated. Middleware bundle 82.6 kB.
  `pnpm --filter web lint` passes with zero warnings.
- **No new DB migrations.** Phase 0's `handle_new_user` trigger auto-inserts
  `user_profiles` on `auth.users` INSERT — sign-up flows through it with no extra wiring.
- **Sign-up metadata kept minimal.** Spec only asks for email + password + ToS this
  slice; no `full_name` collected yet. `user_profiles.full_name` stays null until the
  host onboarding wizard (next sub-session) collects it.
- **Email verification path:** `signUp({ options: { emailRedirectTo:
  ${origin}/auth/confirm } })` => Supabase emails a link with `token_hash` +
  `type=signup` => our Route Handler calls `verifyOtp` => middleware sees a fresh
  session and lands the user on `/dashboard`.
- **Server Action redirect pattern:** actions return `{ ok: false, error }` on failure
  and call `redirect("/...")` on success. The client form awaits the action; on a
  returned error it pops a toast, on redirect Next.js intercepts the thrown
  `NEXT_REDIRECT` and navigates.
- **`/forgot-password`, `/terms`, `/privacy` not yet built.** Links exist per the spec
  but resolve to 404. Forgot-password is the next Phase 1 sub-session per
  PHASE_PLAN.md; legal pages are Phase 5.
- **No Google OAuth, no magic link, no password reset** — all out of scope for this
  slice per CURRENT_TASK.md.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — Marketing homepage v1

### Built
- `apps/web/app/page.tsx` rewritten as a real marketing homepage. Composed from co-located server components under `apps/web/app/_components/home/`: `SiteHeader`, `Hero`, `Features`, `HowItWorks`, `Pricing`, `SiteFooter`, plus a shared `VLogo` SVG.
- Sections: sticky nav · split hero with dual CTA · feature grid (3 host + 3 guest + 2 universal) · two-column how-it-works (hosts + guests, 3 steps each) · 3-tier pricing pulled verbatim from `vilo-platform-mvp.md` §6.6B (Basic R299 / Pro R599 / Business R1,199) · dark-emerald site footer with status dot.
- All sections are server components, all classes use canonical Vilo Design System tokens (brand-primary/secondary/dark/accent/line/mute, rounded-card, shadow-glow, dot-grid, font-display). Lucide icons via existing `lucide-react` dep.

### Changed
- Old dev-status content (Supabase auth health check + stack readout) moved from `/` to a new `/status` route at `apps/web/app/status/page.tsx`. Same readout, same brand styling, but off the public front door. Footer + status-dot link to it.

### Migrations
- None.

### Notes
- Scope: this was outside `CURRENT_TASK.md` (which targeted `/login` + `/register`). The auth Zod schemas at `apps/web/app/(auth)/schemas.ts` and the `/login` `/register` route files already exist on disk from earlier in this session — homepage CTAs already wire to them.
- `pnpm build` clean. `pnpm lint` clean. `/` is statically prerendered (180 B route, 96.1 kB first-load JS).
- Decision: section components live under `apps/web/app/_components/home/` (underscored = private, non-routed) rather than `apps/web/components/` to keep route-local UI close to the route that uses it. Reusable cross-route UI still belongs in `apps/web/components/`.

### Commit
- _Pending — user has not yet asked for commit/PR._

---

## 2026-05-22 — Phase 0 — Bootstrap: git, GitHub, Supabase link

### Built
- Local `git` repository initialized on `main` with a Node/Next/Expo/Supabase `.gitignore`.
- Private GitHub repo `Wollie333/Vilo2027` (created in dashboard by user); `main` pushed.
- `.env.example` created from the `ENV_VARS.md` §9 template (keys only — no secrets).
- Supabase project `Vilo2027` provisioned (ref `zlcivjgvtyeaszikqleu`, region `Central EU (Frankfurt)`).
- `supabase init` + `supabase login` (CLI access token) + `supabase link --project-ref zlcivjgvtyeaszikqleu` completed and verified.
- `.env.local` populated with Supabase project URL + new-format API keys (`sb_publishable_…`, `sb_secret_…`); confirmed untracked.
- `CURRENT_TASK.md` populated as the session contract.
- `gh` CLI 2.92.0 installed via winget; `supabase` CLI 2.101.0 installed via direct binary release (no winget package exists).

### Changed
- Local-only git identity set for this repo: `user.email=wollie333@gmail.com`, `user.name=Wollie333`. No global config touched.
- `PHASE_PLAN.md` Phase 5 line "Supabase region confirmed: af-south-1" annotated with the current Frankfurt provisioning + migration requirement.

### Decisions
- **ADR-015** added: Supabase deployed to Central EU (Frankfurt) rather than `af-south-1` (Cape Town). `af-south-1` was unavailable in the Supabase dashboard for this account at provisioning time. The region MUST be migrated before public launch for POPIA compliance.

### Migrations
- None this session — DB schema work begins once `supabase_database.md` lands.

### Notes
- Supabase keys are the newer `sb_publishable_` / `sb_secret_` format (replacements for legacy `anon`/`service_role` JWTs). They work transparently with `@supabase/supabase-js` ≥2.43.x — no SDK bump required.
- Only **one** Supabase project exists. The plan originally called for production + staging; staging deferred to a future session.
- An earlier Vilo2027 project (ref `ddexrmfuqtvmumgvzqxz`, West EU / Ireland) was created and deleted by the user when neither it nor a re-attempt offered `af-south-1`. Both attempts confirmed `af-south-1` is not currently available for this Supabase account.
- `viloplatform.com` domain ownership and Resend / Doppler / Vercel / EAS / Sentry / PostHog / Mapbox / Paystack / PayPal accounts are NOT set up yet — placeholders remain in `.env.local`.
- `supabase_database.md`, `vilo-platform-mvp.md`, and `customer_journey.md` are still missing from the repo. The Phase 0 Database section is blocked until at least `supabase_database.md` is added.

### Commits
- `chore: initial commit with project documentation` — 2ec4dd9
- `chore: add .env.example from ENV_VARS.md template` — 62b37aa
- `chore: bootstrap supabase config, session contract, and changelog` — 969ea79
- (final commit appended after this update is staged.)

## 2026-05-22 — Phase 0 — Specs added: product, schema, customer journey

### Built
- `vilo-platform-mvp.md` (85 KB) added — full v1.2 product spec with 10 core modules including Refund Manager (6.9) and Policy Manager (6.10).
- `supabase_database.md` (137 KB) added — complete DB architecture: 11 domains, RLS, functions, triggers, pg_cron, Realtime, Storage, seed data, migration strategy. Requires extensions `uuid-ossp`, `pgcrypto`, `pg_trgm`, `postgis`, `pg_cron`.
- `customer_journey.md` (86 KB) added — 6 personas across ~50 end-to-end journeys (guest, host free/pro/business, staff, admin, subscriptions).

### Changed
- `CURRENT_TASK.md` Session Notes: missing-specs blocker removed from "Blockers carried into the next session".
- Decided next session focus: scaffold monorepo + Next.js web app (`apps/web`) per `DEVSTACK.md` §1.1 + §6.

### Notes
- Phase 0 Database section is now **unblocked** — migrations 000000 → 000017 and the v1.1 migration set (20260502000000 → 20260502000017) can be applied in a future session.
- `RULES.md` §2 and `AGENT_RULES.md` §2 ("read `supabase_database.md` before any DB-related work") can now be satisfied.
- Active blockers remaining: Supabase region migration to `af-south-1` (see ADR-015), `viloplatform.com` domain ownership not confirmed.

## 2026-05-22 — Phase 0 — Monorepo scaffold + Next.js web app

### Built
- pnpm monorepo: root `package.json` (private), `pnpm-workspace.yaml` declaring `apps/*` + `packages/*`, `turbo.json` with build/dev/lint/type-check tasks, `tsconfig.base.json` for shared TS strict settings.
- `apps/web` — Next.js 14.2.35 App Router, TypeScript strict, Tailwind 3.4, no `src/` dir, `@/*` import alias. `tsconfig.json` extends the root base.
- Brand-token Tailwind config (`apps/web/tailwind.config.ts`): Vilo primary/secondary/accent/dark/light per `DESIGN_SYSTEM.md` §2 + status palette, custom border-radius (DEFAULT 10px, card 16px, pill, sm), Inter (sans) + Plus Jakarta Sans (display) via CSS variables, shadcn semantic tokens layered on top.
- `apps/web/app/globals.css` — shadcn-style HSL CSS variables tuned to Vilo brand (background = brand.light, foreground = brand.dark, primary = brand.primary).
- `next/font/google` wiring in `apps/web/app/layout.tsx` for Inter + Plus Jakarta Sans (zero layout shift, auto self-hosted).
- shadcn/ui configuration: `components.json` + `lib/utils.ts` (cn helper). Component installs (`pnpm dlx shadcn@latest add ...`) can proceed in any future session.
- Supabase SSR wiring per `ARCHITECTURE.md` §7:
  - `lib/supabase/client.ts` — `createBrowserClient` for Client Components.
  - `lib/supabase/server.ts` — `createServerClient` with Next.js cookie store for Server Components and Server Actions.
  - `lib/supabase/middleware.ts` — `updateSession` helper that refreshes the JWT cookie on each request.
  - `middleware.ts` — wires the helper into Next.js middleware with the standard matcher (skips `_next/static`, `_next/image`, favicon, common image asset paths).
- `apps/web/app/page.tsx` — Server Component homepage that fetches `/auth/v1/health` on the linked Supabase project; renders "OK — GoTrue v2.189.0" in green when reachable. Confirms the env vars load and the network path to Supabase works end-to-end.
- `packages/types` — workspace package with placeholder `database.types.ts`. Populated by `supabase gen types typescript` after DB migrations land.

### Changed
- Removed scaffold-default Geist fonts (`apps/web/app/fonts/`).
- Replaced the default Next.js boilerplate `page.tsx` and `globals.css` with brand-aligned versions.
- Copied root `.env.local` to `apps/web/.env.local` so Next.js can resolve `NEXT_PUBLIC_*` vars; both stay gitignored. Flagged in session notes — when `apps/mobile` lands, switch to a shared loader (dotenv-cli or `next.config.mjs` env merge) to avoid duplication.

### Notes
- **Verified end-to-end:** `pnpm --filter web build` and `pnpm --filter web lint` both pass with zero errors / zero warnings. Started dev server, curled `http://localhost:3000`, confirmed HTTP 200 and the rendered HTML contains the Supabase project URL plus a live "OK — GoTrue v2.189.0" connection signal from `/auth/v1/health`.
- **Node 22.17.1 in use.** `DEVSTACK.md` §1.4 locks Node 20 LTS; Next.js 14.2 is compatible with Node 22 so no blocker, but flagged for revisit.
- Minimal dep set installed — only what the homepage needs (`@supabase/supabase-js`, `@supabase/ssr`, `clsx`, `tailwind-merge`, `class-variance-authority`, `tailwindcss-animate`, `lucide-react`). The remaining `DEVSTACK.md` §6 deps (Mapbox, PayPal, Tiptap, react-big-calendar, Resend, react-email, Sentry, PostHog, sonner, react-dropzone, qrcode.react) will be added in the session that first uses each, per CLAUDE.md "least amount of code that solves the problem".
- Husky / lint-staged / Commitlint / Prettier are still pending — pick up in a polish session.

### Commits
- (Single commit for this slice — pushed to `main`.)

## 2026-05-22 — Phase 0 — DB schema live + CI workflows scaffolded

### Built
- **27 SQL migrations** applied to live Supabase (`zlcivjgvtyeaszikqleu`):
  - 18 v1.0 migrations (extensions, 9 domains, RLS helpers/policies, functions, triggers, cron, storage RLS, seed)
  - 9 v1.1 migrations (Policy Manager + Refund Manager domains, ALTERs, RLS, functions, triggers, cron, storage, seed)
- Full schema: 46 tables, 4 RLS helper functions, 8+ business functions (`check_feature_permission`, `calculate_booking_price`, `calculate_policy_refund_amount`, `snapshot_booking_policies`, `recalculate_listing_ranking`, etc.), 13+ triggers, 15 pg_cron jobs.
- Realtime publication enabled for `messages`, `conversations`, `bookings`.
- Storage RLS policies for 6 buckets (`listing-photos`, `host-avatars`, `host-covers`, `eft-proofs`, `message-attachments`, `refund-requests`) — buckets themselves still need to be created in the Supabase dashboard.
- `packages/types/database.types.ts` regenerated (3479 lines) — covers full schema.
- All 5 GitHub Actions workflows written per `CI_CD.md`:
  - `ci.yml` — PR validation (typecheck, lint, tests, E2E)
  - `db-migrate.yml` — auto-apply schema on push + auto-regen + auto-commit types
  - `deploy-functions.yml` — Edge Functions deploy
  - `deploy-web.yml` — Vercel deploy
  - `mobile-preview.yml` — EAS OTA on `develop`

### Fixed
- `gen_random_bytes()` calls qualified with `extensions.` schema in `staff_invites.token` and `reviews.review_token` defaults — Supabase puts pgcrypto in the `extensions` schema, not `public`, so unqualified calls fail.

### Notes
- **DB verified live:** queried `platform_settings` via PostgREST, all 10 seeded keys returned.
- Migrations follow the spec exactly except for one deviation: `blocked_dates` moved from the listings migration to the bookings migration to resolve a forward FK to `bookings(id)`.
- Single Supabase project (no staging yet) per ADR-015. The Frankfurt → af-south-1 migration is still required before public launch.
- **Vercel deploy failing:** the first push triggered a Vercel build that compiled cleanly but reported "No Output Directory named public found". Fix: in Vercel Project Settings → Build & Development Settings, set **Root Directory** to `apps/web`. Then redeploy. (Not done in this session — user-side action.)
- **Storage buckets still need to be created** by hand in the dashboard (Storage → New bucket). The RLS policies are already in place; they only activate once buckets exist.

### Active blockers / user-side actions for Phase 0
- Doppler account + dev/staging/prod configs
- Vercel root-dir fix + first successful deploy
- EAS account + `eas init` for `apps/mobile`
- Sentry projects (web + mobile)
- PostHog project
- Resend account + `viloplatform.com` domain verification (domain itself not yet registered)
- 6 Supabase Storage buckets

### Still TODO (autonomous in next session)
- Scaffold `apps/mobile` (Expo + NativeWind + Expo Router)
- Install shadcn/ui component set from `DESIGN_SYSTEM.md`
- Prettier + Husky + Commitlint config
- `emails/` directory + React Email setup
- Tighten Vercel monorepo config (`vercel.json` or root-dir setting)

### Commits
- `feat(db): add v1.0 schema migrations` — `7c1ec14`
- `feat(db): add v1.1 schema migrations (Refund + Policy Manager)` — `9fa4e67`
- `feat(db): apply 27 migrations + generate database.types.ts` — `c623cba`

## 2026-05-23 — Phase 0 — Mobile + shadcn + tooling + emails scaffolded

### Built
- **`apps/mobile`** scaffolded with Expo SDK 56 (newer than DEVSTACK's 51+ — modern stack, React Native 0.85, Expo Router pre-configured). Includes `src/app/` file-based routing, `eas.json` (development/preview/production profiles), `app.json` branded as Vilo, `.env.local` with `EXPO_PUBLIC_*` Supabase vars, and `src/lib/supabase.ts` using Expo SecureStore as the auth-storage adapter per `ARCHITECTURE.md` §7. Deps: `@supabase/supabase-js`, `expo-secure-store`, `react-native-url-polyfill`, `@tanstack/react-query`, `zustand`.
- **18 shadcn/ui components** installed in `apps/web/components/ui/` per `DESIGN_SYSTEM.md`: button, input, card, label, badge, skeleton, form, dialog, sonner, separator, avatar, alert, tabs, select, checkbox, textarea, dropdown-menu, sheet. Pulled in `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`, `next-themes`, and the relevant `@radix-ui/*` primitives as transitive deps.
- **Code quality tooling** at workspace root:
  - Prettier 3.8 + `prettier-plugin-tailwindcss` with `.prettierrc.json` (double quotes, trailing comma all, 80-col).
  - `.prettierignore` excluding generated files (lockfile, `database.types.ts`, migrations, `.next`, `.expo`, etc.).
  - Husky 9 with `.husky/pre-commit` running `lint-staged` and `.husky/commit-msg` running `commitlint --edit`.
  - `commitlint.config.js` extending `@commitlint/config-conventional` with Vilo's allowed types (feat, fix, chore, docs, refactor, test, style, perf, ci, build, revert, wip, migration).
  - Root `package.json` scripts: `format`, `format:check`, `prepare`; `lint-staged` config for `*.{ts,tsx,js,jsx}` and `*.{json,md,yml,yaml,css}`.
- **`@vilo/emails` workspace package** at `emails/` with React Email setup:
  - `components/Layout.tsx` — brand-styled shared layout (Vilo green/cream, Inter font, header + content + footer with email-preferences link).
  - `templates/WelcomeHost.tsx` — first of the 26 templates from `EMAIL_TEMPLATES.md` (host onboarding welcome).
  - `package.json` with `email dev`/`build`/`export` scripts.
  - `.gitignore` for `.react-email/` build output.

### Changed
- `pnpm-workspace.yaml` now declares `emails` alongside `apps/*` + `packages/*`.
- `apps/web` `lucide-react` pinned to `^0.469.0` (v1.x requires React 19 types — incompatible with our React 18). Fixed a build failure in `components/ui/checkbox.tsx`.

### Notes
- **NativeWind not configured yet.** It needs metro.config.js, babel.config.js, and tailwind.config.js wiring that's tightly coupled to actual UI work. Deferred to the first mobile UI session.
- **Expo's `default` template uses `src/`** (newer convention); `ARCHITECTURE.md` §4 shows `app/` at app root. Treating `src/app/` as the active path — when ARCHITECTURE.md is next edited, update §4 to match.
- The Vercel deploy is still failing because Vercel needs `Root Directory = apps/web` set in Project Settings. Not done in this session.
- Husky's `prepare` script logs `apps/web prepare: .git can't be found` — benign, can be silenced by removing the propagated `prepare` script from individual workspaces if it becomes noise.

### Phase 0 autonomous work — now complete
Everything I can do without external account access is done. Remaining items in Phase 0 all need user-side action (see PHASE_PLAN.md 👤 items).

## 2026-05-23 — Phase 0 — Vercel web deploy live

### Built
- **https://vilo2027.vercel.app/ is live.** First successful production deploy of `apps/web` — Server Component homepage renders the Foundation Status panel with a green Supabase connection check against the Frankfurt project.
- `apps/web/vercel.json` — explicit `"framework": "nextjs"` + `"outputDirectory": ".next"`. See ADR-017.
- `pnpm.overrides` block in root `package.json` pinning `@types/react@18.3.29` and `@types/react-dom@18.3.7` across the entire workspace. See ADR-016.

### Changed
- Vercel project `vilo2027` (org `wollie333s-projects`) connected to GitHub `Wollie333/Vilo2027`. Root Directory set to `apps/web`. Environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` populated for Production, Preview, and Development.
- `pnpm-lock.yaml` regenerated under the new overrides — single `@types/react@18.3.29` resolution for the web app's dep graph.

### Decisions
- **ADR-016** — `@types/react` pinned to v18 across the workspace despite Expo SDK 56 declaring v19 via its peer chain. Required to make `lucide-react` resolve to v18 types in `apps/web`, which fixed the `bigint`-in-`ReactNode` error in `components/ui/checkbox.tsx` during the Vercel build. Mobile runtime unaffected; mobile type-check may show false positives until revisited.
- **ADR-017** — `apps/web/vercel.json` introduced because Vercel's Turbo detection (`turbo.json` at workspace root) overrode Next.js framework auto-detection, causing the build to succeed but the deploy to fail with "No Output Directory named 'public' found".

### Notes
- **Two genuine bugs in the deploy chain were fixed by the build pipeline itself, not patched around.** The "wrong commit" deploy (Vercel building a stale `eedc69d`) was caused by the GitHub ↔ Vercel App lacking repo access while we pushed new commits; reconnecting the GitHub installation fixed it and the next push triggered an up-to-date build automatically.
- Sequence of issues + fixes during this session: (1) Root Directory not set → set to `apps/web` in dashboard; (2) GitHub auth broken → reconnected Vercel GitHub App, scoped to `Wollie333/Vilo2027`; (3) Vercel deploying stale commit → empty trigger commit `576875c`; (4) `@types/react` v18/v19 type collision → ADR-016 override; (5) Vercel Turbo detection overrode framework → ADR-017 `vercel.json`.
- The lint-staged pre-commit hook auto-reformatted `pnpm-lock.yaml` and `package.json` with Prettier on each commit. Cosmetic — the dep graph and override semantics are unchanged.

### Active blockers / user-side actions still open for Phase 0
- Doppler account + dev/staging/prod configs
- EAS account + `eas init` for `apps/mobile`
- Sentry projects (web + mobile)
- PostHog project
- Resend account + `viloplatform.com` domain verification (domain itself not yet registered)
- 6 Supabase Storage buckets (`listing-photos`, `host-avatars`, `host-covers`, `eft-proofs`, `message-attachments`, `refund-requests`)

### Commits
- `chore: trigger vercel rebuild` — `576875c`
- `fix(deps): pin @types/react to 18 across workspace to fix web build` — `657ddb8`
- `fix(vercel): pin framework to nextjs so Turbo detection doesn't override output dir` — `054c6b9`
- (this CHANGELOG + DECISIONS update — final commit of the session, appended after staging)

## 2026-05-23 — Phase 0 — Canonical design system adopted

### Built
- `Vilo Design System.html` (3914 lines, 290 KB) added at the repo root as the **canonical** source of truth for all Vilo UX/UI work. Replaces the inline token specs in earlier `DESIGN_SYSTEM.md` and `tailwind.config.ts` drafts.
- `apps/web/public/DESIGN_SYSTEM.HTML` — static mirror published via Next.js, accessible at https://vilo2027.vercel.app/DESIGN_SYSTEM.HTML.

### Changed
- `apps/web/tailwind.config.ts` rewritten to match the canonical tokens:
  - Brand palette: `primary #10B981`, `secondary/deep #064E3B`, `accent #D1FAE5`, `dark #0A1510`, `light #F0FDF4`, plus new `ink #052E1F`, `mute #4A7C6A`, `line #DCEAE0` tokens.
  - Status palette adjusted: `confirmed #10B981` (was `#22C55E` — now tracks brand primary).
  - Added `font-mono` family wiring to JetBrains Mono.
  - Added `shadow-card`, `shadow-lift`, `shadow-ring`, `shadow-glow`.
  - Added `transitionTimingFunction.out: cubic-bezier(0.2, 0.8, 0.2, 1)`.
  - Added `bg-brand-gradient`, `bg-brand-gradient-dark`, `bg-dot-grid` background-image utilities.
- `apps/web/app/globals.css` rewritten with the canonical CSS custom properties (light + dark mode), new utility classes (`bg-brand-gradient`, `bg-dot-grid`), and a global `prefers-reduced-motion` rule.
- `apps/web/app/layout.tsx` now loads JetBrains Mono alongside Inter + Plus Jakarta Sans via `next/font/google` and exposes it as `--font-jetbrains-mono`.
- `apps/web/app/page.tsx` (homepage) restyled to the new system: hero with brand gradient logo mark on a dot-grid background, status pill, Foundation Status card with `shadow-card` and `divide-y` rows, and a discoverable link to `/DESIGN_SYSTEM.HTML`.
- `DESIGN_SYSTEM.md` slimmed from a full token spec to a short pointer at the canonical HTML, with a quick-reference cheatsheet of utility names and the hard rules.

### Decisions
- **HTML is canonical.** When `DESIGN_SYSTEM.md` and `Vilo Design System.html` conflict, the HTML wins. Reasoning saved in memory `feedback_design_system_source.md`.
- Old primary `#1B4D3E` (a darker forest green) and amber secondary `#F4A836` from the previous Tailwind config are retired. The new palette is emerald-led, matching the canonical HTML and the live homepage hero.

### Notes
- Web build (`pnpm build`) and lint (`pnpm lint`) both pass with zero warnings.
- shadcn/ui components in `apps/web/components/ui/` were not edited — they consume the CSS custom properties (`--primary`, `--accent`, `--border`, etc.) and pick up the new palette automatically. Per ADR-006, never edit `components/ui/` directly.
- Mobile (`apps/mobile`) NativeWind config is not yet wired up — the design system applies there too, but the wiring is deferred to the first mobile UI session per CHANGELOG 2026-05-23 entry "Mobile + shadcn + tooling + emails scaffolded".

### Commits
- (single commit for this slice — pushed after this entry is staged.)

## 2026-05-23 — Phase 0 — Closeout: Storage, Doppler, EAS landed; Sentry/PostHog/Resend deferred

### Built
- **6 Supabase Storage buckets** created in the Vilo2027 project (`listing-photos`, `host-avatars`, `host-covers` public; `eft-proofs`, `message-attachments`, `refund-requests` private). MIME types and size limits per `supabase_database.md` §17. RLS policies were already applied in the v1.0 migration set; buckets now exist for them to protect. Verified via Storage REST API.
- **Doppler workspace `Vilo2027`**, project `vilo2027`, four configs (`dev`, `dev_personal`, `stg`, `prd`). Imported 18 secrets from `.env.local` (+ 3 Doppler-managed metadata vars) into each top-level config. Integrations connected: Vercel (`wollie333's projects`) and Supabase (`Mana` org). Active syncs: `dev` → Vercel Development env (last synced 13:47 UTC), `dev` → Supabase Edge Functions secrets (13:46 UTC). See Notes for the free-plan gap.
- **EAS project linked** to `apps/mobile`. UUID `50664ed2-d876-4edd-aab0-6a984fbdfca7` written to `app.json` at `expo.extra.eas.projectId`. `eas build` will pick this up when first invoked.

### Changed
- `apps/mobile/app.json` — `slug` changed from `vilo` to `vilo2027` to match the EAS project name (avoids slug-mismatch errors during `eas build`).
- `PHASE_PLAN.md` — Phase 0 marked closed out. New status emoji `🕑` introduced for "deferred-by-design (wire just-in-time)" items. Doppler / Vercel / Storage / EAS lines flipped to ✅. Sentry / PostHog / Resend lines flipped to 🕑 with explicit notes.
- `CURRENT_TASK.md` — fully rewritten to scope the next session (Phase 1 Auth: `/login` + `/register`).
- New memory: `project-doppler-state` capturing the sync gap and the 5 in-transcript tokens flagged for revocation.

### Decisions
- **Doppler free-plan limit accepted as a documented gap.** Doppler's Developer (free) plan caps at one sync per integration; we created the `dev` → Vercel Development sync first, then `stg` and `prd` sync attempts were rejected. Because all three Doppler configs hold identical values today (single Supabase project per ADR-015), the practical impact is nil — Vercel Production is still using the manually-set vars from the earlier deploy session, which match the Doppler `dev` values exactly. Revisit when Doppler is upgraded to a paid plan or when staging/production Supabase projects actually diverge (af-south-1 migration, ADR-015).
- **Sentry, PostHog, Resend all deferred by design.** No users → no errors / no analytics / no outbound emails worth instrumenting. Supabase Auth's built-in templates cover the auth-flow emails Phase 1 needs. Each will be wired just-in-time when its specific feature lands. Placeholder env vars exist in Doppler under the canonical names so adding values later is a one-step change.

### Notes
- 5 Doppler tokens were pasted in chat during the integration debugging (1 read-only Personal Token `dp.pt.P05SY…`, 4 Service Tokens `dp.st.{prd,stg,dev,dev_personal}.…`). All are scoped tightly so blast radius is minimal, but they should be revoked from the Doppler dashboard at convenience. Tracked in `project-doppler-state` memory.
- The Phase 0 closeout was originally scoped to also do Sentry/PostHog/Resend account setup. User opted to defer all three after seeing the Doppler dashboard friction. This deviates from the literal Phase 0 plan but aligns with the platform's "ship over block" guidance and CLAUDE.md's "use the least amount of code that solves the problem" principle — no need to wire telemetry for a service with zero users.

### Commits
- (this commit — closeout + docs update; pushed to main after staging.)

<!-- New entries go above this line -->
