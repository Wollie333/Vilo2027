# Builder V2 — Widget Registry & PageDoc Contract

Status: **Phase 0 contract (locked 2026-07-01).** Phase 1 implements against this exactly.
Companion to `docs/features/BUILDER_V2_PLAN.md`. Every prop name marked _(align)_ must be
reconciled to the existing `apps/web/lib/website/sections.schema.ts` shape in Phase 1 rather
than invented fresh.

---

## 1. PageDoc — the page document shape

Stored in `website_pages.draft_sections` / `published_sections` (JSONB). One document per page.
Clean break: old flat `WebsiteSection[]` is replaced by this nested tree (pre-MVP, re-seeded).

```ts
type ID = string;                          // 'n1', 'n2'… unique within the doc

interface PageDoc {
  v: 2;                                     // schema version (enables future migrations)
  root: RootNode;
  meta: PageMeta;                           // SEO / social / tracking — existing shape, unchanged
}

interface RootNode   { id: ID; type: 'root';    kids: SectionNode[]; }

interface SectionNode {
  id: ID; type: 'section';
  kids: ColumnNode[];
  bg?: string;                              // section background (token ref or hex)
  maxw?: number;                            // content max-width px (default 1180)
  valign?: 'stretch'|'flex-start'|'center'|'flex-end';
  gap?: number; wrap?: boolean;
  stack?: 'none'|'tablet'|'mobile';         // collapse columns to 1 on device
  inner?: boolean;                          // nested/inner section flag
  borderB?: string;
  space?: BoxSpace;                         // margin/padding (desktop base)
  responsive?: ResponsiveOverride;          // per-device overrides (see §4)
  tone?: SectionTone;                        // 'default'|'accent'|'dark'|'muted'
  cssId?: string; cssClass?: string; anim?: 'none'|'fade'|'rise';
}

interface ColumnNode {
  id: ID; type: 'column';
  span: number;                             // 1..12 (columns in a section sum to 12)
  kids: (WidgetNode|SectionNode)[];
  dir?: 'column'|'row'; justify?: string; align?: string; gap?: number; wrap?: boolean;
  space?: BoxSpace; responsive?: ResponsiveOverride;
}

interface WidgetNode {
  id: ID; type: WidgetType;                 // see §2 catalogue
  props: Record<string, unknown>;           // type-specific (registry declares defaults)
  variant?: string;                         // shared layout variant (registry declares options)
  tone?: SectionTone;
  align?: 'left'|'center'|'right';
  space?: BoxSpace; responsive?: ResponsiveOverride; style?: BlockStyle;
  cssId?: string; cssClass?: string; anim?: 'none'|'fade'|'rise';
}

interface BoxSpace { mt:number; mb:number; pt:number; pr:number; pb:number; pl:number; }
```

`ResponsiveOverride`, `BlockStyle`, `SectionTone`, `PageMeta` reuse the **existing** types in
`lib/website/sections.schema.ts` / `lib/site/types.ts` — do not redefine them.

---

## 2. Widget catalogue (the standardized Wielo block vocabulary)

The registry (`lib/website/widgets/registry.ts`) is the single source: library, defaults,
inspector controls, and renderer all read it. `maps-to` = the existing section `type` reused as
the widget's `type` (so render + data binding + Zod are shared). **NEW** = additive type to add
to `sections.schema.ts` in Phase 1.

### Group: Layout (structural, not in the widget list)
| Widget | type | Notes |
|---|---|---|
| Section | `section` | column-structure modal (1 / 2 / 3 / 4 / 8-4 / 4-8) |
| Inner Section | `section` (`inner:true`) | nested flex container |
| Column | `column` | created by the structure picker |

### Group: Basics
| Widget | maps-to | variants | key props _(align in P1)_ | controls |
|---|---|---|---|---|
| Heading | `el_heading` | — | text, tag(h1/h2/h3), size, color, weight, align | Content: text/tag/align · Style: color/size/weight |
| Text | `el_text` | — | text, size, color, align | Content: text/align · Style: color/size |
| Button | `el_button` | solid/outline/pill | text, href, bg, color, size, radius, align | Content: label/link/align · Style: bg/color/size/radius |
| Image | `el_image` | — | src, alt, radius | Content: url/alt · Style: radius |
| Divider | `el_divider` | — | color, thick, width% | Content: width/thick · Style: color |
| Spacer | `el_spacer` | — | h | Content: height |
| Icon Box | `el_icon` **NEW** | stack/inline | glyph, title, desc, color | Content: glyph/title/desc · Style: color |

### Group: Media
| Widget | maps-to | variants | key props | controls |
|---|---|---|---|---|
| Gallery | `gallery` | grid/list/carousel | cols, gap, imgs, radius | Content: images/cols/gap · Style: radius |
| Video | `video` | — | poster, url, radius | Content: poster/url · Style: radius |

