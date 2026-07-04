# Marmalade House — Wielo theme base ("Postcards")

A warm, photographic guest-house theme built on a deliberately different shell:
a **floating pill menu**, full-bleed photo heroes with an **overlapping white
postcard**, and tilted, taped **postcard cards** throughout. Everything visual
derives from the `--site-*` tokens in `theme.css` (under the `.wielo-theme`
block), so the CMS can override any of them. Three palettes ship; **Marmalade**
is the default. Two display fonts and two corner styles are wired.

## Base spec (default)

```
palette: {
  bg:        #F4ECDB   // page background (butter cream)
  surface:   #FFFFFF   // postcards / panels
  ink:       #2C2620   // primary text (warm near-black)
  mute:      #6F6354   // secondary text
  line:      #E4D6BE   // borders / dashed dividers
  accent:    #C8702E   // marmalade — buttons, links, the pill book CTA
  accentInk: #FFFFFF   // text on the accent
}
headingFont: "Gloock"   bodyFont: "Karla"   (+ "Caveat" for handwriting)
radius: md              // 16px base, 14px images (soft)
```

Secondary accent: `secondary #9C3B52` (berry) / `secondaryInk #FFFFFF`.
Supporting: `--site-seal #3C5234` (the wax-seal green), `--site-note #F8DCA0`
(sticky-note / stamp yellow), `--site-soft #FBF4E6`, `--site-tint #F6E6C8`.

## Fonts (Google Fonts)

- **Display** — `Gloock` (default, `data-font="homely"`) or `Playfair Display`
  (`data-font="classic"`).
- **Handwriting** — `Caveat` (captions, stamps, accents).
- **Body** — `Karla`.

## Shape (`data-shape`)

- `soft` → 16 base · 22 lg · 10 sm · 14 img  (default)
- `sharp` → 3px across the board

## Alternate palettes (`data-theme`)

**Damson** — plum + sage
```
bg #F5EFEA · surface #FFFFFF · ink #2C2230 · mute #75697A · line #E6DBD6 · accent #8E4A63 · secondary #4E6151
```
**Sage** — green + cream
```
bg #EEF1E7 · surface #FFFFFF · ink #21302A · mute #5E6E63 · line #DBE2D0 · accent #2E7D6B · secondary #C8702E
```

## Token map (what drives what)

| Concern | Tokens |
| --- | --- |
| Palette | `--site-bg --site-surface --site-ink --site-mute --site-line --site-accent --site-accent-deep --site-accent-ink --site-secondary --site-secondary-ink` |
| Scrapbook | `--site-seal --site-note --site-tint --site-soft --site-soft-2` · `--site-foot --site-foot-ink --site-foot-head` |
| Type | `--site-font-heading --site-font-hand --site-font-body --site-h1…--site-h6 --site-text-base --site-text-sm --site-text-accent --site-weight-heading --site-weight-body --site-leading-* --site-tracking-*` |
| Shape | `--site-radius --site-radius-sm --site-radius-lg --site-radius-img` |
| Buttons | `--site-btn-primary-{bg,color,border,radius} --site-btn-secondary-{bg,color,border,radius}` |
| Cards / images | `--site-card-{border,radius,shadow,ratio} --site-img-{border,radius,shadow}` |
| Icons / social | `--site-icon-color --site-social-{bg,fg,border,radius}` |

All declared with hard fallbacks in `theme.css`; every selector is scoped under
`.wielo-theme`. Apply the theme with `class="wielo-theme"` + the
`data-theme/font/shape` attributes on the root element.

## The shell (what makes it distinct)

- **`.nav` → `.pill`** — a fixed, centred, rounded menu that floats over the
  page (brand monogram + links + a Book CTA). Collapses to a burger + `.mnav`
  drawer under 860px. An optional `.announce` strip can sit above it.
- **`.phero` + `.postcard`** — a full-bleed photo with an overlapping, slightly
  rotated white postcard (stamp, eyebrow, title, handwriting, CTAs). Interior
  pages use `.postcard.sm`; type-only pages use `.phead-plain` (which clears the
  floating nav).
- **`.pc` / `.pcgrid`** — tilted postcard cards (rooms, gallery, journal),
  straightening on hover. `.gal` is a taped photo-album grid. Reviews are pinned
  postcards with washi `.tape`.
