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
| **Safari** | `safari` | **REUSES OceansView** `.ov*` | ⚠️ SAME layout as OceansView (savanna skin only) |
| **Royal Hotel** | `royal` | **REUSES OceansView** `.ov*` | ⚠️ SAME layout as OceansView (champagne skin only) |

The reuse wiring lives in **`apps/web/lib/site/themeFamily.ts`** →
`usesOceansViewLayout(preset)` = `oceansview | safari | royal`. All route guards
(SitePageView ×7, SiteRoomView, SiteSpecialView, blog index + article) call it, and
`SiteChrome.THEME_CHROME` maps all three to the OceansView Header/Footer. Each gets its
palette/font/radius from its preset (`lib/site/themes.ts`) + derived colour tokens from
its `.wielo-<slug>` block (`components/site/themes/theme-skins.css`).

**So: OceansView, Safari and Royal are visually three re-skins of one layout.** That is
exactly what the founder does NOT want. Marmalade + Sabela are fine.

Founder also said: **Safari + Sabela/hotel "feel like the same theme"** (both warm-earth
lodge + serif) — differentiate those too even though their LAYOUTS already differ.

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
> **REMAINING in Phase A:** emit `[data-reveal]` from the rest of the OceansView pages
> (About/Experiences/Specials/SpecialDetail/Contact/Gallery/Journal/Article + RoomDetail)
> and the Marmalade/Sabela subpages. Optionally wire per-theme `[data-parallax]` where a
> hero calls for it. Then Phase B + C below.
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
they stop cloning OceansView. Pragmatic route: fork the specific pages where the design
differs most (start with **Home** + **Rooms** + **Room detail**, the highest-traffic),
into `components/site/safari/*` and `components/site/royal/*`, re-composed to each
theme's identity:
- **Royal** — the reference (`docs/themes/royalhotel/pages/*.html`) already has the
  grand-hotel treatment + its unique sections (accreditation **logos** strip, **amenities**
  section, R-monogram brand tile). Port those bespoke; wire Archivo as its real font
  (add an `archivo` role to `FONT_STACKS` in `themes.ts` + load it in the site font links
  — `SiteFontLinks`; currently Royal borrows the `grotesk`/Bricolage stack).
- **Safari** — NenGama Lodge is a warm savanna lodge: lean into an editorial,
  photography-forward composition distinct from OceansView's resort grid (e.g. full-bleed
  alternating story bands, a different rooms presentation). Its reference is only the
  `safari` skin (no bespoke design dir) — design it, don't just recolour.
Then update `usesOceansViewLayout()` / the route guards so each forked page routes to its
own component while unforked pages still fall back to the shared OceansView set.

### PHASE C — separate Safari from Sabela (founder-flagged "feel the same")
Both are warm-earth lodges with serif display. Push them apart: Safari → lighter, sun /
bush / daylight, airier; Sabela → keep the dark filmic editorial. Different motion
signatures (Phase A) already helps; reinforce with type scale + section rhythm + imagery
treatment so they don't read as one theme in two palettes.

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
