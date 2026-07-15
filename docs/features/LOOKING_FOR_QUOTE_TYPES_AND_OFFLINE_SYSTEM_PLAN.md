# Looking-For — Quote Types & the Offline Quote System (PLAN)

> Status: **PLANNING — nothing built.** Author: session 2026-07-15. Founder asked
> to finish the credit-hardening work first (done), then plan this. Needs founder
> sign-off on the **Decisions** (§9) and any **schema** (CLAUDE.md) before build.
> Related: `project-dual-quote-system` memory, `LOOKING_FOR_LIMITS_CREDITS_NOTIFICATIONS_PLAN.md`,
> `docs/lifecycles/looking-for.md`, `docs/lifecycles/quotes.md`.

---

## 1. Why — the four concerns (founder, verbatim intent)

1. **Quote even when the place can't fit / isn't valid.** A wedding request for
   60+ guests must stay quotable even if the host sleeps 7. Today the shared
   `QuoteForm.validate()` **hard-blocks** over-capacity (hit live: an 80-guest
   post could not be sent).
2. **Negotiate by editing the SAME quote.** After a quote is sent, the host
   should revise the existing quote in place through the back-and-forth, not
   spawn a new quote each round.
3. **Not all quotes are accommodation/calendar-bound.**
   - (a) An Experience request (e.g. a safari drive) isn't a stay — the builder
     shouldn't force calendar/room availability. The host should pick the quote
     **type** up front, which turns the accommodation engine off.
   - (b) Some hosts build quotes in their own tool and just want to **upload**
     the finished quote (PDF/doc), no booking-system integration.
4. **A standalone "Wielo Quotes" offering** (name TBD) — a quote system
   **decoupled** from accommodation/booking, sold as its own subscription, usable
   by **external users who don't have a Wielo host account**, with **Wielo Hosts
   given priority**, and an **admin ability to block these quote-only users from
   the rest of Wielo**.

