# Payment Gateways → Per-Business — Plan

> Move Paystack / PayPal connections from host-level to **per-business**, mirroring
> the EFT-banking precedent (`eft_banking_details.business_id`) and the per-business
> document identity already shipped. Each business owns its own Paystack/PayPal/EFT;
> a booking's payment link or card charge uses the gateway of that booking's
> **listing → business**. Saved 2026-06-14.

## Why
A host can own several legal businesses; listings already belong to a business
(`listings.business_id`), EFT banking is already per-business, and every finance
document already prints the listing's business. **Payment gateways are the one
piece still host-level** (`host_payment_gateways.host_id` only). So a host with
Business 1 + Business 2 has a single Paystack for both — money for a Business 2
booking would land in Business 1's account. This closes that gap.

Target: Business 1 = listing 1 = eft1 + paystack1 + paypal1; Business 2 = listing 2
= eft2 + paystack2 + paypal2; etc.

## Current state (verified)
- **Table** `host_payment_gateways` (`20260602000016`): `host_id`, `gateway`
  (paystack|paypal), `public_identifier`, `secret_cipher` (PAYMENT_CIPHER_KEY),
  `statement_descriptor`, `is_enabled`, env. **Unique `(host_id, gateway)`** — one
  per provider per host. No `business_id`.
- **Resolver** `getHostPaystack(hostId)` (`lib/payments/host-paystack.ts`) — admin
  read, decrypts the secret. ~8 callers; **most already have `listing.business_id`**:
  `pay/[token]/page.tsx`, `listing/[slug]/book/page.tsx`, `booking/[id]/success`,
  and the core `startBookingPayment` / `confirmHostCardPaymentByReference`
  (`lib/payments/pay-booking.ts`). PayPal sits in the same table.
- **Settings UI** is host-level ("these apply across all your businesses") —
  `settings/banking` PaymentGatewaysSection/Dialog.
- **MUST NOT CHANGE:** the platform Paystack key (`PAYSTACK_SECRET_KEY`) used only
  for Wielo's own subscription billing, and the `paystack-webhook` (platform-only).
  Host booking payments already charge the host's own key (AGENT_RULES §4.7/§4.8).
- **Precedent to mirror:** `eft_banking_details.business_id` + `getHostParty(…, businessId)`
  resolving banking per business (default-business fallback).

## Decisions (recommended; confirm before building)
1. **Gateway settings live on each business** (like its banking) — manage
   Paystack/PayPal on the business's detail page (`settings/businesses/[id]`),
   not a single host-level section. This matches the founder's model ("gateways
   belong to the business").
2. **No-gateway fallback:** if a booking's business has no enabled card gateway,
   the pay page shows **EFT only** (using that business's banking) + a host nudge
   to connect a gateway — never silently fall back to another business's account.
3. **Manual "request a payment" link** (`createPaymentLinkAction`, not tied to a
   booking): host **picks the business** (default pre-selected) so the charge
   lands in the right account.
4. **Resolution = derive from the booking** (booking → listing → `business_id`),
   the single source of truth — never store the gateway choice on the booking.

## Plan (phased; commit per phase)

### Phase 1 — Schema (mirror EFT)
- Migration `<ts>_gateway_per_business.sql`: add `business_id uuid REFERENCES
  businesses(id) ON DELETE CASCADE`; backfill each row to the host's default
  business; set NOT NULL; replace unique `(host_id, gateway)` with
  **`(business_id, gateway)`**; index `(host_id, business_id)`. RLS unchanged
  (still host-owned via business→host). Regen types.

### Phase 2 — Resolver
- `lib/payments/host-paystack.ts`: add `getHostPaystackForBusiness(businessId)`
  (the real lookup). Keep `getHostPaystack(hostId)` as a thin wrapper → host's
  default business, for the manual-link/back-compat path. Same for PayPal
  (`getHostPaypalForBusiness`).
- Add a small `businessIdForBooking(admin, bookingId)` helper (or reuse the SQL
  `booking_business_id()`), so the pay/verify paths resolve business cleanly.

### Phase 3 — Pay flows become business-aware
- `pay-booking.ts startBookingPayment`: `getHostPaystackForBusiness(booking.listing.business_id)`.
- `confirmHostCardPaymentByReference`: take/derive `businessId` (from booking→listing)
  and verify with that business's key.
- `pay/[token]/page.tsx`, `listing/[slug]/book/page.tsx`: resolve the card rail
  from `listing.business_id`.
- `booking/[id]/success`: pass the listing's `business_id` to the confirm call.
- PayPal flow: same swap.
- Service-role admin reads keep working (no RLS regressions).

### Phase 4 — Per-business gateway settings UI
- Move PaymentGatewaysSection/Dialog onto the business detail page (next to that
  business's banking), reading/writing `host_payment_gateways` filtered by
  `business_id`. `save/toggle/test/delete` actions take a `businessId`.
- The old host-level "Card payments" section either becomes a redirect/explainer
  ("manage card payments per business") or is removed.
- Manual payment-link form gains a business picker (default pre-selected).

### Phase 5 — Verify, help, ship
- Service-role sweep + a 2-business test: connect Paystack to Business 2, book a
  Business 2 listing, generate the pay link → charges Business 2's key; Business 1
  unaffected. A business with no gateway shows EFT-only on its pay page.
- Help article touch-up (card payments are per business). `pnpm build` + lint;
  CHANGELOG + CURRENT_TASK; chunked commits.

## Files (anticipated)
| Area | Path |
|---|---|
| Migration | `supabase/migrations/<ts>_gateway_per_business.sql` (new) |
| Resolver | `apps/web/lib/payments/host-paystack.ts` (+ paypal equivalent) |
| Pay core | `apps/web/lib/payments/pay-booking.ts` |
| Pay page / checkout / success | `app/[locale]/pay/[token]/page.tsx`, `listing/[slug]/book/page.tsx`, `booking/[id]/success/page.tsx` |
| Settings (per-business) | `settings/businesses/[id]/…` + `settings/banking/actions.ts` (gateway actions take businessId) |
| Manual link | `settings/banking/actions.ts createPaymentLinkAction` (+ business picker UI) |
| Types | `packages/types/database.types.ts` (regen) |
| DO NOT TOUCH | `lib/paystack.ts` platform key, `supabase/functions/paystack-webhook` |

## Pre-MVP note
No real users/data → the migration can backfill + reshape freely (CLAUDE.md
pre-MVP policy). Existing single-business hosts are unaffected (their one gateway
maps to their default business).
