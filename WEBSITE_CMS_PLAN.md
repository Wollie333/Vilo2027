# Vilo Website CMS — Build Plan

> The build contract for turning Vilo's website feature into a full-fledged,
> easy-to-use, enterprise-grade CMS for accommodation hosts — designed so a host
> can launch a real, conversion-ready website in **minutes**, cheaply.
>
> Read alongside `CLAUDE.md`, `AGENT_RULES.md`, `CONVENTIONS.md`, `ARCHITECTURE.md`.
> Scope per session still comes from `CURRENT_TASK.md`.

---

## 1. Goal

A modern, simple, beautiful website CMS that:
- Lets a host stand up a complete accommodation website in minutes (AI-assisted).
- Drives **direct bookings + enquiries** by integrating deeply with the existing
  Vilo booking engine, inbox, and accounting — no marketplace commission.
- Is cost-effective, fast (Core Web Vitals), SEO-excellent, and POPIA-compliant.
- Feels enterprise-grade but stays genuinely easy for a non-technical host.

---

## 2. Design philosophy (the non-negotiable principle)

**This is NOT a freeform drag-and-drop website builder (not Elementor / Wix-style).**
It is a **curated section system**:

- **We** design beautiful, pre-built, fully-responsive **sections and elements**.
- The host **drags a ready-made section onto a page** and only adjusts
  **text, images, colors, and a layout *variant*** — never raw layout, never CSS.
- Every section ships with **style variants** and **one-click color schemes** so the
  host customises in taps, and **cannot break the design**. Every site looks good by
  construction.
- Sections and elements are **reusable across pages**.
- The whole experience lives **in the host dashboard**, with the same polished
  side-panel feel as Brand/Theme Studio (which the host loves and is the UX north star).

Why: guarantees on-brand, responsive, professional results with zero design skill —
the foundation of "set up in minutes, easy to use." This principle overrides any
temptation to add freeform layout controls.

---

## 3. Current foundation (what already exists)

**Polished:** Brand Studio, Theme Studio (DB-backed `site_themes` catalogue).

**Raw / mostly not working — needs Phase 0:** Pages Manager, Section Builder
(18 section types), Rooms Manager, Blog Manager + post editor, Domain Manager,
SEO/Settings tabs.

**Data model in place:** `host_websites` (brand/theme/seo/settings + draft vs
`published_snapshot`), `website_pages` (draft/published sections + `seo_overrides`),
`website_properties`, `website_rooms`, `website_blog_posts/categories/authors`,
`website_media`, `website_domain_events`, `website_restore_points`, `site_themes`.

**Public render:** subdomain + custom-domain routing (middleware), `SectionRenderer`
(18 sections), `SiteChrome`, `SiteThemeRoot` (scoped `--site-*` vars), blog
index/detail, `sitemap.xml`, `robots.txt`, `feed.xml`, draft/preview vs frozen
published split, live auto-populate sections (rooms/reviews/specials/gallery/
location/blog).

**Architecture invariants to preserve:** JSONB-first config, draft → frozen
`published_snapshot`, Zod-validated discriminated-union sections, server-side
recalculated prices (never trust client), service-role rendering (no anon reads),
RLS owner + super-admin, soft-delete on protected tables, types regenerated after
every schema change.

---

## 3.1 Existing scaffold — AUDITED (see `WEBSITE_CMS_AUDIT.md`)

A Phase-0 audit (clean `pnpm build` exit 0 + 4 independent code audits) found the host's
*"very raw, mostly not working"* impression is **not supported by the code.** The CMS is
**mature and round-trips to the DB** across pages, sections, blog, rooms, brand, theme,
publish, restore; domain is real (env-gated). No stub managers, no TODO/FIXME.

