# 🟢 Website CMS — SAVE POINT / Resume Here

**Branch:** `feature/website-cms-10min-wizard` · **Last pushed:** `8dffc19` · **Vercel: auto-deploys on push**
**Updated:** 2026-07-19 (pt6)

## 🗺️ FOUNDER ROADMAP (captured 2026-07-19) — the big picture
The end goal: wizard → pick one of the designed themes → a **professional site** where EVERY page is a
pixel-perfect mirror of that theme's reference design, header/footer included, populated with the host's
details + the **AI content from the relevant page's wizard step**. Track order:
1. **Specials DETAIL pages** (like room detail) + auto "Specials" sub-menu — *in progress this session*
   (see below). Applies to ALL themes going forward (oceansview bespoke + generic fallback now).
2. **Thank-you pages** — the dynamic/action-aware/tracking LOGIC ALREADY EXISTS:
   `app/[locale]/site/book/thank-you` (booking → Purchase) + `app/[locale]/site/thank-you/[[...goal]]`
   with GOAL templates `contact`/`quote`/`custom` (each fires `Lead`, host per-form copy overrides).
   MISSING = the bespoke pixel-perfect DESIGN per theme (a `Thank You.html` exists in every theme folder).
   → build `OceansViewThankYou` over the existing goal/event/copy logic; skin the others.
3. **All-themes pixel-perfect PAGES + AI content** — OceansView pages + all-3 chrome done. Marmalade/Sabela
   PAGES reach pixel-perfect via the SKIN model (`theme-skins.css` over generic blocks, per
   `docs/themes/THEME_SKIN_STANDARD.md`), each page pulling its wizard AI content. Largest track.
   (Founder said "4 themes" — only 3 have reference designs: oceansview, marmalade, sabela → confirm a 4th.)

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

## ✅ Journal — DONE + LIVE-VERIFIED on mana (this session)

**`OceansViewJournal` (index) + `OceansViewArticle` (article) + `oceansJournal.css`, both /site/blog
routes behind the oceansview guard.** tsc green, Vercel READY, both surfaces screenshotted live:
- **Index** (`…/site/blog?site=mana&preview=1`): gradient page-head "The journal", featured split,
  3-up grid. Founder's 2 posts (`first-timers-guide-bush-safari`, `five-reasons-book-lodge-directly`,
  author "Wollie Steenkamp") now HAVE cover images.
- **Article** (`…/site/blog/<slug>?...`): full-bleed hero, prose, author block, "keep reading" strip.

### Fix made (commit `1b06a95`): article "keep reading" was empty
`loadRelatedPosts` (in `lib/site/loadSitePage.ts`) returned `[]` whenever a post had no `category_id`
(the seeded posts have none), so the strip was omitted and left a ~260px void before the CTA. Now:
prefer same-category, then FILL from the site's most-recent other published posts (limit 3, excl.
current). Verified live — the strip shows the sibling post. Also benefits the generic-theme article.

### Still-open Journal design ideas (not blocking; founder judges on the branch)
- **Category filter chips** in the reference aren't built (need client filtering + category on
  `BlogIndexPost`, not currently selected by `loadSiteBlogIndex`).
- **Newsletter** block is a CTA button to Contact (not a real signup).

## ✅ Theme-scoped HEADER + FOOTER — DONE + LIVE-VERIFIED on mana (commit `f83f0d0`)

