# Vilo — Current Task

> Reset at the start of every session. This is the session contract.

**Active focus:** **Specials feature** (host pre-packaged accommodation deals) — runs on the
`feat/website-property-restructure` branch alongside the Website CMS work.

> **SPECIALS RESUME ANCHOR (multi-session).** Plan: `~/.claude/plans/ok-so-i-need-tender-sphinx.md`.
> Memory: `project_specials_feature`. Phases: **S0 schema DONE** (migration `…002000_specials_foundation.sql`
> pushed; types regenerated; `tsc` green) → **S1 host CRUD DONE** (Properties › Specials sidebar row
> under Policies; `/dashboard/specials` list w/ dark hero + status/used-quantity/featured/visibility +
> row menu; `new` + `[id]/edit` wizard `_components/SpecialEditor.tsx` over all sections; `actions.ts`
> create/update/setStatus/delete + addon reconcile + ownership checks; `lib/specials/categories.ts` +
> `schemas.ts`; hero image reuses W8 website-assets upload when the business has a website; pre-MVP gate
> open, help+i18n deferred to S7; code-only, no migration; type-check+lint+build green) → **S2 pricing
> DONE** (pure SSOT `lib/specials/pricing.ts`: `priceSpecialStay` [flat → synthetic `flatSpecialBreakdown`
> all-in package, no separate cleaning, occupancy-invariant; per-night → `priceStay` with ONLY the
> `syntheticPerNightRule` absolute max-priority full-span rule so seasonal/weekend never leak while
> occupancy + cleaning + add-ons flow] + `specialSavings` + `priceSpecialWithSavings` [special vs real-
> seasonal shadow]; server helper `specials/_lib/savings.ts` `computeSpecialSavings` loads unit (room/
> whole) + real seasonal rules + compulsory add-ons, picks shadow dates [fixed=exact, flexible=min_nights
> from window_start], best-effort nulls; wired into create/update actions → stores `was_price`/
> `savings_amount`/`savings_pct`. 10 vitest green [seasonal-skip + flat invariance + savings]; tsc+lint
> +build green; code-only, no migration) → **NEXT S3** booking wiring
> (`createSpecialBookingAction` + `/special/[slug]/book`, both entry points `booked_via`; extract shared
> persistence tail to `lib/bookings/persist.ts`; `redeem_special` atomic + rollback ladder; reuse
> `priceSpecialStay` as the authoritative price) → S4 `/specials` directory → S5 website specials page +
> `specials_preview` section → S6 reporting → S7 gating/help/i18n. Fresh session per phase; commit each.

---

**Prior focus (paused):** **Website CMS pivot + `listings → properties` rename (Property + Channels model).**

