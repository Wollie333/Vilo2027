# 🟢 Website CMS — SAVE POINT / Resume Here

**Branch:** `feature/website-cms-10min-wizard` · **Last pushed:** `7700665` · **Vercel auto-deploys on push**
**Updated:** 2026-07-19 (pt18 — Phase A motion system DONE + live-verified for all 5 themes)

> ## ▶▶ NEXT SESSION STARTS HERE — read `THEME_DIFFERENTIATION_PLAN.md` (repo root) FIRST
> Founder directive (2026-07-19): **the themes must each be UNIQUE — not one layout in
> different palettes.** Each *unique · modern · professional · mobile-responsive* with its
> **own minimal, tasteful JS animations** that enhance the visitor experience.
>
> **✅ PHASE A (per-theme MOTION system) — DONE + LIVE-VERIFIED (pt18).** All FIVE themes now
> animate distinctly. Built `components/site/SiteReveal.tsx` (client IntersectionObserver →
> `.in` on `[data-reveal]`; rAF `[data-parallax]`) + `site-reveal.css` (base primitive),
> mounted once in `SiteChrome`. Gated behind a `wielo-reveal-ready` class the runtime adds
> ONLY when motion is allowed AND not in `.wielo-builder` → reduced-motion/no-JS/SSR/canvas
> never hide anything (zero CLS, proven live). Animates the INDEPENDENT `translate` property
> (+ opacity + filter) so it COMPOSES with each theme's own `transform` (card tilt / hover)
> instead of flattening it. Per-theme signatures in `theme-skins.css` via `--reveal-y /
> -blur / -dur / -ease`: **oceansview** 20px/640ms · **safari** 34px/1000ms/blur9 +
> `wielo-kenburns` hero drift · **royal** 10px/900ms + champagne rule under `.sec-head h2` ·
> **marmalade** 20px springy back-ease (reveals on untransformed wrappers; tilts intact) ·
> **sabela**=`.wielo-hotel` 26px/1050ms/blur5 filmic. `[data-reveal]` emitted from ALL FIVE
> HOME pages + OceansView Rooms. Verified live on mana per theme (distinct resolved vars,
> settle to opacity 1, tilts preserved, hover composes, no overflow, no stuck content).
> Commits: `392e6d3` (core: oceansview/safari/royal) → `5405338` (marmalade+sabela + the
> translate refactor) → `7700665` (docs). Full detail: CHANGELOG 2026-07-19 (×2 entries).
>
> **▶ RESUME with the Phase A TAIL, then B + C** (all in `THEME_DIFFERENTIATION_PLAN.md`):
> 1. **Phase A tail** (low-risk, repetitive) — emit `[data-reveal]` from the bespoke
>    SUBpages: OceansView About/Experiences/Specials/SpecialDetail/Contact/Gallery/Journal/
>    Article/RoomDetail (these power Safari+Royal too), + the Marmalade/Sabela subpages.
>    Same pattern as the home pages; attach to sec-heads/cards/wrappers, stagger via inline
>    `--reveal-delay`. Optionally wire `[data-parallax]` on a hero where it helps.
> 2. **Phase B** — fork Safari + Royal bespoke Home/Rooms/Room-detail so their LAYOUTS
>    diverge (not just motion/palette). Royal ref exists in `docs/themes/royalhotel/pages/`
>    (logos/amenities/R-monogram; wire Archivo font). This is the real fix for "same layout".
> 3. **Phase C** — separate Safari from Sabela (both warm-earth lodge + serif).

