# 🧭 SAVEPOINT — 2026-07-31 — AI wizard fix + branch→main MERGE PLAN (resume here)

**Branch:** `feature/website-cms-10min-wizard` · **HEAD:** `08376f5` (clean, fully pushed;
GitHub tip == local HEAD). **Prod:** `main` @ `a5f4f82` (healthy; `mana.wielo.co.za` 200).

> ## ▶▶ NEXT SESSION: two independent tracks were scoped this session. Read both.
> 1. **AI wizard "generates nothing"** → it's a MISSING ENV VAR, not a code bug (details below).
> 2. **Founder wants to merge `feature/website-cms-10min-wizard` → `main`.** Full merge plan below,
>    ready to execute. Founder paused before Phase 1 to save this point.

---

## 1) AI WIZARD — root cause found (env, not code) ✅ diagnosed, NOT yet fixed

**Symptom (founder):** "the AI does not generate anything during the wizard."

**Root cause:** the wizard AI is **fully built and correct**; it is gated behind
`aiConfigured()` = `Boolean(process.env.ANTHROPIC_API_KEY)` (`apps/web/lib/ai/client.ts:67`).
Every AI action short-circuits `if (!aiConfigured()) return { ok:false, error:"ai_not_configured" }`.
So **`ANTHROPIC_API_KEY` is not set on the deployment serving the wizard.** The wizard UI
(`_wizard/steps/StepStory.tsx`, `_wizard/PageSectionsPanel.tsx`) shows the "AI isn't switched on yet"
message for exactly that error. This matches the old SESSION2 INFO note.