### Group: Wielo blocks (auto-populate — read `SiteData[node.id]`)
| Widget | maps-to | variants | `SiteData` key | key props | controls |
|---|---|---|---|---|---|
| Rooms Grid | `rooms_preview` | grid/showcase | rooms | cols, count, price, radius | Content: count/cols/price · Style: radius/tone |
| Room Card | `el_room_card` **NEW** | postcard/clean/overlay | room (single) | roomId?, name, meta, price, src | Content: room pick / manual · Style: variant/tone |
| Booking Bar | `booking_search` (`variant:'bar'`) | bar | booking | label, accent | Content: label · Style: accent/tone |
| Date Search | `booking_search` (`variant:'search'`) / `availability_calendar` | search/calendar | booking | checkin,checkout,guests,nights,label | Content: labels · Style: accent |
| Search Bar | `booking_search` (`variant:'searchbar'`) | — | booking | placeholder, label, radius | Content: placeholder/label · Style: radius/accent |
| Reviews | `reviews` | grid/list/plain | reviews | count, stars | Content: count/stars · Style: tone |
| Specials | `specials_preview` | grid/list | specials | count, layout | Content: count · Style: tone |
| Map / Contact | `location` / `map` | split/stacked/boxed | location | address, accent | Content: address · Style: accent/tone |

### Group: Site parts (used in Footer document; header/menu handled by Nav builder)
| Widget | maps-to | variants | key props | controls |
|---|---|---|---|---|
| Logo | `el_logo` **NEW** | mark+name/name/mark | name, mono, size, color, align | Content: name/mono/align · Style: size/color |
| Nav Menu | `el_nav` **NEW** | underline/pill/plain | items(src=menu), style, gap, color, size | Content: menu-source/style · Style: color/size/gap |
| Social Icons | `el_social` **NEW** | round/rounded | nets, shape, color, align | Content: networks/shape · Style: color |

> Header/menu are **not** freeform widgets — the Nav builder (locked standard) remains the SSOT.
> `el_nav`/`el_logo`/`el_social` exist for the **Footer** document and any in-page use.

Every widget also exposes the shared **Advanced** tab (CSS id/class, entrance anim, per-device
hide/order) and **Spacing** (margin/padding) — declared once in the registry base, not per widget.

---

## 3. Theme = tokens + blueprint (no per-theme code)

### 3.1 Token set (extends today's `SitePreset`)
```ts
interface SiteTokens {
  palette: { bg; surface; ink; mute; line; accent; accentInk; };
  font: FontKey;              // sans | serif | elegant | grotesk | editorial | homely
  radius: 'none'|'sm'|'md'|'lg'|'xl';
  shadow?: 'none'|'soft'|'lift';
  spacing?: 'tight'|'normal'|'roomy';
}
```
Emitted to `:root` as `--site-*` by `SiteThemeRoot` (already exists). Every block reads these; no
block hardcodes a colour/font.

### 3.2 Blueprint (extends today's `themeSections.ts`)
Per theme: the ordered page set and, per page, the section→column→widget tree with each widget's
default `variant` + `tone` + starter copy. This is what `mergeStandardPages` fills/merges against.
A theme ships **no components** — only `SiteTokens` + a `PageDoc` blueprint per canonical page.

### 3.3 Variant = shared layout, theme picks default
Distinct looks (Marmalade postcard hero + tilted cards, Safari editorial hero, Oceans View bright
cards) are **variants inside the one shared component**, selected by the blueprint. Adding a variant
benefits every theme; it is never per-theme code.

---

## 4. Responsive & style (reuse existing)
- `responsive`: `{ tablet?: Partial<props>+hide/order; mobile?: … }` — per-device prop overrides +
  hide + order, exactly as the current schema. Inspector device bar writes `key@tablet`/`key@mobile`.
- `style` (`BlockStyle`): per-viewport padding/margin/border/frame/typography — existing shape.
- `space` (`BoxSpace`): the margin/padding editor; desktop base + device overrides via `responsive`.

---

## 5. Invariants Phase 1 must uphold
1. One registry entry per widget; library/defaults/inspector/renderer all derive from it.
2. Reuse existing `type` names wherever a mapping exists; only the 5 **NEW** types are added.
3. Keep `tone`, `variant`, `responsive`, `style`, `PageMeta` — do not fork them.
4. `PageDoc` validated by Zod on read/write; unknown widget types fail closed (skip + warn).
5. Auto-populate widgets carry no live data in the doc — they read `SiteData[node.id]` at render.
6. Never store prices/rates in the doc for booking widgets — server recalculates.