It *feels* broken because of: (1) empty-state placeholders on a site with nothing
published, (2) **silent save failures + no autosave/unsaved-guard** (lost edits), and
(3) a few dead controls. Phase 0 is therefore a **targeted fix + harden** pass, not a
rebuild — full fix-list in `WEBSITE_CMS_AUDIT.md`. **One security blocker** (stored XSS
in `rich_text`) must be fixed before any deploy.

**Already scaffolded (complete or partial) — do NOT rebuild from zero:**

| Capability | State | Plan impact |
|---|---|---|
| Theme catalogue + 6 presets (`site_themes`) | Built | Keep; Phase 1 builds on it |
| Restore points (`website_restore_points`) | Built | Keep |
| Header/footer **layout variants** (3×3 desktop/mobile, `SiteChrome.tsx`) | Built | Phase 2 = **content/menu only**, not layouts |
| Contact-form → host inbox (`conversations.source='website'`) | Built | Phase 4 = **form builder + management** on top |
| Analytics pipeline (`website_views`, `website_conversions`) | Tables exist | Phase 10 = **dashboard UI** |
| Media library (`website_media_items`) | Table + basic UI | Phase 7 = **reusable picker + alt + optimisation** |
| Blog `scheduled` status + `publish_at` | Columns exist | Phase 7 = **cron worker + RSS/index/related** |
| 18 section types + drag-reorder + live preview | Scaffolded, raw | Phase 0 = make it work; Phase 1 = variants/library |

## 3.2 Branch reconciliation — RESOLVED

> **Base branch: `main`.** The `agent-website` worktree is **stale and fully
> subsumed** — retire it (do not merge).

Audit finding (`git cherry -v main agent-website`): **all 5** worktree commits have
an equivalent already in `main` (0 truly unique). The worktree's theme/brand lane
(brand-studio stage 2 → themes Phase 1/2/2.5/5.5) was re-applied onto `main`, which
then advanced **~20 commits further**: `(editor)` route group, `deal`→`special`
rename + specials booking, theme **stock content**, blog public features, full button
customization, preview banner. The large `main↔worktree` diff is the worktree being
~20 commits **behind**, not real divergence. The earlier "table drift"
(`website_media_items`, `deal` routes) was simply the worktree's *old* state.

**Action:** build on `main`; archive/delete the `agent-website` worktree once the host
confirms nothing local-only remains (worktree status was clean — no uncommitted work).

---

## 4. Locked decisions

| Area | Decision |
|---|---|
| **Builder paradigm** | **Curated pre-built sections + variants + customise text/colors only. NO freeform drag-drop.** |
| Section system | Style **variants** per section, **visual library** w/ thumbnails, **one-click color schemes**, **saved sections** ("my blocks"), **page-template gallery** |
| Editor infra | **Autosave + undo/redo**; **inline text editing on the preview** (still no layout control) |
| Navigation storage | Typed **JSONB** on `host_websites` (`navigation`), folded into publish snapshot |
| Menu scope | **Dropdowns now, mega menu later** (type reserves the `mega` option) |
| Old nav | **Retire** page-derived `nav_order`/`show_in_nav` + add **auto-build menu** button |
| SEO engine | **Custom lightweight analyzer** (~15 rules) in `packages/utils`, framework-agnostic |
| Readability | **Lite / language-neutral** now; full later |
| Structured data | **Auto Schema.org** (LodgingBusiness/Hotel/Room/BlogPosting) from property data |
| Accessibility | **A11y checker** traffic-light (contrast / alt text / heading order), like the SEO coach |
| Form builder | **Full custom field builder** (any field type, drag-drop, multi-form) |
| Spam | **Honeypot + rate-limit** now; optional **Cloudflare Turnstile** toggle per form |
| Newsletter | **Included** (form type + subscribers + CSV); ESP integration later |
| Lead destination | Submissions route into the **host's existing inbox** (website-enquiry as a source) |
| AI generation | **Full draft then review**, per-section regenerate |
| AI language | **English-first**; `translate` assist hook stubbed for multi-language phase |
| AI inline assist | **Rewrite + SEO-suggest** now; blog-generation + translate later |
| Booking widget | **Inline checkout + thank-you on the website** (own domain → pixels fire), with availability/pricing/booking/payment/accounting **proxied to the existing engine** |
| Gift vouchers | **Own dedicated phase (Phase 11)** — touches payments + redemption |
| Images | **Supabase Storage transforms + Next/Image** (in-stack, cost-effective) |
| Rich text | **TipTap** (clean HTML → `body_html`) |
| Consent | **Custom lightweight CMP**, POPIA-tuned, gates marketing pixels |
| Multi-language | **Included in Phase 10** (per-locale content layer) |
| Team & guest | Roles/collaboration + **pre-arrival guest portal** + buy-a-domain → own phases (8, 9) |

