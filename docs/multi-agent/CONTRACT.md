# Wielo Multi-Agent Contract (active)

> Implements `~/.claude/plans/validated-hopping-reef.md`, adapted to the **feature-based**
> split actually in flight. One owner per lane; the Consolidation lane owns merges + DB +
> `main`. Read this before starting any parallel session.

## Lanes (one owner each — never two agents in one worktree)

| Lane | Worktree (folder) | Branch | Owns |
|---|---|---|---|
| **Consolidation** (head dev) | `wielo-integration` | `integration` | merges, ALL DB pushes, `gen types`, FF→`main`, this contract |
| **Specials** | `Wielo 2027` (primary) | `agent-specials` | `dashboard/specials/**`, `special/**`, `specials/**`, `lib/specials/**`, `lib/bookings/persist.ts` |
| **Website-CMS** | `wielo-website` | `agent-website` | `dashboard/website/**`, `site/**`, `components/site/**`, `lib/site/**`, `lib/website/**` |
| **Mobile** | `wielo-mobile` | `feat/mobile-app` | `apps/mobile/**` only |

## Hard rules (every agent)

1. **DB is shared cloud — agents do NOT touch it.** Write migration files only
   (`supabase/migrations/<YYYYMMDDHHMMSS>_*.sql`). **Never** run `supabase db push` or
   `supabase gen types`. The Consolidation lane applies all migrations in timestamp order
   and regenerates `packages/types/database.types.ts` **once** at integration.
   - Therefore `packages/types/database.types.ts` is **READ-ONLY** in agent lanes.
2. **Stage explicit paths only** — never `git add .` / `<dir>` / `-A`. Commit only files in
   your lane's ownership above.
3. **Shared Core is FROZEN** (imported by multiple lanes): `lib/payments/**`,
   `lib/finance/**`, `lib/notifications/**`, `lib/reviews/**`, `lib/messaging/**`,
   `lib/guests/**`, `lib/business/**`, `lib/brand.ts`, `components/inbox/**`,
   `components/reviews/ReviewPhotoGrid`, `components/booking/CancelBookingDialog`.
   Read-only unless the head dev assigns it to your lane for the session.
4. **Cross-cutting files — append only, coordinate:** `messages/*.json` (append under your
   feature's key prefix), `dashboard/_components/Sidebar.tsx`, `CHANGELOG.md`,
   `middleware.ts`. `CURRENT_TASK.md` is written by the session owner; others read.
5. **Reuse SSOTs, never fork the maths** — ledger (`lib/payments/ledger.ts`), transactions
   (`lib/finance/transactions.ts`), gkey, policy RPCs, brand, business resolver.
6. Inherited guardrails: no `any`; mutations via Server Actions/Edge Functions only;
   currency in full Rand; wire every string through i18n; canonical Modal/FormModal; a Help
   article per feature; gated features open on `free` pre-MVP; card charges use the host's
   Paystack (`getHostPaystack`).

## Workflow

- **Per phase:** build your feature → `cd apps/web && NODE_OPTIONS=--max-old-space-size=6144
  pnpm build` + `pnpm lint` green → commit (explicit paths) on your lane branch → tell the
  head dev "lane X, phase Y ready".
- **Save point = a completed phase that builds.** The head dev validates in `wielo-integration`,
  applies any new migrations + regenerates types, then **fast-forwards `main`** and pushes.
- **Session start:** `git fetch && git rebase origin/main` (or merge) so you have the latest
  consolidated `main` (incl. regenerated types) before coding.

## Notes

- `apps/mobile` only shares `packages/types/database.types.ts` — head dev regenerates it; the
  mobile lane treats it read-only and never runs its own `gen types`.
- Migration timestamp collisions across lanes are resolved by the head dev at integration
  (newer file moves later).
