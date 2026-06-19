# LANE: mobile

- **Session name:** `mobile`
- **Branch:** `feat/mobile-app`
- **Worktree:** `C:\Users\Wollie\Desktop\vilo-mobile`

## You own (edit only these)
`apps/mobile/**` — nothing under `apps/web/**`.

## Rules (full: `docs/multi-agent/CONTRACT.md`)
- **Never** run `supabase gen types`. `packages/types/database.types.ts` is shared and
  **read-only** here — the consolidation lane regenerates it.
- Stage **explicit paths only** (never `git add .` / `-A`).
- Gate: mobile typecheck + lint (`expo lint` / `tsc`).
- When a phase is green, commit on `feat/mobile-app` and tell the head dev.

## Current work
Mobile app build — Phase 6 (shared Edge Functions) and deferred booking/pay/refund mutations.
