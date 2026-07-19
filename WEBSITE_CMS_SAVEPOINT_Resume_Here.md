# 🟢 Website CMS — SAVE POINT / Resume Here

**Branch:** `feature/website-cms-10min-wizard` · **Last pushed:** `392f377` · **Vercel auto-deploys on push**
**Updated:** 2026-07-19 (pt7 — phased plan locked)
**This file is COMMITTED. Commit + push it before ending any session.**

---

## 🎯 THE PLAN (founder's phasing — do them IN THIS ORDER)

1. **PHASE 1 — Pixel-perfect design for EVERY theme × EVERY page (incl. header + footer).** ← **WE ARE HERE**
   Each page must be a pixel-perfect mirror of that theme's reference design, with the host's details wired
   in. OceansView is DONE (all pages + chrome, founder-confirmed pixel-perfect). Next: **Marmalade**, then
   **Sabela**. (Founder said "4 themes" — only 3 have reference designs; confirm if a 4th exists.)
2. **PHASE 2 — Wire in the AI-wizard TEXT + IMAGES** per page (each page pulls the content from its relevant
   wizard step — `content_profile` + assembled live data). Some of this is already wired on OceansView
   (hero/story/experiences/faq from `content_profile`); Phase 2 makes it complete + correct on every theme.
3. **PHASE 3 — Builder CUSTOMISATION options** (host can restyle/edit per element in the builder).

**End state:** wizard → host picks a theme → a professional site with every page designed + AI-populated + editable.

---

## ✅ DONE + LIVE-VERIFIED (on `mana`, this arc)

- **OceansView — ALL pages bespoke + pixel-perfect** (founder-confirmed): Home, About, Rooms, Room detail,
  Specials, **Special detail**, Contact, Journal (index + article), Experiences, Gallery. Components in
  `apps/web/components/site/oceansview/` (`OceansView*.tsx` + `oceans*.css`, scoped `.ov*`).
  A per-page fidelity audit + fix pass (`8dffc19`) closed all minor deviations.
- **Bespoke CHROME (header + footer) for ALL 3 designed themes** via a registry: OceansView, Marmalade,
  Sabela. `SiteChrome.tsx` has `const THEME_CHROME: Record<preset,{Header,Footer}>` and dispatches on
  `preset`. Components: `oceansview/OceansView{Header,Footer}` (`.ovchrome`), `marmalade/Marmalade{Header,
  Footer}` (`.mmchrome`), `sabela/Sabela{Header,Footer}` (`.sbchrome`). Every public `/site` route passes
  `preset={ctx.theme.preset}`.
- **Specials/offer DETAIL pages + auto "Specials" sub-menu** (`930bd2f`) — applies to ALL themes (bespoke
  OceansView `.ovsd` + `GenericSpecialDetail` fallback). Route `app/[locale]/site/specials/[specialSlug]` →
  `SiteSpecialView`; `loadSiteSpecialPage`. Listing cards say **"View offer"** → detail; detail has the
  **Book** CTA → special-locked checkout. Auto sub-menu mirrors rooms (`autoSpecials`/`expandAutoSpecials`/
  `specialMenuLinks`, inferred onto the specials nav item so existing sites get it).
- **Rooms detail + auto "Rooms" sub-menu** already existed (`autoRooms`); specials mirrors it.

---

## 🔜 PHASE 1 — REMAINING WORK (the immediate track)

Build **bespoke PAGE components for Marmalade + Sabela**, page by page, exactly like OceansView. Chrome is
already done for both; only the PAGES are still generic.

