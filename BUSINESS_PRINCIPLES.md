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