---

## 5. Dependencies to add

- **TipTap** — WYSIWYG rich-text editor (blog, rich_text section, long fields).
- **dnd-kit** — drag-drop for section dropping, menu builder, form builder.
- **yet-another-react-lightbox** (or PhotoSwipe) — gallery lightbox.
- **@marsidev/react-turnstile** (optional) — Cloudflare Turnstile spam protection.
- **Anthropic API (Claude)** — AI generation + inline assist (edge functions only; follow `claude-api` skill for model IDs — capable model for generation, fast/cheap model for small rewrites).
- Supabase Storage **image transforms** + **Next/Image**.

> Per `CLAUDE.md`: ask before installing. This is the agreed set; confirm at install time.

---

## 6. Cross-cutting requirements (every phase)

- **Curated-section principle** (section 2) — no freeform layout controls, ever.
- **Mobile-first** responsive on dashboard editors AND public output.
- **Accessibility (WCAG)** — keyboard nav, ARIA, focus management (menus, modals, forms).
- **Draft → publish** — all new config respects the draft/`published_snapshot` split + `website_restore_points`.
- **Feature gating** — wire `check_feature_permission`; pre-MVP open on `free`.
- **Server-authoritative** — all prices/bookings recalculated server-side; mutations via Server Actions / Edge Functions only.
- **Types** — regenerate `packages/types/database.types.ts` after every schema change (`> file` only, never pipe stderr).
- **Save-point discipline** — each save-point: `pnpm build` clean, `pnpm lint` clean, no `console.log`, `CHANGELOG.md` + `CURRENT_TASK.md` updated.

---

## 7. Phases

### Phase 0 — Fix + harden *(audited; NOT a rebuild — see `WEBSITE_CMS_AUDIT.md`)*
*Done:* `agent-website` worktree retired · clean build (exit 0) · full audit complete.
1. 🔴 **B1 — sanitise `rich_text` HTML** on write (`saveDraftSectionsAction` + schema) AND render (`RichTextSection`). Security blocker — before any deploy.
2. 🟠 **M1 — save UX (biggest "feels broken" fix):** inline field validation + field-level error messages + **autosave + unsaved-changes guard**. (Absorbs the planned autosave/undo infra; foundational, reused everywhere.)
3. 🟠 **M2–M4:** add `specials_preview` case to builder `buildPreviewData`; populate location `mapEmbedUrl`; pin Home page to `nav_order` 0 + lock its drag.
4. 🟠 **M5:** fix default-theme fallback (`preset:classic` → a valid default).
5. 🟠 **M6:** regenerate `database.types.ts` (site_themes, restore_points, analytics, media); drop `as unknown as SupabaseClient` casts.
6. ⚙️ **O1/O2:** verify `VERCEL_TOKEN`/`VERCEL_PROJECT_ID` + Vault `blog_publish_url` in the live env (or record as pending) — domains + scheduled-publish are inert without them.
7. Generalise the **responsive device-preview shell** (Brand Studio already has a device toggle — promote it to a shared component for all editors).
8. Minor polish (hero `align`, half-stars, preview-banner sticky) — optional.

