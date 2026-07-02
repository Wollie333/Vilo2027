# Builder × Theme — Pixel-Perfect Pipeline Plan

> **Goal (founder, 2026-07-02):** A host clicks **View theme preview** on a theme
> card → a standalone page shows the **pixel-perfect** theme with **stock images +
> stock data**. On **Activate**, the system pulls in the host's **real** data
> (rooms, amenities, rates…) into **all pages including system pages**, styled by
> the active theme (Wielo blocks = *theme controls the style, the system controls
> the data*). The host can then edit pages in the **Page Manager / builder**;
> missing data is filled via a **modal that writes to the app's real tables** (not
> static website content) — only on Wielo blocks. Finally the host can **override
> the active theme's style per block**. It must work easily and smoothly.

## Locked decisions (2026-07-02, founder)

1. **Gate point = go-live only.** Explore / preview / design is always open. The
   hard requirements only block **Publish / accept bookings** — not creation or
   preview. (Motivation loop: wall at the exciting moment, not the front door.)
2. **Standalone setup wizard** (first-run for a new host) that **forces the host
   through each required step** to have a working website. Where data already
   exists (rooms, payment methods in Settings, policies) the wizard **picks it up**
   and lets the host **edit it or select it for use**; where it's missing the host
   **must add it**. **Mirror the multi-step form pattern of "Create new booking."**
3. **Hard-required set (blocks go-live):** property/business **name** · ≥1 **active
   bookable room** with base price + ZAR · ≥1 **payment method** (Paystack / PayPal /
   manual EFT) · **subdomain** · **cancellation/house-rules policy** (policies are
   HARD, not defaulted). Soft (warn, theme fills the gap): logo, photos, amenities,
   contact, reviews.
4. **Every page — static AND system-template — must (a) inherit the active theme
   style and (b) be editable in the builder.** Wielo blocks are the mechanism.
