# Vilo Platform — Testing Strategy

**Version:** 1.0
**Last Updated:** May 2026
**Companion Docs:** `DEVSTACK.md`, `CONVENTIONS.md`, `AGENT_RULES.md`

---

## 1. Testing Philosophy

Test what matters, not everything. The goal is confidence that the platform works for real users — not 100% coverage for its own sake.

**Priority order:**
1. Business-critical flows (payments, booking state machine, refund calculations, RLS policies)
2. Edge cases that could lose money or expose data
3. Component behaviour for interactive UI
4. Everything else — only when it's complex enough to break

**What we do NOT unit test:**
- Simple presentational components with no logic
- Straightforward CRUD Edge Functions with no business logic
- Database queries that are just `select * from table`
- Config files

---

## 2. Testing Stack

| Layer | Tool | Version | Purpose |
|---|---|---|---|
| Unit + Integration | Vitest | Latest | Utility functions, Zod schemas, business logic, Edge Function logic |
| Component | React Testing Library | Latest | Interactive UI components |
| User events | `@testing-library/user-event` | Latest | Simulating clicks, typing, form submission |
| E2E | Playwright | Latest | Critical user journeys end-to-end |
| API mocking | `msw` (Mock Service Worker) | Latest | Mock Supabase + Edge Function calls in component tests |
| Database | Supabase local (`supabase start`) | — | Real DB for integration tests |

---

## 3. File Conventions

### Test file location
Co-locate tests with the code they test:

```
lib/utils/formatCurrency.ts
lib/utils/formatCurrency.test.ts    ← co-located

lib/utils/calculateNights.ts
lib/utils/calculateNights.test.ts
```

For E2E:
```
tests/
  e2e/
    auth.spec.ts
    booking-flow.spec.ts
    host-signup.spec.ts
```

### Naming rules
- Unit test files: `*.test.ts` or `*.test.tsx`
- E2E test files: `*.spec.ts`
- Test function names: plain English describing what it does — `it('returns R 0 when amount is zero')`, not `it('should return zero')`
- Describe blocks: the thing being tested — `describe('formatCurrency', () => {`

---

## 4. What to Test — Unit & Integration

### Always test these (mandatory)

**`packages/utils/formatCurrency.ts`**
```typescript
it('formats ZAR with space thousands separator and comma decimal')
it('handles zero correctly')
it('handles large amounts')
it('throws on negative amounts')
```

**`packages/utils/calculateNights.ts`**
```typescript
it('returns 2 for a Friday–Sunday stay')
it('returns 1 for same-day check-in check-out')
it('returns 0 if check_out before check_in')
```

**`packages/utils/policyRefundCalc.ts`**
```typescript
it('returns 100% refund when 7+ days before check-in on Moderate policy')
it('returns 50% refund when 3 days before check-in on Moderate policy')
it('returns 0% when less than 24h before check-in on Flexible policy')
it('returns 0% for non-refundable policies regardless of notice')
it('matches database calculate_policy_refund_amount output exactly')
```

**`packages/schemas/*.schema.ts`**
```typescript
// For every Zod schema
it('accepts a valid input object')
it('rejects missing required fields')
it('rejects invalid UUID formats')
it('rejects check_out before check_in')
it('rejects negative amounts')
```

**Booking state machine**
```typescript
// lib/utils/bookingStateMachine.ts (if extracted)
it('allows pending → confirmed transition')
it('allows confirmed → checked_in transition')
it('disallows pending → completed (skipping steps)')
it('disallows confirmed → pending (backwards)')
it('throws on any invalid transition')
```

**`ical-import` Edge Function (integration test)**
```typescript
it('fetches a valid iCal feed and inserts blocked_dates for future events')
it('removes blocked_dates rows when events disappear from the feed on re-sync')
it('does not remove blocked_dates rows from Wielo bookings or manual blocks')
it('rejects a URL pointing to a private IP range (SSRF protection)')
it('rejects a response that is not valid iCal format')
it('caps imports at 500 events and does not error on overflow')
it('marks the feed status as error when the URL returns 404 or 403')
```

**`ical-export` Edge Function**
```typescript
it('returns a valid RFC 5545 .ics response for a listing with confirmed bookings')
it('returns 401 for an incorrect export token')
it('includes VEVENT for each confirmed booking within the next 24 months')
it('does not include guest PII in the exported feed')
```

**`check_feature_permission` RPC (integration test against local Supabase)**
```typescript
it('returns is_enabled: true for a Pro host with instant_booking feature')
it('returns is_enabled: false for a Free host with direct_booking feature')
it('per-host override takes priority over plan defaults')
it('expired overrides fall back to plan defaults')
```

---

## 5. What to Test — Components

