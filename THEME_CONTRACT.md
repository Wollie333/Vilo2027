# Theme Contract — how every theme plugs into the Wielo Website CMS

> **Why this exists.** Safari (NenGama Lodge) is the **reference theme**. Everything
> the CMS and the builders do is designed so a *new* theme is "scope the design,
> reuse the engine": you write a **render layer + scoped CSS** and honour a fixed
> **contract**; you do **not** re-implement builder UI, schema, data binding,
> forms, analytics, or per-page settings. This doc is the contract + the checklist.
> See also the `theme-productionization-playbook` memory and `WEBSITE_CMS_PLAN.md`.

## The three layers (which layer does each change live in?)

1. **Shared contract (theme-agnostic, stored in the DB).** Zod schemas in
   `app/[locale]/dashboard/website/schemas.ts` + the types in `lib/site/types.ts`.
   This is the SSOT of *what a host can configure*. Stored on `host_websites`
   (`navigation`, `brand`, `theme`, `seo`, `settings`) and `website_pages`
   (`draft_sections`/`published_sections`, `seo_overrides`). **Additive, jsonb —
   no migration to add a field.** A new theme adds nothing here; it *consumes* it.

2. **Shared builder UI (theme-agnostic).** One set of editors drives every theme:
   - **Header builder** — `NavSectionEditor` + `NavInspectors.HeaderInspector`.
   - **Menu builder** — `MenuStudio`.
   - **Footer builder** — `NavSectionEditor` + `FooterInspector`.
   - **Page builder** — `PageBuilder` + `SectionEditor` + `PageSeoCard`.
   These write the shared contract. **Work here benefits ALL themes for free** —
   e.g. menu drag-and-drop, a new inspector control. The builders render the REAL
   theme chrome as the live preview (see "Live preview" below), so they are WYSIWYG.

3. **Per-theme render layer (the only thing a new theme writes).** A self-contained,
   scoped render that consumes the shared contract and paints it in the theme's
   design. Safari's lives in `components/site/safari/` (`SafariShell`, `SafariNav`,
   `SafariSiteView`, `SafariSections`, `safari.css`) + the nav-model resolver
   `lib/site/safariNav.ts`. **Generic themes don't write one** — they fall back to
   the shared `SiteChrome` + `SectionRenderer`, which already honour the contract.

## What a NEW bespoke theme implements (checklist)

A theme that needs a fully custom look (like Safari) implements only:

1. **A nav-model resolver** — the `buildSafariNav(ctx)` pattern in
   `lib/site/safariNav.ts`. **This logic is theme-agnostic** (it just reads
   `navigation` into a normalized model) — copy it, or factor a shared
   `buildNavModel` when the 2nd bespoke theme lands. It MUST surface every header
   + menu setting in the contract table below.
2. **A shell + nav + footer render** — the `SafariShell` / `SafariNav` pattern:
   consume the nav model, honour every setting, scoped under a single theme root
   class (`.wielo-safari`).
3. **Section bands + a `renderXxxSection` dispatcher** — the `SafariSections`
   pattern: one component per section `type`, dispatched by type, bound to live
   data (rooms/posts/reviews/forms), with stock fallbacks. Wire it into
   `SectionRenderer`/`SectionSwitch` (the `themeVariant` branch) so the builder
   canvas and the public site share ONE renderer (no drift).
4. **Scoped CSS** — one stylesheet scoped under the theme root. Port any page-level
   `<style>` from the design mockups (recurring fidelity bug — see playbook).
5. **Mount it** — `SitePageView` + `SiteRoomView` + the blog/book/thank-you routes
   branch to the theme when active (mirror the `activeThemeSlug === "safari"` checks).

Everything else — forms→thank-you, Meta Pixel, per-page settings, publish/snapshot,
nav builders — **already works** through the shared layers.

## The header + menu settings contract (a theme MUST honour all of these)

Stored under `navigation` (`navigation.header.*`, `navigation.menuStyle.*`). The
Safari render (`SafariNav` + `buildSafariNav` + `safari.css`) is the reference
implementation for each. A new theme honours the same keys in its own styling.

### `navigation.header.*` (Header builder)
| Key | Controls | Safari reference |
| --- | --- | --- |
| `layout` | classic / centered / split / minimal — where logo·menu·book sit | `.lay-*` CSS, DOM order constant |
| `sticky` | keep header pinned on scroll vs scroll away | `.nav-static` + topPad logic |
| `transparentOverHero` | transparent-over-hero → solid on scroll, vs solid from top. **OPTIONAL in schema** (unset = theme decides: generic solid, Safari transparent) | `over-hero`/`solid` classes |
| `bgColor` / `scrolledBgColor` | solid-bar / scrolled-bar background; auto contrast text by luminance | inline header style + `isDarkColor` |
| `showLogo` | show the logo mark/image vs name-only wordmark | `renderBrandInner` |
| `logoStyle` | wordmark / icon / mark (unset = design default) | `renderBrandInner` |
| `logoMaxHeight` | logo image **and** monogram size (scaled font) | inline width/height/fontSize |
| `tagline` | small subtitle beside the brand | `.brand-name small` |
| `showBookCta` / `ctaLabel` / `ctaHref` / `bookCtaColor` | the Book button (single source — NOT in the menu builder); custom colour persists on hover | `nav-book-custom` scoped rule |

