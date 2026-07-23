# 🧭 SAVEPOINT — 2026-07-22 (SESSION 2, live-testing punch-list) — read FIRST

> ## ▶ 2026-07-23 UPDATE — Royal conform verification pass (HEAD `63fc8a5`)
> Prod confirmed HEALTHY: `mana.wielo.co.za` renders 200 (h1 "Arrive somewhere grand"), **no crash /
> no digest 405703985** — the `b2ab4d7` FONT_STACKS hotfix is live in `origin/main`. Feature branch
> is fully pushed; tree clean.
>
> Founder chose to **finish the Royal conform** with rule: *keep our sections, fix within-section
> mismatches only* (heritage monogram band STAYS; don't add the reference press strip). Did a
> section-by-section reference-vs-live diff of every mana-enabled page (rig:
> `docs/themes/royalhotel` → `public/_royalref`, force-reveal, compare vs `?site=mana`; **rig deleted
> before commit**). Findings:
> - **`63fc8a5` Home sand-band rhythm FIXED** — the alternating tinted (`sand`) backgrounds were
>   hardcoded assuming the CONDITIONAL Experiences section always renders. On sites without experiences
>   (mana) parity shifted → two plain bands adjacent + gallery untinted vs the reference. Added a
>   running `band()` counter in `RoyalHome.tsx` that only advances for sections that actually render →
>   perfect plain/sand alternation in BOTH cases; "A look inside" gallery now `sand` matching the
>   reference. **Verified live on mana** (resolved bg colours: plain→sand→plain→sand→plain→sand→navy→plain,
>   1 h1).
> - **Rooms / About / Specials / Journal / Room-detail / Contact / Special-detail — all CONFORM** (no
>   change): shared-section backgrounds + structure match the reference; headers legible (index/hero
>   pages `nav over` with WHITE nav over dark heroes; detail pages `nav solid` dark nav); exactly 1 h1
>   each. Rooms' `section-sm sand` intro band stays deliberately omitted (founder). About's one extra
>   reference `section sand` before CTA stays omitted per the "keep our sections" rule.
> - **Experiences photo hero — NOW LIVE-VERIFIED** (the outstanding item). Reached via theme-preview
>   `…/site/experiences?site=mana&preview=1&theme=royal` (mana has no Experiences page row so the plain
>   URL 404s). Renders the conformed dark `.phead` **photo** hero (`min-height 440px`, `object-fit:cover`,
>   real image), h1 "Experiences" WHITE, header `nav over` white nav — legible. `d3c00a7` confirmed.
> - Journal index currently shows the honest empty-state ("Your journal is almost here") — mana has no
>   published posts right now (data state, not a regression); the `.phead` warm-fallback photo hero +
>   white nav still render correctly.
> - **Screenshots still flaky** (30s timeouts) — DOM/computed-style reads were the reliable proof, as noted.
>
> **THEN two theme-wide typographic conform fixes** (measured vs the reference `theme.css`, HEAD now `9a35e91`):
> - **`abb2580` heading display scale** — reference sets headings to weight **800** + tracking **-0.035em**
>   (theme.css §FONTS default), but buildSiteVars emits TYPE_DEFAULTS (600 / -0.01em) INLINE on the
>   `.wielo-royal` root → every Royal heading rendered light. Declared the reference vars on each royal
>   PAGE scope (`.wielo-royal .rhome, .rrooms, …` — descendant custom-prop wins over the inline root without
>   `!important`, same trick OceansView uses). Verified live: hero/section/welcome headings = 800 / -0.035em
>   exactly, on home AND rooms.
> - **`9a35e91` 6px button corners** — reference `.btn` = 6px (grand-hotel refinement), NOT pills. Royal
>   buttons were full pills (0.5rem token inline + 5 files hardcoding `border-radius:999px` on base `.btn`).
>   Set `--site-btn-*-radius: 6px` on the royal scopes + repointed the 5 hardcoded rules to the token.
>   Chips/tags/rating-pills/social icons keep their own 999px. Verified live on home/contact/specials: every
>   `.btn` = 6px, round chips unchanged, no layout regression (11 secs, 1 h1, no overflow, no stuck reveals).
> - Both are `.wielo-royal`-scoped → other themes untouched. **Gotcha seen:** editing a globally-imported CSS
>   (theme-skins.css) sometimes triggers a transient dev-server `Cannot read properties of null (reading
>   'useEffect')` in SiteAnalytics — a stale React-module-cache glitch, NOT the CSS; a `preview_stop`+`start`
>   clears it.
>
> Remaining Royal conform is finer per-section spacing nits (e.g. hero maxWidth 15ch already matches — the
> px diff was a sandbox `ch` font-metric artifact). Continue next session with the same rig
> (`cp -r docs/themes/royalhotel apps/web/public/_royalref && cp .../theme.css .../pages/theme.css`; DELETE
> before commit — removed at session end). Compare computed font-weight/size/spacing/radius, not screenshots
> (still flaky, 30s timeouts).
>
> **Branch:** `feature/website-cms-10min-wizard` (Journal `353d841` + Specials `7994015` committed) ·
> **prod hotfix on `main`:** `b2ab4d7` (FONT_STACKS guard, deploying). Push the feature branch before ending.
> Supersedes the "NEXT UP" in `SAVEPOINT_2026-07-22.md` (that session's work is still valid; this is the
> founder's live-testing punch-list on the Royal site). Do NOT merge to `main` yet.

## ▶▶ CONTEXT
Founder ran the wizard + browsed the Royal site live and fired a punch-list. Overarching directive:
**make the Royal theme conform (pixel-perfect) to its reference design** in `docs/themes/royalhotel/`
(header.html, footer.html, theme.css [2334 lines], pages/*.html). Also fix a set of specific bugs.

## 🔬 GROUND-TRUTH FINDINGS THIS SESSION (verified, not assumed)

1. **PRODUCTION CRASH `mana.wielo.co.za` (founder's "Reference: 405703985") — it is a MAIN-BRANCH bug,
   NOT fixable from this feature branch.**
   - Verified via Vercel runtime errors: `TypeError: Cannot read properties of undefined (reading 'heading')`
     on route `/[locale]/site`, **digest `405703985`** (matches the founder's reference exactly), 8 hits
     2026-07-20→22.
   - The crashing deployment `dpl_7depmiCsZ5RW9nsHC5f9Z254rnw5` is `githubCommitRef: main`,
     `target: production`, aliased to `*.wielo.co.za`. So prod = main = crash.
   - This branch renders mana's home at **200** locally (verified) and guards every `.heading` read in the
     site path → **the branch already fixes it**. **DECISION NEEDED FROM FOUNDER** (see bottom): surgical
     hotfix on main vs branch→main merge vs defer. Do NOT switch to main or merge without explicit ok.

2. **LOGO — publishes + renders correctly; NOT a bug.** Verified on the live local mana Royal render: the
   header `.brand-mark` holds a real `<img>` (the teal Mana logo), loads 200. `brand.logo_path` +
   `published_snapshot.brand.logo_path` both hold the host-logos URL; raw + transformed URLs both 200.
   The founder's "placeholder circle" is the **wizard live-preview iframe** (`/theme-preview/royal`), which
   renders the Royal template with **no site header/logo at all**. Real fix = wizard preview fidelity
   (make it show the header+logo), NOT the publish pipeline. LOW priority.

3. **NEARBY PLACES "No taggable places found" = swallowed Overpass 504, NOT genuinely-empty.** The property
   (Mana Bush Lodge, Hazyview) HAS coords (lat -25.0361, lng 31.1265) + a full address. The live Overpass
   query for those coords returns **HTTP 504** (main endpoint overloaded). `fetchNearbyPlaces` returns `[]`
   on ANY non-OK/error → the action reports `none_found`, indistinguishable from "no places". FIX (branch):
   in `lib/site/nearbyFetch.ts` — (a) distinguish transient failure from empty (throw/sentinel so the
   action can say "couldn't reach the places service, try again" vs none_found), (b) add Overpass mirror
   fallback + light retry (main `overpass-api.de`, then `overpass.kumi.systems`, `overpass.private.coffee`),
   (c) consider trimming query cost. `refreshNearbyExperiencesAction` in `dashboard/website/actions.ts`
   + `NearbyExperiencesCard` need the new "transient" outcome surfaced.

4. **HERO / MENU LEGIBILITY root cause (VERIFIED via gap-analysis agent + live):** `SiteChrome.tsx:1378`
   `transparent={transparentOver || (pageHasHero && !topBar?.enabled)}` gives EVERY `pageHasHero` page a
   transparent **light-text** header — legible only if the page opens with a **dark** hero. Several Royal
   subpages were built with **white** heads → the white nav vanishes. OK already (dark image `.phead`):
   Home, Rooms, Gallery, About, Contact. Broken (white head): **Journal ✅FIXED**, **Journal post/Article**,
   **Specials**, **Special Detail**. Room Detail opens white too but the reference `Room.html` uses a
   **solid** header → fix = `pageHasHero=false` for that route (NOT an image). Experiences uses a charcoal
   gradient panel (legible, but reference wants a photo).
   - Reference token wiring note: `docs/themes/royalhotel/theme.css` is **NOT loaded**; Royal parity comes
     from `SITE_PRESETS.royal.palette` (lib/site/themes.ts) + `.wielo-royal` skin (theme-skins.css) +
     per-page `royal*.css`. Royal reuses `OceansViewHeader/Footer` (SiteChrome THEME_CHROME ~line 88).

## ✅ DONE THIS SESSION
- **PROD CRASH FIXED + SHIPPED to main (`b2ab4d7`).** `themes.ts` did `FONT_STACKS[headingFont].heading`
  with `headingFont="archivo"` (Royal's font; mana's `theme.base.font`), a key main's FONT_STACKS lacks
  (branch-only) → `undefined.heading` → digest 405703985 on every royal site. Guarded the lookup → falls
  back to `grotesk`. Reproduced the exact throw + verified mana renders 200 on fixed main. Isolated
  one-line hotfix straight to main (founder-authorized), via a throwaway worktree (torn down). Prod deploy
  `dpl_5LBUfw4nKhixAqYY33iT3ei5HvAg` was BUILDING at hand-off — confirm READY, then check mana.wielo.co.za.
- **`353d841` Journal hero** (blog INDEX): `.rj-phead` white + `nav over` → invisible white menu. Now a
  `.phead` dark image hero (post cover → first cover → warm fallback), guards `featured===null` (a
  null-deref I caught LIVE before commit). Verified live + screenshotted.
- **`7994015` Specials hero** (offers INDEX): merged white `.rhead` + separate `.rhero` band into one dark
  `.phead` hero (matches reference). Verified live.
- **`59a7809` Home hero left-aligned** to match the reference (dropped the `hero center` modifier). Rating
  pill top-left, headline wraps 2 lines on the left, left CTAs. Verified live vs the reference render.

## 🎨 PIXEL-PERFECT CONFORM TO THE ROYAL REFERENCE (founder's ACTIVE focus)
Founder: "make the website look like the actual theme design I provided… still not pixel perfect." The
reference is `docs/themes/royalhotel/` (header.html, footer.html, theme.css, pages/*.html). The app does
NOT load theme.css — Royal parity is carried by the `royal` preset palette + `.wielo-royal` skin +
per-page `royal*.css`, so divergences are per-section CSS/markup differences that must be conformed one by
one against the reference pages.

**Comparison workflow (reproduce it):**
1. Serve the reference in the dev server: `cp -r docs/themes/royalhotel apps/web/public/_royalref &&
   cp apps/web/public/_royalref/theme.css apps/web/public/_royalref/pages/theme.css` → open
   `http://localhost:3000/_royalref/pages/Home.html` (etc.). **DELETE `apps/web/public/_royalref` before
   any commit** (temp; must never ship).
2. The reference pages use scroll-reveal JS (royal.js, NOT copied) so lower sections start hidden —
   force them visible: inject `.reveal,[data-reveal]{opacity:1!important;transform:none!important}` via
   `javascript_tool`, then screenshot.
3. Compare against the live render `http://localhost:3000/en/site/<page>?site=mana`. Google Fonts fail in
   the sandbox on BOTH, so ignore font rendering; compare layout/structure/spacing/colour/alignment.

**SEO RULE (founder, applies to EVERY page): exactly ONE `<h1>` per page** — the hero/page title. Every
other section heading is `<h2>`/`<h3>`. Verified home = 1 h1. Check each page as you conform it.

**HOME page — DONE + verified (structure now matches the reference):**
- ✅ **Hero** left-aligned (`59a7809`).
- ✅ **Welcome** rebuilt to the reference two-column `.split.w-left` (`7615d71`): eyebrow + DISTINCT heading
  (host tagline when distinct, else theme default — never the hero h1) + story paras + Our story/View rooms
  on the left; framed 2nd image + "Direct · best rate" float badge on the right. Ported
  `.split/.w-left/.frame-wrap/.float-badge` into royalHome.css.
- **Section order now matches the reference** (hero → availbar → promise → welcome → stats → rooms →
  experiences → value-tiles → gallery → reviews → CTA). Remaining home nits (LOW): gallery "A look inside"
  is `section` vs reference `section sand` (tinted bg); optional "AS FEATURED IN" press strip above welcome
  (reference has it; ours doesn't — decide add-static vs drop). These are minor; the big divergences are done.

**PAGES CONFORMED this session (verified live on mana):**
- ✅ **Home** — hero left-aligned (`59a7809`), welcome two-column (`7615d71`).
- ✅ **Rooms** — dropped the champagne rule under room names (`c933436`); meaningful per-amenity icons
  (`4342fdd`, new `royalAmenityIcon.tsx` keyword→icon matcher, check fallback). NOTE: the founder
  DELIBERATELY omitted the `section-sm sand` intro band the reference has after the phead — leave it out.
- ✅ **Room detail** — amenity icons via the same helper (`eeef3d3`).
- ✅ **About** — story rebuilt as the reference two-column `.split.w-left` (`26c2853`).
- ✅ **Journal + Specials** index heroes (`353d841`, `7994015`).
- **Font is correct** — Royal renders Archivo (heading) + Manrope (body), Google Fonts `<link>` emitted;
  only the sandbox's blocked font network makes local screenshots fall back. Don't "fix" the font.

- ✅ **Contact** — already matches (photo phead, two-column details+form, FAQ, one h1). No change.
- ✅ **Experiences** — phead charcoal panel → dark photo hero (`d3c00a7`). ⚠️ NOT verified live: mana has no
  Experiences page enabled (404s), so this couldn't be rendered against a real site. Verify when a royal
  site enables the page.
- ✅ **Gallery** — already conformed (photo phead, grid, matching "It's better in person" CTA). Also not on
  mana. Only minor ref diff: an optional `section-sm` filter band between phead and grid.

**All mana-enabled pages are conformed + verified.** Reference-comparison rig: re-run
`cp -r docs/themes/royalhotel apps/web/public/_royalref && cp .../theme.css .../pages/theme.css`
(⚠️ DELETE `apps/web/public/_royalref` before any merge — it was removed at session end), force-reveal,
compare vs `?site=mana`. `royalAmenityIcon.tsx` `amenityIcon(fact)` is reusable theme-wide.

**PUNCH-LIST — DONE this session:**
- ✅ **One-step-at-a-time wizard** (`9ab49d1`): refactored WebsiteWizard to the founder's step-at-a-time
  design (top numbered stepper + Step N/M + Save & exit + progress bar; per-step pill/title/card;
  Back / Save & continue; final = review + preview + Build). New `WizardTopbar.tsx`. Design source:
  Downloads `Wielo (11).zip` → top-level `setup/` (chrome.jsx/app.jsx). Verified live on /dev/wizard,
  tokens pixel-match (Plus Jakarta Sans 800/28px, #10B981 button, #D1FAE5/#064E3B pill).
- ✅ **Nearby Overpass robustness** (`491027f`): `runOverpass()` tries mirrors + throws NearbyServiceError
  on total failure; action → distinct `service_unavailable`; card shows "service busy, try again".
- ✅ **Currency switcher on checkout** (`a016fc5`): wrapped /book in SiteCurrencyProvider (switcher shows);
  Total + all prices stay ZAR (non-converting money(), never <Money>); one muted "≈ estimate; charged in
  ZAR" line under the Total for non-ZAR display. Verified switcher present on mana checkout.

- ✅ **Header menu dropdowns** (`d8c2621`): founder chose to build them (diverges from the reference
  Explore-group header — their call). The expandAutoRooms/expandAutoSpecials machinery already existed but
  ran only on `navigation.menu` (empty on wizard sites) and only auto-flagged Specials. Fix in
  loadSiteContext: seed the menu from the page-derived nav when there's no custom menu + auto-flag Rooms
  too. Verified live on mana: Rooms → each room, Specials → each special.

**ALL punch-list items are now DONE.** Remaining is optional/verify-only: Experiences live-verify (needs a
royal site with the page enabled); Gallery already conforms; the reference `_royalref` was removed.
- **Stats band** (90 / 2 / 24 / 4.9 in the reference; 3 / 4.7 / 3 / 4 in ours) — layout matches; ours is
  live data, fine.
- Continue DOWN the home page + then each other page (Rooms/RoomDetail/About/Experiences/Gallery/Contact/
  Journal/Specials) section-by-section against the reference. This is ITERATIVE and spans sessions.

## 📋 PUNCH-LIST / TASK STATE (see also the harness task list #1–#5)
- [DONE] **Hero/menu legibility (task #5) RESOLVED.** Only the two INDEX pages were actually broken
  (`pageHasHero=true` + white head): Journal (`353d841`) + Specials (`7994015`), both fixed + verified.
  VERIFIED via code that Article (blog post, `blog/[postSlug]/page.tsx` sets `pageHasHero=false` for
  royal), Special-Detail (SiteSpecialView `pageHasHero={false}`) and Room-Detail (SiteRoomView
  `pageHasHero={false}`) ALREADY use a SOLID header → legible → NO fix needed (the gap-analysis
  over-flagged them). Home/Rooms/Gallery/About/Contact already have dark heroes.
- [TODO] **Experiences** hero → charcoal gradient panel is legible but reference wants a real photo
  `.phead` (optional polish). Same pattern as Journal/Specials if desired.
- [TODO] **Nearby robustness** (finding #3) — `lib/site/nearbyFetch.ts` + action + card.
- [TODO] **Currency switcher on checkout** (founder: "on all pages incl. checkout"). `/book` uses a
  different chrome (SiteChrome, not the browsing header) and is deliberately NOT wrapped in
  `SiteCurrencyProvider`. Add the provider + switcher to the checkout header; **keep the pay-total + button
  clearly ZAR** (charge stays ZAR; converted amounts show the ≈ marker). Persist the browsing cookie.
  Files: `app/[locale]/site/book/page.tsx`, `SiteCheckoutForm.tsx`, `components/site/SiteChrome.tsx` header.
- [TODO] **Header menu dropdowns: rooms→each room, specials→each special** (founder). NOTE: DIVERGES from
  the reference (reference groups "Explore ▾" → Experiences/Gallery/Offers, Rooms is a flat link). Confirm
  with founder. Nav is data-driven from the site's `navigation`/`menu`; OceansViewHeader already renders
  `item.children` as `.nav-sub`. Would need to build per-room / per-special children in the nav builder
  (`loadSitePage.ts` nav assembly / `normaliseNavigation`).
- [TODO] **Wizard: one step at a time** (founder). Currently single-page scroll of 7 SectionCards
  (`_wizard/WebsiteWizard.tsx`). Step components already support standalone mode (non-`embedded` → own
  Back/Next). Convert the shell to stepped nav, KEEP the clean design (SectionCard/atoms/ring/rail).
- [INFO] **AI "isn't switched on yet"** on step 4 = `ANTHROPIC_API_KEY` not present on the server serving
  the wizard (`aiConfigured()` = `Boolean(process.env.ANTHROPIC_API_KEY)`). Non-blocking (starter copy is
  used). If the founder sees it on the branch DEPLOY, the Vercel env var isn't reaching that deployment
  (verify it's set for Preview + redeploy). If local, expected. NOT a code bug.

## 🔑 VERIFICATION METHOD (this session — works well)
- `apps/web/.env.local` has REAL Supabase creds (service-role key present). Local `pnpm dev` renders the
  REAL published site against the REAL DB. In-app Browser: `preview_start {name:"web-dev"}` (port 3000),
  then `/en/site?site=mana` (public/published), `/en/site/blog?site=mana`, `/en/site/rooms?site=mana`, etc.
  `javascript_tool` DOM/computed-style reads are reliable; screenshots work here (got one of the Journal).
- Quick DB reads: tiny `.mjs` using `@supabase/supabase-js` + `.env.local`, run from `apps/web/` (needs its
  node_modules), delete after. (Used for the logo + property-geocode checks.)
- Prod errors: Vercel MCP `get_runtime_errors` / `get_deployment` (project `prj_ia39tAuJTTErlViwZXjgNHWKU7xZ`,
  team `team_HBP2Mcif9OcWL3w4hJXlAXDt`).
- Gate before commit: the pre-commit hook runs prettier/lint-staged (clean). Local `pnpm build` may OOM.

## ❓ THE ONE BLOCKING DECISION (prod crash)
`mana.wielo.co.za` crash (ref 405703985) is a MAIN/production bug; this branch fixes it but isn't in prod.
Options: (A) surgical hotfix on main — find the exact unguarded `.heading` read on main + guard it (needs
me to check out/inspect main; low risk); (B) fast-track branch→main merge (big/risky — main diverged, many
migrations; ships everything); (C) defer (prod stays crashed; keep testing on the branch preview). Awaiting
founder's call. Recommend (A).

**Update + commit this savepoint before ending. Push the branch.**
