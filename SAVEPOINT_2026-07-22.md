# 🧭 SAVEPOINT — 2026-07-22 (read this FIRST in a new session)

> **Branch:** `feature/website-cms-10min-wizard` · **HEAD:** `32562db` · tree clean, **all pushed**.
> Do NOT merge to `main` yet — founder wants the feature fully working on the branch first.
> Then read `WIZARD_TO_WEBSITE_PLAN.md` + `CHANGELOG.md`. Supersedes `SAVEPOINT_2026-07-21.md`.

---

## ▶▶ WHERE WE ARE (resume here)

Iterating on the wizard → published tenant-site feature on the branch, driven by the
founder's live testing on the **branch preview** (they run the wizard, screenshot issues,
I fix + push). The Royal theme is the active test theme. **mana** is a **published Royal
site** (host_id `7b4c377e-…`, business_id `3e471597-…`, website_id `823789d8-…`).

**Preview URL (behind Wielo login + Vercel SSO):**
`https://vilo2027-git-feature-website-cms-10m-6c3132-wollie333s-projects.vercel.app`
- Wizard: `…/en/dashboard/website/wizard` · Site (app-domain affordance): `…/en/site?site=mana`
- To run the wizard fresh: on `/dashboard/website`, use **"Delete this website & start over
  (testing)"** on Mana's card first (one-site-per-business; bounce is OFF pre-launch), then run it.

### ⚠️ TWO OPEN ISSUES the founder just flagged (fix on ALL themes + pages)

1. **(A) Logo pulls through WRONG.** Header renders the business logo from the `host-logos`
   bucket and it *loads* (naturalWidth 120) — but it's the colourful **Wielo default/placeholder**
   pinwheel, not Mana's real brand mark. So `businesses.logo_path` points at a generated default;
   the host's *real* logo was never captured. NEXT: confirm whether the founder has a real logo to
   upload / where host logos are captured (host Settings vs wizard Step 1), and make the site show
   the real one. (The path→URL *resolution* is already fixed — commit `b118cd8`; this is a
   which-image / data-capture issue, not a broken URL.)
2. **(B) Highlights/"tiles" cards render LEFT-shifted, want CENTER.** Root cause found:
   `.rhome .tiles { grid-template-columns: repeat(4, 1fr) }` (royalHome.css:577) is a **hardcoded
   4-column grid**, but the "Everything taken care of" section has **3** cards → they fill cols 1–3
   and leave an empty 4th column on the right, reading as left-aligned. FIX across every theme's
   equivalent grid (`.tiles` / highlights / features): make columns adapt to the item count or
   centre the row — e.g. `grid-template-columns: repeat(auto-fit, minmax(220px, 280px));
   justify-content: center;` (verify 3 AND 4 items look right). Same pattern likely in
   oceansview/marmalade/sabela/safari `*Home.css` + the token skins — grep `grid-template-columns: repeat(4`.

---

## ✅ DONE THIS SESSION (11 commits, `9921209`→`32562db`, all pushed + branch-verified)

- **`b118cd8` fix(wizard): logo → URL.** Wizard page passed the bare `host-logos` path;
  `websiteAssetUrl` treated it as a website-assets path → 404. Now resolved to its public URL.
  (Real logo lives in `host-logos`; verified loads. See open issue A for the *which-logo* problem.)
- **`31356a8` fix(safari): specials sticky Book card** clears the 84px fixed header (top 96→112px).
- **`aa86c7e` feat(wizard): hard-cap AI copy lengths.** `lib/website/aiContent.ts` `clampSlot` +
  `AI_SLOT_CHAR_LIMITS` (hero headline 64, sub 130, exp-intro 180, story/bio 460), enforced at
  `aiContentToProfile` + both regen actions; prompt/tool-schema budgets tightened. 12 unit tests.
- **`b783d1e` feat(royal): built the Royal wizard templates.** Royal was in the catalogue but had
  NO template pages → `/theme-preview/royal` 404'd + couldn't seed. Added a full `royal` object in
  `lib/website/themeSections.ts` (mirrors OceansView's composition — Royal = "OceansView layout
  re-skinned via `.wielo-royal`") + `ROYAL_PRESETS`(13)/`ROYAL_TEMPLATES`(5: home/about/rooms/
  journal/contact) + registered in PRESETS/TEMPLATES/ACTIVE_THEME_SLUGS/ROOM_DETAIL. Verified renders.
- **`096dbc5` fix(site): card & ghost-button borders were ink-black on EVERY theme.** Root cause:
  `--site-card-border` + `--site-btn-secondary-border` (in `lib/site/themes.ts`) were emitted as full
  `border` SHORTHANDS but the bespoke CSS consumes them as `border-color:` → invalid-at-computed-
  value-time → CSS resets to `currentColor` (ink). Now emitted as COLOURS; the 2 full-shorthand
  consumers (BookingConfirmationCard, RoomBookingForm) patched to `1px solid var(--token)`. Also
  centred the Royal `.sec-head.center h2::after` accent rule (was pinned left).
