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

## Principle #2 — We never take a success fee. You own your own profits.

**Date:** 2026-06-10
**Status:** Active
**Technical ADR:** `DECISIONS.md` → ADR-003, ADR-020

### The principle

**Vilo never, ever takes a success fee.** We will never dive into a host's
booking fees. When a guest pays, the host keeps 100% of it — **you own your own
profits.**

Vilo may charge for **additional services or subscriptions**, but always
**transparently and up front** about the price. No skimming, no surprise cuts, no
fee buried in a booking total. The host always knows exactly what Vilo costs and
exactly what they keep.

### Why this matters

This is Vilo's core wedge against OTAs (Airbnb, Booking.com) and the single
biggest reason a host switches: they keep their money. The promise only holds if
the platform is **financially exact and transparent** — every cent a guest is
charged is the host's, computed correctly, with Vilo's own pricing always shown
openly and never entangled with booking money. A hidden fee or a pricing defect
breaks the entire value proposition.

### The rules (what must always be true)

1. **No success fee, no booking-fee cut — ever.** Booking totals contain zero
   Vilo cut. The pricing stack ends at "total — no success fee" (see ADR-020).
   Never reintroduce a platform-fee line into a guest-facing or host-facing
   booking total.
2. **Charge only for services and subscriptions, always transparently.** Any Vilo
   charge (a subscription, a paid add-on service) is stated up front, in the open,
   separate from booking money. No dark patterns, no surprise billing.
3. **Provably correct money.** Preview === checkout === invoice, computed by the
   one canonical pricing engine (`apps/web/lib/pricing` → `priceStay`). Never fork
   the pricing maths into a component or action.
4. **Monetise via subscriptions/services, not bookings.** Revenue comes from host
   plans and optional paid services — never from a slice of booking value. Feature
   gating belongs to the subscription tier, never to a booking-value cut.

---

## Principle #3 — Vilo never holds host money

**Date:** 2026-06-10
**Status:** Active
**Technical ADR:** `AGENT_RULES.md` §4.7 / §4.8

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

---

## Principle #4 — Every transaction is assigned to a business and documented

**Date:** 2026-06-16
**Status:** Active

### The principle

**No money ever moves on Vilo without two things being true: (1) it is assigned
to a business, and (2) it is backed by a financial document** — a receipt, an
invoice, a credit note, or a refund note. This holds for **every** transaction
between **every** party: guest ↔ host, host ↔ Vilo, and any other money movement
the platform records. There is no such thing as an unassigned or undocumented
transaction.

### Why this matters

This is the financial backbone of the platform. A transaction that isn't tied to
a business can't be reconciled, taxed, audited, or reported on — it's orphaned
money. A transaction without a document can't be proven to either party or to a
regulator. Together these two rules make Vilo's money **provably correct,
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
   a host, host paying Vilo for a subscription or service, store-credit movements,
   add-on invoices, refunds, and any Vilo ↔ user charge. Vilo's own charges to
   users are documented exactly like host ↔ guest money.
4. **Document follows the money, not the other way around.** The financial
   document is generated as part of recording the transaction (same flow, same
   source of truth) — never bolted on afterwards or reconstructed. The ledger and
   its documents are one consistent record.