**Save-points:** (a) B1 security + M1 save UX, (b) M2–M6 fixes + type regen + ops secrets, (c) shared preview shell + minor polish.

---

### Phase 1 — Curated Section System *(the heart of the product)*
1. **Section variants** — multi-layout variants per section type (e.g. Hero: split / full-bleed / video / slider / minimal); variant stored in section props; all responsive.
2. **One-click color schemes** per section (default / accent / dark / muted) driven by theme vars — no raw color fights.
3. **Visual section library** — gallery with thumbnail previews, categorised (Heroes, About, Rooms, Social proof, CTA, Contact…) + search; matches Brand/Theme Studio look.
4. **Saved sections ("My blocks")** — host saves a customised section as a reusable starting point.
5. **Page-template gallery** — drop in whole pre-composed pages (Home/About/Rooms/Contact/Specials).
6. **Inline preview text editing** — click text in the preview to edit (no layout control).
7. **Section scheduling + device targeting** — show a section only within a date range and/or on mobile/desktop only.
8. **Accommodation section catalog** (new pre-built sections):
   - Amenities/facilities grid (auto from property amenities)
   - Policies & house rules accordion (from property data)
   - Getting here / directions (map + transport + airport distance)
   - Experiences / activities showcase (booking deep-links — supports experience operators)
   - Rooms comparison + seasonal rates table (display-only)
   - Video hero / background, Virtual tour / 360 / Matterport embed
   - Instagram / social feed, Events / "what's on", Upsells / add-ons showcase

**Save-points:** (a) variants + color schemes + library, (b) saved sections + page templates + inline edit, (c) scheduling/targeting + accommodation section catalog.

---

### Phase 2 — Navigation, Header & Footer
1. Schema: add `navigation` JSONB column + Zod; fold `nav` into publish snapshot + restore points; regen types.
2. Server actions: `saveNavigation`, `autoBuildMenuFromPages`.
3. Render: refactor `SiteChrome` to consume `navigation`; mobile drawer w/ nested accordion (a11y).
4. Editor — Navigation tab: header menu tree builder (dnd-kit), top-bar card (phone/WhatsApp/email/hours/message), header CTA card, sticky + transparent-over-hero toggles.
5. Editor — footer widget builder (links / contact / hours / social / newsletter / text / badges + legal links + powered-by toggle).
6. Retire `nav_order`/`show_in_nav`; ship auto-build button.
7. (Reserved) mega-menu panel — type supports `display: "mega"`; build later.

**Save-points:** (a) schema + actions, (b) render + chrome refactor, (c) editor + a11y + retire old nav.

---

### Phase 3 — SEO Excellence (+ accessibility checker)
1. Unify **`SeoMeta`** across site/page/post + Zod; title-template + separator settings.
2. `extractPageText(sections)` + blog HTML→text helper.
3. **Analyzer engine** (`packages/utils`, pure/testable): SEO + lite readability → traffic-light.
4. **SEO panel** UI (reusable on page + blog): focus keyword, live checklist + fix tips, traffic-light, char counters.
5. **A11y checker** (sibling traffic-light): contrast, alt-text presence, heading order.
6. **SERP preview** + **social/OG preview**.
7. **Structured data** emitters: LodgingBusiness/Hotel + Room + reviews + BlogPosting + Breadcrumb + Organization + WebSite (auto; `schemaType` override).
8. Meta wiring (Next Metadata API): title templates, canonical, OG/Twitter, per-page robots; sitemap `lastmod` + per-page index.
9. Site-SEO settings polish (defaults, GSC/Bing verification, sitemap controls).

**Save-points:** (a) engine + extractor + a11y checker, (b) SEO panel + previews, (c) structured data + meta + sitemap.

---

