# Theme Contract — how every theme plugs into the Vilo Website CMS

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
   class (`.vilo-safari`).
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
**conform it to this contract** so it becomes a fully functional Vilo theme
(editable in the builders, data-bound, forms→inbox, analytics, publishable). The
whole point of the layering + the contract above is to make that conformance a
**mechanical slot-filling exercise**, not bespoke engineering each time.

**Conformance workflow (what "conform an uploaded design" means, step by step):**
1. **Scope the CSS.** Wrap every selector under one theme root `.vilo-<t>`
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

## Rule of thumb when building

Before adding a nav/header/menu/section capability, ask **"which layer?"**:
- A new host-configurable option → **schema** (shared) + **builder control** (shared)
  + each theme's render honours it (Safari first, as the reference).
- Never bury a host option inside one theme's render. Never re-implement a builder
  per theme. Keep `header = the bar`, `menu = the links`.