Per theme, the page set (from `docs/themes/<theme>/pages/*.html`) is ~11 pages:
Home · About · Rooms/**Suites** · Room/**Suite** detail · Specials · **Special detail** · Contact ·
Journal (index) · Journal Post · Experiences · Gallery · **Thank You** · (Booking/Checkout + Search Results
are transactional — token-themed, low priority).

> **Note (Sabela naming):** Sabela calls rooms **"Suites"** (`Suites.html`/`Suite.html`) — but the DB
> `page.kind`/route is still `rooms`/`/rooms/<slug>`; just label it "Suites" in the design.

**Suggested order per theme:** Home → Rooms → Room detail → About → Contact → Specials (+ reuse the
special-detail generic OR build a bespoke one) → Journal (index + article) → Experiences → Gallery →
Thank-you. Start with **Marmalade Home**.

### THANK-YOU (part of Phase 1) — the logic already exists, only the DESIGN is missing
Routes: `app/[locale]/site/book/thank-you` (booking → **Purchase** pixel event) and
`app/[locale]/site/thank-you/[[...goal]]` (form goals **contact/quote/custom**, each fires **Lead**, host
per-form copy overrides the goal defaults). Both sit in `SiteChrome` (theme chrome ✓) + fire tracking
events ✓. **Missing = the bespoke pixel-perfect design** (`Thank You.html` exists in every theme folder).
Build `<Theme>ThankYou` over the existing goal/event/copy logic. (Founder's "3 thank-you pages" =
booking / contact-quote / custom — already modelled by the goal templates.)

---

## 🧭 THEME → PRESET MAPPING (dispatch keys)

| Design (docs/themes) | `theme.preset` | skin class | chrome scope | page scope convention |
|---|---|---|---|---|
| oceansview | `oceansview` | `.wielo-oceansview` | `.ovchrome` | `.ov*` (ovhome, ovabout, …) |
| marmalade  | `marmalade`  | `.wielo-marmalade` | `.mmchrome` | use `.mm*` (mmhome, …) |
| sabela     | **`hotel`**  | `.wielo-hotel`     | `.sbchrome` | use `.sb*` (sbhome, …) |

Sabela's Ebony palette == the `hotel` preset, so Sabela sites/preview use `preset: "hotel"` and
`?theme=hotel`. Presets with no reference design (warm/coastal/safari) keep the generic chrome + generic pages.

---

## 🏗️ THE BUILD PATTERN (how each bespoke page is added — proven this session)

A bespoke page = **a scoped React component + a scoped CSS file + a routing hook**, fed by `content_profile`
(host wizard copy) + live `SiteData` (`assembleSiteDataByType`), with **account-derived fallbacks**, and
**demo copy / OMIT** as the last resort (never fabricate specifics — omit-rather-than-fabricate).

1. **Component + CSS** in `apps/web/components/site/<theme>/` (`<Theme><Page>.tsx` + `<theme><Page>.css`,
   every selector scoped e.g. `.mmhome`). Port **class-by-class** from `docs/themes/<theme>/pages/<Page>.html`
   + the theme stylesheet (`theme.css`; Sabela's is `theme.source.css`). Keep `--site-*` tokens WITH the
   reference's hard fallbacks so it's on-brand + host-editable.
2. **Full-site pages** (home/about/rooms/specials/contact/experiences/gallery) route in
   `apps/web/components/site/SitePageView.tsx` behind
   `ctx.theme.preset === "<preset>" && result.page.kind === "<kind>"` — placed BEFORE the generic
   `result.doc` fallback. Pass `preset={ctx.theme.preset}` + `pageHasHero` to `SiteChrome`. Assemble the
   page's data (copy from `content_profile`, live data from `assembleSiteDataByType`).
3. **Room/Suite DETAIL** routes in `components/site/SiteRoomView.tsx` (branch `preset === "<preset>"`).
   **Special DETAIL** routes in `components/site/SiteSpecialView.tsx` (branch `preset === "<preset>"`; else
   `GenericSpecialDetail`). **Journal** is separate: `app/[locale]/site/blog/page.tsx` (index) +
   `…/blog/[postSlug]/page.tsx` (article), behind the preset guard. **Thank-you**:
   `app/[locale]/site/thank-you/[[...goal]]/page.tsx` + `…/book/thank-you/page.tsx`.
4. **Data wiring** — copy the OceansView branch for the same page kind as your template (it shows exactly
   which `content_profile` slots + `assembleSiteDataByType` keys each page uses). `content_profile` shape is
   in `apps/web/lib/website/contentProfile.schema.ts` (hero, about.story, host bio, experiences{intro,items},
   contact.faq, …). `SiteData` types in `apps/web/lib/site/types.ts`.
5. **Verify** live on mana (see below), then commit + push per page.

### ⚡ Efficient method used this session (works well)
Delegate the mechanical port to a **subagent**: give it the reference HTML + theme CSS + an existing
OceansView component as the exact template + the prop interface + the gotchas; it produces the component +
scoped CSS + runs tsc/lint. The **main agent wires the SitePageView/route branch + assembles data + verifies
live** (the integration + Principle-#9 check stays with the main agent). Spawn 2–3 page-builders in parallel.

---

## 🔍 VERIFICATION (Principle #9 — never "done" until SEEN on the live render)

- **mana** is the real OceansView test site on the deploy. Reach any page:
  `…/site/<page>?site=mana&preview=1` (home = `…/site?site=mana&preview=1`).
- **To verify a DIFFERENT theme on mana, add `&theme=<slug>`** (`marmalade` / `hotel` / `oceansview`).
  This hits the theme-preview resolver (`loadSitePage`, `ctx.previewThemeSlug`) which renders the theme's
  page templates; your `preset === "<preset>"` branch in SitePageView then fires and renders the bespoke
  component with mana's live content. **This is how you verify Marmalade/Sabela pages before any real
  site of that theme exists.**
- **Room/Special detail slugs on mana:** rooms `leadwood-suite`, `marula-family-suite`,
  `tamboti-star-bed-suite`; specials `mana-stay-4-pay-3`, `mana-honeymoon-star-bed`, `mana-locals-midweek`
  (paths are `/en/site/rooms/<slug>` and `/en/site/specials/<slug>`).
- **Experiences + Gallery 404 on the plain URL** (mana has no page rows for them) — reach them via
  `&theme=oceansview` (or `&theme=<slug>` for other themes). Experiences shows the empty-state (mana has no
  experiences content); Gallery shows mana's real photos.
- **Deploy protection:** the branch alias is behind Vercel auth. Use the founder's authenticated
  **Claude-in-Chrome** browser to view/screenshot. `mcp__…__web_fetch_vercel_url` only returns edge-CACHED
  pages (force-dynamic routes 302 to SSO). **Browser screenshots were FLAKY this session** (script-injection
  timeouts) — fall back to `javascript_tool` DOM queries (reliable) to confirm structure/hrefs/attrs, and
  retry screenshots after a fresh navigate + `wait`.
- Wait for the LATER of two rapid deploys to reach READY (branch alias serves the newest); builds ≈ 5–6 min.
  Check via `mcp__…__list_deployments` / `get_deployment` (project `prj_ia39tAuJTTErlViwZXjgNHWKU7xZ`,
  team `team_HBP2Mcif9OcWL3w4hJXlAXDt`, alias `vilo2027-git-feature-website-cms-10m-6c3132-wollie333s-projects.vercel.app`).

---

## ⚠️ GOTCHAS (all bit us — all real)

- **prettier-plugin-tailwindcss STRIPS the leading space in a `className` template literal**
  (`className={`nav-link${a?" active":""}`}` → dead class `nav-linkactive`). ALWAYS use a plain-string
  ternary: `className={a ? "nav-link active" : "nav-link"}`. Grep `className={\`` after every commit
  (the pre-commit hook runs prettier). Interpolating a FULL class string is fine — only the conditional
  leading space breaks.
- **No `apps/web/.env.local` in this worktree** → `pnpm build` fails locally with ~460 unrelated
  `createAdminClient …SUPABASE… must be set` prerender errors, AND you **can't reseed DB PageDocs**
  (service-role writes). So the SKIN model (`theme-skins.css` + PageDoc reseed) is BLOCKED here — that's the
  reason we do bespoke components (also matches OceansView + is what the founder wants). Gate commits with
  `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` + `pnpm lint` + the Vercel build + the live render.
- **Build OOMs** at Node's 2 GB default → `NODE_OPTIONS="--max-old-space-size=4096"`.
- **Bash CWD persists** between calls — a second `cd apps/web` after an earlier one fails ("No such file");
  use absolute `cd` paths.
- Never pipe stderr into `database.types.ts` (corrupts it). No Docker / local Supabase — see CLAUDE.md.

---

## 🔑 KEY FILES

- Reference designs: `docs/themes/<theme>/pages/*.html` + `theme.css` (Sabela: `theme.source.css`) +
  `header.html`/`footer.html` + `base.md`. Standard: `docs/themes/THEME_SKIN_STANDARD.md` (note §6b: chrome
  is a per-theme "signature shell" — the sanctioned "extend the chrome" path we took).
- Page routing: `apps/web/components/site/SitePageView.tsx` (copy an OceansView branch as your template).
- Detail routes: `SiteRoomView.tsx`, `SiteSpecialView.tsx`. Journal: `app/[locale]/site/blog/**`.
- Chrome registry + dispatch: `apps/web/components/site/SiteChrome.tsx` (`THEME_CHROME`).
- Data + nav + href helpers: `apps/web/lib/site/loadSitePage.ts` (`assembleSiteDataByType`,
  `loadSiteRoomPage`, `loadSiteSpecialPage`, `siteRoomHref`/`siteSpecialHref`/`siteBookHref`,
  `expandAutoRooms`/`expandAutoSpecials`). Nav-href helpers: `lib/site/navHref.ts`.
- Types: `lib/site/types.ts`. Content-profile schema: `lib/website/contentProfile.schema.ts`.
  Default menu (auto flags): `lib/website/defaultMenu.ts`.
- Templates to copy: the whole `apps/web/components/site/oceansview/` folder + `marmalade/` + `sabela/`
  chrome components.

## Key memories
`oceansview-bespoke-pages-status` · `oceansview-cms-worktree-env` (in the project memory dir).