### `navigation.menuStyle.*` (Menu builder)
| Key | Controls | Safari reference |
| --- | --- | --- |
| `color` / `hoverColor` / `weight` / `uppercase` | top-level link styling | `menuStyleCss` → `.nav-links a` |
| `submenuColor` / `submenuHoverColor` / `submenuBg` | dropdown (sub-menu) item + panel styling, separate from the top level | `menuStyleCss` → `.nav-dd-menu` |
| `align` | menu alignment within its header slot (start/center/end) | layout CSS |
| `itemGap` | spacing between top-level links (px) | `.nav-links { gap }` |

`navigation.menu` (the link tree, incl. `autoRooms`/`hiddenRoomIds`) +
`navigation.header.menuCollapse` (mobile/tablet/never) + `navigation.topBar` +
`navigation.footer` are likewise rendered by the theme. **`menuCollapse` is a
*menu* concern — it lives in the Menu builder (Layout tab), not the Header builder.**

## Live preview standard (the builders are WYSIWYG)

The nav builders render the **real theme chrome** as the canvas (`SafariShell` +
a stock hero), built from the live edit state, so edits show instantly and match
the published site. The header preview is a **bounded, scrollable viewport with a
sticky header** (`.nav-scroll-preview` in `builder.css`) so the host can preview
the scroll interaction (transparent→solid + scroll background) exactly as live.
A new theme gets this by rendering its shell in the same canvas slot.

## The 6 productionization slices (replay per theme)

`render-layer · pages · chrome · forms+thank-you · pixel · per-page-settings`.
Slices 4–6 (forms→inbox/thank-you, Meta Pixel, per-page marketing) are **fully
shared** — a new theme inherits them by rendering the shared `FormSection` /
`SiteMarketing` / `FirePixelEvent` / `PageHeadCode` (Safari does this via a
`--site-*`→theme token bridge for forms). Only slices 1–3 are theme-scoped.

## ★ The north star: conform an uploaded theme design (HTML / CSS / JS)

**The end goal of the Website CMS (founder, 2026-06-27, "the most important aspect"):**
a designer hands over a raw theme — `*.html` pages + `*.css` + `*.js` — and we
**conform it to this contract** so it becomes a fully functional Wielo theme
(editable in the builders, data-bound, forms→inbox, analytics, publishable). The
whole point of the layering + the contract above is to make that conformance a
**mechanical slot-filling exercise**, not bespoke engineering each time.

**Conformance workflow (what "conform an uploaded design" means, step by step):**
1. **Scope the CSS.** Wrap every selector under one theme root `.wielo-<t>`
   (or compile it scoped). Port any page-level `<style>` blocks too. Nothing leaks.
2. **Kill / replace the JS.** Theme JS is almost always nav toggles / sliders /
   scroll effects → re-implement with our React behaviour (the `<T>Nav` scroll/
   drawer pattern, shared lightbox, etc.). We do NOT ship arbitrary uploaded JS.
3. **Carve the markup into section bands.** Map each visual block in the design to
   one of our section `type`s (hero, intro, highlights, rooms_preview, gallery,
   reviews, location, cta, host_bio, faq, amenities, pricing, contact_form, form,
   blog_preview, rate_table, room_* …). One component per band in
   `<T>Sections.tsx`, content from section props (stock fallback baked in), bound
   to live data. Wire the `render<T>Section` dispatcher into `SectionRenderer`.
   *If a design has a block we have no type for, add a new shared section type
   (schema + inspector + generic render) — that's a layer-1/2 add every theme then
   gets, NOT a theme-private hack.*
4. **Carve the chrome.** Header/nav + footer → a `<T>Shell` + `<T>Nav` that honour
   the **header/menu settings contract table** above. This is the most contract-
   heavy part — the table is the checklist.
5. **Bind data + mount.** Suites→real rooms, journal→real posts, contact→real
   brand, forms→`FormSection`/thank-you, analytics→`SiteMarketing`. Branch the
   routes (`SitePageView` etc.) to the theme when active. Seed templates in
   `lib/website/themeSections.ts`.
6. **Verify each slice live** (tsc + lint + vitest + Preview MCP), commit per slice.

