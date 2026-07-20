# 🎨 Theme Differentiation — Phased Plan (fresh-session resume)

> **Created 2026-07-19.** Founder wants each of the 5 website themes to be
> genuinely UNIQUE — not "the same layout with a different palette." Start a fresh
> session and work this in phases. Read this end-to-end first, then
> `WEBSITE_CMS_SAVEPOINT_Resume_Here.md` for the surrounding CMS context.

---

## 🎯 THE GOAL (founder's words, 2026-07-19)

> "I do not want all the themes to look the same just with different palettes… I
> need each one to be **unique, modern, professional, mobile responsive** and have
> their **own set of javascript actions and animations and effects**… keep these
> js effects etc. to a **min so it looks professional**… it should **always enhance
> the visitor's experience**."

So every theme must earn its own identity on THREE axes:
1. **Layout / structure** — distinct composition, not the same sections recoloured.
2. **Motion / interaction** — its own small, tasteful JS animation + micro-interaction
   set (scroll reveals, hover, parallax, counters, etc.), reduced-motion-aware,
   never gratuitous — motion must serve the content, load fast, feel premium.
3. **Visual language** — palette + type + shape (already in place per theme).

Hard constraints: **mobile-first responsive**, **minimal JS** (no heavy libs; small,
dependency-free, `prefers-reduced-motion` respected), **fast** (no LCP/CLS regressions),
**professional** (subtle > flashy).

---

## 🧭 CURRENT STATE — the problem to solve

Five themes exist. **Two are already bespoke + distinct; three share ONE layout.**

| Theme | preset | Components | Layout status |
|---|---|---|---|
| **OceansView** | `oceansview` | bespoke `.ov*` (`components/site/oceansview/`) | the reference layout |
| **Marmalade** | `marmalade` | bespoke `.mm*` (`components/site/marmalade/`) | ✅ already distinct (postcards, tilts/tape, serif) |
| **Sabela** | `hotel` | bespoke `.sb*` (`components/site/sabela/`) | ✅ already distinct (dark editorial lodge) |
| **Safari** | `safari` | ✅ bespoke `.sf*` (`components/site/safari/`) for **ALL public pages** (Home/Rooms/Room-detail + About/Experiences/Contact/Gallery/Specials+detail/Journal+Article, `179c2a7`) | ✅ FULLY forked site-wide (editorial daylight savanna + Fraunces) — no longer reuses OceansView anywhere |
| **Royal Hotel** | `royal` | ✅ bespoke `.r*` (`components/site/royal/`) for **ALL public pages** (Home/Rooms/Room-detail + About/Experiences/Contact/Gallery/Specials+detail/Journal+Article, `20b0acc`) | ✅ FULLY forked site-wide (grand hotel + Archivo + champagne) — no longer reuses OceansView anywhere |

> **UPDATE (pt21 Royal, pt22 Safari):** Safari + Royal now have their OWN bespoke
> components for the three highest-traffic pages (Home / Rooms / Room-detail), routed via
> `preset===` branches ABOVE the shared branches. They still fall through to the shared
> OceansView layout for the LOWER-traffic pages (About/Experiences/Specials/Gallery/
> Contact/Blog) via `usesOceansViewLayout`. So the "three re-skins of one layout" problem
> below is SOLVED for the pages that matter; the paragraph is kept for history.

The (still-used, for the unforked pages) reuse wiring lives in
**`apps/web/lib/site/themeFamily.ts`** → `usesOceansViewLayout(preset)` =
`oceansview | safari | royal`. Route guards call it, and `SiteChrome.THEME_CHROME` maps
all three to the OceansView Header/Footer. Each gets its palette/font/radius from its
preset (`lib/site/themes.ts`) + derived colour tokens from its `.wielo-<slug>` block
(`components/site/themes/theme-skins.css`).

~~**So: OceansView, Safari and Royal are visually three re-skins of one layout.**~~
_(SOLVED for Home/Rooms/Room-detail — see the pt21/pt22 update above.)_

Founder also said: **Safari + Sabela/hotel "feel like the same theme"** (both warm-earth
lodge + serif) — **Phase C** addresses this (now much easier — Safari has its own light
editorial layout while Sabela stays dark filmic).