The through-line: **one "quote" concept, three engines behind it**, chosen per
response — (A) Accommodation (today's calendar-integrated builder), (B) Custom
(build a line-item quote with no calendar/rooms), (C) Upload (attach a finished
quote file). Concerns 1 & 3a are the same lever (quote type + soft validation);
concern 4 is who may use engines B/C and how it's sold.

---

## 2. Core concept — pick the quote TYPE on step 1

Add a first step to every Looking-For response (and the New-Quote page):
**"How do you want to quote?"**

| Type | Engine | Calendar/rooms | Dates required | Who can use |
|------|--------|----------------|----------------|-------------|
| **Accommodation** | A (today's builder) | Yes (soft-warn, see §3.1) | Optional* | Any host with a live listing |
| **Custom quote** | B (line items only) | No | No | Any host + quote-only accounts |
| **Uploaded quote** | C (file attach) | No | No | Any host + quote-only accounts |

\*Accommodation dates become optional so a venue/long-lead request can be quoted
before dates are pinned (see §5). The type is stored on the quote so every
downstream surface (guest view, email, record, PDF) renders the right thing.

This single fork resolves concern 3a and unlocks concerns 1/3b cleanly: the
capacity/calendar rules only apply to type A, and B/C never touch the booking
system.

---

## 3. Concern-by-concern design

### 3.1 Quote even when it can't fit (soft validation) — concern 1
- On the **Looking-For respond path**, convert `overCapacity` (and the
  availability/date-conflict checks) from a hard `toast.error → return false`
  into a **soft warning**: an inline "This is more guests than your place sleeps
  (7) — send anyway?" notice + a confirm on send. The host decides.
- Keep the **direct-booking quote** path (and real checkout) hard-blocking where
  a booking will actually be created — a quote is only an *offer*, but a booking
  must fit. Gate the softening behind "is this a Looking-For response?" and/or
  quote type A-with-no-booking-yet. **Decision D1.**
- Availability/soft-hold: an over-capacity or no-dates accommodation quote should
  probably **not** place a calendar soft-hold until dates+fit are real. Decouple
  the hold from "sent" for these cases.

### 3.2 Negotiate by editing the same quote — concern 2
- Good news: `updateQuoteAction` already revises a **sent** quote in place
  (versioned, with a revision reason) and `sendQuoteAction`'s credit debit is
  **idempotent per quote id**, so re-sending a revised quote never re-charges a
  credit. The negotiation loop mostly exists.
- Work: make **"Edit & re-send"** the primary CTA on a sent Looking-For quote
  (host quote detail + the guest thread), instead of anything that spawns a new
  quote. Surface the revision history to the guest ("updated 12 Aug"). Ensure the
  guest thread + notifications say "quote updated", not "new quote".
- Confirm no surface offers "new quote" for a post the host already responded to
  (the respond page already redirects to the existing quote — keep that).

### 3.3a Non-accommodation (Custom) quote — concern 3a
- Type B builder = the existing line-item + terms + reply UI **minus** the
  listing/room/calendar/availability blocks. Reuses pricing rows, add-ons,
  deposit terms, validity, PDF, email, accept-loop.
- `property_id`, `scope`, `check_in/out`, `headcount` become **optional** for
  type B (see §5). Accept → still creates the CRM/record + notifications, but
  **no booking / no calendar write** (booking conversion is type-A only).

### 3.3b Uploaded / offline quote — concern 3b
- Type C = a thin wrapper: upload a PDF/doc to a private bucket, capture a
  headline amount + currency + validity + a note, attach to the Looking-For
  response. Guest sees "View quote (PDF)" + Accept/Decline.
- Storage: new private bucket `quote-uploads` with signed-URL access scoped to
  the guest + host on that thread (mirror `review-photos` token pattern).
- Accept on an uploaded quote = record + notify only (no Wielo booking); any
  payment/booking happens off-platform (or via a follow-up type-A/B quote).

---

## 4. The "Wielo Quotes" offering — subscription + user classes

### 4.1 A new account class: **quote-only user** (external, non-host)
- Today's roles: guest, host, super_admin. Add a **quote-only** capability a user
  can hold **without** a full host listing/booking footprint.
- Simplest model that fits the codebase: still create a `hosts` row (credits +
  quotes already key off `hosts.id`), but flag it `account_kind = 'quote_only'`
  (or a capability row) so the rest of the host dashboard (listings, calendar,
  bookings, payments, website) is **hidden/gated off**. They get: Looking-For
  browse + respond (types B/C only), quotes, credits, inbox for their threads.
  **Decision D2** (flag on hosts vs a separate table).
- They **cannot** use type A (no listings), so their respond flow defaults to
  Custom/Upload.

### 4.2 Subscription / product
- A new **membership tier** (product_type `membership`) e.g. slug `quotes-*`,
  OR a new `product_type` value. Recommend a membership tier so it rides all the
  existing sub/credit/ledger machinery (activation grants credits — now wired on
  every path incl. admin, per this session's fix). **Decision D3** (tier vs new
  product_type; **name** — "Wielo Quotes"? "Quote Pro"? "Wielo Bids"?).
- Grants a per-cycle credit allotment (already supported: `products.credit_quantity`).

### 4.3 Credits (unchanged metering model)
- Reuse the **Wielo Credits** metering layer as-is: 1 credit per Looking-For
  quote **sent**, regardless of type (A/B/C), refunded on unaccepted expiry.
  Quote-only users buy top-up packages + get plan credits, same as hosts.
- Keep credits strictly separate from the financial credit-note/ledger
  accounting (founder directive — see `project-credits-and-lf-hardening`).

### 4.4 Host priority rules
- Wielo Hosts get **priority visibility + ability**: e.g. their quotes sort above
  quote-only users' on the guest's compare view; quote-only users may be capped
  (fewer active quotes/day, later notify window, no "featured"). **Decision D4**
  (exact priority mechanics — sort? cap? badge "Verified host" vs "Quote
  partner"?). Drive via `check_feature_permission` + quotas, never hardcoded.

### 4.5 Admin block from the rest of Wielo — concern 4 / new req
- Admin can **block a quote-only user from everything except the quote system**
  (or fully). Model: an admin toggle `quote_access` / `platform_access` on the
  user (or a `blocked_scope`), enforced at the gate layer + middleware so a
  blocked user hitting host/guest surfaces is bounced to the quotes-only shell.
- Reuse the existing account-lifecycle/soft-delete + admin audit plumbing
  (`lib/users/accountLifecycle.ts`, `admin_audit_log`). **Decision D5** (block
  granularity: quote-only-off vs full-suspend vs both).

---

## 5. Data-model changes (need founder sign-off — CLAUDE.md)
- `quotes.quote_type text not null default 'accommodation'` CHECK in
  ('accommodation','custom','upload').
- Relax for non-accommodation: `check_in/check_out` NULLable (currently NOT
  NULL), `property_id` NULLable, `scope` NULLable/ignored. Guard: a **booking
  conversion** requires type='accommodation' + property + dates.
- `quotes.attachment_path text` + `quotes.attachment_amount/currency` for type C
  (or a small `quote_attachments` table). New private bucket `quote-uploads`.
- `hosts.account_kind text default 'host'` CHECK ('host','quote_only') — or a
  capabilities table. + admin `platform_access`/`quote_access` flags for §4.5.
- New membership product row(s) for the Wielo Quotes tier + `plan_features` /
  `looking_for_quotas` rows for the quote-only plan.
- Pre-MVP: additive + reshape freely; still additive-friendly to avoid churn.

## 6. Feature gating
- New capability keys via `check_feature_permission`: `quote_custom`,
  `quote_upload`, `looking_for_respond` (already `looking_for_access`),
  `platform_full` (host surfaces). Pre-MVP: open on free per CLAUDE.md, but wire
  the gates now so Phase-3 monetisation flips them on.

## 7. Suggested phasing
1. **Quote type + soft validation** (concerns 1, 3a): add `quote_type`, the
   step-1 picker, Custom (type B) builder (hide accommodation blocks), soften LF
   capacity/date validation. Highest value, no new user class.
2. **Edit-to-negotiate polish** (concern 2): make edit-&-re-send the primary CTA,
   guest-facing "updated" semantics.
3. **Uploaded quotes** (concern 3b): bucket + type C attach + guest view/accept.
4. **Quote-only accounts + Wielo Quotes subscription** (concern 4): account_kind,
   gated shell, membership tier + credits, priority rules.
5. **Admin block/scope controls** (§4.5) + moderation.
Each phase ships independently and is verified in builder + live (Principle #9).

## 8. Reuse (don't fork)
- Credits engine (`lib/credits/wallet.ts`) — as-is; 1/credit per send, all types.
- `sendQuoteAction` idempotent debit — the single send/charge path; keep it SSOT.
- Quote PDF/email/accept-loop/record — parameterise by `quote_type`.
- Sub/credit/ledger activation — every path now grants (this session's fix).
- Distinct-by-purpose forms rule (`feedback-quote-vs-booking-forms-distinct`).

## 9. Decisions

**LOCKED (founder, 2026-07-15):**
- **D6 — MVP cut: FULL dual-system in one release.** External non-host quote-only
  users + the Wielo Quotes subscription + admin block ship WITH the host-facing
  quote types, not after. Build order still follows §7 phases internally, but all
  five phases are in-scope for the release.
- **D1 — Soft-validation: Looking-For responses ONLY.** Over-capacity / no-dates
  becomes a warning-with-confirm only when responding to a Looking-For post. The
  direct-booking quote path + checkout keep the HARD capacity/availability block
  (a real booking must fit). Gate the softening on "is this an LF response".
- **D0 — Name: DEFERRED.** Use placeholder **"Wielo Quotes"** in code/UI copy;
  founder renames before launch (keep it a single constant to swap once).

**PROPOSED (defaults — founder to confirm/adjust):**
- **D2 — Quote-only account = a flag on `hosts`.** Reuse `hosts.id` (credits +
  quotes already key off it) with `hosts.account_kind in ('host','quote_only')`;
  gate every accommodation/booking/website surface off for `quote_only`. Avoids a
  parallel identity + duplicating the credits/quotes/inbox plumbing.
- **D3 — Wielo Quotes = a membership TIER** (product_type `membership`), not a new
  product_type — rides the existing sub/credit/ledger/activation machinery
  (activation now grants credits on every path). A `quote_only` account holds this
  membership + optional credit top-up packages.
- **D4 — Host priority = sort + badge + quota, data-driven.** Verified hosts' A/B
  quotes sort above quote-only users' on the guest compare view; a "Verified host"
  vs "Quote partner" badge; quote-only users get a tighter `looking_for_quotas`
  row (fewer quotes/day). All via `check_feature_permission` + quotas, no hardcoding.
- **D5 — Admin block = two levels.** (i) `quote_access` off = can't send quotes;
  (ii) `platform_access` off = bounced from host/guest surfaces to the quotes-only
  shell (or fully suspended via existing account-lifecycle). Admin toggles both,
  audited.

## 10. Risks / open questions
- Shared `QuoteForm` softening must not weaken the real **booking** capacity/
  availability guard — keep the hard block where a booking is actually created.
- Guest **compare/accept** UI must handle a mix of A/B/C quotes on one post.
- Uploaded-quote **trust/safety** (file scanning, size/type limits, abuse) —
  quote-only users are less-vetted; pair with §4.5 admin controls.
- Priority rules must be data-driven (quotas/gates), not hardcoded, so tiers can
  change without code.