**What makes this fast (and what to keep investing in):**
- A **complete shared section-type catalogue** — the more design blocks already
  have a type + inspector + data binding, the less per-theme work. Growing this is
  the highest-leverage investment toward one-click theme import.
- A **theme scaffold** — a skeleton `<T>Shell`/`<T>Nav`/`<T>Sections` with empty
  slots to drop the uploaded markup + scoped CSS into. (Build this when the 2nd
  bespoke theme lands, factored from Safari.)
- The **settings contract table** staying authoritative — a new theme's chrome is
  "implement these N rows," nothing more to discover.
- Eventually: a **conformance checklist / generator** that, given the uploaded
  files, scaffolds the theme folder + scoped CSS + stub bands to fill.

Until that tooling exists, conformance is **this document, executed by hand per
theme** — which is already far faster than designing from scratch, because every
non-styling concern is shared.

## ★ The canonical page set every theme MUST ship (2026-06-30)

> **Why this exists.** A theme is *a blueprint of existing sections* + *a scoped
> render layer* — never new page infrastructure. This is the fixed list of pages
> every theme ships, so converting an uploaded design is "map its pages onto this
> list and fill each page's `sections[]`". The blueprint lives in
> `site_themes.page_templates` (jsonb) — same shape as the Safari migration
> `20260625050000_add_safari_theme.sql`. The seeder is `seedWebsiteContent()` in
> `app/[locale]/dashboard/website/actions.ts` (uses `theme.pageTemplates`, else a
> hardcoded starter fallback).

Pages fall into **two classes**. **Class 1 (marketing)** varies section
content/order per design and appears in the nav. **Class 2 (system templates)**
keeps a *fixed section spine* (so the booking engine binds reliably), never
appears in nav, and is edit-only in the Page Manager — but still renders in the
theme's scoped CSS. Data-bound sections are **bold**; they auto-hide when the host
has no data (e.g. no specials → the Specials block renders nothing).

### Class 1 — Marketing pages (host-editable, in nav)