The OceansView pages rendered bespoke CONTENT but still used the generic token-driven `SiteChrome`
header/footer. Built the founder's bespoke chrome (scoped `.ovchrome`, ported from
`docs/themes/oceansview/header.html` + `footer.html` + `theme.css`):
- **`OceansViewHeader.tsx`** (client) — fixed bar, transparent over the hero → solid/blurred + dark
  text on scroll; monogram/logo + wordmark; nav-links with active state; **CSS hover "Suites" dropdown
  (auto-populated with the live rooms)**; coral "Book a stay" CTA; full-screen burger drawer. Reserves
  84px on hero-less pages. Own scroll listener (doesn't use StickyHeader).
- **`OceansViewFooter.tsx`** (server) — dark-navy 4-col: brand (+blurb when tagline set), "Explore"
  (live menu), "Stay" (book + contact), "Keep in touch" (→ contact CTA), legal row (© + Powered-by-Wielo
  + socials). Blurb/socials omitted when unset (mana has neither).
- Rendered by `SiteChrome` behind `preset === "oceansview"` (new `preset` prop); **every public /site
  route now passes `preset={ctx.theme.preset}`**. Nav-href helpers moved to `lib/site/navHref.ts` so the
  client header imports them without SiteChrome's server graph.
- ⚠️ prettier-tailwind bit us AGAIN: it stripped the space in `className={`nav-link${a?" active":""}`}` →
  `nav-linkactive`. Fixed with a plain-string ternary (folded into `f83f0d0`). Verified post-hook.
- Live-verified on Home/Rooms/Contact/Article: transparent→solid header, dropdown (3 live rooms), coral
  CTA, dark-navy footer. Mobile drawer structure verified via DOM (burger + 11 links + book).
- **NOTE:** the builder/brand-preview canvases still render the GENERIC chrome (not wired) — only the live
  /site routes got the bespoke chrome. Also the blog `[postSlug]` route passes no `bookHref`, so the
  article header shows no "Book a stay" CTA (pre-existing route data, not a chrome bug).

### ✅ ALL THREE designed themes now have bespoke chrome (commit `c957d00`)
Same pattern applied to the other two designed themes; `SiteChrome` dispatches via a
`THEME_CHROME` registry (`preset → {Header, Footer}`, uniform prop interface). Verified live on
mana via `?site=mana&preview=1&theme=<slug>`:
- **Marmalade** (`preset: marmalade`, scope `.mmchrome`) — floating cream **pill nav** (fixed, blurred,
  subtle lift on scroll, NO colour inversion — `transparent` governs only the spacer), CSS dropdown,
  mobile drawer; footer cols Explore / Stay / "Notes from the kitchen". `components/site/marmalade/`.
- **Sabela** (`preset: hotel`, scope `.sbchrome`) — dark-first editorial nav: transparent over hero →
  solid ebony/warm-bone on scroll, GOLD accents + gold-underline active; top-sliding drawer; footer cols
  Explore / Stay / "From the bush". `components/site/sabela/`.
- Presets with NO reference design (`warm`/`coastal`/`safari`) fall through to the generic chrome.
- Built by two subagents (ported class-by-class from `docs/themes/<slug>/`), wired + live-verified by me.
- **NOTE:** when previewing mana with a non-oceansview theme, the PAGE CONTENT is generic (mana's
  bespoke content only renders under `preset===oceansview`) — but the CHROME is the bespoke theme chrome,
  which is what we verified. A real marmalade/hotel SITE would have its own content + this chrome.

**NEXT: founder smoke test of the wizard→content pull-through, then remaining generic pages
(experiences, gallery, booking flow).**

## ✅ Contact — follow-up fixes DONE + LIVE-VERIFIED on mana (commits `16706c7`, `c1814b2`)
- **Empty phone row removed:** the phone `.drow` in `OceansViewContact.tsx` rendered unconditionally,
  so mana (address, no phone) showed a lone phone icon. Now guarded like email/address.
- **Founder flagged the empty band** in the right info column beside the tall form → filled it with a
  real **guest review** testimonial card (`.qcard`: 5 stars + quote + author monogram), top-rated item
  from live `reviews`. Added `"reviews"` to the contact `assembleSiteDataByType` set + a `review` prop.
  Omitted when a site has no reviews (never fabricated).
- **`c1814b2`:** removed the tan "reassurance" card; the info card now shows the **COMPLETE business
  address** ("Portion 14, Kiepersol Road, Hazyview, Mpumalanga, 1242, ZA") + a street-level map. Shared
  `location.address` stays city/province only (privacy); `LocationData` gained `fullAddress`
  (address_line1/2 + city/province/postal/country) which ONLY the contact page reads. Falls back to the
  locality when no street line is set.

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