---

## 🔑 KEY FINDINGS (so the next session doesn't re-discover them)

### 1. The reference designs SHIP the intended JS — port it, don't invent
Each `docs/themes/<theme>/` package includes JS files (e.g. `royalhotel/royal.js`,
`royal-tweaks.js`; check the others). `royal.js` (read it — it's the OceansView JS)
implements exactly the effect set the design wants:
- **Nav solidify on scroll** — `.nav.over/.float → .solid` past a threshold. (Already
  done in-app by `components/site/StickyHeader.tsx` for the token chrome; the bespoke
  `.ovchrome` header has its own scroll handling.)
- **Mobile drawer** — `.mnav.open` + body-scroll-lock. (In-app; note the OceansView
  drawer bug was fixed this session — `mnav open`, not `mnavopen`.)
- **Scroll-reveal** — elements with class `.reveal` get `.in` when they enter the
  viewport (rect-based, with a 2.3s safety fallback that force-reveals). **This is the
  core animation primitive and is NOT yet implemented in-app** — the bespoke components
  don't emit `.reveal`/`.in` or observe them.
- **Hero parallax** — `[data-parallax]` translate on scroll, gated on
  `prefers-reduced-motion: no-preference`.
- **Lightbox** — `[data-lb]`/`[data-lightbox]` (galleries; in-app the bespoke galleries
  have their own React lightbox).
- Booking calculator / storage / form-navigate — mostly superseded by the real in-app
  checkout; ignore for differentiation.

### 2. How client JS runs on the public site today
The public site is SSR (Next App Router, `force-dynamic`). Existing client components:
`SitePreviewLinks.tsx` (preview nav interception, mounted via `SitePreviewBar` inside
`SiteChrome`), `StickyHeader.tsx`, the gallery lightboxes, `SiteMarketing`/analytics.
There is **no shared scroll-reveal/animation runtime yet.** Global reduced-motion is
already enforced in `apps/web/app/globals.css` (`@media (prefers-reduced-motion: reduce)`
zeroes all animations/transitions) — so any new motion is automatically safe there.

### 3. Refinement already done this session (don't redo)
Site-wide focus rings, 44px tap targets, legible subtitles, 70 images lazy-loaded, 90
images routed through `siteImageUrl` (WebP @ q82, hero widths 2560), contact-form label
a11y. All 5 themes are mobile-responsive + fast. The DIFFERENTIATION is what's left.

---

## 🏗️ THE PHASED PLAN

Do these as separate sessions/commits; verify each live on mana before moving on.

> **PROGRESS (2026-07-19, commit `392e6d3`):** Phase A steps 1–3 DONE + live-verified
> for the three shared-layout themes.
> - ✅ Built `components/site/SiteReveal.tsx` (client runtime: IntersectionObserver →
>   `.in` on `[data-reveal]`, rAF `[data-parallax]`) + `site-reveal.css` (the base
>   primitive, driven by `--reveal-from/-blur/-dur/-ease`). Gated behind a
>   `wielo-reveal-ready` class the runtime adds ONLY when motion is allowed AND not in
>   the builder → reduced-motion/no-JS/SSR/canvas never hide anything (zero CLS).
> - ✅ Mounted once in `SiteChrome` (live + preview; skipped while inline-editing chrome).
> - ✅ Emitted `[data-reveal]` (+ staggered `--reveal-delay`) from the **shared
>   OceansView Home + Rooms** (the layout Safari + Royal reuse).
> - ✅ Per-theme signatures in `theme-skins.css`: OceansView gentle rise; Safari slow
>   warm blur-in + `wielo-kenburns` hero drift; Royal crisp restraint + champagne rule
>   under headings. Marmalade (rotate-settle) + Sabela=`.wielo-hotel` (filmic fade)
>   signature VARS are set but those components don't emit `[data-reveal]` yet.
> - ✅ Live-verified on mana via the authenticated browser (see CHANGELOG 2026-07-19).
>
> **UPDATE (commit `5405338`):** Marmalade + Sabela home pages now emit `[data-reveal]`
> and are live-verified — so ALL FIVE themes have distinct motion. The GOTCHA below was
> RESOLVED by switching the primitive to animate the independent `translate` property
> (not `transform`): `translate` composes with a theme's own `transform` (tilt / hover)
> instead of overriding it. Signature vars are now `--reveal-y` (a distance). Marmalade
> reveals still attach to untransformed wrappers (cleanest group settle); its signature
> dropped the rotate (overflow-safe) for a springy overshoot ease.
>
> **UPDATE (commit `7492d25`):** Phase A motion coverage is now COMPLETE — every
> public subpage of all three themes emits `[data-reveal]` (OceansView About/
> Experiences/Specials/SpecialDetail/Contact/Gallery/Journal/Article/RoomDetail —
> reused by Safari + Royal; Marmalade + Sabela subpages likewise). Reveals on
> section heads / staggered card grids / banners / below-fold detail blocks;
> heroes + prose + above-fold booking content left static. Marmalade reveals stay
> on untransformed group wrappers (tilt-safe). `tsc`+`eslint`+`prettier` green.
>
> **REMAINING in Phase A (optional):** per-theme `[data-parallax]` on individual
> subpage heroes where a hero calls for it (only the shared OceansView home hero
> uses parallax today). Otherwise Phase A is done → move to **Phase B** (structural
> layout divergence for Safari + Royal) then **Phase C** (separate Safari from Sabela).
>
> ✅ **RESOLVED — resting-transform gotcha:** the base reveal rule used to set
> `transform` (hidden + `.in{transform:none}`), which would flatten a card's designed
> tilt (Marmalade) and could tie with a `:hover{transform:…}` lift. Now it animates the
> independent `translate` property, which stacks with any `transform`, so `[data-reveal]`
> is safe on tilted or hoverable elements. (Marmalade reveals are still placed on
> wrappers by choice, not necessity.)
>
> Also note: the shared safety timer force-reveals ALL remaining `[data-reveal]` at
> 2.3 s (matches the reference `royal.js`), so on a long page below-fold content
> reveals at 2.3 s even if unscrolled — the scroll-reveal effect mainly plays for
> above-fold + whatever you reach within 2.3 s. Fine + robust for now; if a longer
> scroll-reveal window is wanted later, lengthen the timer or make the safety a
> repeated rect-check instead of a one-shot force-all-visible.

### PHASE A — a per-theme MOTION system (highest value, do first)
Give every theme its own small, tasteful animation set so each FEELS alive + distinct,
even before layouts diverge. Deliver as ONE shared, dependency-free primitive with
per-theme "signatures":
1. **Build a `SiteReveal` client runtime** (`components/site/SiteReveal.tsx`, mount once
   in `SiteChrome` like `SitePreviewLinks`): an `IntersectionObserver` that adds `.in`
   to `[data-reveal]` elements (staggered via `--reveal-delay`), unobserving after.
   Respect `prefers-reduced-motion` (no-op → everything visible). SSR-safe, tiny.
2. **Emit `data-reveal` from the bespoke components** on section headers, cards, media —
   start with OceansView (`.ov*`) since 3 themes share it.
3. **Per-theme signature CSS** scoped to `.wielo-<slug>` defining what `[data-reveal]`
   → `.in` DOES + the hover/micro-interactions — DIFFERENT per theme, e.g.:
   - **OceansView** (coastal): gentle rise + fade; soft image "float" hover; a subtle
     accent underline sweep on links.
   - **Safari** (savanna): slower, longer-travel fade with a warm blur-in; ken-burns
     drift on hero imagery; card lift with a grain/earthy shadow.
   - **Royal Hotel** (grand): crisp, minimal — a thin champagne rule that draws in under
     headings, letter-spacing settle on the display type, restrained fade (luxury = calm).
   - **Marmalade** (postcards): the tilt/tape already reads distinct — add a playful
     "pin drop" settle + a slight rotate-in on cards.
   - **Sabela** (dark editorial): a filmic dark-to-light fade + gold hairline reveal;
     parallax on the ebony hero.
4. **Optional per-theme parallax** — a `[data-parallax]` handler in the same runtime,
   gated on reduced-motion, applied only where each theme's design calls for it (hero).
Keep total added JS tiny (one observer + one rAF scroll handler, both shared). This
alone makes the five themes feel like five different products.

### PHASE B — structural LAYOUT divergence for Safari + Royal
The real fix for "same layout." Give Safari and Royal their OWN component variants so
they stop cloning OceansView.

> **PROGRESS (2026-07-19, commit `6e6cdef`) — Royal HOME forked + live-verified.**
> `components/site/royal/RoyalHome.tsx` + `royalHome.css` (scoped `.rhome`, forked from
> oceansHome.css then re-composed into a grand-hotel layout: centred hero, "promise"
> trust strip, centred editorial welcome + champagne rule, monogram HERITAGE band,
> centred champagne-ruled heads, static mosaic, centred reviews with champagne bars).
> Archivo wired as a real font role (`archivo`); routing = a `preset==='royal'` home
> branch ABOVE the shared `usesOceansViewLayout` branch in SitePageView. Live-verified
> on mana: Royal home = `.rhome` w/ new sections + Archivo, reveals settle, no overflow;
> Safari/OceansView home still `.ovhome`.
>
> **PROGRESS (2026-07-20, commit `c24882d`) — Royal ROOMS + ROOM-DETAIL forked → Royal
> FULLY decoupled.** `RoyalRooms.tsx` + `royalRooms.css` (`.rrooms`) + `RoyalRoomDetail.tsx`
> + `royalRoom.css` (`.rroom`), forked from the OceansView room layout (the Royal reference
> matches it) with a grand-hotel treatment (centred Rooms page-head + champagne rules under
> room names & section heads). Forked room-detail CSS preserves the literal `.ovroom-lightbox`
> /`.ovlb-*` classes (shared OceansRoomGallery emits them inline). Routed via `preset==='royal'`
> branches above the shared branches (SitePageView rooms + SiteRoomView). Live-verified on mana
> (`.rrooms`/`.rroom`, champagne rules, Archivo, gallery + lightbox CSS + book card, no overflow).
> **REMAINING in Phase B: the whole Safari fork (from scratch).** Then Phase C.
>
> **PROGRESS (2026-07-20, commit `d651e36`) — Safari FULLY forked (Home + Rooms +
> Room-detail), built from scratch → Phase B COMPLETE.** Safari no longer clones the
> OceansView `.ov*` components. New `components/site/safari/`:
> - `SafariHome.tsx` + `safariHome.css` (`.sfhome`) — an EDITORIAL, photography-forward,
>   airy daylight-savanna composition: left-aligned full-bleed hero (with `[data-parallax]`
>   drift), asymmetric editorial welcome (copy + framed photo), inline oversized
>   hairline-ruled STAT numerals, **full-bleed alternating ROOM STORY BANDS** with two-digit
>   index numerals (the signature move), a ruled FIELD-NOTES experiences list, a
>   direct-booking PROMISE row, a daylight mosaic, and a warm-dark reviews band.
> - `SafariRooms.tsx` + `safariRooms.css` (`.sfrooms`) — an editorial "collection" GRID
>   (index numerals + floating rate badges), deliberately distinct from BOTH the home
>   story-bands and the OceansView alternating splits.
> - `SafariRoomDetail.tsx` + `safariRoom.css` (`.sfroom`) — editorial lodge treatment
>   (oversized serif title, hairline-ruled spec row, editorial section heads); reuses the
>   shared `OceansRoomGallery` + `OceansBookCard`.
> Routed via `preset==='safari'` branches ABOVE the shared `usesOceansViewLayout` branches
> (SitePageView home + rooms; SiteRoomView room-detail). All colour/type/shape via the
> existing `.wielo-safari` `--site-*` tokens (no new skin needed); `[data-reveal]` inherits
> Safari's slow warm blur-in signature. Honesty rule kept (always-true guarantees + host
> data only). `tsc`+`eslint`+`prettier` green. **Safari's remaining shared pages (About,
> Experiences, Specials, Gallery, Contact, Blog) still fall through to the OceansView layout
> via `usesOceansViewLayout` — home/rooms/room-detail are the highest-traffic forks, matching
> the Royal scope.** NEXT: Phase C (push Safari vs Sabela further apart).

