# Atelier Hotel — Wielo theme base

A clean, airy, modern design-hotel theme: sticky top nav, soft white cards,
hairline borders, light shadows, generous whitespace. Everything visual derives
from the `--site-*` tokens declared in `theme.css` (in the `.wielo-theme` block),
so the CMS can override any of them at runtime. Three palettes ship; **Sand
(persimmon)** is the default. Two heading fonts and two corner styles are wired.

## Base spec (default)

```
palette: {
  bg:        #FBFAF7   // page background (warm off-white)
  surface:   #FFFFFF   // cards / raised panels
  ink:       #1C1A17   // primary text
  mute:      #79736A   // secondary text
  line:      #EAE5DC   // borders / dividers
  accent:    #B65D3C   // clay — buttons, links, highlights
  accentInk: #FFFFFF   // text/icons on top of the accent
}
headingFont: "Schibsted Grotesk"   bodyFont: "Hanken Grotesk"
radius: lg                         // 18px global corner (round)
```

Secondary accent: `secondary #2F6F62` / `secondaryInk #FFFFFF`. A warm
highlight (`--site-pop #E2A23C`) is used for stars/season tags.

## Fonts (load from Google Fonts)

- **Heading** — `Schibsted Grotesk` (default, `data-font="grotesk"`) or
  `Newsreader` serif (`data-font="syne"`).
- **Body** — `Hanken Grotesk` (both).

## Shape (`data-shape`)

- `round` → 18 / 11 / 16px, pill 999px  (default, ≈ "lg")
- `edge`  → 3 / 2 / 3px, pill 3px  (≈ "none")

## Alternate palettes (`data-theme`)

**Slate (cobalt)** — cool neutral / indigo
```
bg #FAFAFB · surface #FFFFFF · ink #16181D · mute #6C7180 · line #E5E7EC · accent #3A5BD0 · accentInk #FFFFFF
```
**Sage (olive)** — soft green
```
bg #FAFAF6 · surface #FFFFFF · ink #1A1B14 · mute #717363 · line #E6E8DC · accent #5C7045 · accentInk #FFFFFF
```

## Token map (what drives what)

| Concern | Tokens |
| --- | --- |
| Palette | `--site-bg --site-surface --site-ink --site-mute --site-line --site-accent --site-accent-ink --site-secondary --site-secondary-ink --site-pop` |
| Supporting | `--site-soft (panel) --site-sh-1 --site-sh-2 --site-sh-3` |
| Type | `--site-font-heading --site-font-body --site-h1…--site-h6 --site-text-base --site-text-sm --site-text-accent --site-weight-heading --site-weight-body --site-leading-heading --site-leading-body --site-tracking-heading --site-tracking-body` |
| Shape | `--site-radius --site-radius-sm --site-radius-img --site-radius-pill` |
| Buttons | `--site-btn-primary-{bg,color,border,radius} --site-btn-secondary-{bg,color,border,radius}` |
| Cards / images | `--site-card-{border,radius,shadow,ratio} --site-img-{border,radius,shadow}` |
| Icons / social | `--site-icon-color --site-social-{bg,fg,border,radius}` |

All declared with hard fallbacks in `theme.css`; every selector is scoped under
`.wielo-theme`. Apply the theme by putting `class="wielo-theme"` and the
`data-theme/font/shape` attributes on the root element.