5. **Required Wielo blocks per system template.** Each page kind has a contract of
   blocks it *needs to function*. The builder must:
   - **Show system-template blocks in the sidebar library** (grouped, page-kind gated).
   - **Indicate in the UI which blocks are REQUIRED** for that page kind.
   - **Refuse to save/publish** a system page that is missing a required block
     (safety — page can't silently break).
   - Guard required blocks against accidental deletion (lock / re-add prompt).
6. **End-to-end goal:** host activates a theme → system pulls in the host's real
   details where applicable → builder lets the host customise using Wielo blocks
   (theme = style, system = data), on every page including system pages.

## Ground truth (from the 2026-07-02 code map — what already exists)

- **ONE generic renderer.** All themes render through `GenericSection`
  (`components/site/SectionRenderer.tsx`) and the nested V2
  `components/site/v2/PageDocRenderer.tsx`, styled purely by `--site-*` CSS vars
  from `buildSiteVars()` → `SiteThemeRoot`. No per-theme section components.
- **Preview** — `ThemeGallery.tsx` "View theme preview" opens a new tab at
  `/{locale}/site?site=<sub>&preview=1&theme=<slug>`. `loadSitePage.ts`
  (`resolveThemePreviewPages`) renders the **theme's own** `page_templates`
  (from `site_themes.page_templates`) merged via `mergeStandardPages`, then
  assembles **the host's LIVE data** into the auto-populate blocks.
  → *Gap:* not pure "stock" — empty blocks when the host has no rooms/photos yet.
- **Activation** — `applyThemeAction()` (`dashboard/website/actions.ts`) backs up
  (`captureRestorePoint`), deletes all `website_pages`, seeds the theme's merged
  page set (all standard + **system** pages via `mergeStandardPages`; `room_detail`
  seeded separately) into **both** `draft_sections` + `published_sections` (goes
  live immediately), sets `host_websites.theme = { preset, base }`, clears
  `published_snapshot`. Auto-populate blocks then fetch the host's **real** data at
  render. → *This already implements "activate pulls real data into all pages,
  styled by theme."*
- **Per-block style override** — `blockStyle` **schema already exists** on
  `SectionNode` (`lib/website/sections.schema.ts` + `pageDoc.schema.ts`):
  background, per-device padding/margin, border, borderColor, radius, maxWidth,
  minHeight, headingSize/Weight, bodySize/Weight; applied by `SectionWrap` /
  `frameRules()`. → *Gap:* the builder Inspector **Style** tab only exposes tone +
  background; the rest are unplugged from the UI.
- **Wielo-block data editing** — **does NOT exist.** The Inspector edits presenter
  props only (heading, count, toggles). Underlying data (`property_rooms`,
  amenities, `property_seasonal_pricing`, photos) is only editable in the
  Properties manager. → *Net-new work.*

## Key files (anchors)

- Preview/activation: `app/[locale]/dashboard/website/actions.ts`
  (`applyThemeAction`), `lib/site/loadSitePage.ts`
  (`resolveThemePreviewPages`, `assembleSiteDataByType`),
  `lib/website/standardPages.ts` (`mergeStandardPages`).
- Theme card UI: `app/[locale]/dashboard/website/[websiteId]/(editor)/theme/ThemeGallery.tsx`.
- Renderer + styling: `components/site/SectionRenderer.tsx`,
  `components/site/v2/PageDocRenderer.tsx`, `components/site/sections/_shared.tsx`
  (`Card`, `frameRules`, `sectionToneStyle`), `lib/site/themes.ts` (`buildSiteVars`).
- Builder: `app/[locale]/builder/BuilderShell.tsx` (Inspector L1681-2028),
  `lib/website/widgets/registry.ts` (WIDGET_DEFS), `lib/website/pageDoc.schema.ts`,
  `lib/website/pageDocOps.ts`.
- Date picker: `components/site/ThemedDateRange.tsx` (now portaled).

---

## Phases (each ends with a SAVE POINT)

### Phase 0 — Alignment/z-index: search fields + datepicker visible & clickable
**Why first:** concrete visible bug; a partial fix (`ThemedDateRange` portal) is
already written but uncommitted.
- Commit the `ThemedDateRange` portal fix (position:fixed popover in `document.body`).
- Fix non-portaled clipping: `Card` is `overflow-hidden` and `frameRules()`
  auto-adds `overflow:hidden` on any radius → clips search inputs / hero search
  bar. Scope search/booking sections so their fields are never clipped.
- Verify `HeroSearchBar` (rendered inside hero) and booking docks show all fields;
  fix sticky-header vs search z-index if it overlaps.
- **Verify visually** on a themed page before closing.

### Phase 1 — Preview = pixel-perfect STOCK
- In `preview=1&theme=` mode, when the host lacks real data, fall back to
  **stock/demo data** for auto-populate blocks (rooms, gallery, reviews, rates) so
  the preview always renders the designed layout with stock content — truly
  pixel-perfect regardless of host data.
- Confirm the standalone preview is clearly a preview (not the host's live site).

### Phase 2 — Activation → real data into ALL pages incl. system pages, themed + editable
- Verify + harden `applyThemeAction`: every standard + system page seeded
  (home, rooms, specials, experiences, gallery, about, contact, search_results,
  room_detail), all inherit the theme, live data flows post-activation.
- Confirm **checkout / thank-you / other system routes** inherit the theme
  (`SiteThemeRoot` wrapping).
- Confirm every seeded page (incl. system templates) **opens and edits in the
  builder** (they're just `website_pages` rows → PageDoc).

### Phase 3 — Required Wielo blocks per system template (safety contract)
- Author a **page-kind → required-blocks contract** (SSOT, e.g.
  `lib/website/pageContract.ts`): e.g. `room_detail` requires
  room_gallery + room_overview + room_rate + room_policies; `search_results`
  requires search_results; `rooms` requires rooms_preview; `checkout` requires the
  checkout block; `contact` requires contact_form. Reuse existing `pageKinds` gating.
- **Sidebar library** surfaces the system blocks for the current page kind (the
  `"system"` group already exists) and **badges which are REQUIRED**.
- **Builder validation:** saving/publishing a system page **fails with a clear
  message** if a required block is missing; the missing block is one-click
  addable. Guard required blocks from accidental delete (lock / confirm + re-add).
- **UI indicators:** required blocks show a "Required" badge on the canvas node +
  in the library; a per-page readiness strip shows "2/3 required blocks present."

### Phase 4 — Wielo-block DATA modals (edit real app data from the builder)
- On property-sourced blocks, add an **Edit data** affordance in the Inspector that
  opens a modal writing to the **real tables** (`property_rooms`, amenities,
  `property_seasonal_pricing`, photos) — data pulls from the right place, never
  static website content. Only on Wielo blocks.
- Likely sub-sliced per block family (rooms, amenities, rates, gallery).

### Phase 5 — Per-block STYLE override UI
- Expose the existing `blockStyle` fields (border, borderColor, radius, maxWidth,
  minHeight, heading/body size+weight, per-device) in the Inspector **Style** tab so
  the host restyles individual blocks over the theme default. Reset-to-theme control.

### Phase 6 — Standalone first-run Setup Wizard + go-live readiness gate
- **`checkWebsiteReadiness(hostId)` SSOT** → `{ ready, missing[] }` against the
  hard-required set (name · active room+price · payment method · subdomain ·
  policy). Reused by the wizard, the builder **Publish** button, and a dashboard
  readiness card. (Build the SSOT when Phase 3's publish validation lands; the
  wizard consumes it here.)
- **Standalone wizard**, multi-step like **"Create new booking"** (`ManualBookingForm`
  pattern): steps for Basics (name/subdomain/logo), Rooms (**picks up existing**
  rooms → edit/select, or add), Payments (**picks up** configured methods → select,
  or add), Policies (pick up / author), Theme + palette, then **Build & publish**.
- The wizard **forces** completion of each required step — the final Build/Publish
  is disabled until `checkWebsiteReadiness` is green. On finish: activate theme +
  publish → "your website is live & accepting bookings."
- Replaces the current `CreateWebsiteCard` (see `WEBSITE_WIZARD_PLAN.md`).

> **Ordering note:** the readiness SSOT is shared between Phase 3's publish gate and
> Phase 6's wizard — it can be pulled forward if we want the Publish gate live
> sooner. Phases 4/5 are independent and can slot around 3/6 as priorities shift.

---

## Save-point routine (run after EVERY phase)
1. `pnpm build` + `tsc --noEmit` + `pnpm lint` all green (never save red).
2. `git commit` (conventional) + `git push origin main`.
3. Update the **GitHub README** status/progress section.
4. Update this file's Progress log + `CURRENT_TASK.md` anchor + `CHANGELOG.md` +
   memory (`project-builder-v2.md`) with the exact commit hash.

## Progress log
- _2026-07-02_ — Plan authored. Ground-truth code map complete (4 areas).
- _2026-07-02_ — ✅ **Phase 0 DONE.** `ThemedDateRange` portals to `document.body`
  (fixed pos, z-index 2147483000) → calendar never clips under the booking `Card`
  overflow or later stacking contexts; follows trigger on scroll/resize; portal-aware
  outside-click. Verified live on the Safari room-detail dock (popover fully in
  viewport, day cells hit-testable). `tsc` + `lint` + `pnpm build` green.
- _2026-07-02_ — ✅ **Phase 1 DONE.** Theme preview (`?preview=1&theme=`) now fills
  auto-populate blocks with **stock** data via `sampleDataForFlatSections()`
  (`lib/site/sampleSite.ts`, shares `sampleDatumFor` with `sampleDataForDoc`), wired
  into `loadSitePage`'s theme-preview branch in place of live `assembleSectionData`.
  Verified live on Safari: stock rooms (Garden Suite/Family Cottage/The Loft) + stock
  reviews render, host brand retained; no console errors. `tsc`+`lint`+`build` green.
  **Scoping note:** room-detail preview still needs a real room (its loader 404s
  without one) → for a no-rooms host, room-detail isn't in the preview nav. Pure-stock
  room-detail preview deferred (would need a preview branch in `loadSiteRoomPage`
  injecting `DEMO_ROOM_DETAIL`). Next: Phase 2 (activation hardening).
- _2026-07-02_ — ✅ **Phase 2 DONE (verification pass — no code change needed).**
  Confirmed the activation pipeline already meets the requirement, against the live
  vilotest fixture + code. **Page set:** `applyThemeAction` reseeds all pages;
  `mergeStandardPages` guarantees the 7 required marketing pages + `search_results`;
  `room_detail` seeded separately (actions.ts L291); `loadPagesList.ts`
  `ensureRoomDetailPage`/`ensureSearchResultsPage` (L166-167) lazily guarantee both
  system templates. Fixture = 11 pages incl. checkout/thank-you/search_results.
  **Theme inheritance:** checkout, thank-you, search-results all 200 + carry the Safari
  accent `--site-accent:#B26C2E`. **Real vs stock:** the LIVE (non-preview) site renders
  real rooms (Olive Room/…); preview renders stock; no leak. **Builder-editable:**
  `builder/page.tsx` `loadRealPage` loads ANY page row (no kind exclusion) + lists all +
  converts flat→PageDoc, so every system page opens/edits in the builder. Known-benign:
  the fixture lacks a `room_detail` row (seed artifact) → self-heals via
  `ensureRoomDetailPage`. No source changed (Phase-1 build stands). Next: Phase 3
  (required system-blocks).
- _2026-07-02_ — ✅ **Phase 3a DONE (contract SSOT + publish guard + tests).** New
  `lib/website/pageContract.ts` = SSOT for required Wielo blocks per page kind
  (`room_detail` → room_gallery/overview/rate/policies; `search_results` →
  search_results; `rooms` → rooms_preview; everything else free-form). Exposes
  `requiredWidgetsForPageKind` · `isWidgetRequiredOnPage` · `docWidgetTypes` ·
  `missingRequiredWidgets(doc,kind)` · `missingRequiredFromRaw(raw,kind)` (publish
  backstop; enforced on Builder V2 PageDocs only, legacy flat pages skipped).
  `publishBuilderDocAction` now rejects with `missing_required_blocks` if a required
  block is absent. 11 vitest (pageContract.test.ts). `tsc`+`lint`+`build` green.
  Next: **Phase 3b** — builder UI (library "Required" badges + delete guard + readiness).
- _2026-07-02_ — ✅ **Phase 3b DONE — Phase 3 COMPLETE.** Builder UI in
  `BuilderShell.tsx`: (1) library cards show a **"Req"** badge on blocks required for the
  current page kind (`isWidgetRequiredOnPage`); (2) the selected node's canvas badge shows
  a **"Required"** chip; (3) **delete guard** — `doDelete` simulates the removal and blocks
  it (with a toast) if it would strip a required block from the page (add another first);
  (4) **publish guard** client-side — `doPublish` names the missing blocks instead of a
  bare server reject (backed by the 3a server guard). `isWidgetRequiredOnPage` now takes a
  plain string (node types are the broad renderable union). **Verified live** (logged in as
  host@vilotest.com) on the room_detail page: library shows Req on exactly Room Gallery/
  Overview/Rate/Policies (not the optional Amenities); selecting a required block shows the
  Required chip; deleting it is blocked (7→7 widgets, toast fired). `tsc`+`lint`+11 vitest+
  `build` green. Next: Phase 4 (Wielo-block data modals).
- _2026-07-02_ — ✅ **Phase 4a DONE (rooms data modal).** Founder chose: ship the modal now,
  real-data-on-canvas later (4b); rooms first. New `fetchBuilderRoomsAction()`
  (`dashboard/website/actions.ts`) loads the host's REAL rooms RLS-scoped; new
  `builder/RoomDataModal.tsx` lists them + edits name/price/max-guests/description/active and
  saves via the EXISTING `updateRoomAction` (property_rooms SSOT — reused, not forked). The
  inspector shows an **"Edit room data…"** button on room-family blocks (`ROOM_DATA_BLOCKS`:
  rooms_preview/el_room_card/room_gallery/overview/amenities/rate/policies). **Verified live**
  end-to-end as host@vilotest.com: opened on room_detail → modal loaded the real rooms (Olive
  Room/Delux/Vineyard/Mountain, no demo leak) → changed Olive Room price 1300→1355 → Save →
  **DB `property_rooms.base_price` = 1355** (then reverted to 1300 to keep the fixture clean).
  Hit + fixed the stale-`.next` vendor-chunks issue (from running `pnpm build` while the dev
  server shares `.next` — cleared `.next` + restarted). `tsc`+`lint`+`build` green. **Deferred
  to 4b:** Add-room (needs property picker), other block families (amenities/rates/gallery),
  and rendering the host's REAL data on the builder canvas so edits show in-place. Next: 4b.
