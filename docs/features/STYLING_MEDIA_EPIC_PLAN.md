# Styling + Media epic — plan (2026-07-05)

Founder batch: apply the unified styling controls everywhere, universal media
(image + video) on every block/element, a reusable upload component app-wide, plus
builder consistency fixes, Brand Studio upgrades, and a designed search-results
flow. Delivered in committed phases (Business Principle #7), each verified on the
canvas AND live (Principle #8).

## Already shipped this session
- Unified styling-control library + review page (`/style-lab`), Principle #8.
- Colour picker unified app-wide (transparent + opacity + z-index portal) — `8609e21f`.
- Media-library modal (upload OR pick from library) on every image control — `ea372d4e`.
- Hero/host-bio/highlights per-card images — `c89daed2`.
- Element styling standardised + room-detail breadcrumb — `b4817190`.

## Phases (this epic)

### A — Universal background media (image + video) on ALL blocks + elements
Every section/block/element inspector exposes: background **image** (via the media
modal) + background **video** (YouTube/Vimeo) + overlay. Today sections have it;
audit whether widgets/elements do and close the gap. Renderer already reads
`node.style.{backgroundImage,backgroundVideo,overlayColor,overlayOpacity}` in
`PageDocRenderer` for sections — extend to widget leaves where missing.

### B — Reusable upload component applied app-wide (incl. social share)
Consolidate on ONE upload UX (the media-library modal via `useMediaPicker`). Apply
to Page Settings → social-share OG image (currently URL-only) and anywhere else an
image is set. Component: `MediaControl`/`MediaField` + `MediaPickerProvider`.

### C — Room-detail booking button styling
Per-element button styling (colour/bg/border/radius/hover) via `--el-button-*` on
the room booking button; **text always centered**; style the button, NOT the label
(label is dynamic: Check availability / Continue to book / Unavailable).

### D — Builder consistency
- D1 Footer canvas = live: the footer builder preview renders the REAL footer.
- D2 Mobile-menu dropdown styling controls (drawer submenu colours).
- D3 Header border controls + shadow opacity (shadow colour already carries opacity
  via ColorControl; add explicit header border color/width).
- D4 Two-highlights element-naming: elements are node-scoped (`--el-*` per node id)
  so no CSS collision — fix the UI so the two blocks are distinguishable / rename.

### E — Brand Studio upgrades
- E1 Link hover-state colour control.
- E2 Brand Studio canvas includes the live menu → navigate pages while designing.
- E3 Add the most-used social networks + basic icon designs.

### F — Search-results epic (designed, website-scoped)
- F1 Plan (dedicated section below once mapped).
- F2 Designed search-results page, previewable/editable in the page builder.
- F3 Live "Check availability" → redirects to it with from/to/guests.
- F4 Room cards + "Book now" → website checkout with dates pre-filled (still editable).
- F5 Show ALL rooms, available first, unavailable clearly indicated.

## Principle for every phase
Edit → canvas updates live → publish makes it live (Principle #8). Verify BOTH.
`pnpm build` while the preview server runs corrupts `.next` — use `tsc --noEmit` +
`next lint`. Commit + push to `main` per phase.
