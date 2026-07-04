# Builder background media + Profile element — plan

Follows Business Principle #7 (plan → phases → save point per phase). Two features,
each shipped phase-by-phase (green build → commit → push to `main`).

## Grounding (existing code to reuse)

- **Block/section background:** `blockStyle.backgroundImage` (URL/asset path, max 500)
  in `sections.schema.ts`; applied by `frameRules` + `blockFrameStyle` in
  `components/site/sections/_shared.tsx` (`background-image:url(...)`, cover/centre).
  Inspector control today = a plain **"Background image" TextRow** (paste a URL) in
  `BuilderShell.tsx`.
- **Generic media upload (reuse):** `createWebsiteMediaUploadUrl(websiteId, ext)` →
  browser `supabase.storage.from("website-assets").uploadToSignedUrl(...)` →
  `registerWebsiteMediaAction(...)`. Used by `IconPicker.tsx`. Assets resolve via
  `websiteAssetUrl(path)` (`lib/website/assets.ts`).
- **Video today:** only a free-form `video` block (`VideoSection.tsx`, YouTube/Vimeo
  → embed URL via regex). No background video. No block-level overlay (hero has
  `overlay`/`overlayColor`/`overlayOpacity`; blocks only have a `background` scrim).
- **Profile data:** `hosts` table has `avatar_url, bio, display_name, avg_rating,
  total_reviews, is_superhost, is_verified`. A manual `host_bio` block exists (no
  auto-pull). `Stars({rating})` in `_shared.tsx` renders ratings.
- **Auto-populate block recipe (7 steps):** schema type + `AUTO_POPULATE_SECTIONS` +
  `sectionSchema` union → `WIDGET_DEFS` (`autoPopulate:true`, `dataKey`) → `types.ts`
  `SiteDataByType` shape → loader in `loadSitePage.ts` `assembleSiteDataByType` →
  `case` in section-data assembly → renderer component. (amenities is the template.)

---

## Feature I — Background media + overlay (any block/section)

**Phase 1 — Background image upload/pick.** Replace the paste-URL TextRow with a
`MediaField`: thumbnail + "Upload / replace" (reuse `createWebsiteMediaUploadUrl` →
`uploadToSignedUrl` → `registerWebsiteMediaAction`) + "Remove". Writes the stored
asset path to `blockStyle.backgroundImage`. Renders unchanged (already an
`url(...)`). Verify canvas + publish.

**Phase 2 — Background video (YouTube/Vimeo).** Add `blockStyle.backgroundVideo`
(a YouTube/Vimeo URL; reuse `VideoSection`'s embed-URL parser, extracted to a shared
`lib/website/videoEmbed.ts`). Render a muted/looping/cover background `<iframe>`
behind the block content in `frameRules`/`blockFrameStyle` (+ v2 renderer). Inspector:
a "Background type" switch (Image / Video) so image and video are mutually exclusive.

**Phase 3 — Overlay controls.** Add `blockStyle.overlayColor` + `blockStyle.overlayOpacity`
(0–100). Render a scrim layer over the bg image/video (colour + alpha). Inspector:
the unified `ThemeColorPicker` for overlay colour + an opacity slider. Applies over
both image and video backgrounds.

## Feature II — Profile element

**Phase 4 — `profile` auto-populate Wielo block.** New block that pulls the site's
host: avatar, display name, bio/description, `avg_rating` + `total_reviews` (Stars),
`is_superhost`/`is_verified` badges. Follow the 7-step recipe (schema →
`AUTO_POPULATE_SECTIONS` → registry `autoPopulate:true dataKey:"profile"` → `types.ts`
`ProfileData` → loader in `loadSitePage.ts` (query `hosts` for the site's business) →
assembly case → `ProfileSection.tsx` renderer with variants + `--el-*` styling +
`--site-*` theme colours). Host can style but data is live.

Each phase: `tsc` + `eslint` + vitest green → commit → push. Live-verify where the
shared preview allows.
