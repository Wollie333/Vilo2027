# Theme Skin Standard — how we make a theme pixel-perfect (and keep it editable)

> **Status:** authoritative for all theme work from 2026-07-03 onward.
> Supersedes the old "copy the per-theme components + `sed`-rename" conversion
> model (Builder V2 Phase 6 deleted the per-theme component dirs — the public
> site now renders ONE generic, token-driven path). Pairs with
> [`../../THEME_CONTRACT.md`](../../THEME_CONTRACT.md) (page set, chrome/nav,
> token contract) and the per-theme reference in `docs/themes/<slug>/`.

---

## 1. The one idea: a theme is a SKIN, never a fork

Every public page renders through the SAME generic builder blocks
(`components/site/sections/*` + the Builder V2 `PageDocRenderer`). A theme does
**not** ship its own components. A theme = **two things only**:

1. **Tokens** — a `--site-*` palette + a handful of extra tokens (§4), shipped on
   the theme and emitted by `buildSiteVars` / the `.wielo-<slug>` scope.
2. **A skin** — scoped CSS in
   [`apps/web/components/site/themes/theme-skins.css`](../../apps/web/components/site/themes/theme-skins.css)
   under `.wielo-<slug>`, targeting the stable per-block hook
   `[data-section-type="<type>"]`.

Because the skin only sets **defaults + layout**, and the builder emits every
per-element edit **inline** as `--el-*` custom properties (which always win over
a stylesheet rule), **the host can still restyle any element**. Pixel-perfect out
of the box, fully editable after. This is the whole point — never trade one for
the other.

### The three hooks a skin relies on
| Hook | Set by | Use |
|---|---|---|
| `.wielo-<slug>` scope class | `SiteThemeRoot` (from `theme.preset`) | root of every skin selector — nothing leaks to Wielo app chrome |
| `[data-section-type="<type>"]` | `PageDocRenderer` + `SectionRenderer` on every block | the per-block target (`hero`, `intro`, `stats`, `rooms_preview`, `gallery`, `reviews`, `cta`, `highlights`, `amenities`, …) — mirrors the reference HTML's `data-section` |
| `--el-*` (inline) / `--site-*` | builder per-element edits / theme tokens | editability + theming; a skin sets `--site-*`/plain CSS, the host's `--el-*` overrides it |

---

## 2. The per-page recipe (repeat for every page, every theme)

1. **Reseed** the page's v2 PageDoc to the reference design section-for-section,
   using **generic blocks** + the reference copy/images (§3 mapping). One-off
   service-role `.mjs` (pattern in
   `scratchpad/reseed-oceansview-home.mjs`). Write BOTH `draft_sections` and
   `published_sections`. **PageDoc shape** (see `lib/website/pageDoc.schema.ts`):
   ```
   { v:2, meta:{}, root:{ id:"root", type:"root", kids:[ section… ] } }
   section = { id, type:"section", tone, maxw, space:{mt,mb,pt,pr,pb,pl}, kids:[column] }
   column  = { id, type:"column", span:12, kids:[ widget… ] }
   widget  = { id, type, variant, props }
   ```
   Marketing headings are their OWN `el_heading` widget placed above the block
   (Builder V2 Phase B reframed every block "bare": the SECTION owns the band,
   padding and width; the block renders only its content).
2. **Skin** the blocks in `theme-skins.css` under `.wielo-<slug>
   [data-section-type=…]` (§5 cookbook). Reach into the block's real DOM (the
   generic components use Tailwind utility classes — target those, e.g.
   `.rounded-pill`, `.grid > *`).
3. **Verify live** on the theme's fixture (Oceans View = `vilotest`,
   `/en/site?site=vilotest`). The preview panel is ~726px = **below the `md`
   breakpoint** — use `preview_resize width:1280` to see the desktop 2-col
   layouts.
4. **Commit + push** per page (or per meaningful section). Keep the reseed
   script in scratchpad, not the repo.

---

## 3. Reference → generic block mapping (Oceans View home — the template)

The reference sections map onto generic blocks/variants like this. Reuse this
table as the default mapping for any resort/lodge theme.

