# 🧭 SAVEPOINT — 2026-07-22 (SESSION 2, live-testing punch-list) — read FIRST

> **Branch:** `feature/website-cms-10min-wizard` · **HEAD:** `353d841` (pushed? NO — commit local, push before ending).
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
- **`353d841` fix(royal): dark image hero on Journal** so the header menu stays legible. Converted
  `.rj-phead` (white, centred) → `.phead` dark image hero (post cover → first cover → warm fallback +
  gradient overlay + white copy), matching the reference. Guards the `featured===null` case (mana has no
  posts) — I first shipped an unguarded `cover(featured)` that threw `coverUrl` null-deref; caught it LIVE
  and fixed before commit. **Verified live on mana:** nav renders white over the dark hero (screenshotted).

## 📋 PUNCH-LIST / TASK STATE (see also the harness task list #1–#5)
- [DONE] Journal hero legibility (`353d841`).
- [TODO] **Apply the SAME `.phead` dark-hero fix to: RoyalArticle (`.r-art-head`), RoyalSpecials (white
  head + separate `.rhero` band → single dark `.phead`), RoyalSpecialDetail (white breadcrumb open).**
  Pattern = copy `.rrooms .phead` CSS (royalRooms.css:266-299) + the `<section className="phead"><img/>…`
  markup (RoyalRooms.tsx:70-86). Source hero img from that page's own data (article cover / special image)
  with a fallback; **GUARD nulls** (this session's near-miss). Verify each live at
  `/en/site/blog/<slug>?site=mana`, `/en/site/specials?site=mana`, a special-detail URL.
- [TODO] **Room Detail** → make header solid (reference intent): set `pageHasHero=false` for the room route
  (check how SiteChrome / the room page passes `pageHasHero`).
- [TODO] **Experiences** hero → swap charcoal gradient panel for a real photo `.phead` (non-blocking).
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