Only test components that have **interactive logic or conditional rendering**. Pure presentational components need no tests.

### Test these

**`BookingStatusBadge`**
```typescript
it('renders the correct colour for each status')
it('renders the correct label text for each status')
```

**`UpgradePrompt`**
```typescript
it('renders the correct plan name and price')
it('calls onUpgradeClick when button is pressed')
it('shows the correct feature name')
```

**`PolicyRefundTimeline`**
```typescript
it('renders all policy rules from a snapshot')
it('highlights the applicable rule based on days before check-in')
it('shows "Non-refundable" correctly when is_non_refundable is true')
```

**Booking flow forms (React Hook Form + Zod)**
```typescript
it('shows validation error when check-out is before check-in')
it('disables submit button while submitting')
it('calls the server action on valid submit')
it('shows an error toast on server action failure')
```

**`AvailabilityCalendar` (host view)**
```typescript
it('marks blocked dates as unavailable')
it('opens block confirmation modal on date click')
it('calls onBlockDate with correct dates')
```

---

## 6. What to Test — E2E (Playwright)

E2E tests run against a **local Supabase instance with seed data**. They simulate a real browser and test complete user journeys.

### Critical journeys (must pass before every PR merge)

**`auth.spec.ts`**
- Guest signs up with email and verifies
- Host signs up, completes onboarding wizard, selects Free plan
- Login with correct credentials succeeds
- Login with wrong password fails with error
- Logout clears session
- Protected dashboard route redirects unauthenticated user to login

**`booking-flow.spec.ts`**
- Guest: search directory → view listing → select dates → book (Paystack test mode) → see success page
- Guest: request-to-book → booking appears as pending → host confirms → guest sees confirmed
- Host: receives booking request → clicks confirm → booking shows as confirmed
- Host: receives booking request → declines → booking shows as declined

**`listing-management.spec.ts`**
- Host: creates accommodation listing with all required fields → publishes → listing appears in directory
- Host: edits listing name → change appears on public profile
- Host: unpublishes listing → listing no longer in directory

**`payment-webhooks.spec.ts`** (integration test only — no browser)
- Paystack `charge.success` webhook: valid signature → booking confirmed, dates blocked
- Paystack `charge.success` webhook: invalid signature → 401 returned, no DB writes
- Paystack `charge.success` webhook: duplicate `provider_reference` → idempotency: no double-process

---

## 7. Running Tests

```bash
# Unit + integration tests (Vitest)
cd apps/web && pnpm test          # run all unit tests
cd apps/web && pnpm test:watch    # watch mode
cd apps/web && pnpm test:coverage # with coverage report

# E2E tests (Playwright) — requires supabase start
supabase start
cd apps/web && pnpm test:e2e      # run all E2E

# Run a single E2E file
pnpm test:e2e tests/e2e/auth.spec.ts

# Run with browser visible (debugging)
pnpm test:e2e --headed
```

### CI
E2E tests run on every PR via GitHub Actions against a Supabase local instance spun up in the CI environment. Unit tests also run. No merging on red CI.

---

## 8. Test Data & Seeding

E2E tests use the local Supabase seed data plus test-specific fixtures. Do not use production data.

**Seed users available in tests:**
```typescript
const TEST_USERS = {
  guest: { email: 'guest@vilotest.com',  password: 'TestGuest123!' },
  host_free: { email: 'host_free@vilotest.com', password: 'TestHost123!' },
  host_pro:  { email: 'host_pro@vilotest.com',  password: 'TestHost123!' },
  admin:     { email: 'admin@vilotest.com',      password: 'TestAdmin123!' },
};
```

**Test listing:** A pre-seeded published accommodation listing at `vilotest-cottage` handle — used for guest booking flow tests.

**Reset between tests:**
```typescript
// playwright.config.ts
use: {
  baseURL: 'http://localhost:3000',
}
// Run supabase db reset before each full test suite
```

---

## 9. Coverage Targets

We do not chase coverage numbers. These are minimums, not goals:

| Layer | Minimum coverage |
|---|---|
| `packages/utils/` | 90% — these are pure functions, test everything |
| `packages/schemas/` | 85% — all schemas should have valid + invalid cases |
| Business logic (refund calc, booking state machine) | 95% |
| UI components with logic | 60% |
| E2E critical journeys | All listed in Section 6 must pass |

---

## 10. What NOT to Test

- shadcn/ui components (they have their own test suite)
- Tailwind class rendering
- Database migration files (verified by `supabase db push`)
- Auto-generated TypeScript types
- Simple getters/setters with no logic
- Third-party SDK wrappers (Resend, Paystack JS) — mock these at the boundary

---

*When adding a new complex utility or business logic function — write the test in the same commit as the function.*