| Page | `kind` | Req? | Section spine (data-bound in **bold**) |
| --- | --- | --- | --- |
| **Home** | `home` | required | hero · *(optional inline `booking_search`)* · intro · highlights · **rooms_preview** · **specials_preview** · **gallery** · **reviews**/**trust** · **location** · cta |
| **About** | `about` | required | hero · intro · host_bio · highlights · **gallery** |
| **Rooms / Suites** | `rooms` | required | intro · **rooms_preview** · **amenities** · **rate_table** (or pricing) · cta |
| **Specials** | `specials` | required | intro · **specials_preview** (full grid) · cta |
| **Experiences** | `experiences` | required | hero/intro · highlights · **gallery** · cta *(activities/things-to-do; premium lodge staple)* |
| **Gallery** | `gallery` | required | intro · **gallery** (full grid / masonry) · cta |
| **Contact** | `contact` | required | intro · **form** *(the modern `form` element — NOT legacy `contact_form`)* · **location** · faq |
| **Journal / Blog** | `blog` | **optional** | intro · **blog_preview** *(theme MAY include; not required)* |

### Class 2 — System templates (auto-driven, edit-only, NOT in nav)

| Template | `kind` | Spine | Notes |
| --- | --- | --- | --- |
| **Search Results** | `search_results` | bound **`booking_search`** (pre-filled from query) · **results list** (matched rooms: price/availability → Book) · empty-state · cross-sell **specials_preview** | `booking_search` routes HERE, then Results → Checkout. |
| **Room Detail** | `room_detail` | **room_gallery** · **room_overview** · **room_amenities** · **room_rate** (Book) · **room_policies** · cross-sell **rooms_preview** | Per-room override layer (`website_rooms.detail_overrides`). |
| **Checkout** | `checkout` | themed booking flow: dates · rooms · **add-ons** · guests · coupon · contact · payment, + **theme-scoped modals** (T&Cs, date picker, progress) | Shares `createBookingCore`/`priceBooking` with the app. |
| **Thank-you** | `thank-you` | confirmation · booking summary · next-steps (per conversion goal) | — |

### The conversion rule (what makes a new theme mechanical)

A theme's `page_templates` MUST contain entries for **all required Class 1 pages**
(7: home/about/rooms/specials/experiences/gallery/contact) **+ all Class 2
templates** (4: search_results/room_detail/checkout/thank-you). Blog is optional.
For each page, map the design's visual blocks onto our section `type`s and emit
them as the page's `sections[]`. Marketing pages may reorder/add any shared
section; system templates keep their spine so data binding holds. If a design has
a block we have no `type` for, **add a shared section type** (schema + inspector +
generic render + Safari band) — a layer-1/2 add every theme inherits, never a
theme-private hack (see the north-star workflow above).

System pages are NOT shown in the website nav (`show_in_nav: false`) and surface in
the Page Manager's **"System templates"** group (edit-only, no delete); Class 1
pages surface under **"Site pages"** (reorderable, nav-toggle, add/delete custom).

## Shared layer additions (2026-06-30) — every theme inherits these

These landed in the shared layers (schema + generic render + Safari band), so a
new theme gets them for free; a bespoke theme's `render<T>Section` should dispatch
them (or fall through to the generic fallback, which already handles them):

- **`addons_preview` section** — auto-pulls the host's active add-ons (scoped to
  the site's properties via `listing_addons`) as cards. The add-ons content
  surface for marketing pages. Data: `loadAddonsPreview` → `AddonsPreviewData`.
- **`search_results` section + system page** — a self-contained search form that
  quotes every bookable property live (`/api/website-quote`) and lists matches.
  Seeded as the `search_results` **system template** (Class 2). `booking_search`
  links here on multi-property sites (`BookingFunnelData.searchHref`).
- **`SiteThemeModal`** (`components/site/SiteThemeModal.tsx`) — THE way to render
  a booking-flow modal (T&Cs, date picker, progress). It renders INLINE so it
  inherits `--site-*` from `SiteThemeRoot`. **Never use the app's Radix
  `PolicyDialog`/portal-to-`<body>` on a site** — it escapes the theme and renders
  in the app's brand styling. The on-site checkout's terms modal is the reference.
- **`mergeStandardPages`** (`lib/website/standardPages.ts`) — guarantees the
  required page set. A theme's blueprint only needs the pages it wants to
  art-direct; every required marketing page + the system templates it omits are
  filled with a default spine that still renders in the theme's scoped CSS. **A new
  theme therefore does NOT re-list the whole page set** — it overrides by `kind`.

## Rule of thumb when building

Before adding a nav/header/menu/section capability, ask **"which layer?"**:
- A new host-configurable option → **schema** (shared) + **builder control** (shared)
  + each theme's render honours it (Safari first, as the reference).
- Never bury a host option inside one theme's render. Never re-implement a builder
  per theme. Keep `header = the bar`, `menu = the links`.

## Menu / nav customization standard (2026-06-27 — the locked way it works)

This is **the standard every theme must comply with.** The menu/nav builder was
built to this shape; new themes implement only their render layer (§3) and inherit
all of it.

**1. The canvas previews the REAL site.** The header/menu/footer editors render the
host's **actual page** (real chrome + real sections) behind the **live** menu, not
a stylised mini-preview or a stock hero. Safari → `SafariNavCanvas` (real
`SafariShell` + `SafariSectionList`); generic → `SiteChromeCanvas` (real
`SiteThemeRoot > SiteChrome > SectionRenderer`). A new theme's canvas reuses its
own public render components the same way. A **page switcher** (top bar,
`NavBackdrop`) picks which real page sits behind the menu.

**2. Everything is per-device (responsive), live.** The device switcher
(desktop/tablet/mobile) drives which layer the controls edit. The render emits the
live site's `@media` rules AND, in the builder, the active device's merged style
as **flat CSS** via a `previewDevice` prop — so the canvas reflects the chosen
screen size instantly (no media-query-vs-viewport mismatch). Mirror this for any
responsive-in-canvas styling.

**3. Three customization axes, all additive jsonb (no migration):**
- **Global menu style** — `navigation.menuStyle` (+ `tablet`/`mobile` layers).
- **Per-LINK style** — `SiteMenuItem.style` (`MenuItemStyle` = desktop base +
  `tablet`/`mobile`): colour/hover/size/weight/uppercase + background/pill. Render
  via a stable `mi-<id>` class + scoped CSS (`SafariNav.menuItemStyleCss` /
  `SiteChrome.menuItemStyleCss`).
- **Per-PAGE rules** — `SiteMenuItem.hiddenOnPages` (show/hide per page) +
  `navigation.perPage[pageKey]` (appearance + style override per page). The page
  key (`lib/site/menuPage.ts pageKeyFor`) is shared by `buildSafariNav(ctx,
  pageKey)`, `SiteChrome`'s `currentPageKey`, and the canvas backdrop.

**4. Transparent-over-hero headers have TWO colour states.** When a header is
transparent over the hero, the menu (and bar) carry a separate **over-hero** colour
and **scrolled/solid** colour — Safari renders the scrolled colour under
`.nav.solid`. A new theme with a transparent-on-hero header must honour both
(`menuStyle.color`/`scrolledColor`, `navigation.header.bgColor`/`scrolledBgColor`).

**5. Every styling field resets to the theme default.** Each control offers a
reset that clears the host override (→ `undefined` = inherit the theme's default
styling). Builder controls own this; the render simply omits unset fields.