| Reference section (`data-section`) | Generic block | Variant / notes |
|---|---|---|
| `hero` (full-bleed photo, chip, 2 CTAs) | `hero` | `variant:"fullscreen"`, `textTone:"light"`, `eyebrow` (rating chip), `cta_*` + `cta2_*` |
| `booking_search` (availability bar) | `booking_search` | section pulled up under the hero |
| `intro` (split + framed photo + float badge) | `intro` | `variant:"story"` + `image_path` + `badge_value`/`badge_label` |
| `stats` (number strip) | `stats` | `variant:"band"`; section `tone:"sand"` |
| `rooms_preview` (room cards) | `rooms_preview` | real host rooms (live data); `el_heading` above |
| experiences (image tiles) | `highlights` | **`variant:"tiles"`** (image-backed cards, added for this) |
| amenities ("everything taken care of") | `highlights` | `variant:"grid"` (icon + title + body cards) |
| `gallery` (mosaic) | `gallery` | `layout:"mosaic"`; section `tone:"sand"` |
| `reviews` (testimonials) | `reviews` | `variant:"grid"`; section `tone:"navy"` |
| `cta` (closing banner) | `cta` | `variant:"banner"` + `image_path` |

> The generic `amenities` block is icon+label only (it's wired to LIVE property
> amenities). For a marketing "everything taken care of" tile grid with body
> copy, use `highlights` (icon+title+body), NOT `amenities`.

**Rooms page** (`docs/themes/oceansview/pages/Rooms.html`): page-head → `hero`
(`variant:"fullscreen"`, `height:"medium"`, `show_cta:false`); "included" bar →
`amenities` (`variant:"inline"`, sand tone); room list → `rooms_preview`
(**node `variant:"showcase"`** — alternating splits); closing → `cta` banner.

