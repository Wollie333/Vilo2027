# Theme designs (originals)

The founder's original, pixel-perfect theme designs — the reference source for
building each theme's public pages in the app. Kept here so we can always look
back at them for fidelity, inspiration, and edits. **Do not treat these as build
output; they are the design source of truth.**

Each folder is a complete static site export (HTML per page + `theme.css` +
`*.js` + `base.md` spec + a Style Guide), authored by the founder.

## Folders → app themes

| Design folder    | App theme slug | Notes |
| ---------------- | -------------- | ----- |
| `Ocean Lodge`    | `oceansview`   | Bright beach resort (Camps Bay). Home/About/Room/Rooms/Specials/Journal/Contact/Gallery/Experiences/Booking. |
| `NenGama Lodge`  | `safari`       | Unfenced Waterberg safari lodge (dark bands, savanna palette). |
| `Marmalade House`| `marmalade`    | Warm guesthouse "postcards" (Gloock display, berry accents). |
| `Hotel`          | _(urban hotel)_ | City-hotel design — maps to the hotel/editorial theme. |

## How these are used

- The **room-detail** page for `oceansview` is a faithful port of
  `Ocean Lodge/Room.html` (see `apps/web/components/site/oceansview/`).
- Home / About / Rooms / Specials / Journal / Contact per theme are being brought
  to pixel-perfect fidelity against these files, page by page, fully responsive.
- Colour/type/shape come from each design's `theme.css` `--site-*` tokens, which
  the app mirrors via `buildSiteVars` + `theme-skins.css`.

Pages present vary slightly per design (e.g. `Hotel` adds `Rates.html`; some carry
`(v1 backup)` variants). Prefer the non-backup, latest file for each page.
