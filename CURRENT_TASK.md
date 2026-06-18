# Vilo Mobile — Current Task

> This worktree (`C:\Users\Wollie\Desktop\vilo-mobile`, branch `feat/mobile-app`)
> builds the **Vilo mobile app** (Expo) as a full management extension of the web
> app. The web/Supabase DB is the source of truth. **Mobile-only thread** — do not
> touch `apps/web` or other branches from here.

**Plan:** `~/.claude/plans/i-want-to-start-swirling-rain.md` (8 phases).
**Design:** `C:\Users\Wollie\Downloads\Vilo Mobile App.html`.
**Resume detail:** memory `project_mobile_app_build.md` (per-commit notes).

## Conventions
- Live reads + simple writes go direct to Supabase under RLS. Complex/money flows
  (pricing recalc, payments, refunds, booking confirm) are **deferred to Phase 6
  shared Edge Functions** — UI-first, not faked.
- Screens live under `src/app/(auth|guest|host)/`; register every new host detail
  route in `(host)/_layout.tsx`. Query modules in `src/lib/queries/*`. Reuse
  `src/components/ui/*` (Button, Field, Tag, Chip, Card, SegmentedControl,
  ScreenHeader, EmptyState, Skeleton, Icon, Avatar). Every string via `t()` +
  `src/i18n/en.json`. No `any` (use `@vilo/types`).
- Forms: seed local state via `useState` initializer keyed by id (NOT a
  setState-in-effect — eslint `react-hooks/set-state-in-effect` forbids it).
- **Gates here = `npx tsc --noEmit` + `npx expo lint`** (can't run the simulator in
  this env; founder boots it on device). Commit per sub-phase; stage explicit
  `apps/mobile/...` paths; the pre-commit hook runs prettier.

## Status
- ✅ **Phase 0** worktree/setup · **Phase 1** foundation (design system, auth, nav)
- ✅ **Phase 2** guest flows (browse/search/listing/trips/inbox/chat/notifications/profile)
- ✅ **Phase 3** host operations (overview/bookings/booking-detail/calendar/inbox/chat/Guests CRM)
- ✅ **Phase 4** host catalogue & config — Properties, Rooms, Add-ons, Coupons,
  Seasonal pricing, Policies (assign), Reviews (respond), Settings. All live RLS
  writes; no money math / publish-gating on mobile.
- ✅ **Phase 5** finance read-only — Finance (cash position + payments) + Reports
  (revenue/months/status). Derived from payments+bookings; mirrors web ledger rules.
- ⏳ **NEXT: Phase 6** shared Edge Functions (create-booking/pay/cancel/refund/
  review + booking confirm/decline) — **DEFERRED by founder** (it's shared backend +
  money + deploy, outside pure mobile-app dev; needs explicit go-ahead).
- Interim (mobile-only): polish — pull-to-refresh, empty/error states, a11y, design QA.
- Later: Phase 7 offline+sync, Phase 8 push + final polish.

## Verify
Run on device: `pnpm --filter mobile start` → Expo Go. Confirm a change made on
mobile (e.g. edit a property, add a coupon) round-trips to the web app, and vice-versa.