> **PROGRESS (2026-07-20, commits `179c2a7` + `6b85e83`) — Safari forked SITE-WIDE.**
> The six remaining shared subpages are now bespoke too, so Safari no longer uses the
> OceansView layout on ANY public page: `SafariAbout` (`.sfabout`), `SafariExperiences`
> (`.sfexp`), `SafariContact` (`.sfcontact`, reuses the shared `OceansContactForm`),
> `SafariGallery` (`.sfgallery`, reuses the shared `OceansMosaicGallery` lightbox),
> `SafariSpecials` (`.sfspecials`) + `SafariSpecialDetail` (`.sfspecial`), `SafariJournal`
> (`.sfjournal`) + `SafariArticle` (`.sfarticle`). Routed via `preset==='safari'` branches
> above the shared branches in SitePageView (about/experiences/contact/gallery/specials),
> SiteSpecialView (special-detail ternary) + blog/page & blog/[postSlug] (journal/article
> ternaries). ALL live-verified on mana (`.sf*` render, Fraunces headings, no h-overflow,
> forms + lightbox work). **GOTCHA fixed (`6b85e83`): never put `data-reveal` on an element
> that WRAPS a `position:fixed` descendant** — the reveal primitive sets `translate`, which
> establishes a containing block and broke the gallery lightbox's fixed overlay (the wrapper
> around `OceansMosaicGallery` must be reveal-free; SafariRoomDetail's shared gallery is
> likewise un-wrapped). Royal still shares its non-core subpages with OceansView — fork
> those too only if the founder wants Royal fully bespoke as well.

