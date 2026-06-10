# Vilo Platform — Business Principles

**Version:** 1.0
**Last Updated:** 2026-06-10

This file records Vilo's **foundational business principles** — the durable
strategic rules that shape how the product is built, regardless of which feature
is in front of us. They answer *"what is Vilo, and what must always be true,"*
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

## Principle #1 — Vilo owns all guest identity

**Date:** 2026-06-10
**Status:** Active
**Technical ADR:** `DECISIONS.md` → ADR-021

### The principle

**Vilo is the primary owner of every guest account and all guest data.** Hosts
are granted *shared access* to the guests they interact with — Vilo does **not**
gatekeep that data from them — but the account and its history **belong to
Vilo**, not to any single host.

### Why this matters

This is a strategic moat, not a technical convenience. Because every guest who
ever touches the platform — through any host — becomes a Vilo account:

- Vilo accumulates a **platform-wide guest graph** that no individual host owns.
- A guest's history (bookings, conversations, stays, reviews) **follows them
  across every host**, so the guest experience compounds in value the more they
  use Vilo — a network effect that favours the platform.
- Hosts get a richer CRM for free (shared, not gatekept), which keeps them on
  Vilo; Vilo retains the underlying relationship.

### The rules (what must always be true)

1. **Every guest entry point mints a Vilo account.** However a guest enters —
   - signing up directly as a guest,
   - making a booking,
   - being added as an additional / party guest on someone else's booking,
   - submitting a quote request —
   the system creates (or reuses) a single global Vilo guest account for them,
   **for free**.

2. **Email is the universal identity key, and it is mandatory.** A guest
   **cannot be added without an email**. There is no name-only guest. One guest
   = one email = one Vilo account. (No marketplace-style anonymous guests.)

3. **Accounts are minted passwordless and claimed later.** A new guest account
   is created without a password (`is_lead = true`). The guest "owns" nothing
   yet — Vilo does. When that guest later signs up or logs in with the same
   email, the system **recognises them and prompts them to set a password**
   (claim), at which point all of their historical activity — across every host
   — appears in their single guest portal. Signup must never dead-end a returning
   passwordless guest with "email already registered."

4. **Shared, not gatekept — but owned.** Hosts can see and work with their
   guests' data (CRM, notes, threads, bookings). That access is a grant, not
   ownership. The canonical record lives with Vilo.

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

## Principle #2 — Direct booking, no success fee

**Date:** 2026-06-10
**Status:** Active
**Technical ADR:** `DECISIONS.md` → ADR-003, ADR-020

> _Draft from documented strategy — founder to confirm/refine wording._

### The principle

Vilo is a **direct-booking platform, not a marketplace.** Guests discover and
book hosts directly. Vilo **never takes a per-booking commission or success
fee** — hosts keep 100% of what their guests pay. Vilo earns from **host
subscriptions**, not from skimming bookings.

### Why this matters

The "no success fee" promise is Vilo's core wedge against OTAs (Airbnb,
Booking.com) and the reason a host switches. It only holds if the platform is
**financially exact** — every cent a guest is charged is the host's, computed
correctly. A pricing defect or a hidden fee breaks the entire value proposition.

### The rules (what must always be true)

1. **No commission, ever.** Booking totals contain no Vilo cut. The pricing stack
   ends at "total — no success fee" (see ADR-020). Never reintroduce a
   platform-fee line into a guest-facing total.
2. **Provably correct money.** Preview === checkout === invoice, computed by the
   one canonical pricing engine (`apps/web/lib/pricing` → `priceStay`). Never fork
   the pricing maths into a component or action.
3. **Monetise via subscriptions, not bookings.** Revenue comes from host plans.
   Feature gating belongs to the subscription tier, never to a booking-value cut.

---

## Principle #3 — Vilo never holds host money

**Date:** 2026-06-10
**Status:** Active
**Technical ADR:** `AGENT_RULES.md` §4.7 / §4.8

> _Draft from documented strategy — founder to confirm/refine wording._

### The principle

When a guest pays for a booking, the money goes **directly to the host**, charged
on the **host's own payment account** (their own Paystack via `getHostPaystack`).
Vilo is **not the merchant of record** and does not custody, pool, or pass through
host funds.

### Why this matters

Staying out of the money flow keeps Vilo out of money-transmitter / payment-
aggregator regulatory territory, removes settlement and chargeback liability from
the platform, and reinforces Principle #2 (the host's money is the host's). It
also keeps trust one-directional: the host owns their guest relationship _and_
their cashflow; Vilo owns the identity graph and the software.

### The rules (what must always be true)

1. **Charge the host's own gateway.** Card charges use the host's connected
   payment account (`getHostPaystack`) — **never** the platform key.
2. **One ledger, never forked.** Booking money is tracked through the single
   payments ledger (`apps/web/lib/payments/ledger.ts`); pay flows go via
   `startBookingPayment`. Never reimplement ledger maths elsewhere.
3. **Vilo's keys are for Vilo's own revenue only** (host subscriptions), never for
   moving a guest's booking payment.
