# Dev-Environment Handoff — resume on the new PC (2026-06-19)

Snapshot for moving the Wielo dev environment to a faster PC. Everything below is in
the GitHub repo (`git pull` brings it). **Claude's memory does NOT travel via git** —
copy `C:\Users\Wollie\.claude\projects\C--Users-Wollie-Desktop-Wielo-2027\memory\`
to the same path on the new PC if you want the assistant's recalled context; otherwise
this file is the source of truth.

## Repo
`https://github.com/Wollie333/Vilo2027.git` — Supabase project ref `zlcivjgvtyeaszikqleu`.

## Branch state at handoff (all pushed to origin)
| Branch | Role | Tip | Status |
|---|---|---|---|
| `main` | integrated truth | (latest) | green; everything below is merged in |
| `agent-specials` | Specials lane | `b9eb724` | **= main** (feature complete) |
| `agent-website` | Website-CMS lane | `b2f0167` | **= main** (all committed work integrated) |
| `integration` | consolidation/CI lane | (= main) | mine; DB-linked lane |
| `feat/mobile-app` | Mobile lane (PARKED) | `15c390e` | own branch, never merged to main; WIP saved as a commit |

## Feature status
- **Specials — COMPLETE on main.** S0–S7c (schema, host CRUD, pricing, booking wiring,
  public `/deals` directory + `/deal/[slug]` detail, view tracking, feature gate, help,
  full i18n) + UI redesigns (Specials Manager, Special Editor, listing-style deal page,
  rooms-on-deal) + the **"Specials → Deals" rename** (routes `special→deal`, `specials→deals`).
- **Website CMS — STOPPED AT PHASE 6.** Done & on main: themes-as-data **P1** (seam +
  `site_themes` catalogue), **P2** (applyTheme + page seeding + theme gallery), **P2.5**
  (design restore points safety net, `website_restore_points`), **P5.5** (header/footer
  layout variants), plus Brand Studio (merge→focus-mode→redesign→stage-2).
  **NEXT = Phase 6: two flagship free themes** (one `is_default`, "last before refine"),
  theme-aware tabs manifest, per-section responsive visibility. See plan
  `~/.claude/plans/crispy-sparking-hippo.md`. Theme plan phases 3 (admin theme CRUD,
  enters `admin/**`) and 4 (premium themes; reuse `product_orders`/
  `confirmProductOrderByReference`, gate at `publishWebsiteAction`) still to do.
- **Mobile — PARKED** by founder until the web app is 100% + launched. Do not merge/sync
  `feat/mobile-app` to main. Its pre-move WIP is committed (`15c390e`).

## DB (cloud, shared) — all migrations applied through `20260619005000`
`…001000 special_view_events`, `…002000 specials_feature_gate`, `…003000 help_specials`,
`…004000 site_themes`, `…005000 website_restore_points`. Verify on new PC with
`supabase migration list --linked`.

## Multi-agent coordination model (how this repo is being built)
Per `docs/multi-agent/CONTRACT.md`. Feature-based lanes, one git worktree each; a
**consolidation lane** (this assistant) owns ALL DB applies + `gen types` + merges to
`main`. Agents write migration files only, never `db push`/`gen types`; stage explicit
paths; `packages/types/database.types.ts` is read-only in agent lanes.

## Resume on the new PC
1. `git clone https://github.com/Wollie333/Vilo2027.git` then `cd` in.
2. `git fetch --all`; check out branches you need (`git switch agent-specials`, etc.).
3. Recreate worktrees (optional but recommended — mirrors this setup):
   ```
   git worktree add worktrees/wielo-website  agent-website
   git worktree add worktrees/wielo-integration integration
   git worktree add ../wielo-mobile feat/mobile-app
   ```
4. `pnpm install` at the root (and in each worktree you'll build in — `CI=true pnpm install`
   if a relocated worktree has dead symlinks).
5. Copy `.env.local` (root + `apps/web/`) — secrets are git-ignored, carry them manually.
6. `supabase link --project-ref zlcivjgvtyeaszikqleu` (the integration lane is the DB lane).
7. Build gate: `cd apps/web && NODE_OPTIONS=--max-old-space-size=6144 pnpm build` (clear
   `.next` between consecutive builds to avoid false "Cannot find module ./chunks/*" errors).
8. Resume: Website CMS Phase 6 (in `agent-website`); Specials is done; Mobile stays parked.