### Phase 4 — Forms & Leads
1. Tables + RLS + types: `website_forms`, `website_form_submissions`, `website_subscribers` (public insert via service-role edge function only).
2. **Form builder** UI: field palette, drag-drop, per-field config + validation, settings, multi-form; default "Quick contact" form per site.
3. Public render + submit: `formId`-bound section, **server-side schema rebuild**, honeypot + optional Turnstile, success/redirect.
4. Submission **edge function**: validate, spam, insert, Resend notify, in-app notify.
5. **Inbox integration**: submissions into the host's existing inbox as "website enquiry" (read/reply/status/notes); CSV export; POPIA export/erase.
6. **Convert-to-booking**: prefilled deep-link into the booking engine.
7. **Newsletter**: form type + subscribers + optional double opt-in + CSV export.

**Save-points:** (a) tables + builder, (b) render + submission + spam, (c) inbox integration + newsletter.

---

### Phase 5 — Minutes-to-Launch (AI Site Generator)
1. `buildSiteBrief()` — structured property data → compact AI brief.
2. **Generation engine** (edge function): Claude structured output where tool schema = `WebsiteSection[]` + `SeoMeta` + `SiteNavigation`; Zod-validate + repair; write to drafts; real photos only (+ alt text).
3. **Onboarding wizard** UI: stepper (basics → vibe→theme → voice/guest → pages → generate), pre-filled.
4. **Review step**: preview draft, accept / per-section regenerate.
5. **Inline assist** (reusable): rewrite-section + SEO-suggest. `translate` hook stubbed.
6. **Guided first-run tour + contextual tips** across the editor.
7. Guardrails: gating, token budget, optional `website_ai_generations` log, draft-only, no fabricated facts.

**Save-points:** (a) brief + engine, (b) wizard + review, (c) inline assist + guided tour + guardrails.

---

### Phase 6 — Conversion & Booking
**6A — Conversion extras**
1. **WhatsApp** floating click-to-chat + top-bar number (pre-filled message).
2. **Announcement bar + pop-ups**: trigger rules (delay/exit-intent/scroll-%) + frequency cap; optional embedded newsletter.
3. **Trust signals** section: grading stars / awards / certifications / payment + secure badges; auto review score.

**6B — Inline booking funnel** *(may become its own phase)*
4. Section types: `booking_search`, `availability_calendar`, `rate_table` — wired to engine's live availability + **server-recalculated** pricing.
5. **On-site checkout funnel**: search → select room → guest details → checkout/payment → **thank-you page**, all on the host's domain.
6. **Deep integration**: availability, pricing, booking record, payment (Paystack/PayPal), accounting all proxied to the existing engine; website hosts UI only.
7. **Conversion events** fire on the thank-you page (consumed by Phase 10 pixels), consent-gated.

**Save-points:** (a) WhatsApp + pop-ups + trust, (b) booking search + availability + rate table, (c) inline checkout + thank-you + engine integration.

---

### Phase 7 — Blog Completion & Media (+ performance score)
1. **TipTap** editor → `body_html` + `rich_text` + long-text fields; sanitised render; image insert from media library.
2. **Tags**: `website_blog_tags` + join + tag archive pages.
3. **Scheduled publishing**: `pg_cron` flips `scheduled` → `published` at `publish_at`.
4. **Image optimisation**: Supabase transforms + responsive Next/Image site-wide.
5. **Lightbox** galleries (swipeable fullscreen).
6. **Media library upgrades**: reusable media-picker modal for every image field; alt-text capture; dimensions; replace-in-place; folders/search.
7. **Performance / Core Web Vitals score** surfaced in dashboard.

**Save-points:** (a) TipTap, (b) tags + scheduled cron, (c) image pipeline + lightbox + media picker + perf score.

---

### Phase 8 — Team & Collaboration
1. **Roles** — invite a marketer/VA with website-only edit access (gated permissions).
2. **Approval workflow** — draft → review → publish.
3. **Site clone / duplicate** — for hosts with multiple properties.
4. **Per-page version history with visual diff** (expose restore points per page).

