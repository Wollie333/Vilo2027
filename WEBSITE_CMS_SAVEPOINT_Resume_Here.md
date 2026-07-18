# 🟢 Website CMS — SAVE POINT / Resume Here

**Branch:** `feature/website-cms-10min-wizard` · **Last pushed:** `ec79150` · **Vercel: auto-deploys on push**
**Updated:** 2026-07-18

> This file is COMMITTED (the previous savepoint was lost because it was never committed —
> don't let that happen again: commit + push before ending a session).

---

## How to see the work (the live branch)

- **Branch deploy (auto-updates on every push):**
  `https://vilo2027-git-feature-website-cms-10m-6c3132-wollie333s-projects.vercel.app`
- **The real OceansView test site is `mana`** (subdomain on `host_websites`). Reach its pages via:
  - `…/site/rooms?site=mana&preview=1` · `…/site/specials?...` · `…/site/contact?...`
  - `…/site?site=mana&preview=1` (home) · `…/site/about?...` · `…/site/blog?...` (Journal)
  - `…/site/blog/<post-slug>?site=mana&preview=1` (article)
  - `&preview=1` renders drafts + regardless of publish state. Public (non-preview) needs the site published.
- **NOTE:** the old `vilotest` fixture is LOCAL-only and 404s on the deploy — use `mana`.
- Vercel project `prj_ia39tAuJTTErlViwZXjgNHWKU7xZ`, team `team_HBP2Mcif9OcWL3w4hJXlAXDt`.

---

## The build pattern (how every bespoke OceansView page is added)

Content is decoupled from skin. A bespoke page = **a scoped React component + a scoped CSS file +
a routing hook**, fed by `content_profile` (host wizard copy) + live `SiteData`
(`assembleSiteDataByType`), with **account-derived fallbacks**, and **demo copy / omit** as the last
resort (never fabricate specifics — mirror the About page).

- Component + CSS live in `apps/web/components/site/oceansview/` (CSS scoped `.ov<page>`).
- **Full-site pages** (home/about/rooms/specials/contact) are routed in
  `apps/web/components/site/SitePageView.tsx` behind
  `ctx.theme.preset === "oceansview" && result.page.kind === "<kind>"` (place BEFORE the `result.doc`
  / generic fallbacks). Set `pageHasHero` when the page opens with a full-bleed hero.
- **Blog/Journal** is NOT in SitePageView — it has its own routes:
  `apps/web/app/[locale]/site/blog/page.tsx` (index) and `…/site/blog/[postSlug]/page.tsx` (article).
  Hooked behind `ctx.theme.preset === "oceansview"`.
- Design source of truth: `docs/themes/oceansview/pages/*.html` + `docs/themes/oceansview/theme.css`
  (token values under the `lagoon` block). Port class-by-class; keep `--site-*` tokens with the
  reference's hard fallbacks so it stays on-brand + host-editable.

### ⚠️ Gotchas (all real, all bit us this session)
- **No `apps/web/.env.local` in this worktree** → `pnpm build` fails locally with ~460
  `createAdminClient: …SUPABASE… must be set` prerender errors on UNRELATED pages (login/register).
  That's env-only; the SAME commit builds green on Vercel. To build/verify locally you need the keys.
- **Build OOMs** at Node's 2 GB default (box has ~8 GB RAM). Build with
  `NODE_OPTIONS="--max-old-space-size=4096" pnpm build`. Disk filled up too — reclaim via deleting
  `AppData/Local/npm-cache` (stale; project is pnpm) + `apps/web/.next` + `pnpm store prune`.
- **prettier-plugin-tailwindcss mangles `className` template literals** (pre-commit hook strips the
  leading space inside `${…}`, e.g. `section${x?" sand":""}` → dead class `sectionsand`). Use
  plain-string ternaries: `className={x ? "section sand" : "section"}`. Verify post-commit with grep.

---

## ✅ DONE + verified live on the branch (mana)

| Page | Component / CSS | Notes |
|------|-----------------|-------|
| Home | `OceansViewHome` / `oceansHome.css` | (earlier arc) |
| About | `OceansViewAbout` / `oceansAbout.css` | (earlier arc) |
| Room detail | `OceansViewRoomDetail` / `oceansRoom.css` | (earlier arc) |
| **Rooms** | `OceansViewRooms` / `oceansRooms.css` | live `rooms_preview`, alternating splits, price badge, facts, empty-state, CTA. Blurb clamped to 4 lines (`1e69ed7`). |
| **Specials/Offers** | `OceansViewSpecials` / `oceansSpecials.css` | live `specials_preview` grid, badge/now-was-save, empty-state, CTA. |
| **Contact** | `OceansViewContact` + `OceansContactForm` (client) / `oceansContact.css` | real lead form → `/api/website-enquiry` (host inbox); live location card + Google map; **FAQ = wizard `content_profile.contact.faq` → real property `policies` → omit** (`3b54e11`, standard-aligned). |

All verified live on `…?site=mana&preview=1` with real data (Leadwood/Marula rooms, 3 specials,
Hazyview map, policy FAQ). Contact form correctly DISABLED in preview.

---

## 🔧 IN PROGRESS — Journal (NEXT SESSION STARTS HERE)

**Pushed `ec79150` (WIP): `pnpm lint` GREEN, but tsc + live render NOT yet verified.**

- Built `OceansViewJournal` (index: featured split + 3-up grid, gradient-monogram fallback for
  cover-less posts) + `OceansViewArticle` (hero + prose + author/share + "keep reading") +
  `oceansJournal.css` (scoped `.ovjournal`), ported from `Journal*.html`.
- Hooked into both blog routes behind the oceansview guard (generic layout still serves other themes).
- Seed script `apps/web/scripts/seed-mana-journal.mjs` exists (3 Field Notes posts) but the FOUNDER
  seeded **2 posts himself** to the DB (author "Wollie Steenkamp") — those are live on the Journal now.

### FIRST steps next session
1. **Verify:** run `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` (from `apps/web`) OR just
   let the Vercel deploy of `ec79150` finish and check it built green (get_deployment on the branch
   alias). Then open `…/site/blog?site=mana&preview=1` + click into a post `…/site/blog/<slug>?...`.
2. **Fix anything** the live render shows (this is the "FIX DESIGN" task — user judges on the branch).
3. Known design gaps to consider: the **category filter chips** in the reference aren't built (need
   client filtering + category on `BlogIndexPost` — not currently selected by `loadSiteBlogIndex`);
   the **newsletter** block is a CTA button to Contact (not a real signup); the seeded posts have **no
   cover images** (cards use the gradient-monogram fallback — founder can add covers in the blog
   editor, or seed with cover URLs — `websiteAssetUrl` passes absolute URLs through).

---

## Remaining OceansView pages (not yet bespoke)
`experiences`, `gallery`, and the booking system pages (`search_results`, `checkout`, `thank-you`)
still render generic. Experiences + Gallery designs exist in `docs/themes/oceansview/pages/`.

## Verification protocol (Principle #9 — non-negotiable)
Never "done" until SEEN working on the real branch render. This session's loop: edit → commit →
push → Vercel auto-deploys → open `…?site=mana&preview=1` in the browser → screenshot/confirm.
Two commits deploy sequentially, so wait for the LATER one's deploy to alias before re-checking.

## Key memories
`oceansview-cms-worktree-env` · `oceansview-bespoke-pages-status` (in the project memory dir).
