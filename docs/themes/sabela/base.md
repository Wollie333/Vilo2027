# Sabela Lodge — Wielo theme base

A dark-first, editorial safari-lodge theme. Everything visual derives from the
`--site-*` tokens declared in `theme.css` (in the `.wielo-theme` block), so the
CMS can override any of them at runtime. Three palettes ship; **Ebony** is the
default. Two alternate heading fonts and two alternate radii are also wired.

## Base spec (default)

```
palette: {
  bg:        #14120D   // page background (deep ebony)
  surface:   #1C1913   // cards / raised panels
  ink:       #F1EADB   // primary text (warm bone)
  mute:      #A99B7F   // secondary text
  line:      #2B2618   // borders / dividers
  accent:    #C9A24A   // brand gold — buttons, links, highlights
  accentInk: #15120B   // text/icons on top of the accent
}
headingFont: "Cormorant Garamond"   bodyFont: "Inter"
radius: sm                          // 4px global corner (sharp)
```

Optional secondary accent: `secondary #E7DCC4` / `secondaryInk #15120B`.

## Fonts (load from Google Fonts)

- **Heading** — `Cormorant Garamond` (default), or `Plus Jakarta Sans` (modern),
  or `Space Grotesk` (grotesk). Set via `data-font="editorial|modern|grotesk"`.
- **Body** — `Inter` (all variants).
- Mono (IDs / references): `JetBrains Mono`.

## Radius (`data-radius`)

- `sharp` → 4 / 6 / 3px  (default, ≈ "sm")
- `soft`  → 16 / 24 / 11px  (≈ "lg")
- `round` → 24 / 34 / 16px  (≈ "xl")

## Alternate palettes (`data-theme`)

**Savanna** (warm light)
```
bg #F8F3EA · surface #FFFFFF · ink #2B2114 · mute #8A7558 · line #E6DCC8 · accent #B0793C · accentInk #FFFFFF
```
**Stone** (cool light)
```
bg #F6F5F1 · surface #FFFFFF · ink #26271F · mute #7C7E70 · line #E1E0D6 · accent #6E7B5E · accentInk #FFFFFF
```

## Token map (what drives what)

| Concern | Tokens |
| --- | --- |
| Palette | `--site-bg --site-surface --site-ink --site-mute --site-line --site-accent --site-accent-ink --site-secondary --site-secondary-ink` |
| Supporting | `--site-soft --site-soft-2 --site-tint --site-foot --site-foot-ink --site-foot-head --site-cta-bg --site-cta-ink --site-cta-accent --site-ring --site-hero-overlay` |
| Type | `--site-font-heading --site-font-body --site-h1…--site-h6 --site-text-base --site-text-sm --site-text-accent --site-weight-heading --site-weight-body --site-leading-heading --site-leading-body --site-tracking-heading --site-tracking-body` |
| Shape | `--site-radius --site-radius-lg --site-radius-sm` |
| Buttons | `--site-btn-primary-{bg,color,border,radius} --site-btn-secondary-{bg,color,border,radius}` |
| Cards / images | `--site-card-{border,radius,shadow,ratio} --site-img-{border,radius,shadow}` |
| Icons / social | `--site-icon-color --site-social-{bg,fg,border,radius}` |

All of the above are declared with hard fallbacks in `theme.css` and every
selector in that file is scoped under `.wielo-theme`. Apply the theme by putting
`class="wielo-theme"` and the `data-theme/font/radius/hero` attributes on the
root element.
