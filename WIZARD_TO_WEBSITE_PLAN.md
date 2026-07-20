# 🧭 Wizard → Professional Working Website — Implementation Plan (resume pointer)

> **Created 2026-07-20.** Branch `feature/website-cms-10min-wizard`. Vercel auto-deploys on push.
> **Founder goal:** a host **selects a theme → completes the wizard → ends up with a professional,
> fully-functioning, MOBILE-READY business website that seamlessly integrates with the booking
> system and all features** — no dead ends, no demo copy, no unwired features.
>
> Also in scope (founder, do in this order): **(a)** wire the nearby-experiences cards to Google
> Places; **(b)** bring the other 4 themes to Safari's differentiation + do an explicit mobile pass;
> **(c)** keep CHANGELOG/savepoint current. Ordered below for fastest logical execution.
>
> **▶▶ NEW SESSION: read this top-to-bottom, then `WEBSITE_CMS_SAVEPOINT_Resume_Here.md` for the
> surrounding CMS/theme context. Start at Phase 1.**

---

## ✅ What already works (don't rebuild — verify)

Mapped 2026-07-20 (flow map from an Explore pass; file refs in `apps/web/`):

- **Wizard flow exists + is fairly complete.** Orchestrator `app/[locale]/dashboard/website/_wizard/WebsiteWizard.tsx`
  (steps `WebsiteWizard.tsx:30-49`): `basics → theme → colors → story → payments → pages → review →
  building → done`. State in `_wizard/wizardState.ts`. Live theme mini-render via `WizardThemePreview.tsx`
  (real `buildSiteVars`, not thumbnails). AI copy via `_wizard/aiActions.ts` (inert until `ANTHROPIC_API_KEY`).
- **Theme selection persists** → `host_websites.theme` JSONB (`{preset, base, colors.accent, palette}`),
  written in `createWebsiteWithWizardAction` (`actions.ts:882-905`).
- **"Build my site" seeds a full site.** `createWebsiteWithWizardAction` (`actions.ts:791-963`) →
  updates the draft `host_websites` row → `seedWebsiteContent` (`actions.ts:544-660`: `website_forms`,
  `website_pages` w/ hydrated Builder-V2 PageDocs, legal pages, `website_properties`/`website_rooms`
  from the business) → best-effort `publishWebsiteAction`.
- **Content stored in two places:** canonical `host_websites.content_profile` (schema
  `lib/website/contentProfile.schema.ts:22-96`) AND per-page `website_pages.draft/published_sections`
  (PageDoc hydrated from content_profile at seed via `hydratePageDoc`).
- **Public site reads it** (`components/site/SitePageView.tsx` + `lib/site/loadSitePage.ts`):
  bespoke themes (royal/safari/oceansview/marmalade/hotel) read `content_profile` DIRECTLY +
  `assembleSiteDataByType` live data; generic themes render the hydrated PageDoc.
- **🎉 BOOKING IS WIRED END-TO-END.** Rooms sync `properties`/`property_rooms` → `website_rooms`
  (`actions.ts:627-659`), render via `rooms_preview`/`assembleSiteDataByType`; `siteBookHref`
  (`loadSitePage.ts:763-794`) → `/site/book`; checkout `app/[locale]/site/book/page.tsx` resolves
  the property (visible-channel-member gate), live rooms/add-ons/specials, and **server-side
  price/availability/payment** (Paystack/PayPal/EFT gated by `settings.payments`). This is the big
  one and it's **done** — Phase 3 only VERIFIES it.

## ⚠️ The gaps (this is the actual work)

1. **Wizard finish ≠ live site.** Auto-publish is gated by `checkWebsiteReadiness` (`actions.ts:955`,
   `lib/website/readiness.ts:83-92`): needs name + a bookable priced ZAR room + a payment method +
   subdomain + cancellation policy. A brand-new host has none of these, so the wizard finishes
   `status:"draft"` and the public route 404s (`loadSitePage.ts:216`). The wizard collects none of
   rooms/payment/policy — it only links out. `StepDone.tsx:29-64` shows the "what's left" checklist.
2. **`derived` fallbacks NOT passed at seed.** `seedWebsiteContent` is called without `derived`
   (`actions.ts:937-947`; defaults `{}` at `:566`), so `DerivedContent` account fallbacks (hostName,
   hostPhoto, propertyDescription, heroPhoto, policiesFaq — `contentProfile.schema.ts:109-115`) are
   never computed → empty slots fall back to **theme DEMO copy** instead of the host's real data.
