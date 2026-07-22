# 🧭 SAVEPOINT — 2026-07-22 (read this FIRST in a new session)

> **Branch:** `feature/website-cms-10min-wizard` · **HEAD:** `f84208f` · tree clean, **all pushed**.
> Do NOT merge to `main` yet — founder wants the feature 100% working on the branch first.
> This file supersedes all earlier SAVEPOINT_* files. Then skim `CHANGELOG.md` (top ~6 entries
> are this session) + `WIZARD_TO_WEBSITE_PLAN.md`.

---

## ▶▶ WHERE WE ARE (resume here)

Building the **launch-ready Royal micro-site + its setup wizard** on the branch, driven by the
founder's live testing on the **branch preview** (they run the flow, flag issues, I fix + push).

### 🔒 LAUNCH STRATEGY — ROYAL ONLY (founder directive)
Get **ONE theme 100% working end-to-end** (wizard → published booking-integrated site) before
touching the others. Hosts currently see **only Royal** in every theme picker; the other four
(oceansview/safari/sabela/marmalade) stay fully built but HIDDEN via
`lib/frontendFlags.ts` → `LAUNCH_THEME_SLUGS = ["royal"]` (filtered in `loadActiveThemes()`; render
path untouched). Re-enable a theme by adding its slug there. **All new work is Royal-only** until the
founder signs Royal off, then sweep the others.

**mana** is the live Royal test site — look it up by subdomain `mana` (founder deletes + re-runs the
wizard, so `website_id` changes). host_id `7b4c377e-…`, business_id `3e471597-…`.

### 🎯 NEXT UP — the ONE thing left to verify: a **real wizard → publish → booking run on Royal**.
Everything below is built + branch-verified EXCEPT the final publish mutation + a live booking, which
need the founder's login on the branch preview (the `/dev/wizard` harness can't run it — it uses a
fake `dev-harness` business the finalize action rejects). Founder to:
1. Run the wizard on the branch preview → build/publish → confirm the site goes live.
2. Do a real test booking (room → dates → checkout → a payment method) on mana.
3. Confirm the two harness-blocked items (below) on their real browser.

**Preview URL (behind Wielo login + Vercel SSO):**
`https://vilo2027-git-feature-website-cms-10m-6c3132-wollie333s-projects.vercel.app`
- Wizard: `…/en/dashboard/website/wizard` · Site: `…/en/site?site=mana`
- Run wizard fresh: on `/dashboard/website`, use **"Delete this website & start over (testing)"** on
  Mana's card first (one-site-per-business; bounce is OFF pre-launch), then run it.

---

## ✅ DONE THIS SESSION (6 commits, `2d0be09`→`f84208f`, all pushed + branch-verified)

1. **`2d0be09` — Theme gate to Royal only.** `LAUNCH_THEME_SLUGS` allowlist in
   `lib/frontendFlags.ts`, applied in `lib/site/themes.server.ts` (`loadActiveThemes` + preset
   fallback). Verified `/dev/wizard`: DB has 5 themes → picker gets exactly `(1): royal`.
2. **`ec5b5b7` — Currency switcher live on Royal tenant sites (browsing estimates).** Guests switch
   ZAR/USD/EUR/GBP; every browsing price re-renders converted with a "≈" marker. **Checkout stays
   ZAR (transactional) — the `/book` route is deliberately NOT wrapped, so its switcher self-hides.**
   Foundation: `CurrencyProvider` got an `enabled?` prop + `enabled` in context (tenant sites pass
   `true` without flipping the global flag); `CurrencySwitcher` reads `enabled` from context; `Money`
   `currency` widened to `string|null`; new server `SiteCurrencyProvider` fetches rates+cookie and
   wraps the tenant browsing routes (`site/page`, `site/[...slug]`, `rooms/[roomSlug]`,
   `specials/[specialSlug]`). Royal price renders swapped `money()`→`<Money>` in RoyalHome/Rooms/
   RoomDetail/Specials/SpecialDetail + shared `OceansBookCard`; switcher added to `OceansViewHeader`.
   Verified live on mana across all browsing surfaces (home R4 850→≈$294.63, specials R18 500→≈€985.50,
   etc.); checkout confirmed ZAR + switcher-less.
3. **`707dd9b`/`a119ac6`/`69139c0`/`f84208f` — Website wizard redesigned to the single-page
   "setup-flow" pattern** (from the founder's Claude-design handoff, applied to OUR real steps,
   keeping the live site preview). New shell + full design-atom migration. See "Wizard" section below.

---

## 🧩 THE WIZARD (new architecture — you'll likely iterate here next)

Route: `app/[locale]/dashboard/website/wizard/page.tsx` → `_wizard/WebsiteWizard.tsx`.
Dev harness (no auth): `/en/dev/wizard` (`app/[locale]/dev/wizard/`).

- **Single-page scroll**, not step-at-a-time. `WebsiteWizard.tsx` = orchestrator: `phase` =
  `edit|building|done`, per-section **completion rules**, publish **gating**, scroll-spy.
- **Chrome** in `_wizard/WizardChrome.tsx`: `SectionCard` (numbered 01–07 badge, Required/Optional
  pill, Done check, hint), sticky `ProgressRail` (scroll-spy status discs + amber required-dots +
  gradient bar + gated Build button), `CompletionRing`, `PublishBar`, `Confetti`. Styles in
  `_wizard/wizard.css` (scoped to `.wz-root`: focus-ring, `.wz-num`, active-card pulse, confetti).
