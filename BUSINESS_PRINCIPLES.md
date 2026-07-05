# Vilo Platform — Business Principles

**Version:** 1.0
**Last Updated:** 2026-06-10

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