3. **Contact FAQ empty** for generic themes (`contact.faq` binds only via `derive:d.policiesFaq`,
   which is unset — gap #2).
4. **`home.intro.body` (Welcome) underused** — no AI slot; bespoke homes read it only as a fallback
   for `story` (`SitePageView.tsx:463`), so a host who fills BOTH About-story and Welcome loses the
   Welcome text on bespoke homes.
5. **Two divergent content paths.** Bespoke themes read `content_profile` directly and IGNORE the
   seeded PageDoc; generic themes render the PageDoc. Per-section images/copy that live only in the
   PageDoc (not in a canonical `content_profile` slot) may not surface on bespoke themes. Must
   confirm every wizard-collected slot round-trips to the bespoke components (esp. experiences
   images, host photo, gallery).
6. **`published_sections:[]` at seed** until `publishWebsiteAction` copies draft→published
   (`actions.ts:611,2316-2323`). Fine as-is, but any force-publish that bypasses the copy shows a
   blank site — add a guard.
7. **One-per-business bounce disabled** (`WebsiteWizard.tsx:127-134`, commented for testing) —
   re-enable before launch.
8. **Mobile-ready asserted, not verified per theme.** No per-theme mobile QA. (This session fixed
   the booking bar; see below.)
9. **Nearby-experiences cards are placeholder** (`SiteNearbyExperiences` renders `NEARBY_PLACEHOLDER`)
   — real data is item (a).

---

## 🎯 THE PLAN — phased, fastest logical order

### PHASE 1 — Wizard produces a FULLY-POPULATED site (content flow) ← **✅ CODE DONE (`3c2acfc`), live-verify pending**
The highest-leverage work: make a completed wizard yield the host's REAL content on the chosen theme,
with zero demo copy. Contained + high-impact.

1. **Pass `derived` account fallbacks at seed.** In `createWebsiteWithWizardAction`, compute a
   `DerivedContent` (hostName from `hosts→user_profiles`, host phone/email, propertyDescription +
   heroPhoto from the business's primary property, `policiesFaq` from the cancellation/house policies)
   and pass it into `seedWebsiteContent(..., derived)` (`actions.ts:937`). Mirror the account-derived
   fallback pattern already used at render time in `assembleSiteDataByType` (`loadSitePage.ts`, the
   `businesses.host_id → hosts.user_id → user_profiles` chain). Closes gaps #2 + #3.
2. **Verify every wizard content_profile slot reaches the bespoke components.** For each bespoke theme
   (safari/royal/oceansview/marmalade/hotel), confirm home hero, about story, host bio + photo,
   experiences intro + items (incl. images), gallery, contact FAQ read from `content_profile`/live
   data — not demo fallback. Fix any slot a bespoke component ignores (gap #5). Grep the
   `content_profile` reads in `SitePageView.tsx` bespoke branches.
3. **Decide `home.intro.body` (Welcome) usage** (gap #4): either surface it as its own intro block on
   bespoke homes, or drop the wizard field. Recommend surfacing it (it's a distinct block).
4. **Guard the publish copy** (gap #6): ensure `published_sections` is always populated on publish;
   add an assertion/fallback in `publishWebsiteAction`.
5. **Acceptance:** create a website via the wizard for a host WITH a room+payment+policy → the live
   site shows the host's real name/photo/story/rooms/FAQ on the chosen theme, **no demo copy**, on
   every bespoke theme. Verify live (see Verification).

### PHASE 2 — "Complete wizard → live site" go-live UX
Make the readiness wall smooth so a host reliably reaches a published URL.

1. **StepDone → guided completion.** When readiness fails, `StepDone` already lists what's left
   (`StepDone.tsx:29-64`). Deep-link each item to the exact editor (add room / add payment method /
   set cancellation policy), and add a "Publish now" button that re-runs `publishWebsiteAction` and,
   on success, shows the live URL. Reuse `ReadinessChecklist.tsx` + `readiness.ts`.
2. **Optional: sensible defaults** to lower the wall (founder decision) — e.g. seed a default
   cancellation policy + a "manual EFT" payment on wizard finish so only a priced room is required.
   Keep it reversible.
3. **Re-enable the one-per-business bounce** (`WebsiteWizard.tsx:127-134`) behind a launch flag.
4. **Acceptance:** a host who finishes the wizard is either published, or one obvious click-through
   away from published, with the live URL shown.

### PHASE 3 — Booking integration VERIFICATION (mostly already done)
Booking is wired (see "What works"). This phase is verification + fixes, not build.

1. On a wizard-created + published site, per bespoke theme: Book CTA → `/site/book` → correct
   property/rooms, live price + availability, add-ons, specials redeem, each enabled payment rail
   renders. Confirm the visible-channel-member gate + server-side pricing.
2. Confirm the header "Book now" + room/special card hrefs carry the theme (preview) + correct params.
3. Fix anything found. **Acceptance:** a real (test-mode) booking completes from a wizard site.

### PHASE 4 — (a) Nearby-experiences → Google Places wiring
The card UI already ships (this session). Now feed it real data. See memory
`[[experiences-ai-autopopulate-idea]]`; founder correction: use the **LISTING/property's own
address** (`properties.address_line1…`), not the business/settings address.

1. Geocode the property if it lacks lat/long; fetch nearby POIs (Google Places API v1 — or free
   Overpass/OSM + Wikivoyage as the cheaper first pass), compute distance/drive-time from the
   property's lat/long.
2. Map results → `NearbyPlace[]` (`lib/site/nearby.ts` — the type already mirrors Places fields),
   pass as the `nearby` prop to `SiteNearbyExperiences` (replaces `NEARBY_PLACEHOLDER`; drop the
   "sample" flag). Cache into `content_profile` (new `experiences.nearby[]` slot) so it's not
   re-fetched per request; present as **host-approved drafts**, never silent auto-publish.
3. Wire a wizard/editor step to trigger + curate the fetch. Add the API key to `ENV_VARS.md`.
4. **Acceptance:** a real property shows real nearby places with correct distances + working
   Directions links; empty/opt-out hides the section.

### PHASE 5 — (b) Per-theme differentiation + explicit mobile pass
Bring the other 4 themes to the bar Safari hit this session, and verify mobile per theme.

1. Each theme already has bespoke pages; do a differentiation/polish audit vs the founder's "each
   theme genuinely unique" bar (own layout signatures, motion, palette, type — see
   `THEME_DIFFERENTIATION_PLAN.md`). The nearby cards already render on all 5.
2. **Explicit mobile QA per theme × per page** (home/rooms/room-detail/about/experiences/contact/
   gallery/journal/specials + checkout/booking). The bespoke CSS already has breakpoints; verify no
   horizontal overflow, tap targets ≥44px, drawers/menus work, images scale. Fix gaps.
3. **Acceptance:** each theme is visibly its own site AND clean at 360–414px on every page.

### PHASE 6 — (c) Docs
Keep `CHANGELOG.md` + `WEBSITE_CMS_SAVEPOINT_Resume_Here.md` current each phase; refresh
`WEBSITE_CMS_AUDIT.md`/`MVP_READINESS_AND_AUDIT_BACKLOG.md` as gaps close.

---

## 🔍 VERIFICATION (Principle #9 — SEE it working on the live render)

- **Test site:** `mana` on the branch deploy. Any page: `…/site/<page>?site=mana&preview=1[&theme=<slug>]`
  (`oceansview|marmalade|hotel|safari|royal`). Room slugs: `leadwood-suite`, `marula-family-suite`,
  `tamboti-star-bed-suite`. Branch alias:
  `vilo2027-git-feature-website-cms-10m-6c3132-wollie333s-projects.vercel.app`.
- **Deploy is behind Vercel SSO.** Use the founder's **authenticated Claude-in-Chrome** browser
  (`mcp__claude-in-chrome__*`) — it renders the deploy. Vercel project `prj_ia39tAuJTTErlViwZXjgNHWKU7xZ`,
  team `team_HBP2Mcif9OcWL3w4hJXlAXDt`; wait for the READY deploy (builds ≈5-6 min).
- **⚠️ Tooling limits learned this session:**
  - `mcp__claude-in-chrome__resize_window` is a **no-op** here (viewport stays 1920) → CANNOT drive a
    real mobile viewport in the authenticated browser. For mobile checks, verify via CSS media-query
    audit + `document.documentElement.scrollWidth<=innerWidth` (no h-overflow) + render mirrored
    components at mobile width in the **in-app Browser** (`mcp__Claude_Browser__resize_window
    {preset:"mobile"}`, which DOES work) — but the in-app browser CANNOT reach the SSO deploy.
  - **Screenshots are flaky** (timeouts, all-dark on scrolled full-bleed pages). Fall back to
    `javascript_tool` DOM/computed-style/geometry queries (reliable) to confirm structure + no overflow.
  - Local `pnpm build` FAILS in this worktree (no `apps/web/.env.local` → ~460 prerender errors) →
    gate with `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` + `pnpm lint` + the Vercel
    build + the live render. No Docker / local Supabase (see CLAUDE.md).

## 🔑 KEY FILES
- Wizard: `app/[locale]/dashboard/website/_wizard/` (`WebsiteWizard.tsx`, `wizardState.ts`,
  `pageSections.ts`, `aiActions.ts`, `steps/*`), page `…/website/wizard/page.tsx`.
- Seed/publish: `app/[locale]/dashboard/website/actions.ts` (`createWebsiteWithWizardAction`,
  `seedWebsiteContent`, `publishWebsiteAction`), `lib/website/readiness.ts`, `lib/website/hydrateProfile.ts`,
  `lib/website/publish.ts`.
- Content schema + bindings: `lib/website/contentProfile.schema.ts` (`SLOT_BINDINGS`, `DerivedContent`).
- Public render: `components/site/SitePageView.tsx`, `lib/site/loadSitePage.ts` (`loadSiteContext`,
  `assembleSiteDataByType`, `siteBookHref`, `orderedVisibleRooms`).
- Checkout: `app/[locale]/site/book/page.tsx` + `book/SiteCheckoutForm.tsx`.
- Nearby cards: `components/site/sections/SiteNearbyExperiences.tsx` + `siteNearby.css`, `lib/site/nearby.ts`.
- Theme presets/tokens: `lib/site/themes.ts`, `components/site/themes/theme-skins.css`.

## 🗒️ DONE THIS SESSION (2026-07-20) — context for the new session
- **Safari differentiated into a "daylight field-journal" theme** (founder: Safari+Sabela read as
  siblings). Terracotta/clay accent theme-wide, cover-line masthead, Roman-numeral section markers,
  drop caps, terracotta pull-quote, daylight reviews band. Applied site-wide via shared `.wielo-safari`
  utilities (`sf-coverline`/`sf-secnum`/`sf-drop`/`sf-pullband`). Commits `6b3e067` (core+home) →
  `4707189` (fix: cover-line collided with the overlay chrome header — moved in-flow above the
  meta/breadcrumb; live-verified `collides:false`, no overflow on home + subpages).
- **Nearby-experiences cards** on all 5 themes' Experiences pages — shared token-driven
  `SiteNearbyExperiences`, Google-Places-shaped placeholder data. Commit `e38f090`. Live-verified
  (6 cards, 3-col, no overflow). **Real data = Phase 4.**
- **Mobile:** booking availability bar now stacks to 1 column ≤520px (was cramped 2-col). Commit
  `33493ea`. Verified at 375px (1 col, no overflow). Broader per-theme mobile QA = Phase 5.
- HEAD `4707189`. All commits tsc+lint clean.

## 🗒️ DONE — Phase 1 (2026-07-20, HEAD `3c2acfc`)
- **Wizard-seeded + bespoke themes now render the host's REAL content, no demo copy.** New shared
  `apps/web/lib/website/deriveContent.ts` is the SSOT for account-derived fallbacks:
  `buildDerivedContent({businessId})` (host name/photo via `hosts`→`user_profiles`; primary property
  description + first photo; a policies FAQ from cancellation label + check-in/out + house rules),
  `mergeDerivedProfile(profile, derived)` (fills only EMPTY canonical slots — filled slots win), and
  `resolveEffectiveProfile(...)` (render resolver, short-circuits when nothing's missing).
- **Seed** (`createWebsiteWithWizardAction`): now passes `derived` into `seedWebsiteContent` → generic
  themes' hydrated PageDoc is populated (gaps #2, #3 closed).
- **Render** (`SitePageView`): all **26** bespoke `content_profile` reads route through
  `resolveEffectiveProfile` → bespoke themes get the same fallbacks (gap #5 closed for derived slots).
- **Publish guard** (`publishWebsiteAction`): `isEmptySections()` won't copy an empty draft over a
  live page (gap #6 closed).
- **Decision on gap #4 (`home.intro.body`/Welcome):** the wizard does NOT collect Welcome (StepStory
  collects hero headline/sub, about.story, hostBio.body, experiences). So there's no "host filled both
  and lost Welcome" case in the wizard. The `story = about.story ?? home.intro.body ?? propertyDescription`
  fallback chain now surfaces it. A dedicated Welcome BLOCK on bespoke homes = a Phase-5 design call, not
  Phase-1. No wizard field dropped.
- tsc + lint + vitest (`deriveContent.test.ts`, 6 cases) green. **⏳ Live-verify** on the `3c2acfc`
  deploy (branch alias) via authenticated Claude-in-Chrome: pick a bespoke theme, confirm host
  name/photo/story/hero/FAQ show the real business data (no theme demo strings). NB derived fallbacks
  need the business to actually HAVE a property description / photo / policy — an empty account still
  shows demo copy by design.

**This file is COMMITTED. Update + commit it before ending any session.**
