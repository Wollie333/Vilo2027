# 🧭 SAVEPOINT — 2026-07-22 (read this FIRST in a new session)

> **Branch:** `feature/website-cms-10min-wizard` · **HEAD:** `2ecfef2` · tree clean, **all pushed**.
> Do NOT merge to `main` yet — founder wants the feature fully working on the branch first.
> Then read `WIZARD_TO_WEBSITE_PLAN.md` + `CHANGELOG.md`. Supersedes `SAVEPOINT_2026-07-21.md`.

---

## ▶▶ WHERE WE ARE (resume here)

Iterating on the wizard → published tenant-site feature on the branch, driven by the
founder's live testing on the **branch preview** (they run the wizard, screenshot issues,
I fix + push). The Royal theme is the active test theme. **mana** is a **published Royal
site** — CURRENT website_id `00fd5e51-8883-4ed1-a88d-2cb70d314d42` (the founder deletes +
re-runs the wizard, so the id changes — look it up by subdomain `mana`, not by a hard-coded id).
host_id `7b4c377e-…`, business_id `3e471597-…`.

### 🔒 ROYAL IS THE SOLE LAUNCH THEME (founder directive, 2026-07-22)
Get ONE theme working 100% end-to-end (wizard → published booking-integrated site)
before touching the others. Hosts now see **only Royal** in every theme picker; the
other four (oceansview/safari/sabela/marmalade) stay fully built but HIDDEN via
`lib/frontendFlags.ts` → `LAUNCH_THEME_SLUGS = ["royal"]` (filtered in
`loadActiveThemes()`; render path untouched). **All new tenant-site work is Royal-only**
until the founder signs Royal off — then add slugs back to `LAUNCH_THEME_SLUGS` and sweep.
Committed `HEAD` (see below). Any "sweep the other themes" note elsewhere in this file is
DEFERRED behind this gate.