> **FINDING (2026-07-19) — Royal Rooms/Room-detail ≈ OceansView layout.**
> `docs/themes/royalhotel/pages/{Rooms,Room}.html` are structurally the SAME as the
> OceansView Rooms/Room-detail (OceansViewRooms already ships the included chip bar +
> float-badge prices + alternating `.split w-left` rows the reference uses). So forking
> Royal's Rooms/Room-detail is low-value: a pure copy-rename renders identically (just
> duplicated code), and the `.wielo-royal` skin already recolours `.ovrooms`/`.ovroom`
> to champagne/charcoal/Archivo. Room-*detail* pages are inherently similar across hotel
> themes. **Decision: skip Royal Rooms/Room-detail forks** unless a concrete redesign is
> wanted; the real remaining differentiation is the **Safari fork** (from scratch — no
> reference dir, currently 100% clones OceansView) and **Phase C**. Room-detail routing
> hook (if ever forked): a `preset==='royal'` branch above line ~138 in `SiteRoomView.tsx`.

Pragmatic route: fork the specific pages where the design
differs most (start with **Home** + **Rooms** + **Room detail**, the highest-traffic),
into `components/site/safari/*` and `components/site/royal/*`, re-composed to each
theme's identity:
- **Royal** — the reference (`docs/themes/royalhotel/pages/*.html`) already has the
  grand-hotel treatment + its unique sections. ✅ **Home done** (`6e6cdef`): the honest
  analogues of the reference's unique sections shipped — a "promise" trust strip (in the
  reference's accolades/featured style, but honest guarantees not fake press), a monogram
  heritage band, centred champagne-ruled heads. ✅ **Archivo wired** as a real `archivo`
  font role (themes.ts + SITE_FONTS + SiteFontLinks). REMAINING: **Rooms + Room-detail** —
  port `docs/themes/royalhotel/pages/{Rooms,Room}.html` into `components/site/royal/`
  (route the `royal` rooms branch in SitePageView + the room-detail branch in SiteRoomView,
  each above the shared OV branch). NOTE the honesty rule: the reference fabricates press/
  awards/amenities/"Est. 1888" — the in-app fork must NOT (host data or always-true only).
