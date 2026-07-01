# Builder V2 — Standardized Wielo Block Builder (Redesign Plan)

Status: **PLANNING — not yet approved.** No code until the founder signs off.
Author anchor: 2026-07-01. Supersedes the "curated, NO freeform drag-drop" decision in `WEBSITE_CMS_PLAN.md`.

---

## 1. The vision (founder's words, distilled)

Stop building **theme-specific blocks**. Build **standardized Wielo blocks** — one fixed
vocabulary of website elements (room grid, room card, booking bar, date search, search bar,
reviews, specials, map, gallery, heading, text, button, image, etc.) that the host drags onto a
canvas and styles. **Every block is theme-agnostic.** The active theme supplies only colours,
fonts and design direction as tokens; the *same blocks always exist regardless of theme.*

Outcome: a single, decluttered, enterprise-grade custom web builder that opens as its **own
full-screen page** (not inside the Wielo dashboard), pixel-perfect to the supplied prototype.

### Decisions locked (2026-07-01)
1. **Clean break, no migration.** Pre-MVP, no real users. Discard old builder documents and
   re-seed each theme's standard pages directly into the new block model.
2. **Pure token-driven theming.** One shared component per block; a theme is a **token set**
   (palette, fonts, radius, shadow, spacing) + a **blueprint** (which pages/sections/variants +
   starter copy). No per-theme block component files.
3. **Keep shared layout variants.** Each block ships several built-in layout variants; a theme's
   blueprint picks the default variant + tokens. Still zero per-theme component code. Preserves the
   distinct feel of Safari / Sabela / Oceans View / Marmalade.
4. **Header + menu keep the Nav-builder as source of truth** — but presented inside the new UI.
   Rewire/redesign the existing Nav builder + header settings into the new `.bse-*` overlay chrome;
   do NOT re-implement header/menu as freeform widget trees. `navigation` JSONB stays the SSOT.
5. **Delete the four bespoke theme dirs outright** in Phase 2 (git history is the archive).

---

## 2. What the prototype actually is

A schema-driven, Elementor/Webflow-class builder. One JSON document per page is the single
source of truth: `root → section → column → widget`. The canvas and navigator render from it; the
inspector reads/writes the selected node. Widgets are **design-agnostic** — a fixed class
vocabulary — and the theme is injected as tokens at render time (`brandize()` / `--site-*`).

Prototype inventory (all working in the supplied files):

- **Chrome:** emerald topbar (`--secondary #064E3B`, 54px), 332px left panel, standalone app.
- **Topbar:** document switcher (Page / Header / Footer), Templates dropdown, device toggles,
  undo/redo/reset, Brand Studio, Page Settings, Preview, Publish split-button.
- **Left panel, 3 footer modes:** Widgets (grouped library + search) · Navigator (tree) · Settings.
- **Widget groups:** Layout · Basics · Media · Site parts · **Wielo blocks**.
- **Canvas:** nested render, drag-drop with drop-lines, per-element badge (grip / up / down /
  duplicate / delete), inline select, section-structure modal.
- **Inspector:** Content / Style / Advanced tabs, device bar (desktop/tablet/mobile) with
  per-device overrides (size, align, spacing, order, hide), per-field revert-to-default.
- **Overlays (shared `.bse-*` chrome):** Theme Settings, Nav/Menu builder (matches locked nav
  standard), Brand Studio, Page Settings (SEO / social / tracking / custom code).
- **Extras:** Tweaks FAB (builder chrome theming), toasts, keyboard shortcuts.

---

## 3. The core reconciliation — old model → new model

### 3.1 Page document shape
Current: `website_pages.draft_sections` / `published_sections` = **flat `WebsiteSection[]`** with
`columns` / `flex` container types. New: an **explicit nested document** (clean break allows the
reshape). Stored in the same JSONB columns.

```ts
PageDoc  = { root: RootNode; meta: PageMeta }        // meta = SEO/social/tracking (existing shape)
RootNode = { id; type:'root'; kids: SectionNode[] }
SectionNode = { id; type:'section'; kids: ColumnNode[]; bg; maxw; space; inner?; ...responsive }
ColumnNode  = { id; type:'column'; span; kids:(WidgetNode|SectionNode)[]; dir;justify;align;gap;wrap }
WidgetNode  = { id; type: WidgetType; props; tone?; variant?; space; ...responsive; style? }
```

Keep the existing `tone`, `variant`, `responsive`, `style` concepts on `WidgetNode` — they already
express everything the prototype's Style/Advanced/Responsive tabs need.

### 3.2 Widget vocabulary ↔ existing section types (reuse, don't reinvent)
The prototype's widgets map almost 1:1 onto types that **already exist** in
`lib/website/sections.schema.ts`. Mapping:

| Prototype widget | Existing type            | Action |
|------------------|--------------------------|--------|
| heading          | `el_heading`             | reuse |
| text             | `el_text`                | reuse |
| button           | `el_button`              | reuse |
| image            | `el_image`               | reuse |
| divider          | `el_divider`             | reuse |
| spacer           | `el_spacer`              | reuse |
| gallery          | `gallery`                | reuse |
| video            | `video`                  | reuse |
| rooms (grid)     | `rooms_preview`          | reuse |
| booking bar      | `booking_search` (bar)   | reuse (variant) |
| date search      | `booking_search`/`availability_calendar` | reuse (variant) |
| reviews          | `reviews`                | reuse |
| map / contact    | `location` / `map`       | reuse |
| specials         | `specials_preview`       | reuse |
| **icon box**     | `el_icon`                | **NEW** (additive) |
| **room card**    | `el_room_card`           | **NEW** (single-room card) |
| **search bar**   | `booking_search` (search)| reuse (variant) or new small `el_search` |
| **logo**         | `el_logo` (site part)    | **NEW** |
| **nav menu**     | `el_nav` (site part)     | **NEW** |
| **social icons** | `el_social` (site part)  | **NEW** |

A small **Widget Registry** (`lib/website/widgets/registry.ts`) becomes the single source that
declares, per widget: label, group, icon, default props, which inspector controls it exposes,
whether it auto-populates (and what `SiteData` key it needs), and its render component. The
library, inspector, defaults, and renderer all read from this one registry.

### 3.3 Theme = tokens + blueprint (the big simplification)
Collapse the four bespoke render layers into **one token-driven render layer**. Each block is one
shared component that reads `--site-*` and supports the existing `variant` options. A theme becomes:

