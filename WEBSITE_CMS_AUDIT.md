# Website CMS — Phase 0 Audit (point-in-time)

**Date:** 2026-06-20 · **Branch:** `main` · **Method:** clean build + 4 independent
code audits (pages/sections, renderer/sections, blog/rooms, brand/theme/domain/seo/publish).

## Headline

The host's impression — *"very raw, mostly not working"* — is **not supported by the
code.** `pnpm build` passes (exit 0, full route manifest). All four audits independently
concluded the CMS is **mature and round-trips to the DB**: create/edit/reorder/delete/
save all work across pages, sections, blog, rooms; brand/theme/publish/restore are
polished; domain is real Vercel integration (env-gated). There are **no stub managers**
and **no TODO/FIXME markers** in the website tree.

## Why it *feels* broken (perception vs reality)

1. **Empty-state placeholders.** Auto-populate sections (gallery, rooms, reviews,
   specials, blog) show "your X appears here" when nothing is published yet. On a fresh
   site this reads as "broken" but is intended.
2. **Silent save failures.** A single invalid field rejects the *entire* page save with a
   vague toast, and there's **no autosave / no unsaved-changes guard** — so edits get
   lost on navigation. This is the most likely real cause of the complaint.
3. **A few dead controls** (specials preview blank in builder, location map never renders,
   hero per-section align ignored) that look like breakage.

## Progress (2026-06-20)

- ✅ **B1** fixed — `rich_text` sanitised on write + at the render chokepoint
  (`lib/website/sanitiseSections.ts`, `actions.ts`, `loadSitePage.ts`).
- ✅ **M1** fixed — section builder now validates-before-save (names the bad section),
  autosaves valid drafts (~1.5s debounce), and guards against unsaved-tab-close.
- ✅ **M2** fixed — `specials_preview` now renders in the builder preview.
- ✅ **M3** fixed — location `mapEmbedUrl` built from city/province/country
  (`loadSitePage.ts`); `show_map` now works.
- ✅ **M4** fixed — home page locked from drag + pinned to `nav_order` 0
  client- and server-side (`PagesManager.tsx`, `actions.ts`).
- ✅ **M5** fixed — `resolveDefaultThemeId` falls back to `preset:warm`
  (`DEFAULT_PRESET`) instead of the dangling `preset:classic` (`restorePoints.ts`).
- ✅ **M6 (type regen)** verified — `supabase gen types --linked` output is
  **byte-identical** to the committed `database.types.ts`; `site_themes`/
  `website_restore_points` already defined. Regen is a no-op (was done in `main`).
  The `as unknown as SupabaseClient` casts are **not** a missing-types problem —
  `createAdminClient()` is schema-untyped app-wide (no `<Database>` generic).
  Properly typing them = make the shared admin client generic (app-wide change,
  separate task — NOT Phase 0). Stale "not in types" comment corrected.
- ✅ **Minors** fixed — half-star rating (`_shared.tsx`, committed `7e8fccc`);
  hero per-section align honored (`HeroSection.tsx`) and preview banner no longer
  overlaps the sticky header (`PreviewBanner.tsx`) — these two ride uncommitted
  with the in-progress brand work.
- Verified: clean `pnpm build` (exit 0) + ESLint clean on all changed files.
- Commits: `7d57378` (B1/M1/M2), `4f53bd5` (M3/M4), `1b79f5e` (M5),
  `35263f5` (M6 comment), `7e8fccc` (half-star).
- **Remaining: O1/O2 ops secrets only (your environment).** Optional follow-up:
  app-wide admin-client `<Database>` typing.

## Consolidated fix-list

### 🔴 BLOCKER (security — fix before any deploy)
- **B1. Stored XSS in `rich_text` sections.** `RichTextSection.tsx:16`
  `dangerouslySetInnerHTML` renders **unsanitised** `props.html`. The "sanitised by
  loader" comment is false — `loadSitePage.ts` only sanitises blog bodies; the write path
  (`saveDraftSectionsAction`, `actions.ts:808`) and schema (`sections.schema.ts:191`,
  `z.string().max(50000)`) store raw HTML. Sanitise on write **and** render. Violates
  CLAUDE.md security rules.

### 🟠 MAJOR (functional / "feels broken")
- **M1. Save UX = silent data loss.** Atomic Zod reject → generic toast, no field-level
  errors, no autosave, no `beforeunload`/route guard (`SectionBuilder.tsx`,
  `SectionEditor.tsx`, `actions.ts:786`). Required-but-blankable fields (`hero.headline`,
  `cta.button_label/href`, `intro.body`, `map.address`, `rich_text.html`) let a host build
  an unsavable page. → inline validation + field errors + autosave/unsaved guard.
- **M2. `specials_preview` blank in builder preview.** Missing case in `buildPreviewData`
  (`SectionBuilder.tsx:70-100`) though the renderer + data pool support it.
- **M3. Location map never renders.** `mapEmbedUrl` hardcoded `null`
  (`loadSitePage.ts:792`) while `show_map` defaults true → the toggle is a no-op.
- **M4. Home page is draggable / not pinned.** No drag-lock for `kind==="home"`
  (`PagesManager.tsx`), and `savePagesAction` writes array index as `nav_order` with no
  home-pinning (`actions.ts:1043`) → Home can be reordered out of first position.
- **M5. Default-theme fallback mismatch.** `restorePoints.ts:235` falls back to
  `preset:classic`, but only `warm`/`coastal` presets exist (`themes.ts`) → silent
  wrong-state (no active theme highlighted, base resolves to `warm`).
- **M6. Type hygiene / generated types stale.** Multiple
  `createAdminClient() as unknown as SupabaseClient` casts because `site_themes`,
  `website_restore_points`, analytics + media tables aren't in
  `packages/types/database.types.ts`. Regen types (CLAUDE.md rule) and drop the casts.

### 🟡 MINOR
- Hero per-section `align` prop dead (`HeroSection.tsx` reads only theme-level).
- `Stars` rounds average → no half-stars (`_shared.tsx:137`).
- PreviewBanner + header both `sticky top-0` → header scrolls under banner in preview.
- Enum `as Layout` casts (`SectionEditor.tsx:509,541,649`); RSS enclosure hardcodes
  `image/jpeg`; blog index passes already-resolved URL through `siteAsset()` (harmless).
- Price like `"1."` can pass client filter, rejected server-side with generic error.

### ⚙️ OPS / CONFIG (inert until secrets — verify in prod)
- **O1. Custom domains** inert until `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` set (real
  integration, just gated).
- **O2. Scheduled blog publish** silently never runs until Vault secret
  `blog_publish_url` is created (`20260619006000_blog_publish_cron.sql:12`). Cron + worker
  are otherwise functional.

### 📋 CONTENT GAPS (planned features, not bugs)
- **Tags** don't exist at all (no table/UI) — Phase 7 work.
- **Categories** are author-only; no public `/blog/category/[slug]` or filter — content
  visibility gap.

## Implication for the plan

Phase 0 is **much smaller than feared** — not "rebuild the raw core" but a targeted
**fix + harden** pass: B1 (security), M1 (save UX, which overlaps the planned
autosave/undo work), M2–M6, type regen, and verifying the two ops secrets. Empty-state /
onboarding polish is partly addressed later by the AI generator (Phase 5) and stock
content. The mature foundation means Phases 1+ can proceed with confidence.