- **Safari** — NenGama Lodge is a warm savanna lodge: lean into an editorial,
  photography-forward composition distinct from OceansView's resort grid (e.g. full-bleed
  alternating story bands, a different rooms presentation). Its reference is only the
  `safari` skin (no bespoke design dir) — design it, don't just recolour.
Then update `usesOceansViewLayout()` / the route guards so each forked page routes to its
own component while unforked pages still fall back to the shared OceansView set.

### PHASE C — separate Safari from Sabela (founder-flagged "feel the same")

> **▶▶ RESUME HERE (next session), 2026-07-20.** Phase A (motion) + Phase B (Safari
> AND Royal fully forked) are DONE + live-verified. Phase C is IN PROGRESS — the code +
> migration for the biggest move (Safari's own typeface) are done (commits `f3a145a` +
> the `20260720120000` migration) BUT the migration is **NOT applied yet**, so Fraunces
> is **NOT live-verified**. FIRST STEP next session: apply the migration + verify (see
> the ⚠️ below). Read the whole plan first.
>
> **PHASE C PROGRESS (2026-07-20) — Safari given its OWN display typeface (Fraunces).**
> The side-by-side live audit found the root cause of "feel the same": Safari (`safari`)
> and Sabela (`hotel`) BOTH used the `elegant` font role → identical Cormorant Garamond
> serif headings, plus similar warm gold/ochre accents. Fix = a new `fraunces` font role
> (Fraunces — warm editorial soft-serif + Inter body): code preset + FONT_STACKS +
> SiteFontLinks (loads Fraunces+Inter) + builder font enums (SITE_FONTS, studio.ts,
> _sections.tsx) + `font_fraunces` i18n label (commit `f3a145a`); Sabela keeps Cormorant.
>
> ⚠️ **KEY FINDING — the font is served from the DB, not the code preset.**
> `buildSiteVars` resolves the font as `type.headingFont ?? theme.font ??
> theme.base.font`, and `resolveThemeBase(slug)` returns the **`site_themes` catalog
> row** (`base` JSON), whose `base.font` was `"elegant"`. So `SITE_PRESETS.safari.font`
> is only the FALLBACK — the live render kept showing Cormorant after the code change.
> The operative fix is migration **`supabase/migrations/20260720120000_safari_theme_fraunces_font.sql`**
> (`jsonb_set` flips `site_themes.base->font` → `fraunces` for slug `safari`).
> **This environment has no `supabase link` + the branch lacks the cloud's newer billing
> migrations, so `db push` was NOT run here (would risk migration-history divergence).**
>
> **▶ FIRST STEP next session (OPS-TODO, founder): `supabase db push --linked`** to apply
> the migration, then preview `?theme=safari` on mana and confirm the headings compute to
> Fraunces (not Cormorant) — DOM check: `getComputedStyle(h1).fontFamily` starts with
> "Fraunces", and a `Fraunces` googleapis `<link>` is in `<head>`. Only THEN is the
> typeface split verified. (Existing applied sites like mana's LIVE theme keep the old
> copied font until Safari is re-picked in Brand Studio — pre-MVP, acceptable.)
>
> **REMAINING for C after that (optional, verify first): imagery grade (a subtle daylight/
> warmth lift on Safari vs Sabela's moodier grade, CSS filter only) + any type-scale/rhythm
> nudges IF the audit still reads them as too close. Likely minor — light/dark palette +
> different layouts + different typefaces should separate them cleanly.**

Both are warm-earth lodges with serif display. Push them apart: Safari → lighter, sun /
bush / daylight, airier; Sabela → keep the dark filmic editorial. Different motion
signatures (Phase A) already helps; reinforce with type scale + section rhythm + imagery
treatment so they don't read as one theme in two palettes.

**GOOD NEWS — the gap is already much wider than when the founder flagged it.** As of pt22
Safari now has its OWN bespoke `.sf*` components (light daylight editorial: full-bleed
alternating story bands, oversized ruled numerals, airy whitespace) while Sabela keeps its
dark filmic `.sb*` layout. They no longer share a layout at all. So Phase C is now a
REFINEMENT pass, not a rebuild. Concretely, do a **side-by-side live audit first**
(`?theme=safari` vs `?theme=hotel` on mana, same pages) and only then adjust:

1. **Palette contrast check** — Safari surface is warm bone `#FBF6EC` on `#F4EDE0`; Sabela
   is dark ebony. Already very different. Confirm nothing on Safari reads as dark/filmic.
2. **Type scale + rhythm** — Safari uses Cormorant Garamond at an airy editorial scale;
   check Sabela's serif (Fraunces?) + tighter dark rhythm still feels distinct at a glance.
3. **Imagery treatment** — consider a subtle daylight/warmth lift on Safari imagery vs
   Sabela's moodier grade (CSS filter only; don't touch host photos). Optional / low-priority.
