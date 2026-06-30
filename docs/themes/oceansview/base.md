# Oceans View — Wielo theme base

A bright, Mediterranean beach-resort theme: bold grotesk display, soft rounded
forms, airy whitespace, aqua + sand + navy + coral. Everything visual derives
from the `--site-*` tokens declared in `theme.css` (in the `.wielo-theme` block),
so the CMS can override any of them at runtime. Three palettes ship; **Lagoon**
is the default. Two display fonts and two corner styles are wired.

## Base spec (default)

```
palette: {
  bg:        #FFFFFF   // page background
  surface:   #FFFFFF   // cards / raised panels
  ink:       #0E2C3A   // primary text (deep teal-navy)
  mute:      #5E7884   // secondary text
  line:      #E9E1D1   // borders / dividers
  accent:    #12A5B5   // aqua — buttons, links, highlights
  accentInk: #FFFFFF   // text/icons on top of the accent
}
headingFont: "Bricolage Grotesque"   bodyFont: "Manrope"
radius: lg                           // 16px base, 22–30px on cards (rounded)
```

Secondary accent: `secondary #FF6B57` (coral) / `secondaryInk #FFFFFF`. A deep
navy (`--site-navy #0A2330`) anchors the footer and dark sections; `--site-soft
#F7F1E6` is the warm sand fill.

## Fonts (load from Google Fonts)

- **Display** — `Bricolage Grotesque` (default, `data-font="grotesk"`) or
  `Archivo` (`data-font="archivo"`).
- **Body** — `Manrope` (both).

## Shape (`data-shape`)

- `rounded` → 16 base · 22 lg · 30 xl · 24 img, pills 999px  (default, ≈ "lg")
- `sharp`   → 3px across the board  (≈ "none")

## Alternate palettes (`data-theme`)

**Riviera** — cool navy / blue
```
bg #FFFFFF · surface #FFFFFF · ink #0A1E2D · mute #587082 · line #E0E8EE · accent #19405E · accentInk #FFFFFF · secondary #FF6F5B
```
**Sea Glass** — soft green-teal
```
bg #FFFFFF · surface #FFFFFF · ink #13302A · mute #577068 · line #E5E2D2 · accent #2E9E8F · accentInk #FFFFFF · secondary #F2825A
```

## Token map (what drives what)

| Concern | Tokens |
| --- | --- |
| Palette | `--site-bg --site-surface --site-ink --site-mute --site-line --site-accent --site-accent-deep --site-accent-ink --site-secondary --site-secondary-deep --site-secondary-ink` |
| Dark sections | `--site-navy --site-navy-2 --site-navy-ink --site-navy-mute` · soft fills `--site-soft --site-soft-2 --site-tint` |
| Type | `--site-font-heading --site-font-body --site-h1…--site-h6 --site-text-base --site-text-sm --site-text-accent --site-weight-heading --site-weight-body --site-leading-heading --site-leading-body --site-tracking-heading --site-tracking-body` |
| Shape | `--site-radius --site-radius-sm --site-radius-lg --site-radius-xl --site-radius-img` |
| Buttons | `--site-btn-primary-{bg,color,border,radius} --site-btn-secondary-{bg,color,border,radius}` |
| Cards / images | `--site-card-{border,radius,shadow,ratio} --site-img-{border,radius,shadow}` |
| Icons / social | `--site-icon-color --site-social-{bg,fg,border,radius}` |

All declared with hard fallbacks in `theme.css`; every selector is scoped under
`.wielo-theme`. Apply the theme by putting `class="wielo-theme"` and the
`data-theme/font/shape` attributes on the root element. The nav has two states
built in — `.nav.over` (transparent over a hero) and `.nav.solid` (on scroll).