### ✅ DONE — the currency switcher (#11), Royal MVP. Founder chose "Royal first". Foundation
(enabled-scoped `CurrencyProvider` + `SiteCurrencyProvider` wrap on tenant browsing routes +
`CurrencySwitcher` in `OceansViewHeader`) + all Royal browsing price renders swapped to client
`<Money>` (home/rooms/roomdetail+OceansBookCard/specials/specialdetail). Verified live on mana
flipping ZAR→USD/GBP/EUR at every browsing surface; checkout intentionally stays ZAR (switcher
self-hides there — transactional). See CHANGELOG 2026-07-22. **To extend to the other themes when
they come back:** repeat the `money()`→`<Money>` swap in each theme's price components (they already
render inside the tenant provider). ⚠️ Cross-page cookie persistence is correct in code but was NOT
observable in the in-app test browser (it doesn't forward the JS-set cookie) — confirm on the real
branch preview.

### 🎯 NEXT UP — founder-driven. Options: (a) full wizard→publish→booking end-to-end on Royal
(the launch goal — needs founder login on the branch preview); (b) confirm currency cross-page
persistence on the real preview; (c) #6 logo in the wizard theme-preview (minor). Everything the
founder flagged before this (A logo, B centering, theme-gate to Royal) is resolved/done.

**Preview URL (behind Wielo login + Vercel SSO):**
`https://vilo2027-git-feature-website-cms-10m-6c3132-wollie333s-projects.vercel.app`
- Wizard: `…/en/dashboard/website/wizard` · Site (app-domain affordance): `…/en/site?site=mana`
- To run the wizard fresh: on `/dashboard/website`, use **"Delete this website & start over
  (testing)"** on Mana's card first (one-site-per-business; bounce is OFF pre-launch), then run it.

### ✅ RESOLVED since flagged (A logo, B centering) — kept for context

1. **(A) Logo — RESOLVED, no code bug.** The CURRENT mana site (`00fd5e51-…`, the old `823789d8`
   was deleted) has `brand.logo_path` correctly set (live + snapshot) to the business logo URL. The
   wizard prefilled + persisted it end-to-end; the header renders it. The pinwheel is simply Mana's
   stored `businesses.logo_path` — a **19KB placeholder** the host never replaced (`host.avatar_url`
   is a separate profile photo). **Fix = upload a real logo** (wizard Step 1 / business settings);
   it replaces the placeholder everywhere. Nothing to code.
2. **(B) Left-shifted stats/feature grids — DONE, all themes.** Commits `1aa4827` (Royal
   `.stats`+`.tiles`, verified symmetric) + `2e96026` (OceansView `.stats`/`.tiles`, Safari
   `.sf-stats`/`.sf-promise-row`, Sabela `.feature-grid`). Pattern: `repeat(auto-fit, minmax());
   justify-content: center` (+ `text-align: center` on stats). Marmalade already centres its postcards.

<details><summary>Original flagged text (superseded)</summary>

1. **(A) Logo pulls through WRONG.** Header renders the business logo from the `host-logos`
   bucket and it *loads* (naturalWidth 120) — but it's the colourful **Wielo default/placeholder**
   pinwheel, not Mana's real brand mark. So `businesses.logo_path` points at a generated default;
   the host's *real* logo was never captured. NEXT: confirm whether the founder has a real logo to
   upload / where host logos are captured (host Settings vs wizard Step 1), and make the site show
   the real one. (The path→URL *resolution* is already fixed — commit `b118cd8`; this is a
   which-image / data-capture issue, not a broken URL.)
2. **(B) LEFT-shifted grids → CENTRE them, on ALL themes.** A whole family of `repeat(4, 1fr)`
   grids read left-heavy. Confirmed cases in `royalHome.css`:
   - **`.tiles`** (highlights/features, line 577): 4-col grid but the "Everything taken care of"
     section has **3** cards → empty 4th column on the right → looks left-aligned.
   - **`.stats`** (line 412): 4-col grid; the stats row (e.g. "3 Rooms · 4.7 rating · 3 reviews ·
     4 sleeps") sits left because each cell's content is left-aligned (and short rows leave gaps).
   FIX pattern (apply to every theme's equivalents — grep `grid-template-columns: repeat(4` across
   `components/site/*/`): centre the row when items < columns (e.g.
   `grid-template-columns: repeat(auto-fit, minmax(200px, 240px)); justify-content: center;`) AND
   centre each item's content (`text-align: center` / center the stat number+label). Verify with
   3 AND 4 items. Same `.tiles`/`.stats`/features grids exist in oceansview/marmalade/sabela/safari
   `*Home.css` + the token skins — do a sweep, not just Royal.

</details>

---

## ✅ DONE THIS SESSION (15 commits, `9921209`→`2ecfef2`, all pushed + branch-verified)

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
- **`1aa4827` fix(royal) + `2e96026` fix(site): centre the stats + feature grids** (issue B). Were
  `repeat(4,1fr)` → 3 items left an empty column / stats left-hung. Now `repeat(auto-fit, minmax());
  justify-content: center` (+ `text-align:center` on stats). Royal (verified symmetric), OceansView
  `.stats`/`.tiles`, Safari `.sf-stats`/`.sf-promise-row`, Sabela `.feature-grid`. Marmalade N/A.
- **`ff7f4ed`/`2ecfef2` docs(savepoint)** — this file.

---

## ⏳ OPEN / NOT DONE (priority order for next session)

> (A) logo + (B) centering are DONE/resolved — see "RESOLVED since flagged" above. Remaining:

1. **#11 Currency switcher on tenant sites** — founder approved "build it now"; it's LARGER than a
   wire-up (scoped this session). The currency *system* exists but is **flag-locked** and tenant
   prices don't use it. Exact plan:
   - **(a) Lift the ZAR lock for tenant sites.** `lib/frontendFlags.ts` `CURRENCY_SWITCHER_ENABLED=false`
     hard-gates EVERYTHING (CurrencyProvider ignores the cookie + locks to ZAR; `setCurrency` no-ops;
     `CurrencySwitcher` returns null). Flipping it globally also enables the main-app UtilityBar — a
     product call. Prefer a **tenant-scoped enable** (e.g. a `enabled` prop threaded through
     CurrencyProvider/Money/CurrencySwitcher, or a second flag) so tenant sites unlock without touching
     the app. Confirm fx rates are production-ready first (`lib/fx.ts` `getDisplayRates()`).
   - **(b) Wrap the tenant site in `CurrencyProvider`** (in `components/site/SitePageView.tsx` or
     SiteChrome), seeded server-side with `await getDisplayRates()` + the cookie's initial currency.
   - **(c) Add `CurrencySwitcher` to each theme's header** (SiteChrome / the bespoke chrome).
   - **(d) THE BIG PART — convert ~30 bespoke price renders** from the local server `money()` helper to
     the client `<Money amount currency>` (components/currency/Money.tsx). Files: every
     `components/site/{royal,oceansview,safari,sabela,marmalade}/*Home|Rooms|RoomDetail|Specials|
     SpecialDetail|Suite*.tsx` + `RoomBookingForm.tsx` + `sections/{RatesBlocks,RateTableSection,
     SearchResultsSection}.tsx` + `v2/NewLeaves.tsx` (grep `function money(`). Suggest a shared
     `<SitePrice amount currency>` wrapper (wraps `<Money>` with the site's price styling) so it's ONE
     swap-per-usage + consistent. Money already prefixes converted amounts with "≈" (browsing estimate;
     the guest is still charged in ZAR — keep that wording). Do Royal first as the reference, verify the
     switcher flips prices live, then sweep the other 4 themes.
   - Verify: switch currency in the header → room/special/booking prices re-render converted; ZAR stays
     exact; no layout breakage in the styled price spans.
2. **#6 Logo in the wizard THEME-PREVIEW** (minor) — `/theme-preview/[slug]` passes `brand={{name}}`
   only (sample brand), so the host's logo doesn't show in the theme step preview. Pass the logo through.
3. **Full wizard end-to-end + a real test booking** on the branch preview (founder-driven; needs their login).
4. **Merge to `main` eventually** — branch & main have DIVERGED (main +223 / branch +184 commits since
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
