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

**Rules:** skin sets defaults/layout only; never `!important` except to beat an
inline theme default you must override (and never over an `--el-*` hook). Keep
every selector under `.wielo-<slug>`.

---

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
- **`el_heading` is a valid renderable widget** (headings are their own element
  post-Phase B) — don't expect it to be a "section type" only.
- **Live vs stock data:** `gallery` / `rooms_preview` / `reviews` / `amenities`
  prefer the host's LIVE data over the stock props you seed — so on the published
  fixture you'll see the host's real photos/rooms, not the reference stock. Stock
  only shows in preview / until the host adds data. This is correct.
- **Preview width** is ~726px (below `md`) — resize to 1280 to check desktop
  layouts.
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
- Prior foundation: `f4c49eed` (skin scaffolding + `data-section-type` hooks),
  `4b5ea727` (hero), `c6b0c36f` (cta coral).
- **Next:** Rooms → Room detail → About → Contact → Journal → Specials →
  Experiences → Gallery → Search results → Checkout → Thank-you, then replay for
  the other themes.