- **`8311519` fix(site): removed the rooms-page trust chip band** (Book direct / price you pay /
  Secure payment) on Royal, OceansView, Marmalade, Safari. Sabela had none.
- **`3e8b188` fix(royal): ghost buttons use the design's light `var(--site-line)` border** (gold on
  hover), not the espresso secondary token — matches the provided grand-hotel design. 5 royal CSS files.
- **`32562db` feat(site): copy-relevant default images for empty experience cards.** New
  `lib/site/defaultImages.ts` (`defaultCardImage`) — free Unsplash photos keyword-matched to each
  card's copy (safari/dining/nature/stars/pool/spa/wine/sunset/water…), rotating within a category by
  index. Host image ALWAYS wins. Wired into all 9 `experiences` mappings in `SitePageView.tsx`.

---

## ⏳ OPEN / NOT DONE (priority order for next session)

1. **(A) Logo — show the host's real logo** (see top). Investigate the logo-capture path.
2. **(B) Highlights "tiles" grid — centre the cards** on all themes (see top; root cause known).
3. **#11 Currency switcher on tenant sites** — founder: important, infra EXISTS. Reuse
   `components/currency/CurrencySwitcher.tsx` + `lib/currency.ts` + `lib/fx.ts` (already used by
   `app/_components/home/UtilityBar.tsx`). Wire into the tenant site chrome/header + convert displayed
   prices (rooms, specials, booking). NOT started.
4. **#6 Logo in the wizard THEME-PREVIEW** (minor) — `/theme-preview/[slug]` passes `brand={{name}}`
   only (sample brand), so the host's logo doesn't show in the theme step preview. Pass the logo through.
5. **Full wizard end-to-end + a real test booking** on the branch preview (founder-driven; needs their login).
6. **Merge to `main` eventually** — branch & main have DIVERGED (main +223 / branch +184 commits since
   base `c0eb519`; main +89 migrations, branch +7). Trial-merge showed only ~1 real code conflict
   (`themeSections.ts`) + 2 docs; real risk is the 96-migration ordering + build. Do it as an isolated
   git-worktree trial merge (build+verify) before touching main. `main` is VERY active (2FA, security,
   billing, email fixes landing constantly), so the merge grows daily.

---

## 🔴 The "subdomain crash" (digest `405703985`) — NOT a branch bug

`TypeError: Cannot read properties of undefined (reading 'heading')` on `/[locale]/site`, seen at
`mana.wielo.site`. That subdomain is served by the **production** deployment = **`main`**, which is
~40 site-render commits behind the branch. The **branch renders mana's exact published data at HTTP
200, every page** (verified repeatedly). It only crashes on production/`main`. It self-resolves when
the branch reaches production (the merge above). Nothing to fix on the branch.

---

## 🔑 ENVIRONMENT / TOOLING STATE

- **`apps/web/.env.local` exists** with REAL Supabase creds (URL + anon + service-role, project ref
  `zlcivjgvtyeaszikqleu`) — `pnpm dev` works, renders real site pages. `ANTHROPIC_API_KEY` is set in
  Vercel (AI works on the deploy). ⚠️ service-role key was shared in chat → founder rotates at launch.
- **Dev + QA loop:** `.claude/launch.json` (gitignored) defines the `web-dev` server → use the in-app
  Browser (`mcp__Claude_Browser`) `preview_start {name:"web-dev"}`, then `?site=mana`. The public
  (non-preview) render path = `?site=mana` WITHOUT `preview=1`. **`computer{action:screenshot}` keeps
  TIMING OUT** this session — rely on `javascript_tool` DOM/computed-style reads for verification.
- **Vercel MCP** (project `prj_ia39tAuJTTErlViwZXjgNHWKU7xZ`, team `team_HBP2Mcif9OcWL3w4hJXlAXDt`):
  `get_runtime_errors` / `get_runtime_logs` / `get_deployment` are the way to read production errors +
  confirm a branch build is READY. Branch alias auto-points to the newest branch build.
- **Gate before commit:** `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` + `npx eslint <files>`
  (local `pnpm build` may OOM). Commit hook runs prettier/lint-staged automatically.

## 🗺️ KEY FILES (this session)
- Design tokens: `lib/site/themes.ts` (card/button border tokens — the ink-border root cause).
- Theme templates (wizard preview + seeding): `lib/website/themeSections.ts` (added `royal`).
- Site render dispatch (bespoke per-theme components): `components/site/SitePageView.tsx`.
- Royal bespoke: `components/site/royal/*.tsx` + `royal*.css`; shared skin `themes/theme-skins.css`
  (`.wielo-royal` block ~line 1020/1261; `.tiles` grid + card/button token wiring in `royalHome.css`).
- Default images: `lib/site/defaultImages.ts`. AI caps: `lib/website/aiContent.ts` + `aiPrompts.ts`.
- Readiness gate: `lib/website/readiness.ts`. Wizard: `app/[locale]/dashboard/website/_wizard/`.

**Update + commit a new savepoint before ending any session.**