4. **Motion** — signatures already differ (Safari 34px/blur(9px)/1000ms warm blur-in;
   Sabela blur(5px)/1050ms). Leave unless the audit shows they read the same.

If the side-by-side already reads as two clearly different hotels (likely), Phase C may be
a quick confirm + a couple of small nudges rather than real work — **verify live before
assuming there's a problem.** Sabela components live in `components/site/sabela/` (`.sb*`).

**KEY FILES for the Safari fork (pt22, for reference / future edits):**
`components/site/safari/{SafariHome,SafariRooms,SafariRoomDetail}.tsx` +
`{safariHome,safariRooms,safariRoom}.css` (scoped `.sfhome`/`.sfrooms`/`.sfroom`). Routing:
`preset==='safari'` branches ABOVE the shared `usesOceansViewLayout` branches in
`SitePageView.tsx` (home + rooms) and `SiteRoomView.tsx` (room-detail). Tokens come from the
existing `.wielo-safari` block in `theme-skins.css` (no new skin was needed). Safari's
About/Experiences/Specials/Gallery/Contact/Blog still route through the shared OceansView
layout — fork those too ONLY if the founder wants full-site divergence (not required for C).

---

## 🧪 VERIFY (Principle #9 — never "done" until SEEN live)
- Preview any theme on mana: `…/site/<page>?site=mana&preview=1&theme=<oceansview|marmalade|hotel|safari|royal>`.
- Branch deploy is behind Vercel auth → view via the founder's authenticated
  **Claude-in-Chrome** browser. Reliable checks = `javascript_tool` computed-style/DOM
  queries (screenshots were flaky). Confirm: the motion runs, is reduced-motion-safe, no
  CLS, no horizontal overflow, mobile layout holds.