> **RESUME ANCHOR (multi-session project).** Branch: `feat/website-property-restructure`.
> Plan: `~/.claude/plans/ok-it-has-come-spicy-snail.md`. Rename checklist + progress log:
> `RENAME_LISTINGS_TO_PROPERTIES.md` (repo root). To continue in a fresh session: read
> those two files + `git log --oneline -15`, then do the next unchecked phase.
>
> **Sequence:** Phase 0 = full `listings→properties` rename in 5 green checkpoints
> (R0 inventory ✓ → R1 leaf tables → R2 core tables → R3 `listing_id→property_id` cols →
> R4 routes+i18n). THEN the website build (plan §1+): Property+Channels, per-business
> `host_websites` CMS, subdomains + custom domains, sidebar/IA restructure, product gating.
> Ledger/booking core is NOT touched. Each phase: migration → `db push --linked` → gen types
> → code sweep → `pnpm build`+`pnpm lint`+query-sweep → commit → (optionally start fresh session).
>
> **Status:** R0 done (inventory); R1 done (8 leaf tables, commit `ca78d20`); R2 done
> (7 core tables `listings→properties` + core children; migration
> `20260617000200_rename_r2_core_tables.sql`; 30 fns recreated; 112 code files + 4
> scripts swept; type-check/lint green; live verify green). **R3 done** (migrations
> `20260617000300` cols `listing_id→property_id` on 20 tables + `listing_type→
> property_type` + `whole_listing_discount_pct→whole_property_discount_pct` +
> `clicked_listing→clicked_property` + `listing_view_events→property_view_events`;
> 36 fns recreated by mechanical swap; 104 source files + edge fn swept;
> `20260617000400` drops a stale pre-SSOT `get_listing_policy_summary(uuid)` overload;
> build + type-check + lint green; verify-policy-resolver + 13 RPCs live-green;
> `track-listing-view` edge fn redeployed + smoke-tested green). **R4 done** — routes +
> i18n labels, **no DB migration**: route folders renamed (`listing/[slug]`→`property/[slug]`,
> `dashboard/listings`→`dashboard/properties`, `admin/listings`→`admin/properties` +
> `[listingId]`→`[propertyId]`, iCal `[listing_id]`→`[property_id]`) with every path-string
> + import swept (typedRoutes OFF → swept by hand); `messages/en.json` + `af.json` app-UI
> "Listing"→"Property" value swaps (fr/de/pt are empty stubs); host sidebar item
> "Listings"→"Properties". Build+lint green; 0 route strings remain. Commit `852bfea`
> (routes) + i18n commit. **Deferred to website §5:** the ~50 *hardcoded* "Listing" page
> headings/labels (extract to i18n during the IA pass, don't hardcoded-swap now).
> **The R0–R4 physical rename is COMPLETE.** **Website build STARTED** (plan §8 — 15
> phases). **W1 (Data foundation) DONE** — migration `20260617000500_website_foundation.sql`
> created 7 additive tables (`host_websites`, `website_pages`, `website_properties`,
> `website_rooms`, `website_blog_categories`, `website_blog_posts`, INSERT-only
> `website_domain_events`) + owner/admin RLS + `update_updated_at` triggers + public
> `website-assets` bucket & host-scoped object policies + `plan_features` seed (4 new
> keys × 4 plans, open pre-MVP). Added the 4 keys to `lib/products/features.ts` and the
> shared Zod section union at `apps/web/lib/website/sections.schema.ts` (co-located, NOT
> `packages/schemas`, to avoid a pnpm-install risk — deviation noted). Pushed; types
> regenerated; build+lint+type-check green; `scripts/verify-website-foundation.mjs` 🎉.
> **Naming note:** channel table is `website_properties(property_id)` (authored post-rename).
> **W2 (Sidebar IA, plan §5) DONE** (commit `1770a98`) — config-only re-author of
> `dashboard/_components/Sidebar.tsx` into 5 groups: always-open daily driver
> (Overview/Calendar/Bookings/Inbox/Guests) + collapsible Properties/Channels/Finances/
> Insights. New gated **Website** row (NEW badge) → `/dashboard/website` + a `ComingSoon`
> placeholder page (replaced in W6). Folded rows removed (Rooms/Seasonal/Listing-extras/
> Add-ons/per-property Policies — already editor tabs); account Policies+Staff kept in
> footer; "Channels"→"OTA channels"; Affiliates under Insights. Build+lint+type-check green.
> **Deferred:** (a) business/website switcher → W6 (first consumer is the per-business site;
> a `vilo_active_business` cookie now would be a no-op — views are all-businesses, Ledger/
> Guest-record use `?business=`); (b) Policies/Staff as Settings tabs (route move); (c) the
> ~50 hardcoded "Listing" headings → i18n sweep.
> **W3 (shared section components + renderer, plan §2/§8.3) DONE** (commit `12873de`):
> the ONE presentational component set (preview === public) — `lib/site/themes.ts`
> (5 presets → `--site-*` vars via `buildSiteVars`), `components/site/SiteThemeRoot`
> (scopes the vars), `SiteChrome` (header/nav/footer + Book CTA), `lib/site/types.ts`
> (auto-populate `SiteData` shapes + `dataFor`), 13 `components/site/sections/*` +
> `_shared`, and `SectionRenderer` (switch(type), passes live `data` to auto sections +
> an `asset` path→URL resolver to hero/host_bio). Pure presentational, no fetching, read
> `--site-*` only. Temp harness at `dashboard/website/preview` (sample data + preset
> switcher; sample sections validated through W1 `sectionsSchema`). Build+lint+type-check
> green. **W4 (public site routes + loadSitePage, plan §8.4) DONE** (commit `8f66b7f`):
> `lib/site/loadSitePage.ts` (service-role; `resolveSiteRef` ?site/host-header,
> `loadSiteContext` brand/theme/nav + published-only-unless-preview, `loadSitePage`
> page-by-path + published/draft sections + auto-populate data for gallery/rooms/location/
> reviews/blog, `loadSiteBlogPost`) + routes under **`app/[locale]/site/*`** (home,
> `[...slug]`, `blog/[postSlug]`, host-aware `sitemap.xml`+`robots.txt`, `not-found`;
> all force-dynamic) + `SitePageView` (shared frame + public-bucket asset resolver).
> Testable via `/<locale>/site?site=<sub>`. `scripts/verify-website-site-loader.mjs` 🎉.
> **KEY DEVIATION:** mounted under `[locale]/site/` NOT a `(site)` root group — `_`-prefixed
> folders (`__site`) are non-routable in Next, and a 2nd route-group root layout can't
> coexist with the non-grouped `[locale]` root. Booking CTAs deep-link the engine. Chrome
> reads live columns (published_snapshot fast-path → W10).
> **W5 (middleware host routing, plan §8.5/§3) DONE** (commit `de12cdf`):
> `lib/site/host.ts` pure classifier (`classifyHost` app vs {site,ref}, `RESERVED_SUBDOMAINS`,
> `siteRewritePath`, `isSeoFile`) — FAIL-SAFE (no `NEXT_PUBLIC_ROOT_DOMAIN` ⇒ all app, opt-in
> by env). `middleware.ts`: classifier FIRST; tenant host → rewrite `/<defaultLocale>/site<path>`
> + `x-vilo-site-host`, NO next-intl/NO session (no cookies on tenant hosts); app hosts UNCHANGED;
> sitemap.xml/robots.txt added to matcher. `host.test.ts` 10 tests (the mandated app-routing-
> unchanged guard) — vitest 49/49 green. `ENV_VARS.md` + new `WEBSITE_HOSTING.md` (DNS/Vercel ops,
> reserved subs, `?site=` pre-DNS testing). **OPS TODO (founder):** set `NEXT_PUBLIC_ROOT_DOMAIN=
> vilo.site`, add wildcard `*.vilo.site` DNS + Vercel project domain (the on-switch + DNS are
> external; code is ready and inert until then). Shell `<html lang>` is `en` for tenants (site
> language still drives content via business default_language) — refine later if wanted.
> **W6 (create-site flow + builder shell, plan §8.6) DONE** (commit `8161446`): replaced the W2
> ComingSoon placeholder. `/dashboard/website` landing (dark hero + per-business create/manage;
> single business w/ site → editor). `createWebsiteAction` (subdomain reserved-check via shared
> `RESERVED_SUBDOMAINS`, one-site-per-business + global subdomain uniqueness, seeds starter Home+About
> pages + syncs properties/rooms as visible channel membership). `lib/website/subdomain.ts`+tests
> (`deriveSubdomain`/`validateSubdomain`→error codes). `[websiteId]` editor shell: `layout` (name +
> address + Preview `?site=&preview=1` + disabled Publish + tab bar Overview-live / rest "coming soon")
> + Overview (checklist + counts) + `loadWebsiteEditorData` (owner-scoped). New `website` i18n
> namespace (52 keys); help migration `20260617000600`. build+lint+type-check green; vitest 54/54.
> **STILL DEFERRED:** the business/website switcher (kept deferred — the per-business create/manage
> cards already handle multi-business; revisit if the editing flow needs a global active-business).
> **W7 (Brand & Theme tabs, plan §8.7) DONE** (commit `58f1831`): `[websiteId]/brand` +
> `[websiteId]/theme` routes wired live in `WebsiteTabs` (Overview/Brand/Theme live; rest "coming
> soon"). **Brand**: logo upload browser→Storage into public `website-assets` (signed-URL pattern:
> `createWebsiteLogoUploadUrl`→`uploadToSignedUrl`→`registerWebsiteLogoAction`, path `{websiteId}/…`)
> + name + tagline → `host_websites.brand` jsonb; `removeWebsiteLogoAction` clears path + deletes
> object. **Theme**: 5 preset swatches + accent/font/radius overrides (empty=inherit preset) + a live
> `--site-*` preview via `buildSiteVars` → `host_websites.theme` jsonb. `saveBrandAction`/
> `saveThemeAction` (+ `patchSiteJson` merge), owner-scoped `assertWebsiteOwnership` + pre-MVP
> `assertWebsiteFeature` short-circuit (§3.4); `brandSchema`/`themeSchema`. New shared
> `lib/website/assets.ts` (`websiteAssetUrl`) — SSOT path→public-URL, adopted by `loadSitePage`
> (logo now resolves) + `SitePageView.siteAsset`. **NO DB schema change** (brand/theme cols + bucket
> from W1); help migration `20260617000700` pushed; +44 `website` i18n keys (en). build+lint+
> type-check green; `scripts/verify-website-brand-theme.mjs` 🎉.
> **W8 (Home + About section builder, plan §8.8) DONE** (commit pending): the flagship CMS editor.
> **Pages** tab now live → `[websiteId]/pages` (list: Home/About + section counts) → `pages/[pageId]`
> two-pane builder. LEFT: accordion of sections — add (typed menu), reorder (up/down buttons, NO
> `@dnd-kit`), show/hide, delete, click-to-edit. RIGHT: **inline live preview** through the SAME
> `components/site/*` renderer the public site uses (preview === public) + desktop/phone width toggle.
> `SectionEditor` = per-type RHF-free forms over the shared `sectionSchema` union (free-form edit
> text/images; auto-populate sections edit config only + "pulls live data" note). Reusable field
> primitives in `pages/[pageId]/_components/fields.tsx`. Section images (hero bg, host photo) upload
> browser→Storage via `createWebsiteAssetUploadUrl` (path saved into props on Save).
> `saveDraftSectionsAction` (owner-checked, validates via `sectionsSchema`, writes
> `website_pages.draft_sections`); `newSection()` defaults; `loadPageBuilder` + `loadPagesList`.
> **KEY REFACTOR:** `lib/site/loadSitePage.ts` now exports **`assembleSiteDataByType`** (data keyed
> by TYPE = SSOT); `assembleSectionData` fans it out by id; the builder preview reuses it via
> `loadSiteContext(subdomain,{preview})` so auto sections show REAL data. **NO DB schema change.**
> **DEVIATION (noted):** local React state in the one builder island instead of the plan's Zustand
> store (Zustand not a dep; a global store buys nothing here) — no package added. Help migration
> `20260617000800` pushed; +~95 `website` i18n keys (en). build+lint+type-check green.
> **W9 (Rooms tab, plan §8.9) DONE** (commit pending): Rooms tab now live in `WebsiteTabs` →
> `[websiteId]/rooms`. `loadRoomsEditor` (owner-scoped; properties → active `property_rooms` ⟕
> `website_rooms` overrides, grouped by property). `RoomsManager` island: per-room show/hide
> switch, up/down reorder (within property), expandable display overrides (name/price/currency/
> desc; blank=inherit live value), "{shown} of {total}" counter. `syncWebsiteRoomsAction`
> reconciles `website_properties`+`website_rooms` with the business's current props/rooms
> (insert new visible, prune deleted, preserve overrides — also tops up property membership so
> book-links resolve). `saveWebsiteRoomsAction` upserts one row/room (sort_order=index;
> anti-tamper room→business check). New `websiteRoomSchema`/`saveWebsiteRoomsSchema`; reuses W8
> `fields.tsx` primitives. **Booking untouched** — `display_price` cosmetic; public RoomsPreview
> per-room CTA already deep-links `/property/[slug]/book` (re-prices server-side). **NO DB schema
> change** (cols from W1). Help migration `20260617000900` pushed; +~18 `website` i18n keys (en).
> build+lint+type-check green; `scripts/verify-website-rooms.mjs` 🎉.
> **W10 (Publish workflow, plan §8.10) DONE** (commit pending): the editor header `PublishBar`
> island replaces the disabled button. `publishWebsiteAction` copies every page's `draft_sections`
> → `published_sections` and freezes the public-render config (brand/theme/nav + visible property
> ids + room overrides) into `host_websites.published_snapshot` + `status='published'` +
> `published_at`; `unpublishWebsiteAction` takes a live site offline (keeps draft + snapshot).
> **Dirty detection** = new `lib/website/publish.ts` (`buildWebsiteSnapshot`, `computeWebsiteDirty`,
> key-order-independent `stableStringify` — jsonb doesn't preserve key order): dirty when
> never-published/offline, or live snapshot ≠ published snapshot, or any page draft≠published
> sections. Surfaced via Publish-button enabled state + header status pill + Overview status banner
> (`loadWebsiteEditorData.isDirty`). **KEY CHANGE:** `loadSiteContext` non-preview now reads chrome +
> membership + room overrides from `published_snapshot` (NOT live cols) so unpublished edits no longer
> leak; preview + legacy-no-snapshot fall back to live. Rooms assembly refactored to take override
> rows from either source ⨝ live `property_rooms` (price/photos stay live; booking re-prices
> server-side). `pageHref` exported for snapshot nav SSOT. **NO DB schema change** (publish cols from
> W1). Help migration `20260617001000` pushed; +21 `website` i18n keys (en). build+lint+type-check
> green; `scripts/verify-website-publish.mjs` 🎉.
> **W11 (Blog, plan §8 item 12) DONE** (commit pending): Blog tab now live in `WebsiteTabs` →
> `[websiteId]/blog`. List (status pill / category / slug / delete) + **New post** + inline
> **Categories** editor (`loadBlogEditor`; posts ⨝ category). Full-screen `blog/[postId]` editor
> (`loadBlogPost` + `PostEditor`): title, body via reused `RichTextEditor` (Tiptap), cover
> image (browser→Storage via `createWebsiteAssetUploadUrl`+`ImageField`), excerpt, author,
> category/status pickers, editable URL slug, compact SERP preview (meta title/desc → `seo` jsonb).
> Actions: `createBlogPostAction` (unique-slug draft, returns id), `saveBlogPostAction` (unique
> slug, stamps `publish_at` on first publish, anti-tamper category), `deleteBlogPostAction` (soft),
> `saveBlogCategoriesAction` (reconcile upsert+delete; FK SET NULL keeps posts). Slugs reuse
> `lib/help/slug.ts`. All owner-checked + pre-MVP feature short-circuit (§3.4). **KEY FIX:**
> `loadSitePage` now resolves the `blog_preview` cover via `websiteAssetUrl` (was raw path).
> **NO DB schema change** (blog tables + RLS from W1; public routes + blog_preview data from W4).
> Help migration `20260617001100` pushed; +~40 `website` i18n keys (en). build+lint+type-check
> green; `scripts/verify-website-blog.mjs` 🎉. **DEFERRED:** post scheduling (`status='scheduled'`
> + cron flip) — UI ships Draft/Published only so every state works without a worker.
> **W13 (Custom domain + SSL, plan §8 item 13) DONE** (commit `221ba1c`): Domain tab now live →
> `[websiteId]/domain`. **Inert until the founder sets the Vercel secrets** (mirrors the W5
> on-switch): `vercelConfigured()` false ⇒ UI says "not available yet", connect disabled.
> `lib/website/domain.ts` (pure validate + DNS-record builders: apex `A 76.76.21.21` / subdomain
> `CNAME cname.vercel-dns.com` + `_vercel` TXT), `vercel.ts` (Domains API wrapper, server-only,
> reads `VERCEL_TOKEN`/`VERCEL_PROJECT_ID`/`VERCEL_TEAM_ID`), `domain-poll.ts` (**`pollWebsiteDomain`
> SSOT**: verify→config → `pending`→`verifying`→`active`/`error` + SSL, appends
> `website_domain_events`). `connect/refresh/removeCustomDomainAction` (owner-checked, then write
> via the **admin client** — events have no authenticated INSERT policy). `DomainManager` island:
> status + SSL pills, DNS-records table w/ copy, Refresh + Disconnect, activity log. Worker
> `/api/website-domain-poll` (reuses `EMAIL_WORKER_SECRET`) + `poll-website-domains` pg_cron every
> 2 min (migration `20260618000000`, Vault `website_domain_poll_url`, fail-soft). **OPS TODO
> (founder):** set the 3 Vercel env vars + register the Vault worker URL — see `WEBSITE_HOSTING.md`
> (now documents the full setup) + `ENV_VARS.md`. **W14 (SEO tab + Overview, plan §8 item 14) DONE**
> (same commit): SEO tab → `[websiteId]/seo`. `saveSeoAction` → `host_websites.seo` jsonb
> (title/description/og_image_path/gsc_token/robots_index/sitemap_enabled; OG image uploads via the
> W8 `ImageField`). **KEY:** `SiteContext.seo` (snapshot→live) + new **`loadSiteMeta` SSOT** →
> `lib/site/metadata.ts` `siteMetadata()` wired into `generateMetadata` on the site home/`[...slug]`/
> `blog/[postSlug]` routes (page `seo_overrides` → site `seo` → brand; OG/Twitter cards; GSC
> `verification.google`; preview never indexed). `robots.txt` honours `robots_index`; `sitemap.xml`
> honours `sitemap_enabled`. `SeoForm` (Google SERP preview, OG upload, index toggles) + Overview
> checklist gains a "search engine details" step. **NO DB schema change** (domain/seo cols + events
> table from W1). Help migrations `20260618000100` (custom-domain) + `20260618000200` (seo); +~70
> `website` i18n keys (en). build+lint+type-check green; `scripts/verify-website-domain-seo.mjs` 🎉.
> **All editor tabs are now live.**
> **W12 (Per-property Channels control, plan §8 item 11) DONE** (commit pending): new **Channels**
> tab on the property editor (`properties/[id]/edit`) with two independent switches — **Vilo
> Directory** (reuses `togglePublishAction` → `properties.is_published`; directory state lifted so the
> tab + header toggle stay in sync) and **Your website** (new `setWebsiteChannelAction` upserts
> `is_visible` on the business's `website_properties` row, insert-if-missing, hide keeps overrides;
> handles no-business / no-website-yet). `loadListingEditorData` now returns `channels`
> (business→`host_websites`→`website_properties.is_visible`). Booking untouched (both channels
> deep-link the same re-pricing checkout). Help `20260618000300` (`property-channels`). New tab uses
> the editor's existing hardcoded-strings convention (editor i18n sweep still deferred).
> build+lint green; help migration pushed. **Also (founder side-note):** folded the account-level
> **Policy library** out of the sidebar footer into the **Properties** group (page unchanged, nav
> move only; per-property assignment already lives in the editor's Policies tab).
> **W15 (Flip gating live, plan §8 item 15 / §7) DONE** (commit pending): the pre-MVP open-on-free
> short-circuit is removed — gating is now enforced via `check_feature_permission`. New SSOT
> `lib/products/featureGate.ts` (`hostHasFeature`, fail-closed). **Action layer:** website/CMS
> `assertWebsiteFeature(hostId, key)` now calls the RPC — `website_builder` master gate, blog actions
> check `website_blog`, custom-domain checks `website_custom_domain`, `createWebsiteAction` gated too;
> property editor `togglePublishAction` gated on `directory_listing` (publish-on only; un-publish
> always allowed) and `setWebsiteChannelAction` on `website_builder` (show-on only; hide always
> allowed). **UI layer:** dashboard layout resolves `website_builder` → Sidebar Website row badge
> flips NEW↔PRO; `/dashboard/website` landing + `[websiteId]` editor layout render the shared
> `WebsiteLocked` upgrade card when not entitled (`loadWebsiteEditorData` now returns `hostId`).
> **Effective gate:** all five keys are seeded `true` on every plan AND on the default products, so
> the real test is "active/trialing subscription?" — a host with one keeps full access; one with no
> active subscription is locked out (the accepted trade-off). **NO DB migration** (code-only).
> +3 `website` i18n keys (en: lockedTitle/Body/Cta). tsc + lint green. **The website build (W1–W15)
> is COMPLETE.**
>
> **ENTERPRISE BUILD-OUT (2nd plan: `~/.claude/plans/so-based-on-th-harmonic-petal.md`).**
> Tab-by-tab elevation of the CMS to enterprise grade, 11 phases. **Phases 0a/0b/1–4
> DONE** (analytics pipeline, media library, Overview dashboard, Brand, Theme, Domain —
> commits `4edb785`…`eb73a8c`). **Phase 5 (Home page editor) DONE** this session, 4 commits:
> (1) `stats`/`logos`/`map` section types; (2) **contact form → inbox "Website Enquiry"**
> (`conversations.source='website'` + `website_enquiry` system card + sky "Website" chip;
> shared `findOrCreateLeadIdentity` SSOT reused by quote enquiries; `createWebsiteEnquiry`
> + `/api/website-enquiry` + `website_enquiry_host` notif; optional host email via new
> **Settings tab** in `host_websites.settings` jsonb) — see [[project_website_contact_enquiry]];
> (3) **@dnd-kit** drag-reorder + duplicate section/page; (4) **section library** modal +
> **visual click-to-edit** (preview hotspots → FormModal). Migrations `…001200` (source col)
> + `…001300` (help). **Phase 6 (multi-page + nav) DONE** — Pages tab is now a full
> manager (`PagesManager`): add-page w/ Blank/About/Contact templates, DnD reorder,
> per-page nav label + show/hide-in-nav (`savePagesAction`, live on Publish), delete
> (Home protected), per-page SEO overrides card (`savePageSeoAction` → `seo_overrides`,
> already consumed by the public metadata SSOT). Migration `…001400` (help).
> **Phase 7 (Rooms tab) DONE** — DnD room ordering, feature-a-room + custom badge
> (`website_rooms.featured`+`badge`), auto room facts (sleeps/beds/ensuite from
> property_rooms), per-property group headers (wired the unused
> `website_properties.display_overrides`: heading/intro/hero), and a live preview pane
> (same public loader/renderer). Threaded through `RoomCard`/`RoomsPreviewData`, the
> publish snapshot (`SnapshotRoom`+`propertyOverrides`), `loadSitePage` assembly,
> `RoomsPreviewSection`, save action + loader. Booking untouched (cosmetic only).
> Migration `…001500` + help `…001600`.
> **Phase 8 (Blog) IN PROGRESS — Commit A (dashboard) DONE + committed/pushed (`c786cbd`,
> branch only — NOT on main yet since the phase is incomplete).** Migration
> `20260618001700_website_blog_phase8.sql` added `website_blog_posts.featured` +
> `author_bio` + `author_avatar_path` (status CHECK already allowed 'scheduled'; publish_at
> already existed) — PUSHED + types regenerated. Commit A shipped: featured pin (star) +
> status filter + search + missing-SEO badge + category counts/slugs in `BlogManager`;
> `setBlogFeaturedAction`; `saveBlogPostAction` now persists featured/author_bio/
> author_avatar_path + handles status='scheduled' (validates publishAt) + `deriveExcerpt`
> auto-excerpt; `saveBlogPostSchema` extended (status enum +scheduled, featured, publishAt,
> authorBio, authorAvatarPath); `PostEditor` adds Scheduled status + datetime-local picker +
> featured toggle + author avatar/bio + reading-time; loaders return the new fields. tsc +
> lint GREEN, **`pnpm build` GREEN** (had to bump heap: `cd apps/web &&
> NODE_OPTIONS=--max-old-space-size=6144 pnpm build` — the default heap OOM-crashed the
> build worker with exit 134, an env memory issue not a code error; use the bumped heap).
> **Phase 8 Commit B (REMAINING — public + cron), all designed, not built:**
> (1) **Blog index page** `app/[locale]/site/blog/page.tsx` (themed list, featured-first; new
> loader `loadSiteBlogIndex(ctx)`); add a "View all" link on `BlogPreviewSection` → `/blog`.
> (2) **Featured-first ordering** in the `blog_preview` assembly (`lib/site/loadSitePage.ts`
> ~line 664: add `.order('featured',{ascending:false})` before publish_at; select `featured`).
> (3) **Related posts** on the post detail (`loadSiteBlogPost` → also return same-category
> published siblings, limit 3; render at bottom of `site/blog/[postSlug]/page.tsx`).
> (4) **Author profile** on the post detail — `loadSiteBlogPost` return `authorBio` +
> `authorAvatarUrl` (select `author_bio,author_avatar_path`); render an author card.
> (5) **RSS feed** `app/[locale]/site/feed.xml/route.ts` (published posts XML). Wire tenant-host
> routing: extend `isSeoFile` in `lib/site/host.ts` to include `/feed.xml` + add `/feed.xml`
> to `middleware.ts` matcher. Test via `/en/site/feed.xml?site=<sub>`.
> (6) **Scheduled-publish cron** — worker route `app/api/blog-publish/route.ts` (auth via
> `EMAIL_WORKER_SECRET`, timing-safe; find status='scheduled' AND publish_at<=now() AND
> deleted_at null → set status='published'; batch 50) + cron migration mirroring
> `20260618000000_website_domain_poll_cron.sql` (pg_cron every 5 min, Vault secrets
> `blog_publish_url` + `email_worker_secret`, fail-soft). NOTE: blog posts render LIVE
> (not from the publish snapshot), so flipping status='published' shows them immediately —
> no website re-publish needed. **OPS TODO (founder): register Vault `blog_publish_url`.**
> (7) Help migration `…001800`-ish refresh of `website-blog`; +i18n keys for index/related/author.
> After Commit B: build green → commit on branch → **fast-forward `main` + push** (phase done).
> **DEFERRED in Phase 8 (note to founder):** inline image/gallery embeds in the post body
> (the RichTextEditor is shared with listings — left untouched to avoid risk; quote/blockquote
> already supported); author is per-post (avatar/bio on the post) rather than a reusable
> author table. **THEN: 9 SEO, 10 website-native booking flow [LAST big one], 11 theme catalog.**
> **WORKFLOW: commit on branch + fast-forward/push `main` after EACH completed phase (founder
> 2026-06-18).** Fresh session per phase; build+lint green each commit.

_(Previous focus below — hardening features for MVP — remains valid context.)_

## ✅ Done this session (2026-06-16) — Vilo product payments: reporting + invoices + thank-you + Meta Pixel + test mode
- Fixed: a Vilo product/subscription purchase paid with Paystack test keys
  "stopped" after payment and never showed in admin payments/ledger/reporting.
  Root cause: product orders settled only via the webhook. Now they settle on
  return (`confirmProductOrderByReference`), with the webhook as backstop.
- Post-payment **thank-you one-pager** + **auto-issued Vilo invoices**
  (`vilo_invoices`, minted by a `platform_ledger` trigger; public page + PDF;
  admin **Vilo business details** form). User **Settings → Transaction history**
  lists purchases with invoice downloads.
- **Admin-managed Meta Pixel** (Platform settings) + shared `firePurchase`
  (fbq Purchase with dynamic value + `eventID`; CAPI plumbed, not wired).
- **Test/Live tagging** (`environment`) + admin Payments Live/Test/All filter;
  live KPIs exclude test. Plan: `~/.claude/plans/when-a-user-pays-snuggly-bonbon.md`.
- **TODO before launch:** set the Paystack **test** webhook URL in the dashboard
  (backstop in test mode); fill Vilo business details for the invoice issuer;
  wire the Meta Conversions API server post; full i18n pass on the new strings.

## (Earlier) ✅ Affiliate programme (Phases 1–8)
- Full enterprise affiliate programme for Vilo products, open to any user
  (anchored on `user_profiles.id`, not host). Mounted at `/portal/affiliates`.
- 30-day cookie tracking + permanent binding; commission accrual/clearing/
  clawback engine (RPCs + crons); affiliate Overview/Products/Marketing/Payouts;
  payout requests with per-method fee; admin management + settings + the
  user-record Referrals tab. Migrations `…010`–`…018`; `verify-affiliate-ledger.mjs`
  16/16. Plan: `~/.claude/plans/flickering-tinkering-ripple.md`.
- **TODO before launch:** redeploy `paystack-webhook` (live accrual); add Supabase
  env vars to Vercel **Preview** scope (preview builds fail prerendering `/login`
  without them); platform-wide i18n pass covering portal/admin/affiliate strings;
  setup-fee commission when billing charges it as a separable amount.

## (Earlier) Harden each feature to 100% for MVP — Reviews feature, end-to-end.

## ✅ Done this session (2026-06-13) — Guest Reputation (hosts rate guests, cross-host)
- Built `host_review_guest.md` end-to-end: `guest_ratings` table (cross-host
  read RLS, own-row write, one living review per host/guest), `hostCanRateGuest`
  eligibility (completed/no-show), `upsert/deleteGuestRatingAction`, a new
  **Reputation** tab on the Guest Record (aggregate + your review + other hosts),
  and a `FormModal` rate-a-guest flow. Extracted shared `CategoryStars`.
- Migrations `20260613000020_create_guest_ratings.sql` +
  `20260613000021_help_guest_ratings.sql` pushed; types regenerated. `pnpm
  build` + `pnpm lint` green.
## ✅ Done this session (2026-06-13) — Ledger ↔ multi-business (Phases 1–2)
- Plan `LEDGER_MULTIBUSINESS_PLAN.md`. Confirmed finance **documents already**
  render the listing's business (no work). **Txn now business-aware** (derived
  via booking→listing→business_id; `fetchHostTransactions` businessId filter that
  scopes rows + running balance). **Business selector on the Ledger** + on the
  **Guest Record Finances tab** (server-side `?business=`; headline balance stays
  all-businesses). Also fixed the portal `in_app_notifications` user-scope.
- **Remaining (Phase 3, next chunk):** `business_id` on `guest_credit_ledger`
  (per-business store credit) + populate it on credit write-paths; headline still
  nets all. Then verify (2-business + shared guest) + help + ship.
- **Still parked:** guest-portal build plan (portal is ~95% built; only QA tracker exists).

## ✅ Done this session (2026-06-10) — Calendar: select a range on the grid + inline book
- **Industry-standard range selection on the month grid.** Tap check-in → later
  check-out; nights highlight, a **Selected range** card shows (listing picker,
  est. total, live booked/blocked conflict check). Actions: **Block** the nights
  (`setManualBlocksAction`) or **Create booking**.
- **Inline quick-book modal** (no page change) — compact `FormModal` over the
  calendar, dates locked, guest + price + payment; posts to the existing
  `createManualBookingAction` (SSOT, not forked). **Open the full editor**
  deep-links the wizard with listing + both dates for rooms/add-ons.
- Also fixed the single-day Availability panel from a UI re-review (booked rows
  open the booking; real status label; past dates read-only).
- Help: `20260610180007_help_calendar_inline_booking.sql` (re-upsert
  `managing-your-calendar`). `tsc` + `eslint` green on changed files. Commits
  `d22f8eb`, `5673295`.

## ✅ Done this session (2026-06-10) — Calendar: manage availability + book from it
- **Wired the calendar's existing-but-unused block actions into the UI.** New
  right-rail **Availability** panel (per listing for the selected day:
  Open/Booked/Blocked) with one-tap **Block**, **Open up** (unblock) and **Book**
  (deep-links the new-booking wizard with listing + check-in prefilled).
- **Block dates** top-bar button → canonical `FormModal` to block/open a whole
  range listing-wide (`setManualBlocksAction`); booked + quote-held nights left
  untouched. Single-day toggle uses `toggleBlockedDateAction`.
- **New-booking prefill** — `/dashboard/bookings/new` honours `?listing=&checkIn=&checkOut=`
  (validated server-side); `ManualBookingForm` seeds listing/dates/picker month.
- Help: `20260610170000_help_calendar_manage.sql` (`managing-your-calendar`).
  `tsc` + `lint` green. Commits `73ae1f9`, `f95a48f`.

## ✅ Done this session (2026-06-10) — Inbox: one chat design (host = guest)
- **Single source of truth for the inbox.** Extracted shared components in
  `components/inbox/` (`ConversationList`/`ConversationRow`, `ChatMessageWall`,
  `ChatComposer`, `ChatThreadHeader`, `InboxAvatar`) used by BOTH the host inbox
  and the guest portal.
- **Host inbox reworked to the guest's two-pane WhatsApp layout.** Removed the
  folder rail, deal **pipeline**, tabs, pagination, assignee, follow-up/snooze and
  internal notes. Kept: quick-reply templates, a slim Booking/Details slide-out,
  archive/un-archive, pin. Deep links (`?c=`, `?f=enquiries`) + full-bleed intact.
- Deleted `PipelineControl.tsx`/`ConversationNotes.tsx` + 4 dead actions. DB
  `pipeline_stage` column + guest auto-advance left in place (harmless).
- Help: `20260610160000_help_inbox_redesign.sql` (new `using-your-inbox`; corrected
  `enquiry-pipeline-inbox`) — **pushed to remote**. `tsc` + `lint` green.

## ✅ Done this session (2026-06-10) — Party guests → guest records + relationships
- **Party members become guest records.** Each named person on a booking's
  `additional_guests` is materialised into `host_contacts` (deduped by email) so
  the host can open/message/tag them individually — they show in the Guests
  directory + have a working record automatically (`_host_guest_rows` UNIONs
  `host_contacts`).
- **`guest_relationships`** table + RLS links each party member ↔ the lead booker
  (one row per direction, tagged with the booking). New **Relationships** tab on
  the guest record; **Guests** tab on the booking record (replaces "Guest")
  showing lead + party with per-member record links + an **Add guest** action.
- **Single-source materialiser** — `_materialize_booking_party()` called by an
  `AFTER UPDATE OF status` confirm trigger AND the ownership-checked
  `materialize_booking_party()` RPC (lazy fallback on the booking record +
  Add-guest). Checkout party manifest now requires name + email; thank-you page
  lists the party. Migrations `20260610150000`, `20260610150001` (help).

## ✅ Done earlier (2026-06-10) — Reviews to MVP
- **Photos on reviews** — public `review-photos` bucket + `review_photos` table;
  token-gated signed upload from the (account-less) submit form; one reusable
  `ReviewPhotoGrid` (lightbox) on listing / dashboard / admin / portal / confirm.
- **Delayed request** — checkout enqueues `review_request_queue(send_at=+5min)`;
  `/api/review-request-worker` + `drain-review-requests` cron drain it via one
  SSOT `lib/reviews/request.ts → sendReviewRequest()` (email + in-app + thread
  card). Old daily queuer → paid-aware 24h backstop.
- **Fixed broken plumbing** — emailed review link had no token (resolver now
  signs it); added the missing in-app builder; fixed tokenless portal CTA.
- **Publish immediately** (was 48h); `protect_review_content()` makes reviews
  immutable (hosts may only respond); host **Review link** card on bookings.
- **Eligibility** — only completed **+ paid** stays (refunded-after-stay still
  counts). Help articles `how-reviews-work` (host) + `leaving-a-review` (guest).
- **Ops TODO (founder, one-time):** Vault `review_request_worker_url`; confirm
  `NEXT_PUBLIC_SITE_URL`. Probe: `scripts/verify-reviews.mjs` (green).

<details><summary>Previous focus — Finances are the spine</summary>

## ✅ Done (2026-06-08)
- **Reporting wired to the ledger** — new **Cash position** panel on Analytics
  (Collected/Outstanding/Refunded/Net cash + lifetime collection bar) sourced
  from `fetchHostTransactions`, so Reports, Ledger and Finances agree. Added
  canonical `txnFlows` (SSOT for collected/refunded/credits/charged); `txnStats`
  builds on it. Booked-value (accrual) vs cash explainer added; refund-rate
  labels disambiguated. Help article `reports-cash-position` (live). All 12
  analytics RPCs probed green against the real schema.
- **Booking-flow follow-ups** — live per-room availability + whole-place toggle
  (`b063d76`).
- **Host-Paystack spine fix** — guest card payments now charge the **host's own**
  connected Paystack (not the platform key); success-page verify uses the host
  key. `getHostPaystack` is the SSOT (`8a83d31`).
- **Pay-now link** — `bookings.pay_token` + public **`/pay/[token]`** page (card
  on host Paystack or EFT) + host **Payment link** card (Copy / WhatsApp /
  Email) on the Payments tab. Shared `startBookingPayment` core
  (`d6cffe3`, `3cd1134`). Help article `send-a-payment-link` applied.
- **Guardrails added** — AGENT_RULES **§4.7** (wire into the ledger, never fork
  the maths) + **§4.8** (booking card → host gateway). See
  `[[feedback_ledger_single_source_of_truth]]`.

</details>

## ▶ Next
1. **Test bookings end-to-end** with the host's connected Paystack test account
   (guest checkout card path + the `/pay/[token]` link). Founder-driven.
2. **Pay-link in the guest message thread** — deferred fast-follow (needs
   conversation lookup/creation; Copy/WhatsApp/Email cover resend today).
3. ✅ **Single-source-of-truth consolidation pass** (founder request) — DONE for
   the payments/finance audit: one `round2` (lib/format), one `INBOUND_KINDS` +
   `sumPaidFromRows`, success page via `confirmHostCardPaymentByReference`, one
   `requireHost()` adopted across ~14 action files, `getHostPaystack` in the
   banking link action, one `nightsBetween`. _Deliberately left:_ per-page
   `fmtDate` formatters (intentionally divergent — not forced).

---

<details><summary>Previous task — Booking Redesign — COMPLETE</summary>

**Plan:** see **`BOOKING_REDESIGN_PLAN.md`** (repo root) — full, buildable, phased.
**Designs:** `C:\Users\Wollie\Downloads\Listing 3.0.html` (listing) +
`C:\Users\Wollie\Downloads\Booking Flow.html` (checkout).

## Start here
1. Read `BOOKING_REDESIGN_PLAN.md` end-to-end.
2. Build phase-by-phase (§4), committing + pushing after each; `pnpm build` +
   `pnpm lint` green every time; tick the §5 Progress box.
3. Resolve the §3 flags (add-on units, in-flow availability, listing cleanup)
   in-phase — flag the founder before any schema change.

> Goal: listing page is **display-only** with **two CTAs** — **Reserve**
> (→ self-contained 3-step Rooms→Details→Payment flow) and **Request a quote**
> (→ existing modal). Guests cannot select rooms or book on the listing itself.

</details>

<details><summary>Previous task — Guest Record (CRM) — COMPLETE</summary>

**Plan:** `GUEST_RECORD_PLAN.md` · **Design:** `Guest Record.html`. Feature
complete (see Progress below).
</details>

## One-line summary
Add a **Guests** sidebar item (after Bookings); a Guests list (`/dashboard/guests`); a CRM **Guest
Record** page (`/dashboard/guests/[gkey]`) — identity + verifications, lifetime stat band, tabs
Overview/Bookings/Messages/Payments/Notes; two-way linked with Booking Details. New tables:
`guest_notes`, `guest_tags`, + `user_profiles` verification columns. Guests are keyed by a unified
`gkey` (user_profiles.id, or `e_<base64url(email)>` for email-only manual-booking contacts).

> **ARCHITECTURE CHANGE (2026-06-06):** founder chose to **reuse & extend** the
> existing `host_contacts` (tags/notes/blocked, deduped by email) + `message_templates`
> (full CRUD in `inbox/actions.ts`, `{{guest_name}}` tokens) instead of the plan's
> parallel `guest_contacts`/`guest_tags`/`guest_flags`/new-templates tables. Only
> `guest_notes` is genuinely new. `gkey` is a URL/resolution scheme, not a stored
> column. Inbox **Contacts tab + page removed** (Guests supersedes it). Keep it lean.

## Progress (Guest CRM build)
- ✅ **Phase 1** schema — extended host_contacts (+country/email_consent/blocked_*),
  new `guest_notes`, user_profiles verify cols, seeded message_templates. (commit 59856e8)
- ✅ Inbox Contacts tab + page removed. (632aa71)
- ✅ **Phase 2** RPCs — `_host_guest_rows`, `fetch_host_guests`(+`_summary`),
  `fetch_guest_record`; demo-host probe green. (e627e55)
- ✅ **Phase 3** sidebar entry + badge + `/dashboard/guests` list (KPI strip, segments,
  search, density, sort, pagination, rows). (06f0f76)
- ✅ **Phase 4** Add guest modal + filters + selection/bulk Tag·Export + CSV/vCard
  actions on host_contacts (lazy upsert). (d2d9092)
- ✅ **Phase 5** Guest Record shell — identity + stat band + Overview/Bookings/Payments + prev/next. (5a332e0)
- ✅ **Phase 6** Messages + Notes tabs (+ template picker) + Templates manager. (6aebc9b)
- ✅ **Phase 7** Booking↔record link + record More-menu (tag/block/export/new-booking). (cc8c089)
- ✅ **Phase 8** Help article (`guests-crm`) + CHANGELOG.
- ✅ **Phase 9** Bulk mailer — guest_marketing + guest_broadcasts + RPCs;
  lib/guests/broadcast.ts (Resend, server-side); sendBroadcastAction (monthly cap);
  BroadcastModal ("Email guests"); public /unsubscribe/[token]; per-guest opt-out.
  **Build-only — not deployed/sent.** Uses existing RESEND_API_KEY +
  EMAIL_FROM_ADDRESS + NEXT_PUBLIC_SITE_URL (no new env, no edge fn — sends from a
  Server Action like the rest of the app). Founder to do the first live-send test.
- ✅ **Extra (founder request):** record **Reviews** + **Finances** (invoices/
  quotes/refunds/credit-notes) tabs; POPIA marketing-consent control (locked,
  opt-out only); per-host isolation confirmed (already enforced by RLS).

**Feature complete.** Remaining before real email use: set a verified Resend
sender domain and run a live-send smoke test; consider AAL2/MFA restore (separate).

Probes: `scripts/verify-guest-crm-p1.mjs`, `verify-guest-crm-p2.mjs` (run from apps/web).

---

## ✅ Previously completed (this session group)
- **Analytics variable-mismatch fix** — 12 RPCs realigned to the real schema; missing tables created.
- **Unified shell theme** — host dashboard, guest portal, super admin all on `ClassicShellFrame` +
  `AppHeader` + `GmailNav` (collapsible 76px rail); founder tweaks (no compose, no plan card, no header
  New-booking, thin scrollbar).
- **New Booking 5-step wizard** — `ManualBookingForm` re-laid into Property → Dates & guests → Guest →
  Price & extras → Payment, real logic preserved.
