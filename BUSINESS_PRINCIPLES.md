# Vilo Platform — Business Principles

**Version:** 1.0
**Last Updated:** 2026-07-06

This file records Wielo's **foundational business principles** — the durable
strategic rules that shape how the product is built, regardless of which feature
is in front of us. They answer *"what is Wielo, and what must always be true,"*
not *"how is this coded."* For the technical *how* and *why* behind a specific
implementation, see `DECISIONS.md` (Architecture Decision Records).

**How to use this file:**
- Read it at the start of every session (it's in `CLAUDE.md` → "Read These First").
- A principle here is **load-bearing**. Don't violate it for convenience, and
  don't build a feature that quietly contradicts it. If a principle seems wrong
  for a task, raise it with the founder before deviating — don't silently route
  around it.
- Each principle is numbered and dated. Add new ones as the strategy grows;
  supersede rather than delete (note what replaced it and why).

---

## Principle #1 — Wielo owns all guest identity

**Date:** 2026-06-10
**Status:** Active
**Technical ADR:** `DECISIONS.md` → ADR-021

### The principle

**Wielo is the primary owner of every guest account and all guest data.** Hosts
are granted *shared access* to the guests they interact with — Wielo does **not**
gatekeep that data from them — but the account and its history **belong to
Wielo**, not to any single host.

### Why this matters

This is a strategic moat, not a technical convenience. Because every guest who
ever touches the platform — through any host — becomes a Wielo account:

- Wielo accumulates a **platform-wide guest graph** that no individual host owns.
- A guest's history (bookings, conversations, stays, reviews) **follows them
  across every host**, so the guest experience compounds in value the more they
  use Wielo — a network effect that favours the platform.
- Hosts get a richer CRM for free (shared, not gatekept), which keeps them on
  Wielo; Wielo retains the underlying relationship.

### The rules (what must always be true)

1. **Every guest entry point mints a Wielo account.** However a guest enters —
   - signing up directly as a guest,
   - making a booking,
   - being added as an additional / party guest on someone else's booking,
   - submitting a quote request —
   the system creates (or reuses) a single global Wielo guest account for them,
   **for free**.

2. **Email is the universal identity key, and it is mandatory.** A guest
   **cannot be added without an email**. There is no name-only guest. One guest
   = one email = one Wielo account. (No marketplace-style anonymous guests.)

3. **Accounts are minted passwordless and claimed later.** A new guest account
   is created without a password (`is_lead = true`). The guest "owns" nothing
   yet — Wielo does. When that guest later signs up or logs in with the same
   email, the system **recognises them and prompts them to set a password**
   (claim), at which point all of their historical activity — across every host
   — appears in their single guest portal. Signup must never dead-end a returning
   passwordless guest with "email already registered."

4. **Shared, not gatekept — but owned.** Hosts can see and work with their
   guests' data (CRM, notes, threads, bookings). That access is a grant, not
   ownership. The canonical record lives with Wielo.

5. **Ownership ≠ marketing consent.** Minting an account is internal identity
   ownership. It does **not** grant the right to market to that guest. Marketing
   sends stay gated on explicit consent (POPIA) exactly as before.

6. **Free for all guests, always.** Guest accounts (`role = 'guest'`) are never
   plan-gated or charged. The platform's value is the guest graph, not guest fees.

### Status of implementation

The identity layer (`user_profiles` as the global account, `is_lead` flag,
`gkey` addressing, the passwordless claim flow) already exists. The rule is being
made **universal** across all entry points via the identity-spine roadmap — see
`DECISIONS.md` → ADR-021 for the technical plan and current build state.

---

## Principle #2 — We never take a success fee. You own your own profits.

**Date:** 2026-06-10
**Status:** Active
**Technical ADR:** `DECISIONS.md` → ADR-003, ADR-020

### The principle

**Wielo never, ever takes a success fee.** We will never dive into a host's
booking fees. When a guest pays, the host keeps 100% of it — **you own your own
profits.**

Wielo may charge for **additional services or subscriptions**, but always
**transparently and up front** about the price. No skimming, no surprise cuts, no
fee buried in a booking total. The host always knows exactly what Wielo costs and
exactly what they keep.

### Why this matters

This is Wielo's core wedge against OTAs (Airbnb, Booking.com) and the single
biggest reason a host switches: they keep their money. The promise only holds if
the platform is **financially exact and transparent** — every cent a guest is
charged is the host's, computed correctly, with Wielo's own pricing always shown
openly and never entangled with booking money. A hidden fee or a pricing defect
breaks the entire value proposition.

### The rules (what must always be true)

1. **No success fee, no booking-fee cut — ever.** Booking totals contain zero
   Wielo cut. The pricing stack ends at "total — no success fee" (see ADR-020).
   Never reintroduce a platform-fee line into a guest-facing or host-facing
   booking total.
2. **Charge only for services and subscriptions, always transparently.** Any Wielo
   charge (a subscription, a paid add-on service) is stated up front, in the open,
   separate from booking money. No dark patterns, no surprise billing.
3. **Provably correct money.** Preview === checkout === invoice, computed by the
   one canonical pricing engine (`apps/web/lib/pricing` → `priceStay`). Never fork
   the pricing maths into a component or action.
4. **Monetise via subscriptions/services, not bookings.** Revenue comes from host
   plans and optional paid services — never from a slice of booking value. Feature
   gating belongs to the subscription tier, never to a booking-value cut.

---

## Principle #3 — Wielo never holds host money

**Date:** 2026-06-10
**Status:** Active
**Technical ADR:** `AGENT_RULES.md` §4.7 / §4.8

### The principle

When a guest pays for a booking, the money goes **directly to the host**, charged
on the **host's own payment account** (their own Paystack via `getHostPaystack`).
Wielo is **not the merchant of record** and does not custody, pool, or pass through
host funds.

### Why this matters

Staying out of the money flow keeps Wielo out of money-transmitter / payment-
aggregator regulatory territory, removes settlement and chargeback liability from
the platform, and reinforces Principle #2 (the host's money is the host's). It
also keeps trust one-directional: the host owns their guest relationship _and_
their cashflow; Wielo owns the identity graph and the software.

### The rules (what must always be true)

1. **Charge the host's own gateway.** Card charges use the host's connected
   payment account (`getHostPaystack`) — **never** the platform key.
2. **One ledger, never forked.** Booking money is tracked through the single
   payments ledger (`apps/web/lib/payments/ledger.ts`); pay flows go via
   `startBookingPayment`. Never reimplement ledger maths elsewhere.
3. **Wielo's keys are for Wielo's own revenue only** (host subscriptions), never for
   moving a guest's booking payment.

---

## Principle #4 — Every transaction is assigned to a business and documented

**Date:** 2026-06-16
**Status:** Active

### The principle

**No money ever moves on Wielo without two things being true: (1) it is assigned
to a business, and (2) it is backed by a financial document** — a receipt, an
invoice, a credit note, or a refund note. This holds for **every** transaction
between **every** party: guest ↔ host, host ↔ Wielo, and any other money movement
the platform records. There is no such thing as an unassigned or undocumented
transaction.

### Why this matters

This is the financial backbone of the platform. A transaction that isn't tied to
a business can't be reconciled, taxed, audited, or reported on — it's orphaned
money. A transaction without a document can't be proven to either party or to a
regulator. Together these two rules make Wielo's money **provably correct,
attributable, and auditable** end to end, which underpins every other financial
principle (#2 transparency, #3 not holding host money) and protects both the host
and the platform legally.

### The rules (what must always be true)

1. **Always assigned to a business.** Every transaction record carries a
   `business_id`. A transaction with a null/unknown business is invalid — it must
   never be written, settled, or reported.
2. **Always documented.** Every transaction produces exactly one of: a **receipt**
   (payment received), an **invoice** (amount owed), a **credit note** (amount
   credited), or a **refund note** (money returned). No document → not a valid
   transaction.
3. **Universal — no exceptions by party.** This applies to all flows: guest paying
   a host, host paying Wielo for a subscription or service, store-credit movements,
   add-on invoices, refunds, and any Wielo ↔ user charge. Wielo's own charges to
   users are documented exactly like host ↔ guest money.
4. **Document follows the money, not the other way around.** The financial
   document is generated as part of recording the transaction (same flow, same
   source of truth) — never bolted on afterwards or reconstructed. The ledger and
   its documents are one consistent record.

---

## Principle #5 — One Source of Truth

**Date:** 2026-06-28
**Status:** Active

### The principle

**Every domain concept has exactly one canonical location** in the codebase — one
table, one function, one component that owns the authoritative definition. All
other code reads from or calls that source; it never duplicates the logic.

### Why this matters

Enterprise-grade maintainability and scalability. When pricing logic lives in one
place, a pricing bug is fixed once. When guest identity resolution has one
function, account merge works everywhere. Duplication creates drift — two
implementations slowly diverge until one breaks silently.

### The rules (what must always be true)

1. **One table owns each entity.** Guest identity → `user_profiles`. Host
   contacts → `host_contacts`. Quotes → `quotes`. Never create a parallel table
   that stores the same concept differently.

2. **One function owns each calculation.** Pricing → `computeStayPricing()`.
   Guest key → `gkeyFor()`. Feature check → `hostHasFeature()`. Never inline the
   same logic elsewhere.

3. **One component owns each UI pattern.** Quote card → `ThreadQuoteCard`.
   Sidebar → `GmailNav`. Feature lock → `WebsiteLocked`. Copy the pattern, don't
   rebuild it.

4. **New features extend, not fork.** A new feature that needs quotes uses the
   `quotes` table with an FK, not a `looking_for_quotes_data` table with copied
   columns.

5. **Cross-cutting concerns use shared infrastructure.** Notifications, feature
   gates, audit logs — all flow through the existing pipelines, never parallel
   ones.

---

## Principle #6 — Two colour worlds: host sites are theme-scoped, Vilo surfaces are Vilo-branded

**Date:** 2026-07-05
**Status:** Active

### The principle

There are two distinct colour worlds, and they never bleed into each other:

1. **A host's website (the website CMS).** Every rendered element — sections,
   blocks, menus, buttons, booking cards, amenities, icons, accents — is **scoped
   to that host's active theme colours, always.** A host's site is *their* brand;
   Wielo green never appears on it unless it happens to be their chosen palette.
   Builder colour pickers offer the **active theme's palette** first (plus a custom
   option).

2. **The Vilo directory, the app system, and the host dashboard.** These always
   default to the **Wielo/Vilo brand colours.** They are Wielo surfaces, not a
   host's, so they carry Wielo's identity regardless of any host theme.

### Why this matters

The website CMS is a white-label product: a host who builds their site expects it
to look like *their* business, not like Wielo. Conversely, the marketplace,
dashboard, and platform chrome are Wielo's shopfront and must read as Wielo. Mixing
the two — Wielo green on a host's site, or a host's accent on the directory —
breaks the brand promise on both sides.

### How to apply it

- In `apps/web/components/site/*` and the website builder, resolve colours from the
  **theme** (`theme.base.palette` / `theme.colors` / `--site-*` vars). Colour
  pickers seed their preset circles from the active theme's palette.
- In the marketplace (`/property`, `/`), the dashboard, and admin, use the Wielo
  **brand tokens** (`--brand-*`, Vilo green `#10b981`).
- A shared component used on both (e.g. `AmenitiesCategorized`) stays
  colour-agnostic via CSS vars and lets each caller supply the right world's colours.

---

## Principle #7 — Plan first, then ship in phased save points

**Date:** 2026-07-05
**Status:** Active

### The principle

**Every new feature, and every major change to an existing feature, is planned
before any code is written — and then delivered in phases, each ending in a
committed, pushed save point.** This is the default workflow, always.

The sequence, every time:

1. **Plan.** Study the *existing codebase* first (what's already there to reuse, what
   the change touches) and state the *expected outcome*. Write the plan down for
   anything non-trivial (a `docs/features/*.md` for a real feature).
2. **Phase it.** Break the work into small, easy-to-execute phases — each one a
   coherent, independently-verifiable slice, not a big-bang.
3. **Save point per phase.** When a phase is complete and green (build/lint/tests),
   create a save point: **commit and push to `main`.** Then start the next phase.

### Why this matters

- Planning against the real codebase prevents rebuilding what exists and catches the
  blast radius before it becomes a mess (reinforces Principle #5, One Source of Truth).
- Small phases keep every step reviewable and reversible; a committed-and-pushed save
  point after each means work is never lost and `main` always moves in verified steps.
- It makes progress legible: at any moment there's a plan, a current phase, and a
  clean history of shipped save points.

### How to apply it

- Before building: map the touched systems, confirm the approach, write the plan.
- Size phases so each is genuinely easy to do and to verify.
- After each phase: build/lint/test green → commit → **push to `main`** → next phase.
- Don't batch several phases into one unverified push, and don't start a feature by
  writing code before the plan exists.

---

## Principle #8 — Website-CMS styling is WYSIWYG: edit → canvas updates instantly → publish makes it live

**Date:** 2026-07-05
**Status:** Active
**Scope:** The website CMS / builder feature only (page, navigation, header,
footer, and any future builders that edit a host's site). It does **not** govern
non-CMS admin forms.

### The principle

**Every styling edit made in any website builder updates the canvas in real time,
and the exact same change goes live on publish.** There is no styling control that
"saves but doesn't show," and none that shows in the canvas but fails to reach the
published site. What the host sees while editing is what visitors get.

Concretely, for every styling control (colour, spacing, typography, background
image/video, borders, shadows, overlays, per-device overrides, menu/header/footer
styling, element styling — everywhere):

1. **Edit → canvas reflects it immediately.** The moment the control changes, the
   builder canvas re-renders with the new value (e.g. an uploaded background image
   appears on the section at once; a colour change recolours the block instantly).
2. **Publish → the change is live.** The same value is persisted and rendered on
   the public site with no drift between the canvas preview and production.

### Why this matters

- WYSIWYG is the whole promise of a visual builder. A control that doesn't move the
  canvas reads as broken and erodes trust in every other control.
- The canvas and the live site share ONE render path (`SiteChrome` + the token/
  `--el-*` renderer), so "shows in canvas" and "works when published" are the same
  guarantee — reinforces Principle #5 (One Source of Truth).

### How to apply it

- New styling control? It is not done until the canvas updates live AND a publish
  round-trips the value to the public site. Verify BOTH before marking complete.
- Build styling controls from the **unified styling-control library** (the single
  source of truth for control UI — sliders, colour pickers, media, toggles, etc.)
  so behaviour and look stay uniform across every builder.
- Wire controls to the same state the canvas renders from; never to a write-only
  side channel. If a control can't show its effect in the canvas, that's a bug to
  fix, not a limitation to ship.
- Popovers/modals for styling controls (colour picker, media picker, etc.) must
  render above all canvas and card content (portal + high z-index) so they're never
  clipped by a card's `overflow`.

---

## Principle #9 — Not done until the change is SEEN in BOTH the canvas AND live

**Founder directive (do not ask again): a task is not complete — and must never be
reported as complete — until the change has been VISUALLY VERIFIED working in BOTH
the builder canvas AND the live/published site.** "It typecheck's / lint's / tests
pass" is necessary but NOT sufficient. "It should work" / "the logic is correct" /
"I couldn't reach live" are not acceptable stopping points.

### The rule

For any change a user could see (UI, styling, layout, header/footer, sections,
blog, search, funnel, chrome — anything rendered):

1. **Verify in the canvas** — drive the builder/preview and confirm the change
   actually renders (screenshot / DOM inspect / computed style — real evidence,
   not assumption).
2. **Verify on live** — confirm the SAME change on the published/live render path.
   Canvas ≠ live has bitten us repeatedly (e.g. the header scrolled state showed in
   the nav overlay's bespoke preview but not on the real `StickyHeader` used by the
   canvas page + live). Both paths must be checked because a component can diverge.
3. Only then report done — and say explicitly what was verified and how.

### If you can't reach one of the two environments

That is a blocker to RESOLVE, not an excuse to skip. Do whatever it takes:

- Reproduce the render locally (build a minimal harness / preview route / fixture
  that exercises the SAME component the live site uses).
- If a real login / published tenant / test URL is genuinely required, ASK the
  founder for it up front and keep it on hand — don't finish the task blind.
- Never hand back work with "verify it yourself on a real site" as the only check.
  If verification is truly impossible this session, say so LOUDLY at the top of the
  response and mark the task **NOT verified / incomplete** — never "done."

### Why this matters

- Shipping "green but unseen" changes has repeatedly produced regressions the
  founder had to catch (scrolled state, search results design, blog publish).
  Every one would have been caught by actually looking at both surfaces.
- Reinforces Principle #5 (One Source of Truth) and Principle #8 (WYSIWYG): the
  canvas and live share one render path, so verifying both is the proof that the
  shared path — not a bespoke preview — carries the change.

---

## Principle #10 — Mobile-first, fully responsive, always

**Founder directive: everything we code and add to the website — every block,
element, section, widget, control, page and piece of chrome — is MOBILE-FIRST and
must be FULLY RESPONSIVE at every breakpoint, always. No exceptions.**

**Restated and sharpened by the founder, 2026-07-17:** *"always design mobile
first so the feature/page/section is 100% mobile responsive and works beautifully
on mobile devices."* Applies to **the whole app** — not just the website builder
this principle was originally written about.

### 🔴 The booking flow is the sharpest edge of this principle

**~95% of bookings happen on a phone.** Our competitors do not take this
seriously, and their negative reviews are full of guests who *wanted to book* and
couldn't — the form fought them on a small screen. **That is a commercial
opportunity, not a detail.** A guest who abandons a booking on their phone is a
booking the host never gets, and the host churns to the marketplace we exist to
replace.

So the booking path — property page → date/room select → guest details → payment →
confirmation — carries a **higher bar than "it doesn't overflow"**:

- It must be **pleasant to complete one-handed on a 360–390px phone**, thumb-first.
- **No horizontal scroll, ever.** Not on a price table, not on a date picker, not
  on a summary row.
- The **price and the primary action stay reachable** — a guest must never scroll
  hunting for "Reserve", or lose sight of what they're paying.
- **Tap targets ≥44px** on every date cell, stepper, radio and submit.
- Inputs use the right **`inputMode`/`type`** so phones show the correct keyboard,
  and the field is never covered by it.
- **Nothing important is desktop-only.** If a summary/breakdown/policy is visible
  on desktop, it is reachable on mobile — collapsed is fine, absent is not.

**Booking is the one flow where "works on mobile" is not enough — it must be the
best mobile booking experience in the market. Verify it on a phone viewport, on
the real render, every time it changes** (Principle #9).

### The rule

- Design and build for the smallest screen first, then enhance up (Tailwind's
  `sm:`/`md:`/`lg:` are additive from a mobile base — never desktop-first with
  `max-*` hacks).
- Every grid/list (rooms grid, results, galleries, cards, amenity lists, footers,
  menus) collapses cleanly: 1 column on phones → 2 on tablets → 3+ on desktop, with
  no overflow, no horizontal scroll, no touching/overlapping cards.
- Images use responsive sizing (`max-width:100%`, `object-fit`, `sizes`), text
  wraps, tap targets are ≥44px, and nothing is clipped or cut off on a 360px phone.
- The builder canvas + the live site must BOTH look correct at mobile, tablet and
  desktop (ties into Principle #9 — verify at all three widths, canvas AND live).

### How to apply it

- A new component is NOT done until it has been checked at phone (~375px), tablet
  (~768px) and desktop (~1280px) widths — resize the preview and confirm.
- Never ship a fixed-width or desktop-only layout. If a grid has `grid-cols-3`, it
  MUST also have a mobile base (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
- Reuse the shared responsive section/card primitives; don't hand-roll widths.

---

## Principle #11 — A "clean wipe" deletes USER data only, never functionality data

**Date:** 2026-07-06
**Status:** Active

### The principle

**When the founder asks for a "clean wipe" / "blank slate" / "fresh app with no
users," it means delete all USER data and nothing else.** The goal is a
fresh-install web app with zero users and zero user data so we can test from
scratch — it is **never** a request to remove the data the app needs to function.

Two categories, and only one of them is ever wiped:

1. **User data — DELETE.** Everything a user (host, guest, staff, admin person)
   creates or owns: accounts (`auth.users`, `user_profiles`), hosts, listings,
   bookings, payments, quotes/invoices, host websites + pages + blog + media,
   specials, reviews, conversations/messages, looking-for posts, affiliates,
   businesses, subscriptions, guest CRM, notifications, sessions. If a real person
   generated it, it goes.

2. **Functionality / reference data — NEVER DELETE.** The seed/config data the app
   relies on to build pages and run at all: `site_themes` (and any theme
   templates), `plans` / `plan_prices` / `plan_features`, `amenity_catalog` /
   `amenity_groups`, `listing_categories` and other taxonomies, `special_categories`,
   help-center content (`help_*`), notification templates
   (`notification_categories` / `notification_events`), admin RBAC definitions
   (`admin_roles` / `admin_permissions` / `admin_role_permissions`),
   `platform_settings` / platform integrations / services, `fx_rates`. Wiping any of
   these breaks the app (e.g. no themes → sites can't render). They must survive
   every wipe.

### Why this matters

The whole point of a wipe is a *working* fresh app to test on. Deleting
functionality data defeats the purpose — you get a broken app, not a clean one.
"Clean" means clean of users, not stripped of the platform's furniture.

### Accounts that must ALWAYS survive a wipe

- **`support@wielo.co.za` ("Wielo Support") — NEVER delete. It is infrastructure,
  not a user.** It is the platform identity behind the host↔Wielo support inbox
  (`conversations.channel = 'platform'`, `lib/inbox/platform-thread.ts`). Deleting
  it breaks support messaging for every host. (Founder, 2026-07-16.)
- The **super admin** account(s) in `platform_staff` — without one there is no way
  back into `/admin`.

### How to apply it

> ⚠️ **CORRECTION (2026-07-16).** This section previously prescribed
> `TRUNCATE public.hosts, public.user_profiles RESTART IDENTITY CASCADE;` and
> claimed reference tables were *"physically incapable of being caught in the
> cascade"* because they are parents. **That is false, and following it would break
> the app.** Two reasons:
>
> 1. **`TRUNCATE ... CASCADE` empties whole dependent TABLES, not just the rows that
>    reference a deleted user.** It is table-level, not row-level.
> 2. **A reference table is a child the moment it carries a `created_by` /
>    `updated_by` / `author_id` FK to `user_profiles`** — which several do.
>
> Measured against live on 2026-07-16, that TRUNCATE would have wiped:
> **`plan_features` (3 rows — the Wielo-credit allowance dial; every host would
> resolve 0 credits and the whole credit system would lock), `platform_settings`
> (7), `admin_audit_log` (169), `policy_snapshots` (48), `subscription_history`
> (27), `help_articles` + `help_article_*`** — i.e. exactly the "NEVER DELETE" list
> above, plus three tables CLAUDE.md marks INSERT-only.

- **Use row-level `DELETE` from the user roots** — it only removes rows that actually
  reference a deleted user, and `ON DELETE SET NULL` columns (like `updated_by` on a
  config table) are simply nulled instead of destroying the row.
- **Order the deletes child-first.** The FK graph is not uniformly `CASCADE`:
  `hosts.user_id → user_profiles` is **RESTRICT**, `properties.host_id → hosts` is
  RESTRICT, and `payments` / `invoices` / `credit_notes` / `policy_snapshots` /
  `refund_requests` / `looking_for_posts` all block `bookings`. A naive
  `DELETE FROM auth.users` fails outright.
- **Compute the blast radius BEFORE running anything**, don't trust a remembered
  playbook. Walk the FK graph recursively from the roots and list every table that
  would be touched, then diff that against the "NEVER DELETE" list above.
- **Rehearse in `BEGIN; … ROLLBACK;` on the real database** and assert both sides
  inside the transaction before committing anything.
- **Verify both sides after any wipe** (ties into Principle #9): user tables → 0
  rows and `auth.users` down to the kept accounts; reference tables still populated
  (`site_themes`, `plans`, `plan_features`, `amenity_catalog`, `platform_settings`);
  and the app still boots on the blank slate. Never report a wipe done until the app
  is seen working fresh.
- **If ever in doubt whether a table is user or functionality data, ask the founder
  before deleting it** — don't guess and risk breaking the app.

---

## Principle #12 — Every feature has a detailed, living lifecycle flow

**Added:** 2026-07-12

### The principle

**Every feature on the platform must have a documented lifecycle flow** that maps
the feature the way it plays out in the *real world*, step by step, from the first
trigger to the final state — and **each step names the exact functions, files and
logic that make it happen**, plus the side-effects it fires (notifications,
calendar changes, ledger entries, emails, status transitions).

These flows live in **`docs/lifecycles/<feature>.md`** and are the canonical map a
developer opens *before* touching a feature — to understand how it works, to add or
re-order a stage, to change what a stage does, or to find and fix a broken link in
the chain quickly. They are crucial, load-bearing documentation for the dev team
going forward, not an afterthought.

### Why this matters

- **You can't safely change what you can't see end-to-end.** A feature is a *chain*
  of steps across many files (UI → server action → DB trigger → cron → worker →
  email/push/inbox → ledger → calendar). Without the whole chain written down, a
  change to one link silently breaks another. The lifecycle flow makes the chain
  explicit so edits are surgical and fast.
- **It's how we onboard, debug, and extend.** "Where does the review request come
  from?" or "why didn't the guest get the access email?" should be answerable by
  opening one document, not by re-reading ten files.
- **It reinforces Principle #5 (One Source of Truth) and #9 (seen working).** The
  flow is the single description of the feature's behaviour; verifying the feature
  live means walking the flow and seeing every step fire.

### The rules (what must always be true)

1. **One lifecycle doc per feature**, at `docs/lifecycles/<feature>.md` (e.g.
   `booking.md`, `reviews.md`, `payments.md`, `access-details.md`).
2. **Model the real-world flow, not the code layout.** Steps are the things that
   actually happen in order ("guest books → guest gets confirmation → host ledger
   charge row created → host gets a booking-request notification → …"), each with a
   clear trigger and actor (guest / host / system-cron / webhook).
3. **Every step lists its functions + logic:** the file(s)/function(s) that run,
   the DB tables written, the trigger/RPC/cron involved, and every side-effect
   (which notification kind + channels, which email template, inbox card, calendar
   `blocked_dates` change, ledger/invoice/receipt/credit-note row, status
   transition). Name real symbols and paths — not prose.
4. **Cover the branches**, not just the happy path: EFT vs card vs PayPal, pending
   vs confirmed, cancellation/refund, no-show, decline, expiry.
5. **Keep it living.** When you add, re-order, or change a stage — or find the flow
   is wrong — update the doc in the *same* change. A stale lifecycle is worse than
   none. Note the date of material updates.
6. **Verify against reality.** A lifecycle flow is only trustworthy once each step
   has been seen firing end-to-end (Principle #9). Mark steps that are documented
   but not yet verified as such, loudly.

### How to apply it

- **Backfill the core features first** (booking, payments/ledger, reviews,
  access-details, quotes, subscriptions), then **write the lifecycle doc as part of
  building or auditing any feature** from here on.
- **Step skeleton** (repeat per step):

  ```
  ### Step N — <what happens, in real-world terms>
  - Trigger: <what starts this step> · Actor: guest | host | system(cron/webhook)
  - Functions/files: <file:function(s) that run>
  - Logic: <the decision/branch, in one or two lines>
  - DB writes: <tables + key columns>
  - Side-effects: notification(<kind>, channels) · email(<template>) · inbox card ·
    calendar(blocked_dates …) · ledger(<row type>) · status(<from → to>)
  - Next: → Step N+1 (and any branches)
  ```

- **Index them** in `docs/lifecycles/README.md` so the set is discoverable, and link
  the relevant lifecycle doc from the feature's code area when helpful.

---

## Principle #13 — Never run more than two dev servers at once

**Added:** 2026-07-13
**Status:** Active
**Founder directive.**

### The principle

**At most TWO dev servers may be running at any given time — hard cap.** More than
two exhausts the founder's laptop resources and freezes the machine, every time.
Before starting a dev server, **kill existing ones first**; only keep a second alive
if it is genuinely needed for the task at hand.

### Why this matters

This is a physical constraint of the founder's development machine, not a
preference. Each Next.js dev server is memory- and CPU-hungry; three or more
running concurrently (e.g. leftover servers from parallel sessions plus a new one)
reliably locks up the laptop and costs real time to recover from. Respecting the
cap keeps the machine usable and the founder unblocked.

### The rules (what must always be true)

1. **Two is the ceiling.** Never have three or more dev servers live simultaneously.
2. **Kill before you start.** Before launching a dev server, stop any that are no
   longer in use — check `preview_list` (and any stray processes) and `preview_stop`
   the ones you don't need. Don't accumulate servers across tasks.
3. **Default to one.** A single running server is the norm; only spin up a second
   when the task truly requires two at the same time, and tear it down when done.
4. **Clean up at the end.** When work that needed a server is finished, stop it —
   don't leave servers running idle for the next session to trip over.

### How to apply it

- Use `preview_list` to see what's already running before `preview_start`; reuse an
  existing server (`reused: true`) instead of starting a new one where possible.
- After a verification pass, `preview_stop` the server(s) you started (this also
  pairs with the `.next`-corruption gotcha: stop the dev server before `pnpm build`).
- If two are already up and a task needs another, stop one first — never let the
  count reach three.

---

## Principle #14 — Close the gaps before moving on: finish a task 100%

**Added:** 2026-07-13
**Status:** Active
**Founder directive.**

### The principle

**When a gap, loose end, unverified branch, or "TODO later" surfaces while doing
a task, do not defer it and move on to the next thing.** Surface it, get the
founder's confirmation, and then **fill/fix it as part of the same task** so the
task is genuinely 100% complete before the next one starts. There is no "future
pass" for something that belongs to the task in front of you.

### Why this matters

Deferred gaps quietly become permanent. "I'll verify the guest side later" or
"the email isn't built yet — noting it for a future pass" leaves the feature
*almost* done, and almost-done features accumulate into a platform that looks
finished but isn't. Completing one thing fully — verified end to end, all its
branches closed — is worth more than starting three and finishing none. It also
keeps the audit trail honest: a feature marked done is actually done.

### The rules (what must always be true)

1. **A task is not done while it has a known gap in its own scope.** Unverified
   branches, an un-built sub-path, a "mirrors the verified path" hand-wave — all
   are part of the task, not a separate one.
2. **Surface + confirm, then fix — don't silently defer.** When a gap appears,
   name it to the founder and get a yes; then close it fully. (Confirmation keeps
   scope honest; it is not permission to skip.)
3. **One task 100% before the next.** Don't jump to the next feature/audit while
   the current one has open gaps you introduced or uncovered. Finish, verify,
   then move.
4. **This composes with Principle #9 (seen working) and #12 (living lifecycle
   docs):** "seen working in BOTH surfaces" means every branch, not just the
   convenient one; a lifecycle doc's `⚠️ not verified` markers are gaps to CLOSE,
   not a resting state.

### How to apply it

- When you catch yourself writing "noting for a future pass" / "not re-verified"
  / "mirrors the verified path" — **stop**, list the gap, ask the founder, and
  close it before continuing.
- If a gap is genuinely out of the current task's scope (a different feature),
  it may be spun off — but say so explicitly and get agreement; don't let it hide
  inside a "done" report.
- Prefer finishing the task in front of you over breadth. Depth-first, verified,
  then next.

---

## Principle #15 — Security is a first-class concern in every change

**Added:** 2026-07-17
**Status:** Active
**Founder directive.**

### The principle

**Every line of code we write or edit is written with its security implications
considered first — never as an afterthought.** Wielo moves real money on hosts'
behalf, owns guest identity for the whole platform, and stores banking + payment
credentials. The bar is **industry-standard, enterprise-grade secure code,
always.** A feature that is functional but insecure is **not done.**

### Why this matters

A single security defect — an IDOR, a missing ownership check, a leaked secret, a
fail-open gate — can drain a host's revenue, expose every guest's data, or put the
platform in regulatory jeopardy. Security is not a feature to add later; it is the
precondition for every feature. These defects are invisible to build/lint/tests —
only a security mindset catches them. (One audit pass found a guest who could
self-confirm a booking without paying, ciphertext bank details shipped to the
client, refunds that could exceed the payment, and 73 privilege-escalation-prone
DB functions — all green on every automated check.)

### The rules — the security checklist for EVERY change

1. **Authorize by ownership, server-side.** Anything keyed by a client-supplied id
   (host_id, booking_id, quote_id, payment_id, guest id) must verify the caller
   **owns** that resource — in the Server Action / Edge Function / RLS policy,
   never trusting the client. No IDOR, ever.
2. **Fail closed.** Gates, guards and permission checks default to **DENY** on any
   miss, error or NULL. Three-valued SQL gets `COALESCE(..., false)`; an unhandled
   branch denies, never allows.
3. **Never trust the client for money or identity.** Recompute every amount
   server-side (Principles #2/#3); never accept a client-supplied price, balance,
   status, or "who am I".
4. **Secrets stay server-side; sensitive data is encrypted at rest and decrypted
   only at a trusted boundary.** No service-role / payment keys / tokens in client
   code or `NEXT_PUBLIC_*`. Banking/account numbers reach a client only after a
   server-side decrypt — never ciphertext, never plaintext in a URL.
5. **Verify authenticity before acting.** Webhook signatures verified before any DB
   write; a failed verification returns 4xx and does nothing.
6. **Least privilege at the DB.** RLS enabled with correct policies on every table;
   `SECURITY DEFINER` functions pin `search_path`; grants scoped to the role that
   needs them. Revoke from **PUBLIC**, not just `anon`.
7. **Enforce at the layer that matters.** The server is the authority; UI gating is
   convenience only. A control hidden in the UI is **not** a security boundary.
8. **Never leak in errors or logs.** No secrets, banking details, tokens, or raw
   internals in error messages, logs, or client responses.

### How to apply it

- **Before writing:** ask *"what's the attack here?"* — who could call this with
  something they don't own, what happens on the error path, what data crosses to
  the client, what identity is trusted.
- **When editing an existing feature:** leave it **more secure than you found it.**
  If you touch code near an ownership check, a gate, a money path, or a secret,
  verify and harden it as part of the change — never step around a weakness.
- **Prove it adversarially.** For a security-relevant change, prove the DENY path
  live (house style: a rollback-txn showing the attack now returns `42501` / 0
  rows), not just the happy path.
- **`SECURITY_CHECKLIST.md` + `AGENT_RULES.md §1` hold the standing detail;** this
  principle is the always-on mindset behind them. When unsure, treat it as a
  security issue and ask.

---

## Principle #16 — Never name a competitor in sales copy

### The principle

**Wielo sells on what Wielo does, not on who else is worse.** No competitor's
name appears in marketing copy, headlines, feature benefits, FAQs, email, ads,
or anything else written to persuade.

**One exception:** a **structured comparison** — a table of pricing, fees or
capabilities — may name the products it compares, because the reader needs to
know which product each row describes for the comparison to mean anything. That
licence covers the table only. It does not extend to the sentence above it, the
heading, or a pull-quote lifted out of it.

### Why this matters

1. **A named claim is a claim you must defend.** "Booking.com takes 17%" is a
   factual assertion about another company's pricing that changes without notice
   and varies by plan and region. The moment it is stale it is a false statement
   about a named business — and under the CPA that is our problem, not theirs.
2. **Partner pages carry someone else's name.** A Founding Partner's landing page
   shows their face and their number. A comparative swipe there is published
   under *their* identity, and they are the one who has to answer for it.
3. **It positions us as the challenger.** Copy that leads with a competitor makes
   them the subject. Wielo's argument — 0% commission, you own the guest, one
   subscription — needs no opponent to make sense.
4. **The category, not the brand, is the real contrast.** What differs is the KIND
   of product: an OTA takes commission, a website builder does not book, an
   agency does not integrate. Naming the category says the true thing and stays
   true when the market moves.

### The rules (what must always be true)

1. **No competitor name in persuasive copy.** Use the category: *OTA*, *global
   OTA*, *local directory*, *booking engine*, *website builder*, *web agency*,
   *agent*.
2. **Gloss the shorthand once per page.** Not every host reads "OTA" as jargon
   they know. One plain line — *"OTA means online travel agent — the big booking
   sites that charge commission on each stay"* — is enough.
3. **Comparison tables may name products**, and must then be accurate, dated and
   sourced. If nobody will keep them current, use categories there too.
4. **FUNCTIONAL naming is always fine and must not be scrubbed.** These are not
   claims — they are instructions and data:
   - calendar-sync help ("paste your Airbnb iCal URL here"),
   - booking channel labels and channel-mix reports,
   - integration settings and migration guides.
   Removing a name a host needs in order to complete a task makes the product
   worse for no gain.
5. **Citing a research source is not naming a competitor.** An attributed
   statistic keeps its attribution — an uncited number is the worse failure. If
   the source is itself a competitor, prefer a neutral source or drop the stat;
   never strip the citation and keep the number.

### How to apply it

- **Writing copy:** if a sentence needs a competitor's name to land, the sentence
  is arguing the wrong thing. Say what Wielo does instead.
- **Reviewing a design or mockup:** brand names in headings, chips, calculators
  and testimonials are the usual offenders. Swap to the category before it ships.
- **Unsure whether it's copy or function?** Ask what the reader is doing. Deciding
  whether to buy → copy, no names. Completing a task → functional, name it.