- Deploys ≈ 5–6 min; the branch alias serves the newest READY. Project
  `prj_ia39tAuJTTErlViwZXjgNHWKU7xZ`, team `team_HBP2Mcif9OcWL3w4hJXlAXDt`, alias
  `vilo2027-git-feature-website-cms-10m-6c3132-wollie333s-projects.vercel.app`.
- **Clean-tree/build gotchas:** no local `.env.local` → `pnpm build` can't run locally;
  gate with `cd apps/web && NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` +
  `npx eslint <files>` + the Vercel build + the live render. prettier-tailwind strips a
  leading space in a `className` template literal → use a plain-string ternary. Commit
  subject must be lowercase (commitlint). Bash CWD persists — use absolute `cd`.

## 📌 IMMEDIATE OUTSTANDING (carried in from pt16)
- **Live-verify Royal Hotel** (`0874a5b`) once its deploy is READY — on an older deploy
  `?theme=royal` falls back to `warm` (unknown preset) so you'll see warm off-white + no
  `.ovhome`; that's a stale-deploy artifact, not a bug. Confirm champagne-gold + `.wielo-royal`.

## 🔑 KEY FILES
- Reuse wiring: `apps/web/lib/site/themeFamily.ts` · route guards in
  `components/site/SitePageView.tsx`, `SiteRoomView.tsx`, `SiteSpecialView.tsx`,
  `app/[locale]/site/blog/{page,[postSlug]/page}.tsx`.
- Presets: `apps/web/lib/site/themes.ts` (`SITE_PRESETS`, `FONT_STACKS`, `buildSiteVars`).
- Skins: `apps/web/components/site/themes/theme-skins.css` (`.wielo-<slug>` blocks).
- Chrome registry: `apps/web/components/site/SiteChrome.tsx` (`THEME_CHROME`).
- Bespoke components: `components/site/{oceansview,marmalade,sabela}/`.
- Reference designs (incl. the intended JS): `docs/themes/<theme>/` +
  `docs/themes/royalhotel/{royal.js,royal-tweaks.js,theme.css,pages/*.html}`.
- Global reduced-motion + focus rings: `apps/web/app/globals.css`.