- **Form atoms** in `_wizard/WizardFields.tsx`: `WField`, `WInput`, `WTextArea`, `WSelect`, `WToggle`
  (design-exact; focus ring comes from the `.wz-root` CSS). ALL step internals now use these.
- **7 sections** → `SectionCard`s embedding the existing steps in `embedded` mode (each step got an
  `embedded?` prop that hides its own title + Back/Next): 01 Basics, 02 Theme, 03 Colours, 04 Your
  story (AI), 05 Payments, 06 Pages, 07 Review & publish (summary + framed live preview w/ Desktop/
  Mobile toggle + publish bar → build → confetti + `StepDone` modal).
- **Completion rules** (`WebsiteWizard.tsx`): basics (name>2 + subdomain≥3) & theme are REQUIRED
  (gate the build); colours/payments/pages optional; story "done" once AI copy generated. Ring % =
  done/6 editable. Prefilled start ≈ 83% (story the only todo).
- **Verified `/dev/wizard`:** layout, ring reactivity (clear name → 67% + amber dot + gated button),
  scroll-spy, device toggle, all atoms (px-3.5/py-2.5 inputs, text-sm/medium labels, h-6/w-11 toggles).

---

## ⚠️ NOT VERIFIABLE IN THE HARNESS (founder to confirm on the real branch preview)

1. **Wizard build → publish + a real booking** — harness uses a fake business the finalize action
   rejects. The path reuses UNCHANGED finalize/`StepBuilding`/`StepDone` logic; just needs a real run.
2. **Currency cross-page persistence** — the display-currency cookie → server-seeded initial currency
   is correct in code (same cookie the app-root provider reads), but the in-app test browser doesn't
   forward the JS-set cookie to the server, so it reset to ZAR on navigation there. In-page switching
   works; persistence should work on a real browser.
3. **The wizard focus-ring** — the `.wz-root input:focus` glow is present + correct by rule inspection,
   but the in-app browser runs without system focus (`document.hasFocus()` false) so `:focus` never
   matches there. Renders on a real browser. (Pick-card glow uses static classes → already confirmed.)

---

## ⏳ OPEN / OPTIONAL (after the end-to-end run passes)

1. **Merge to `main` eventually** — branch & main have DIVERGED (main very active: 2FA, security,
   billing, email). Do it as an isolated git-worktree trial merge (build+verify) before touching main;
   main is ~40+ site-render commits behind, +90ish migrations vs branch's few. The "subdomain crash"
   (`TypeError …reading 'heading'` at `mana.wielo.site`) is a PRODUCTION/`main` bug that self-resolves
   when the branch reaches prod — NOT a branch bug (the branch renders mana at 200 every page).
2. **Currency for the OTHER themes** — when they come back, repeat the `money()`→`<Money>` swap in each
   theme's price components (they already render inside the tenant provider).
3. **#6 logo in the wizard theme-preview** (minor) — `/theme-preview/[slug]` gets `brand={{name}}` only.

---

## 🔑 ENVIRONMENT / TOOLING STATE
- **`apps/web/.env.local` exists** with REAL Supabase creds (project ref `zlcivjgvtyeaszikqleu`);
  `ANTHROPIC_API_KEY` set in Vercel (AI works on the deploy). ⚠️ service-role key was shared in chat →
  founder rotates at launch.
- **Dev + QA:** in-app Browser (`mcp__Claude_Browser`) `preview_start {name:"web-dev"}` (from
  gitignored `.claude/launch.json`). `/dev/wizard` is the auth-free wizard harness. `?site=mana` (no
  `preview=1`) is the public tenant render. **`computer{action:screenshot}` frequently TIMES OUT when
  a page has the live-preview iframes** — rely on `javascript_tool` DOM/computed-style reads. The
  in-app browser also has NO system focus (`:focus` won't match) and doesn't forward JS-set cookies.
- **Vercel MCP** (project `prj_ia39tAuJTTErlViwZXjgNHWKU7xZ`): `get_runtime_errors`/`get_runtime_logs`/
  `get_deployment` read prod errors + confirm a branch build is READY.
- **Gate before commit:** `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` + `npx eslint <files>`
  (local `pnpm build` may OOM). Commit hook runs prettier/lint-staged automatically. Founder workflow =
  commit + push each iteration so the branch preview updates for their testing.

## 🗺️ KEY FILES (this session)
- Theme gate: `lib/frontendFlags.ts` (`LAUNCH_THEME_SLUGS`), `lib/site/themes.server.ts`.
- Currency: `components/currency/{CurrencyProvider,CurrencySwitcher,Money}.tsx`,
  `components/site/SiteCurrencyProvider.tsx`, `lib/fx.ts` (`getDisplayRates`), Royal `components/site/
  royal/*.tsx` + `components/site/oceansview/{OceansViewHeader,OceansBookCard}.tsx`.
- Wizard: `app/[locale]/dashboard/website/_wizard/` — `WebsiteWizard.tsx`, `WizardChrome.tsx`,
  `WizardFields.tsx`, `wizard.css`, `WizardLivePreview.tsx`, `steps/*.tsx` (each has `embedded`).
- Design source (reference, gitignored/local): the Claude-design handoff is in Downloads
  `Wielo (11).zip` → `design_handoff_setup_flow/`.

**Update + commit a new savepoint before ending any session.**
