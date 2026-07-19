# Royal Hotel — Wielo theme base

A clean, contemporary grand-hotel theme: a tight modern grotesk display, warm
charcoal ink, generous whitespace and a single champagne-gold accent. Everything
visual derives from the `--site-*` tokens declared in `theme.css` (in the
`.wielo-theme` block), so the CMS can override any of them at runtime. Three
palettes ship; **Charcoal** is the default. Two display fonts and two corner
styles are wired.

## Base spec (default · "Charcoal")

```
palette: {
  bg:        #FFFFFF   // page background
  surface:   #FFFFFF   // cards / raised panels
  ink:       #1B1915   // primary text (warm charcoal)
  mute:      #6B655B   // secondary text
  line:      #E7E1D6   // borders / dividers
  accent:    #B08948   // champagne gold — buttons, links, highlights
  accentInk: #FFFFFF
}
headingFont: "Archivo"   bodyFont: "Manrope"
radius: sm               // 9px base, 12px cards, 6px buttons (refined)
```

Secondary accent: `secondary #23201B` (espresso — tags, "Book" CTA, quote marks).
A near-black charcoal (`--site-navy #16130E`) anchors the footer and dark
sections; `--site-soft #F6F3ED` is the warm stone fill; `--site-tint #F1E8D6` a
pale champagne chip fill.

## Fonts (Google Fonts)
- **Display** — `Archivo` (default, `data-font="grotesk"`) or `Space Grotesk`
  (`data-font="archivo"`). Both tight, confident modern sans.
- **Body** — `Manrope`.

## Shape (`data-shape`)
- `rounded` → 9 base · 12 lg · 16 xl · 10 img · 6 buttons (default, refined-soft)
- `sharp`   → ~2px across the board

## Alternate palettes (`data-theme`)
**Stone** (`riviera`) — cool graphite + muted bronze. **Sage** (`seaglass`) —
soft warm olive-green + antique gold. Both keep white surfaces and charcoal text.

## Token map, nav states, components
Identical contract to the Wielo theme system: all colours/type/shape/buttons/
cards/images/icons driven by `--site-*` with hard fallbacks, every selector
scoped under `.wielo-theme`. Apply with `class="wielo-theme"` +
`data-theme/font/shape` on the root. Nav has `.nav.over` (transparent over hero)
and `.nav.solid` (on scroll). Brand mark is an "R" monogram in a gold tile.
Pages: Home, Rooms, Room, About, Experiences, Gallery, Journal (+ 3 posts),
Specials, Search Results, Booking, Contact, Thank You, Style Guide.