**Actions (all built, grounded in host's real rooms/reviews/policies, length-capped):**
`apps/web/app/[locale]/dashboard/website/_wizard/aiActions.ts` —
`generateWizardContentAction`, `writeWizardSlotAction` (wizard-time, no persist),
`generateSiteContentAction`, `regenerateSlotAction` (editor). Client: `apps/web/lib/ai/client.ts`
(`generateJson` over plain fetch, forced-tool-call structured output).

**THE FIX (no code change needed):** add `ANTHROPIC_API_KEY` to the Vercel env for the environment
serving the wizard — **Preview** (feature-branch deploy) and, at go-live, **Production** (main).
It's a secret → founder enters it in the Vercel dashboard (Claude must not handle the key value).
Merging to main will NOT fix this by itself — if the key is unset for Production too, the AI is
equally dead on main. Env var and merge are orthogonal.

**Optional follow-ups (tuning, not blockers):**
- `ANTHROPIC_API_KEY` is **undocumented** in `ENV_VARS.md` (grep confirmed absent) — add it.
- Model defaults in `client.ts` `defaultModel()` are `claude-sonnet-4-6` for BOTH tiers (still a valid
  active model, won't 404). "fast" tier using Sonnet not Haiku is a needless cost. Consider
  `claude-opus-5` (quality) / `claude-haiku-4-5` (fast). Overridable via env
  `ANTHROPIC_MODEL_QUALITY` / `ANTHROPIC_MODEL_FAST` — no code change required to change them.

---

## 2) BRANCH → MAIN MERGE PLAN (founder-approved to plan; execution paused)

### Ground truth (measured this session; merge-base `c0eb519`)
- **Two-way divergence:** `main` is **335 commits** ahead of the base (affiliate/partner-program +
  email-verification + admin-affiliate + prize-engine + security arc); the **branch is 246 ahead**
  (CMS/theme/wizard arc). NOT a fast-forward either way.
- Prod hotfix **`b2ab4d7` is on main, NOT in the branch** — it flows IN automatically on merge
  (`lib/site/themes.ts` auto-merges cleanly), so the crash fix is not at risk.
- **Migrations:** main added **115** since base; branch added **7** (all CMS/theme, listed below).
  Branch migration timestamps are 0717–0721 — EARLIER than main's latest applied (`20260724010000`).
- **Conflicts: 6 files** (`git merge-tree --write-tree origin/main HEAD`), the two arcs are mostly
  disjoint:

| File | Effort | Note |
|---|---|---|
| `CHANGELOG.md` | trivial | both appended → keep both |
| `CURRENT_TASK.md` | trivial | docs → keep both / take branch |
| `apps/web/app/_components/home/home-data.ts` | trivial | main −74, branch ±1 → take main + reapply 1 line |
| `apps/web/components/currency/Money.tsx` | moderate | both edited currency (~15 lines each) → combine |
| `apps/web/components/currency/CurrencyProvider.tsx` | moderate | branch added currency switcher (+36), main +4 → combine |
| `apps/web/lib/website/themeSections.ts` | moderate | branch-dominant (+507), main +40 → take branch + reapply main's 40 |

- `packages/types/database.types.ts` text-merges but is GENERATED — must be **regenerated** from the
  merged migration set, never hand-merged.

### The 7 branch migrations to apply to prod (all additive/backward-compatible, affiliate-independent)
```
20260717090000_website_content_profile.sql
20260717100000_theme_preview_stock_images.sql
20260717110000_site_themes_grant_read.sql
20260717120000_site_themes_admin_policy_scope.sql
20260718090000_rename_sabela_theme_to_hotel.sql
20260720120000_safari_theme_fraunces_font.sql
20260721120000_add_royal_theme_to_catalog.sql
```
⚠️ Their timestamps predate main's latest applied migration. Verify `supabase db push --linked`
applies them despite out-of-order versions (may warn "migration history out of order"; if the CLI
balks, `supabase migration repair` / confirm the applied set). This is the one truly irreversible,
prod-touching step. They're additive so safe to apply BEFORE the code lands.

### Recommended execution order (merge INTO the branch first; prod touched LAST)
**Phase 1 — local, fully reversible (`git merge --abort` undoes it; nothing touches main/prod):**
1. `git merge origin/main` **into** `feature/website-cms-10min-wizard`.
2. Resolve the 6 conflicts (2 docs keep-both; 4 code per the table).
3. Regenerate `packages/types/database.types.ts` (from linked DB after migrations, or as part of Phase 2).
4. Gate: `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` + `pnpm lint` + Vercel **preview**
   build + live render on the branch preview. (Local `pnpm build` OOMs / lacks full env — known gotcha.)

**Phase 2 — production, EACH step gated by explicit founder "go":**
5. Apply the 7 migrations to the linked prod DB (`supabase db push --linked`). Founder undecided on who
   runs it ("n/a" this session) — decide at step 5; hand founder the exact command if this env lacks the
   Supabase link/token.
6. Fast-forward `main` to the merged branch + push → triggers prod deploy. **IRREVERSIBLE / outward —
   needs explicit go.**
7. Founder adds `ANTHROPIC_API_KEY` to Vercel **Production** (secret; founder's action) → AI wizard live.
8. Verify prod: `mana.wielo.co.za` 200 + AI wizard generates real copy (no `ai_not_configured`).

**Hard gates Claude is holding:** never run step 5 (prod DB) or step 6 (push to main → prod deploy)
without a separate explicit founder "go" at that moment. Phase 1 needs a go to START but is reversible.

### Reproduce the analysis (if re-verifying)
```
git fetch origin
git merge-base origin/main HEAD                      # c0eb519
git rev-list --left-right --count origin/main...HEAD # 335  246
git merge-tree --write-tree --name-only origin/main HEAD | head   # the 6 conflicts
git diff --name-only --diff-filter=A c0eb519 HEAD -- supabase/migrations/   # the 7 branch migrations
```
NOTE: the local `origin/feature/...` tracking ref went stale this session (looked 184 behind);
fixed with `git update-ref`. If it looks wrong again, trust `git ls-remote origin <branch>`.

---

## Prior context (unchanged, still valid)
- Royal theme conform is **comprehensive** (structure/type/shape/colour/pheads/detail-bodies/hover-motion)
  — see `SAVEPOINT_2026-07-22_SESSION2.md`. Royal is the **launch theme** (host picker gated to Royal).
- SEO JSON-LD enrichment done + live-verified (`08376f5`).
- Wizard→website Phases 1–4 done; booking wired end-to-end. See `WIZARD_TO_WEBSITE_PLAN.md`.
- Open verify-only items: Royal Journal article body (needs a published post), Experiences hero
  (needs a royal site with the page enabled), nearby-experiences E2E (needs a founder click).

**COMMIT + PUSH this savepoint before ending.**