- **Token set:** palette (bg/surface/ink/mute/line/accent/accentInk), font stack, radius, shadow,
  spacing scale. (Extends today's `SitePreset`.)
- **Blueprint:** which pages, which sections/widgets per page, each widget's default `variant` +
  `tone` + starter copy. (Extends today's `themeSections.ts`.)

**Design variety is preserved through variants, not through per-theme code.** The distinctive looks
that make the four themes feel different (Marmalade's postcard hero + tilted/taped cards, Safari's
editorial hero, Oceans View's bright cards) become **shared block variants** any theme can select,
plus token values. No `SafariSections.tsx` / `MarmaladeShell.tsx` etc.

> ⚠️ Confirm interpretation: "pure token-driven" here means **one component per block, zero
> per-theme component files** — but each block keeps multiple **layout variants** (already in the
> schema) that a theme's blueprint picks. Without variants, all four themes would share one identical
> layout and only differ by colour. Recommended: keep variants (it is still zero per-theme code).

### 3.4 Header / footer / nav — keep the locked standard as source of truth
The prototype edits Header/Footer as builder "documents" AND has a Theme-Settings overlay AND a
Nav/Menu overlay — these overlap. In the real system the **Nav builder already is the locked
standard** (per-device, per-link, per-page, two-state colours, real-canvas preview) and it drives
the live site's sticky/mobile/menu behaviour via `host_websites.navigation` JSONB.

**Resolved (locked):** the header + menu stay governed by the Nav builder + header settings — the
`navigation` JSONB is the single source of truth. We **rewire and redesign** the existing Nav
builder + header settings into the new `.bse-*` overlay chrome so it *looks* like the prototype but
keeps the locked model. The document switcher's **Header** opens that reskinned Nav/header overlay;
the **Footer** document edits the existing footer-column config. Header/menu are NOT re-implemented
as freeform widget trees.

---

## 4. Gap analysis — HAVE vs BUILD

**Already have (reuse):** @dnd-kit drag-drop, undo/redo, device targeting, live WYSIWYG preview,
`variant` + `tone`, responsive + style overrides, Nav builder (locked standard), Brand Studio,
SEO/tracking page settings, publish snapshot + `mergeStandardPages`, auto-populate `SiteData`
assembly, `ThemedDateRange`, `SiteThemeModal`, generic `SectionRenderer` + `SiteChrome` +
`SiteThemeRoot`.

**Must build / change:**
1. Nested `section→column→widget` document model + Zod + widget registry (§3.1–3.2).
2. New widget types: icon box, room card, logo, nav, social (+ booking_search variants). Additive.
3. Token-driven render collapse; delete 4 bespoke theme dirs; themes → tokens + blueprint (§3.3).
4. Pixel-perfect builder shell (emerald chrome, topbar, 332px 3-mode panel, nested canvas with
   badges + drop-lines, structure modal, inspector with device bar + per-field revert, Tweaks FAB).
5. Widget library grouped + search; Navigator tree panel.
6. Overlays reskinned to `.bse-*`: Brand Studio, Nav, Theme Settings, Page Settings; Templates
   dropdown.
7. Re-seed the four themes' standard pages into the new model (clean break).
8. Delete the superseded old builder (`PageBuilder.tsx`, `SectionEditor`, `SectionLibrary`, the
   dashboard editor page routes it powered).

---

## 5. Phased build order

Each phase ends green (`pnpm build` + `pnpm lint` + vitest) and live-verified on the `vilotest`
fixture (`host@vilotest.com`), with a save-point commit + memory + CHANGELOG per the phase-savepoint
rule.

- **Phase 0 — Contracts & docs (this file).** Lock document model, widget↔type map, registry shape,
  token/blueprint theme model, header/footer decision. Rewrite the "NO freeform" decision in
  `WEBSITE_CMS_PLAN.md` + `DECISIONS.md`; update `THEME_CONTRACT.md` to the token+blueprint model.

- **Phase 1 — Model + registry + schema.** `PageDoc` Zod schema; widget registry; new widget types;
  `newSection`/defaults factories; keep tone/variant/responsive/style. **No DB migration** —
  `draft_sections`/`published_sections` are JSONB, so the reshape is content-only (re-seed script) +
  additive Zod enum entries. Regenerate DB types only if a column changes (none expected).

  **Sequencing (adopted 2026-07-01): parallel build, not big-bang.** The new nested model +
  token-driven renderer + builder shell are built *alongside* the existing flat-model builder/
  renderer (new route + new render path), so `main` and prod stay green throughout. Cut over and
  delete the old path in Phase 6. "Clean break" = no data migration of the old JSONB content (it is
  re-seeded), NOT a broken intermediate main.

- **Phase 2 — Token-driven render collapse.** One `PageDocRenderer` reading `--site-*`; each block a
  shared component with variants (widget leaves reuse the extracted `GenericSection`); convert the
  four themes to token sets + `PageDoc` blueprints. Keep chrome/date/modal shared components.
  Live-verify all four themes still read distinct on the public site. **Deletion of the four bespoke
  theme dirs (`components/site/{safari,sabela,oceansview,marmalade}/`) MOVES TO CUTOVER (Phase 6)** —
  under parallel build the live public site still renders the legacy flat model until cutover, so
  deleting them in Phase 2 would break prod.

- **Phase 3 — Builder shell (pixel-perfect). Biggest phase; sub-phase it.**
  3a chrome (topbar + panel frame + tokens) · 3b widget library + search + Navigator ·
  3c canvas (nested render + badges + drag-drop + drop-lines + structure modal) ·
  3d inspector (Content/Style/Advanced + device bar + per-field revert) · 3e undo/redo + autosave +
  preview + publish split + Tweaks. Wire to the real `PageDoc` + server actions.

- **Phase 4 — Sub-feature overlays.** Reskin Brand Studio, Nav builder, Theme Settings, Page
  Settings to `.bse-*` overlays launched from the shell; Templates dropdown; document switcher.

- **Phase 5 — Live data + booking funnel.** Auto-populate widgets read `SiteData`; booking widgets
  use server quote/engine (never client prices); `ThemedDateRange` everywhere; room-detail template
  with room-scoped widgets; pixel/goal events on thank-you.

- **Phase 6 — Delete old builder + finalize.** Remove superseded routes/components; update docs +
  memory; full green + live verify; final save point.

---

## 6. Non-negotiables to respect throughout
- Canonical page set guaranteed by `mergeStandardPages` (home/about/rooms/specials/experiences/
  gallery/contact + system: search_results/room_detail/checkout/thank-you).
- Nav locked standard (per-device, per-link, per-page, two-state colours, real-canvas preview).
- Never trust client prices — recalc server-side. `ThemedDateRange` for every themed date picker.
- Brand-safe colour system (tones + `--site-*`; no raw host hex leaking into components).
- Design system tokens (brand colours, fonts, radius, motion) and pre-MVP data policy.

---

## 7. Decisions — RESOLVED (2026-07-01)
1. **Header/footer source of truth:** Nav builder + header settings stay the SSOT; rewire/redesign
   into the new `.bse-*` overlay UI. Not freeform. (See §3.4.)
2. **Variants under "pure token-driven":** blocks keep shared layout variants; theme blueprint picks
   the default. Zero per-theme code. (See §3.3.)
3. **Bespoke theme dirs:** delete outright in Phase 2; git history is the archive.

_No open decisions remain. Next step: founder approves this plan → begin Phase 0._
```