> ## 🧭 WHERE WE ARE (read this first)
> **FIVE full themes.** OceansView, Marmalade, Sabela (=`hotel`), Safari (=`safari`, "NenGama Lodge"), and
> now **ROYAL HOTEL** (=`royal`) all render bespoke pages. Verify on mana via
> `?site=mana&preview=1&theme=<oceansview|marmalade|hotel|safari|royal>`.
>
> **⚠️ GOLDEN-RULE DEBT (founder: "no two themes the same"):** OceansView, Safari AND Royal still share the
> SAME LAYOUT (Safari + Royal reuse OceansView's components via `usesOceansViewLayout()` in
> `lib/site/themeFamily.ts`); they differ by palette/font/radius — and now (pt18) by **MOTION** (each has its
> own scroll-reveal signature, so they no longer read as one layout in three palettes). The founder ACCEPTED
> the shared layout for Royal ("faithful now, distinct later"). **Distinct-later backlog (Phase B/C):** (1)
> Royal — wire Archivo (uses grotesk/Bricolage now), the R-monogram brand tile, the grand-hotel
> logos/amenities sections; (2) re-compose a page or two per reuse-theme so the LAYOUT diverges, not just the
> skin/motion; (3) the founder also flagged Safari + Sabela/hotel "feel like the same theme" (both warm-earth
> lodge + serif) — differentiate.
>
> **ROYAL HOTEL (pt16, `0874a5b`, ✅ LIVE-VERIFIED pt18):** grand hotel — white ground,
> warm-charcoal ink, champagne-gold accent (#B08948) + espresso secondary, tight grotesk, refined `md`
> corners. REUSES OceansView pages + chrome (like Safari) re-skinned via the `.wielo-royal` block. Added:
> `royal` preset (themes.ts), `.wielo-royal` colour tokens (theme-skins.css), `usesOceansViewLayout()` helper
> (refactored all guards), `THEME_CHROME.royal` → OceansView chrome. Reference in `docs/themes/royalhotel/`.
> NOTE: verify AFTER the `0874a5b` deploy is READY — on an older deploy `?theme=royal` falls back to `warm`
> (preset unknown) so you'll see warm off-white + no `.ovhome`; that's a stale-deploy artifact, not a bug.
>
> **IMAGE QUALITY (pt15/16, `cd5de81`):** founder wants premium photos for guests. `siteImageUrl` default
> quality 72→82 (WebP; +~1KB, visually lossless); full-bleed hero/cover/lightbox widths 2000→2560 (retina).
> Transform never upscales. Verified: mana photo @800/q82 = 200/webp/~28KB vs 138KB original. Can go q90 for
> max fidelity (~30-40% larger).
>
> **SAFARI (pt15, `b51192c`+`6035f08`, VERIFIED live):** Safari was palette-only. It now REUSES the
> OceansView bespoke page components (same layout convention per page) re-skinned to the savanna palette,
> so every page is bespoke with NO new component files. How: extend each `preset === "oceansview"` guard to
> also match `"safari"` (SitePageView ×7, SiteRoomView, SiteSpecialView, blog index+article) + register
> `safari` in `THEME_CHROME` → OceansView Header/Footer. The savanna derived tokens come from the
> pre-existing **NenGama Lodge** `.wielo-safari` block in theme-skins.css (search `.wielo-safari`); Safari's
> elegant serif + sharp `sm` radius come from the `safari` preset so it reads distinctly on the shared layout.
> Live-verified: sand bg `rgb(244,237,224)`, warm-bark dark bands, ochre, Cormorant Garamond serif, no
> coral/navy leak, zero overflow. (Any REAL empty Safari site would show OceansView's ocean-ish DEMO
> fallbacks e.g. "Wake up to the whole ocean" — a Phase-2 AI-content follow-up, not a layout issue.)
>
> **CROSS-THEME REFINEMENT PASS (pt15) — errors + premium/modern + fast, all pushed + tsc/lint green:**
> - `185eeb4` **ERROR fixed:** OceansView/Safari mobile nav drawer never opened (`mnavopen` → `mnav open`,
>   the prettier space-strip gotcha). + site-wide `:focus-visible` rings (globals.css, per-theme accent) +
>   44px burger tap targets + footer socials 42px + 9px→11px header subtitles. Nav fix VERIFIED live.
> - `08e1a1f` **lazy-load** 70 below-fold images (heroes kept eager) across all 3 component sets.
> - `995bfe3` contact-form label a11y (htmlFor/id ×3 forms) + Sabela error `#dc2626`→`#f87171` (ebony
>   contrast) + Marmalade empty-reviews guard + 44px article share icons.
> - `7933e68` **serve resized images** — 90 `<img src>` wrapped in `siteImageUrl(url,{width})` (Supabase
>   `/render/image` transform; safe no-op for external/SVG/null). Transform endpoint verified live (mana
>   listing photo @width=800 → 200, webp, ~27KB). Generous 2× widths so retina stays sharp.
> - **False positives** (audits only read theme files, missed shared infra): reduced-motion is ALREADY
>   global in globals.css; Sabela "hardcoded links" are fine (SitePreviewLinks intercepts every internal
>   click in preview; tenant-relative works live).
> **⏳ pt15 outstanding:** live-verify the resized-image deploy `7933e68` (endpoint proven; confirm a page
> img `src` is a `/render/image` URL + sharp). Then **Next = PHASE 2** (wire AI-wizard content per page,
> incl. the Experiences auto-draft idea below) then PHASE 3 (builder per-element customisation).
>
> **🚀 LAUNCH OPS-TODO (founder, Cloudflare dashboard) — Turnstile allowed hostnames.** The checkout +
> website-enquiry forms use Cloudflare Turnstile (`components/site/TurnstileWidget.tsx`, gated by
> `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; server verify `lib/security/turnstile.ts`, fail-closed once
> `TURNSTILE_SECRET_KEY` is set). The site key is **domain-locked**: on any hostname NOT in the key's
> *Allowed Hostnames* it renders RED with **error 110200** and, because the checkout submit gates on
> `turnstileEnabled() && !tsToken`, the pay button stays disabled. This is why checkout Turnstile fails on
> the `*.vercel.app` PREVIEW domain (diagnosed pt15 — NOT a code bug). **Before a real tenant site goes
> live, add that tenant's actual domain/subdomain to the Turnstile widget's Allowed Hostnames** (and the
> production apex/`www`), or the live checkout will 110200 there too. (Optional preview convenience: add the
> branch alias / `*.vercel.app`, or use a Cloudflare *testing* site key on preview deploys.)
>
> **✅ `f7ebd86` VERIFIED live** — Sabela checkout now has three clear elevation levels: page `≈rgb(20,18,13)`
>   < form card `≈rgb(45,42,35)` < room/add-on rows `≈rgb(62,58,51)` (lighter, visible border `≈rgb(98,93,79)`).
>   The `dateInk` change softens the SELECTED date value; the "Add date" placeholder stays the standard mute
>   `#A99B7F` (if the founder wanted the placeholder itself darker, tweak the `mute` prop on ThemedDateRange).
> **⏳ OUTSTANDING (pending, do first in a new session):**
> - **Social rail never live-seen** — mana has no social links set + toggle off. To demo: add socials to mana's
>   brand + flip Website→Settings "Social media rail" ON, then it renders on every page.
>
> **pt14 additions:**
> - **Checkout refinement (`f7ebd86`)** — dark-theme room + add-on selectable rows lifted to a lighter panel
>   (surface + 16% ink) with clearer border (line + 28% ink) so they stand out; date-range text softened
>   (ink + 28% mute). Gated on `surfaceDark`; Marmalade light checkout unchanged. PENDING live-verify (above).
>
> **pt13 batch (all live-verified on mana `?theme=hotel` unless noted):**
> - **SABELA fully built** — every page bespoke (Home/Suites/Suite-detail/Specials/Special-detail/Contact/
>   About/Experiences/Gallery/Journal/Article/Thank-you), preset `hotel`, scope `.sb*`. 3 themes now complete
>   (OceansView, Marmalade, Sabela).
> - **Sabela About** (`254b955`): the host/team section now ALWAYS renders (honest generic fallback when no
>   host bio) — was omitted → page looked sparse vs the reference.
> - **Sabela Suite-detail** (`254b955`): rebuilt to the OceansView room-detail architecture (breadcrumb →
>   hero gallery → 2-col overview + STICKY book card → facts/specs/amenities → seasonal → good-to-know →
>   reviews w/ rating-distribution → other suites). Verified: sticky card, 3 reviews + bars, 2 other suites.
> - **Sabela Contact** (`aa02a30`): rebuilt per OceansView — prominent quote FORM + "How to reach us" details
>   card (addr/phone/email) + full-width MAP + FAQ; dark fields legible (muted placeholder, gold focus).
> - **Checkout legibility** (`254b955` fields + `317dac9` card): shared SiteCheckoutForm — muted placeholder +
>   gold focus ring + border nudged toward ink; and on DARK themes the form/summary cards lift to a lighter
>   warm-brown panel (`color-mix surface + 8% ink`, gated on `siteSurfaceIsDark` from the route) so they stand
>   off the ebony page while inputs stay dark inset wells. Marmalade's light checkout unchanged. Verified:
>   card rgb≈(45,42,35) > page rgb(20,18,13).
> - **FLOATING SOCIAL RAIL** (`d8eb503` component+wiring, `f2ff6b8` settings toggle): NEW shared, theme-token
>   `components/site/SiteSocialRail.tsx` — collapsible left-edge vertical bar of the host's socials
>   (ig/fb/x/yt/li/website), mobile-aware, works light+dark. Rendered by `SiteChrome` on EVERY theme when
>   `brand.showSocialRail` (reads `settings.socialRail.enabled`) AND ≥1 social link is set. Host toggle added
>   to Website→Settings (`schemas.ts`+`actions.ts`+settings `page.tsx`/`SettingsForm.tsx`). **NOT live-seen on
>   mana** — mana has no social links set + toggle off, so it correctly renders nothing; needs a host with
>   real socials + the toggle on to appear.

> **FIX `99003e0` (preview-theme carry) — affects ALL themes' preview.** The nav href helpers
> (`siteBookHref`/`siteRoomHref`/`siteSpecialHref`/`siteSearchHref` in `lib/site/loadSitePage.ts`) dropped the
> `?theme=<slug>` gallery-preview param, so clicking Book/room/offer/search from a themed preview navigated to
> the destination WITHOUT the theme → it rendered the SITE's stored theme (e.g. Marmalade preview → OceansView
> checkout). Now they append `&theme=<previewThemeSlug>` when set. Checkout/search are token-themed BY DESIGN
> (no bespoke per-theme layout) — they now inherit the previewed theme's colours/fonts/chrome. Verified: Book
> from marmalade preview → `/book` renders `.mmchrome` + `--site-bg #F4ECDB` + `--site-accent #C8702E` + Gloock.
> **(Correction:** the PREVIEW TOOLBAR chips (`.pb-link`) are NOT broken — I mis-flagged them. Their raw
> `href` is tenant-relative with no params BY DESIGN; the client interceptor `SitePreviewLinks.tsx` adds
> `site`+`preview`+`theme` on every internal click. Verified: clicking a preview-bar chip keeps the theme.
> No fix needed there.)
**This file is COMMITTED. Commit + push it before ending any session.**

---

## 🎯 THE PLAN (founder's phasing — do them IN THIS ORDER)

1. **PHASE 1 — Pixel-perfect design for EVERY theme × EVERY page (incl. header + footer).** ✅ **DONE**
   All three designed themes complete + live-verified: **OceansView, Marmalade, Sabela** — every page bespoke.
   (Only 3 themes have reference designs; no 4th exists.) The checkout + search are token-themed BY DESIGN
   (they inherit each theme's colours/fonts/chrome, no bespoke per-theme layout — founder accepted this).
2. **PHASE 2 — Wire in the AI-wizard TEXT + IMAGES** per page ← **WE ARE HERE NEXT** (each page pulls the content from its relevant
   wizard step — `content_profile` + assembled live data). Some of this is already wired on OceansView
   (hero/story/experiences/faq from `content_profile`); Phase 2 makes it complete + correct on every theme.
   - **Phase-2 IDEA (founder, 2026-07-19) — auto-draft EXPERIENCES from the LISTING's address.** Use the
     LISTING/property's OWN address (`properties.address_line1…` — the actual establishment), NOT the
     `businesses`/settings business address (founder correction). Geocode the property if it has no lat/long
     → fetch REAL nearby POIs from free geodata (Overpass/OpenStreetMap;
     Wikivoyage for regional colour; Google Places later as a paid upgrade) → ground Claude on that verified
     list to write 4-6 on-brand experiences ("use ONLY these places, omit if unsure") → present as **drafts
     the host approves** (never silent auto-publish), cache into `content_profile.experiences`. Do NOT scrape
     Google's SERP; AI alone isn't "latest" (needs a live source). Displays through the already-built bespoke
     Experiences pages. Full write-up in memory `[[experiences-ai-autopopulate-idea]]`.
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
- **Marmalade — HOME page bespoke + live-verified** (`326e908`) — first Marmalade PAGE (chrome
  already existed). `marmalade/MarmaladeHome.tsx` + `marmaladeHome.css` (scoped `.mmhome`), ported
  class-by-class from `docs/themes/marmalade/pages/Home.html` + `theme.css`. Same prop interface as
  `OceansViewHome` + a `location` prop. Sections (in order): postcard HERO · availability bar
  (shared `BookingSearchSection`, self-themed) · intro split · rooms postcards (live) · highlights
  (3 static direct-booking value cards) · taped gallery (live) · reviews (live) · "Finding us"
  location (live address + POIs + map iframe, conditional) · CTA banner. Routed in `SitePageView`
  behind `preset === "marmalade" && page.kind === "home"`. **Verified on mana** via
  `?site=mana&preview=1&theme=marmalade` (DOM + computed-style + layout-integrity): `.mmhome` mounts
  in `.mmchrome`, 9 sections in order, live rooms (Leadwood/Marula/Tamboti + real prices), 6 gallery
  photos, 3 reviews, address "Hazyview, Mpumalanga, ZA"; Gloock/Caveat fonts + terracotta `#C8702E`
  accent + cream `#F4ECDB` bg all applied; no hidden/opacity-0 content, zero horizontal overflow.
  (Screenshots kept timing out — the documented flakiness; DOM/computed-style is the reliable path.)
- **Marmalade — Rooms + Room detail + Specials + Special detail + Contact** all bespoke + LIVE-VERIFIED
  (`6561ebd`). Components in `components/site/marmalade/`: `MarmaladeRooms` (`.mmrooms`),
  `MarmaladeRoomDetail` (`.mmroom`, reuses the shared `OceansRoomGallery` + `OceansBookCard`, re-skinned
  under `.mmroom` — does NOT import oceansRoom.css), `MarmaladeSpecials` (`.mmspecials`),
  `MarmaladeSpecialDetail` (`.mmsd`, bespoke — no reference HTML existed; carries the special-locked
  checkout href like OceansView), `MarmaladeContact` (`.mmcontact`) + `MarmaladeContactForm` (client, posts
  to `/api/website-enquiry`). Wired: SitePageView (rooms/specials/contact), SiteRoomView + SiteSpecialView
  (`preset === "marmalade"`). Prop interfaces mirror the OceansView components 1:1 so each branch is a
  near-copy. Verified on mana (`?site=mana&preview=1&theme=marmalade`, DOM + a real screenshot): live rooms
  (Leadwood/Marula/Tamboti + prices + facts + 2-line-clamped blurbs + "We'll pick for you" card), room
  detail (gallery + book card 4.7★ R4 850/night + 2 other rooms + 3 reviews), specials (3 live offers),
  special detail (facts + book href + more offers), contact (form + info card + map). **100% responsive
  verified** via the loaded `@media` rules: every grid collapses (…@1040 →1@560), the room/special book-card
  `aside` goes `position:static` @860 (stacks below content), card tilts reset on phones; zero horizontal
  overflow on every page at desktop.
- **CONTACT phone + email on ALL themes** (`6561ebd`): `assembleSiteDataByType`'s `location` block now
  falls back from the wizard's `brand.contact` to the OWNING HOST ACCOUNT's phone/email
  (`businesses.host_id → hosts.user_id → user_profiles.{phone,email}`) when the wizard fields are empty.
  So the contact section always offers a real way to reach the host, not just an address. Live-verified on
  mana: BOTH OceansView contact (address + `+27 …` phone + `…@manamarketing.co.za` email, 3 info rows) AND
  Marmalade contact (same, as `tel:`/`mailto:` links) now show all three. Applies to every theme's contact
  (generic `LocationSection` already rendered phone/email when present — the fix was the DATA).
  Marmalade contact's reference "reassurance" note was dropped (founder previously preferred the guest-review
  card carry that column — see the OceansView contact `c1814b2` precedent).
- **Marmalade — About + Experiences + Gallery + Journal (index) + Article** all bespoke + LIVE-VERIFIED
  (`96c5144`). `MarmaladeAbout` (`.mmabout`), `MarmaladeExperiences` (`.mmexp`), `MarmaladeGallery`
  (`.mmgallery`), `MarmaladeJournal` (`.mmjournal`), `MarmaladeArticle` (`.mmarticle`). Wired: SitePageView
  (about/experiences/gallery), blog index (`app/[locale]/site/blog/page.tsx`) + article
  (`…/blog/[postSlug]/page.tsx`) behind `preset === "marmalade"`; prop interfaces mirror the OceansView
  components 1:1. **pageHasHero:** About + Experiences + Article open full-bleed (true); Gallery + Journal
  index open with a plain head (false — faithful to the marmalade references). Verified on mana
  (`?site=mana&preview=1&theme=marmalade`, DOM + media-rule checks): About ("A house with stories"),
  Experiences (empty-state — mana has no experiences content), Gallery (43 live photos), Journal (2 real
  posts), Article (17-para body + related). Zero horizontal overflow on every page; responsive `@media`
  collapse rules present (grids …@1040 →1@560, splits →1@860, tilts reset on phones).

- **Marmalade — THANK-YOU** bespoke + live-verified (`2980e39`). `MarmaladeThankYou` (`.mmty`) — the FIRST
  bespoke thank-you on any theme. Full-bleed hero + tilted postcard card, animated check (green confirmed /
  amber pending clock), reference chip, dashed booking summary, CTAs. ONE component serves BOTH routes:
  - `app/[locale]/site/book/thank-you/page.tsx` (booking): dispatches `MarmaladeThankYou` (OUTSIDE the host
    `BookingStyleOverlay`, like the other bespoke pages) vs the generic `BookingConfirmationCard`. Confirmed →
    Total paid row; EFT-pending → amount folded into a row + banking-details block. **All FirePurchase / Meta
    CAPI / payment-settle logic left untouched.**
  - `app/[locale]/site/thank-you/[[...goal]]/page.tsx` (form/goal): summary-less variant; the goal pixel
    (Lead/Subscribe via FirePixelEvent) still fires; generic themes keep the simple card.
  - `pageHasHero=true` for marmalade so the full-bleed hero rides under the pill.
  - **Verified live** (goal variant): `…/site/thank-you/quote?site=mana&preview=1&theme=marmalade&name=Jane`
    → `.mmty` in mmchrome, "Thanks, Jane", green `--site-seal` check, CTAs, tilted card, `@560` un-tilt +
    full-width CTAs, zero overflow. **BOOKING variant is code-complete + tsc/lint green but NOT live-seen** —
    that route has no `?theme=` preview and needs a real Marmalade site + paid booking (doesn't exist
    pre-launch); it reuses the SAME verified component with extra summary props.

  **➡ MARMALADE IS 100% COMPLETE** — every page bespoke: Home, Rooms, Room detail, Specials, Special detail,
  Contact, About, Experiences, Gallery, Journal (index + article), Thank-you. **NEXT: start SABELA**
  (preset `hotel`, scope `.sb*`; chrome already done). Same build pattern — port each page from
  `docs/themes/sabela/pages/*.html` (note: Sabela's stylesheet is `theme.source.css`; rooms are labelled
  "Suites"), template off the matching OceansView/Marmalade component, wire behind `preset === "hotel"`.

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
Thank-you. **Marmalade DONE + live-verified: Home, Rooms, Room detail, Specials, Special detail, Contact, About,
Experiences, Gallery, Journal (index + article).** ONLY **Thank-you** remains for Marmalade — and no theme
has a bespoke thank-you yet (see the THANK-YOU section; logic/events exist, design missing). After Marmalade
Thank-you, start **Sabela** (preset `hotel`, `.sb*`). Sabela's generic contact already shows phone/email now
(the data fix is theme-agnostic).

### THANK-YOU (part of Phase 1) — the logic already exists, only the DESIGN is missing
Routes: `app/[locale]/site/book/thank-you` (booking → **Purchase** pixel event) and
`app/[locale]/site/thank-you/[[...goal]]` (form goals **contact/quote/custom**, each fires **Lead**, host
per-form copy overrides the goal defaults). Both sit in `SiteChrome` (theme chrome ✓) + fire tracking
events ✓. **Missing = the bespoke pixel-perfect design** (`Thank You.html` exists in every theme folder).
Build `<Theme>ThankYou` over the existing goal/event/copy logic. (Founder's "3 thank-you pages" =
booking / contact-quote / custom — already modelled by the goal templates.)

---

## 📐 CARD CONVENTION (founder, 2026-07-19 — applies to EVERY theme)

Room cards + special/offer cards clamp their **description to 2 lines** so cards stay uniform and
tidy (long host copy must never make one card tower over its neighbours). Larger alternating-row /
split feature layouts (not compact cards) clamp to **3**. CSS: `display:-webkit-box;
-webkit-line-clamp:2; line-clamp:2; -webkit-box-orient:vertical; overflow:hidden` (or Tailwind
`line-clamp-2`). Already applied to OceansView + Marmalade + the generic sections; **build every new
bespoke card this way.** Also in `DESIGN_SYSTEM.md` Hard rules.

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