**Save-points:** (a) roles + permissions, (b) approval workflow, (c) clone + version diff.

---

### Phase 9 — Guest Experience Extensions
1. **Pre-arrival guest portal** — personalised page per booking (wifi, check-in steps, directions, upsells). *Uniquely possible because Vilo owns the booking.*
2. **Buy-a-domain in-app** — purchase a domain through Vilo (not just connect).
3. **QR code generator** — for site/booking, to print in rooms.
4. **Review collection flow** — request → display → respond.
5. **PWA / add-to-home-screen** for the guest site; **multi-currency display**.

**Save-points:** (a) guest portal, (b) buy-a-domain + QR, (c) review collection + PWA + multi-currency.

---

### Phase 10 — Compliance, Tracking & Ops + Multi-language
**Privacy + tracking bundle**
1. **POPIA cookie consent (custom CMP)**: banner (accept/reject/customise) + categories + privacy-policy generator + data-subject export/erase (reuses inbox erase). **Gates marketing scripts.**
2. **Integrations / custom code**: GA4, Meta Pixel, GTM, GSC verification, header/footer script slots — `settings.integrations` JSONB, consent-gated; consumes Phase 6 funnel events.
3. **Analytics dashboard**: views, top pages, referrers, devices, enquiry + booking conversion, top posts, date range; first-party, cookie-free basics.

**Ops**
4. **Redirects manager**: `website_redirects`; 301/302 in middleware; auto-create on slug change.
5. **Reusable global blocks**: `website_blocks` referenced from pages; edit once, updates everywhere (synced — distinct from Phase 1 "saved sections").
6. **Maintenance / coming-soon mode**: branded landing + email capture.

**Multi-language**
7. Per-locale content layer (translated sections/pages/posts), language switcher, `hreflang`; powered by the Phase 5 `translate` assist; leverages `[locale]` routing.

**Save-points:** (a) consent + integrations + analytics, (b) redirects + global blocks + maintenance, (c) multi-language content layer.

---

### Phase 11 — Gift Vouchers & Packages *(later)*
1. Vouchers: tables (voucher / code / balance / redemption); purchase via Paystack/PayPal.
2. Packages: bundled stay + experience offers.
3. Redemption tied to bookings + accounting.
4. Purchase + gifting UX; anti-fraud.

**Save-points:** (a) voucher data + purchase, (b) redemption + booking tie-in, (c) packages + gifting UX.

---

## 8. Build order summary

```
Phase 0   Stabilise core + editor foundations   ← prerequisite, highest priority
Phase 1   Curated Section System                ← the heart of the product
Phase 2   Navigation / Header / Footer
Phase 3   SEO Excellence + a11y checker
Phase 4   Forms & Leads
Phase 5   AI Site Generator + guided tour
Phase 6   Conversion & Booking                  ← 6B (inline funnel) may split out
Phase 7   Blog & Media + performance score
Phase 8   Team & Collaboration
Phase 9   Guest Experience Extensions
Phase 10  Compliance/Tracking/Ops + Multi-language
Phase 11  Gift Vouchers & Packages              ← later
```

## 9. Key dependencies between phases

- **Everything** depends on Phase 0 (pages/sections + autosave must work).
- **Phase 1** is the spine — variants/library/color-schemes define how every later section is built and customised.
- Phase 3 SEO/a11y coach depends on Phase 1 section content + Phase 7 alt text (degrade gracefully early).
- Phase 5 AI writes into Phases 0–4 outputs (sections, nav, SEO) → build after them.
- Phase 6B inline funnel ↔ Phase 10 pixels/consent (checkout exists to fire consented conversion events).
- Phase 4 leads + Phase 10 consent share data export/erase tooling.
- Phase 9 guest portal + Phase 6B funnel both deep-integrate the booking engine.
- Phase 10 multi-language uses the Phase 5 `translate` assist hook.
