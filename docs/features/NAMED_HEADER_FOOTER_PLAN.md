# Named header + footer instances (per-page assignment) — Plan

> Task **6b** from the website-builder batch. This is the FEATURE half of task 6
> (6a — the room-detail solid-header bug — is already shipped, commit `1fff958b`).
> Founder ask: _"named HEADER + FOOTER instances (like named menus) that the host
> assigns PER PAGE."_ Modelled directly on the existing named-**menus** system.

## Goal

Today a site has exactly one header config and one footer config
(`navigation.header`, `navigation.footer`), shared by every page. The host wants
to define **multiple named header instances** and **multiple named footer
instances**, then choose which header/footer each page uses (e.g. a transparent
hero header on Home, a solid compact header on Rooms; a full footer on marketing
pages, a minimal footer on checkout).

## Prior art to mirror (do it the SAME way)

The named-**menus** feature is the template. Reuse its shape exactly so the code
stays uniform:

- **Data:** `navigation.menus: SiteNamedMenu[]` + `navigation.primaryMenuId`,
  with `navigation.menu` kept **mirrored** to the primary for the legacy render
  path. See `lib/site/namedMenus.ts` (`resolveNamedMenus`, `resolvePrimaryMenuId`,
  `primaryMenuItems`, `MAIN_MENU_ID`).
- **Builder:** `NavBuilderOverlay` edits `menus`/`primaryMenuId`; `BuilderShell`
  `setMenus`/`setPrimaryMenu` re-derive the mirror on every change; `saveNav`
  persists the whole `navigation` via `saveNavigationAction` →
  `navigationSchema` (all fields already round-trip).
- **Render:** `SiteChrome` reads `navigation.menu` (the mirror).

## Proposed data model (additive, pre-MVP so no back-compat shims)

In `lib/site/types.ts`:

```ts
export type SiteNamedHeader = { id: string; name: string; config: NavHeader };
export type SiteNamedFooter = { id: string; name: string; config: NavFooter };

// on SiteNavigation:
headers?: SiteNamedHeader[];
defaultHeaderId?: string;        // used when a page has no override
footers?: SiteNamedFooter[];
defaultFooterId?: string;
```

Per-page assignment lives on the page, next to the existing per-page nav
override. Two clean options — pick ONE:

- **(A) On `navigation.perPage[key]`** (keyed by page key "home"/slug): add
  `headerId?`, `footerId?`. Pro: all nav config in one JSONB; matches the
  existing `perPage` override for transparency/colour. Con: page key indirection.
- **(B) On the page row** (`website_pages`): add `header_id`, `footer_id`
  columns. Pro: travels with the page, survives slug edits via id. Con: a
  migration + join at load.

**Recommendation: (A)** — no migration, mirrors how per-page header appearance
already works (`navigation.perPage[key].transparentOverHero` etc.), and pre-MVP
we can reshape freely.

Keep `navigation.header`/`navigation.footer` as the **mirror** of the default
header/footer (like `navigation.menu` mirrors the primary menu) so the whole
existing render path stays untouched.

## Helpers (new `lib/site/namedChrome.ts`, mirrors `namedMenus.ts`)

- `resolveNamedHeaders(nav)` / `resolveNamedFooters(nav)` — synthesise a single
  "Default header/footer" from `navigation.header`/`footer` when none exist yet.
- `resolveDefaultHeaderId/FooterId(nav)`.
- `headerForPage(nav, pageKey)` / `footerForPage(nav, pageKey)` — the assigned
  instance's config, falling back to the default. **Single source of truth used
  at render.**

## Render wiring (`SiteChrome` + callers)

`SiteChrome` currently reads `navigation.header`/`footer` directly (~20 call
sites). Change: compute `const activeHeader = headerForPage(navigation, currentPageKey)`
and `activeFooter = footerForPage(...)` ONCE near the top, then read every
`navigation.header?.x` / `navigation.footer?.x` from `activeHeader`/`activeFooter`.
`currentPageKey` is already computed for the per-page override. Live pages,
room detail (`SiteRoomView`), and the builder canvas all funnel through
`SiteChrome`, so this one change covers all three.

## Builder UI (`NavBuilderOverlay`)

- Header tab + Footer tab each get a **named-instance switcher** at the top
  (dropdown + rename + new + delete + "make default"), identical to the Links
  tab's menu switcher (`editingMenuId` pattern, lines ~183-226 + the menu
  `<select>`/rename row).
- A **per-page assignment** control: a "This page uses" header/footer picker.
  Since the builder edits ONE page at a time, this writes
  `navigation.perPage[currentPageKey].headerId/footerId`. Needs `currentPageKey`
  threaded into the overlay (BuilderShell knows the page kind/slug).
- `BuilderShell`: add `setHeaders`/`setDefaultHeader` (+ footer equivalents)
  that re-derive the `navigation.header`/`footer` mirror from the default, exactly
  like `setMenus`/`setPrimaryMenu`.

## Schema (`app/[locale]/dashboard/website/schemas.ts`)

- `navigationSchema`: add `headers`/`footers` (arrays of `{id,name,config}` where
  config = the existing header/footer object schemas, factored out for reuse) +
  `defaultHeaderId`/`defaultFooterId`.
- `menuPageOverrideSchema`: add `headerId`/`footerId` (optional strings).
- No DB migration (option A). Regenerate types NOT required (JSONB).

## Phasing (each ends green + committed)

1. **Types + helpers** (`types.ts`, `namedChrome.ts`) + schema — no behaviour
   change; defaults synthesise the current single header/footer.
2. **Render cutover** — `SiteChrome` reads `headerForPage`/`footerForPage`.
   Verify every current page renders identically (default path).
3. **Builder: named instances** — header/footer switchers (create/rename/delete/
   default). Verify canvas + save round-trip.
4. **Builder: per-page assignment** — the "This page uses" picker →
   `perPage[key].headerId/footerId`. Verify a page with an override renders its
   assigned instance live.

## Gotchas

- Keep the **mirror** (`navigation.header`/`footer` = default) so nothing that
  reads it directly breaks mid-migration.
- `pnpm build` while the preview server runs corrupts the shared `.next` — use
  `tsc --noEmit` + `next lint` during the work.
- The per-page override for transparency/colour already exists on
  `navigation.perPage[key]`; the new `headerId` sits beside it and, when set,
  supersedes those page-level appearance fields (the assigned header carries its
  own). Decide precedence explicitly in `headerForPage`.