**Room detail** (`docs/themes/oceansview/pages/Room.html`): a full-width
`room_gallery` (`variant:"mosaic"`); then a **2-column band** — a section with two
columns: `col(8)` = `room_overview` (`variant:"stacked"`, `show_price:false`) +
an `el_heading` + `room_amenities` + `room_policies`; `col(4)` = `room_rate`
(`variant:"card"`) — skinned sticky + coral; then `rooms_preview` grid ("the
other rooms", sand). Set the band `stack:"tablet"` so it collapses to one column
on phones. All room-scoped blocks render the room in scope live.

---

## 4. The token contract every theme ships

The core palette (`bg surface ink mute line accent accentInk secondary`) comes
from `theme.base.palette` and is emitted by `buildSiteVars`. Alternating bands
and dark sections need these **extra tokens** — declare them in the
`.wielo-<slug>` block in `theme-skins.css` (additive; brand-safe fallbacks mean
a theme that omits them still renders):

```
--site-soft / --site-soft-2   warm/alternate band fill      (→ tone "sand")
--site-navy / --site-navy-2    deep anchor band + raised card (→ tone "navy")
--site-navy-ink / --site-navy-mute   text on the navy band
--site-tint                    accent-tint chips / icon boxes
--site-accent-deep             hover/darker accent
--site-secondary-deep          hover/darker secondary (coral)
```

The band **tones** `sand` + `navy` live in `SECTION_TONES` / `sectionToneStyle`
(`sections.schema.ts` + `_shared.tsx`) — a section just sets `tone:"sand"` /
`tone:"navy"` and the tokens above paint it. Any theme gets them for free.

---

## 5. Skin cookbook (the CSS patterns, reusable)

All under `.wielo-<slug> …`. These are the moves that took Oceans View to
pixel-perfect — adapt the values, keep the structure.

- **Coral (secondary) conversion CTAs on hero + cta only:** override the button
  *vars* on those blocks so inline `var()` resolves coral there while the rest of
  the site keeps the aqua primary:
  ```css
  .wielo-x [data-section-type="hero"],
  .wielo-x [data-section-type="cta"] { --site-btn-primary-bg: var(--site-secondary); … }
  ```
- **Hero rating chip:** target `.site-hero-eyebrow` (stable hook the hero emits)
  → glassy pill (`rgba(255,255,255,.16)` + blur + pill radius).
- **Stats accent numbers:** `[data-section-type="stats"] { --el-value-fg: var(--site-accent) }`
  (still overridable per-element).
- **Card hover-lift + tint chips** (rooms): translateY + shadow on `> * > *`;
  restyle `.rounded-pill` fact chips to `--site-tint` / `--site-accent-deep`.
- **Icon-box tiles** (amenities via highlights grid): turn the `.text-2xl` icon
  into a 52px rounded `--site-tint` chip; add hover-lift to `.grid > *`. Use
  `:not(:has(.site-hl-tile))` so it doesn't hit the image-tile variant.
- **Coral quote-marks** (navy reviews): `::before { content:"\201C"; color:var(--site-secondary) }`
  on each `.grid > *`, add top padding.
- **Display typography** (hero / big headings): `buildSiteVars` emits a *modular*
  type scale (`--site-h1` ≈ 33px, weight 600) that is far smaller than a dramatic
  theme's display type — and it's emitted **inline**, so a `.wielo-<slug>
  { --site-h1: … }` rule can't win. Pin the rendered type at the **consumption
  site** instead, from the reference values:
  ```css
  .wielo-x [data-section-type="hero"] .site-hero-title {
    font-size: clamp(3rem,8vw,7rem) !important;  /* !important beats the inline var */
    font-weight: 800 !important; line-height: .95 !important;
    letter-spacing: -.02em !important; max-width: 15ch;
  }
  ```
  Hero hooks: `.site-hero-title` / `.site-hero-sub` / `.site-hero-cta` /
  `.site-hero-eyebrow`. Match font-size, weight, line-height, letter-spacing,
  max-width AND the vertical rhythm (margin-top between chip → h1 → sub → CTA).
  The `.site-hero-*` title isn't wired to `--el-*`, so `!important` here costs no
  editability; for `--el-*`-backed elements never `!important` over the `--el-*`
  hook.

**Rules:** skin sets defaults/layout only; never `!important` except to beat an
inline theme default you must override (and never over an `--el-*` hook). Keep
every selector under `.wielo-<slug>`.

**NEVER set an `--el-*` slot in the skin.** A block reads `var(--el-value-fg,
<theme default>)`; the host's per-element edit sets `--el-value-fg` at
`[data-node-id]` (specificity 0,1,0). A skin rule at `.wielo-x
[data-section-type]` is (0,2,0) — so if the skin sets `--el-value-fg`, it beats
the host's edit and editability breaks. To recolour a block by default, rely on
the component's own fallback, or style the element's own property (e.g.
`.wielo-x [data-section-type="stats"] .value { color: … }`) — not its `--el-*`
variable. (Learned when the stats skin's `--el-value-fg` blocked the About page's
coral-number override.)

---

## 5b. Wire the skin INTO the elements (host-editable design)

A CSS-only skin makes an element pixel-perfect but **not editable** — the host
can't nudge it in the builder. The goal is: the theme's design is the *default*
of a per-element control the host can override. Three parts, per element:

1. **Component reads `--el-<key>-<prop>`** with the theme design as the FALLBACK
   (never as the `--el-*` slot itself — see the "never set an `--el-*` slot"
   rule). Layer the fallback so the design lives in a THEME var:
   ```
   fontSize: "var(--el-title-size, var(--site-hero-title-size, var(--site-h1)))"
   //         ^host edit           ^theme design default        ^generic fallback
   ```
2. **Theme sets the design default** as a `--site-*` theme var in
   `theme-skins.css` (e.g. `--site-hero-title-size: clamp(3rem,8vw,7rem)`). Fluid
   clamps stay responsive until a host sets a fixed px via `--el-*`.
3. **Registry declares the element** in `WidgetDef.elements` (key + label +
   controls) so the builder's Style-tab "Elements" accordion shows it. The `key`
   MUST match the `--el-<key>-*` the component reads.

Result: default = the theme's pixel-perfect design; the host can restyle each
element (colour/size/weight/radius/…) in the builder; other themes (no
`--site-*` default) fall back to the generic scale — no regression. Prefer this
over a CSS-property skin whenever the property is one the `--el-*` system can
carry (colour, font-size px, weight, line-height, letter-spacing, radius, bg,
border, shadow). STRUCTURAL/interactive things the `--el-*` system can't express
— hover transforms, gradients/scrims, grid spans, sticky, pseudo-element quote
marks, measure/margins — stay in the skin CSS (not per-element editable; that's
inherent). Done for the hero (`e5bc85f8`): eyebrow/title/sub/both buttons.

## 6. Bake this into the reference design (so skinning is fast)

When commissioning / drawing a NEW theme reference, design **against the generic
block vocabulary** so step §2 is mechanical:

1. **Use the `data-section` names** from §3 for each section in the mockup HTML.
   One reference section = one generic block.
2. **Only use layouts a generic block already supports** (see each block's
   `variant` enum in `sections.schema.ts`). If the design needs a layout no block
   has, that's a **one-time additive variant** (like `highlights` `tiles`) — add
   it to the block + schema so EVERY future theme can reuse it, don't fork.
3. **Drive everything from `--site-*` tokens** (colours, fonts, radius, shadows)
   — no hardcoded hex in section CSS. Ship the §4 extra tokens.
4. **Headings are separate elements** (`el_heading`) above bare blocks — design
   the section band (padding/width/background) as the container, the heading as
   its own text element.
5. Keep a `docs/themes/<slug>/` folder: `base.md` (token spec), `theme.css`
   (reference), `pages/*.html` (per-page mockups).

If the reference respects 1–4, a new theme is: seed tokens → reseed pages with
the §3 mapping → write a `.wielo-<slug>` skin block → verify. No components.

---

## 7. Gotchas (learned the hard way)

- **`root.type` MUST be `"root"`** in the PageDoc, or `parsePageDocLoose`
  rejects the whole doc and **zero sections render with no error**.
- **`display`-style blocks (`rooms_preview`, `blog_preview`) read their layout
  from the node `variant`, not `props.display`** — `foldVariant` in
  `PageDocRenderer` overwrites `props.display` with the node's `variant`. So to
  select a rooms layout, set the widget node's `variant` (e.g. `"showcase"`);
  `props.display` alone is silently overwritten by `variant` (which defaults to
  `"grid"`).
- **A node `variant` MUST be one of the block's declared variants**, or the
  shared-widget path's `sectionSchema.safeParse` fails and the block renders
  **empty (null)** with no error. Don't use `"default"` as a catch-all — e.g.
  `room_overview` variants are `["split","stacked"]`, so `variant:"default"`
  blanks it. Check the block's `*_VARIANTS` enum in `sections.schema.ts`.
- **2-column layouts** (content + sticky aside) = a section with two columns
  (`col(8)` + `col(4)`), NOT a block. Set the section `stack:"tablet"|"mobile"`
  so it collapses on phones — the renderer now emits a stacking media query for
  `stack` (before, `stack` only fired off the builder device, so live mobile
  stayed cramped). A sticky aside is `position:sticky;top:Npx` in the skin.
- **Data-coupled blocks ignore seeded props when live data exists.** `amenities`
  renders the host's LIVE property amenities over any `props.items` you seed — and
  those carry lucide icon *names* (e.g. `"wifi"`), which render as literal text if
  you output `item.icon`. The `inline` amenities variant omits icons for this
  reason. Same live-wins rule for `gallery`/`rooms_preview`/`reviews`.
- **`el_heading` is a valid renderable widget** (headings are their own element
  post-Phase B) — don't expect it to be a "section type" only.
- **Live vs stock data:** `gallery` / `rooms_preview` / `reviews` / `amenities`
  prefer the host's LIVE data over the stock props you seed — so on the published
  fixture you'll see the host's real photos/rooms, not the reference stock. Stock
  only shows in preview / until the host adds data. This is correct.
- **Preview width** is ~726px (below `md`) — resize to 1280 to check desktop
  layouts.
- **Some pages are FIXED system routes, not builder docs** — `/blog` (index),
  `/blog/[slug]`, `/search`, likely checkout/thank-you render from dedicated
  `app/[locale]/site/**/page.tsx` files, NOT the page's `published_sections`. A
  reseed of those page kinds is unused. They still sit inside `SiteThemeRoot`
  (the `.wielo-<slug>` scope) and use `--site-*`, so you can SKIN them (add a
  stable class hook to the route, then scope CSS) — but you can't restructure them
  per-theme. Reproducing a reference layout they don't have is a platform change
  to the shared route.
- **`pnpm build` while the dev server is running corrupts the shared `.next`** —
  don't; use `tsc --noEmit` + `eslint <files>` to gate a commit instead.
- **Formatter strips a leading space in a template-literal `className`
  conditional** — use full-literal ternaries in TSX (see
  `commit-formatter-strips-className-space`).

---

## 8. Progress log (Oceans View)

- **Home — DONE** (`6ae16f4a`, 2026-07-03). Every section per §3; added the
  reusable `sand`/`navy` tones + `highlights` `tiles` variant. Live-verified.
  Deferred polish: nav transparent-over-hero (chrome), intro eyebrow coral, room
  price pill overlay, amenity 4-col.
- **Home hero typography pinned to reference** (2026-07-03). Family was already
  correct (Bricolage Grotesque); fixed size (33→102px @1280), weight (600→800),
  line-height (1.15→0.95), tracking (−0.01→−0.02em), max-width 15ch, and the
  chip→h1→sub→CTA rhythm — see the "Display typography" cookbook note.
  Systemic follow-up: section `el_heading` sizes still use the generic scale
  (~27px vs reference ~56px) — pin per-theme when doing heading-heavy pages.
- **Section heading scale — FIXED theme-wide** (2026-07-03). Redefined
  `--site-h1/h2/h3` on `.wielo-oceansview [data-section-type]` (a descendant of
  the root that carries the inline scale), so every "auto" `el_heading`/section
  heading grows to the reference display sizes without `!important` and without
  breaking host size edits. This lifted the home headings too.
- **Rooms — DONE** (2026-07-03). Page-head hero + sand "included" pill bar +
  `rooms_preview` **`showcase`** (alternating splits) + coral CTA. Added two
  reusable variants: `rooms_preview` `showcase` (set via node `variant`) and
  `amenities` `inline` (text pill bar). Live-verified on `/rooms`.
- **Room detail — DONE** (2026-07-03). 2-column band (content + sticky coral
  booking card) via real builder columns; full-width gallery + "other rooms".
  Fixed a general responsive gap: multi-column `stack` sections now emit a
  stacking media query so they collapse on live phones (was builder-device only).
  Live-verified on `/rooms/olive-room`, desktop + mobile.
- **Search / Checkout / Thank-you — token-themed** (2026-07-04). Fixed system
  routes (`app/[locale]/site/book`, `…/thank-you`; search_results is a flat page
  reached mid-flow). All render inside `SiteThemeRoot` + `SiteChrome` with
  `--site-*`, so they're on-brand automatically (verified in code). They're
  transactional FLOWS, not builder docs, and redirect without a live booking
  session — so per-theme restructuring is out of the skin model and can't be
  preview-verified safely. Left inheriting the theme (functional + on-brand).
- **Specials / Experiences / Gallery — DONE** (2026-07-04). Pure block reuse +
  data reseed, no code change: page-head hero + `specials_preview` (live offers,
  aqua "Book this offer" per ref) + CTA; hero + `highlights` "tiles" (image) +
  `highlights` grid (icon, sand) + `gallery` mosaic + CTA; hero + `gallery`
  mosaic + CTA. Stock hero/CTA images; grids/gallery show live host data.
- **Element wiring** (2026-07-04, `e5bc85f8` · `9af3e261` · `cbc719fc`): hero
  (eyebrow/title/sub/buttons), showcase (name/tag/price/desc/button), blog
  featured (title/excerpt/meta), intro story (eyebrow/body/badge/badge-value),
  cta (heading/body/button) and `SiteButton` (`--el-button-*`, so every themed
  button is editable) all read `--el-*` with the theme design as the fallback —
  host-editable per §5b; registry declares each. Highlights tiles already did.
  Theme defaults that were `!important` skins (hero type, intro badge) are now
  `--site-hero-*` / `--site-intro-badge-*` theme vars. Verified: default = design,
  per-element override wins.
- **Journal (/blog) — PARTIAL** (2026-07-03). `/blog` is a FIXED system route
  (`app/[locale]/site/blog/page.tsx`), not a builder doc — so the reference's hero
  page-head + featured post + newsletter can't come from a reseed. Skinned its card
  grid (hover-lift via a `site-blog-grid` hook). Added reusable blocks for a
  journal teaser on any BUILDER page: `blog_preview` "journal" display (featured +
  grid, one block) and `cta` "newsletter" (email + subscribe). ⚠️ Matching the
  reference Journal fully needs a platform change to the shared blog route (adds a
  page-head + featured) — affects every theme; flagged, not done.
- **Contact — DONE** (2026-07-03). Page-head hero + `contact_form` (split, posts
  to `/api/website-enquiry`) + FAQ accordion (sand). Added `contact_form` to the
  coral conversion-CTA scope (design reserves coral for book + submit). Deferred:
  the contact-details card / decorative map (data-coupled; footer carries contact
  info). Live-verified `/contact`.
- **About — DONE** (2026-07-03). Pure reuse of skinned blocks: page-head hero,
  intro "story" (coral "2014" badge), navy stats (coral numbers via a per-element
  override), values icon-tiles (`highlights` grid), sand founder pull-quote
  (`intro` "lead" + text elements), CTA banner. Fixed a skin bug — removed the
  stats `--el-value-fg` slot so the coral per-element override wins (see the
  "NEVER set an `--el-*` slot" rule). Live-verified `/about`.
- Prior foundation: `f4c49eed` (skin scaffolding + `data-section-type` hooks),
  `4b5ea727` (hero), `c6b0c36f` (cta coral).
- **Next:** Rooms → Room detail → About → Contact → Journal → Specials →
  Experiences → Gallery → Search results → Checkout → Thank-you, then replay for
  the other themes.
