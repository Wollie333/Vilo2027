# Website Setup Wizard V2 — Full Plan

> Source brief: `~/Desktop/vilo-website-wizard-spec.md` (founder's vision).
> This plan **reconciles that brief against the real codebase** and defines what to build.
> Status: **PLANNED — not started.** Save point for a later build session.
> Companion (older, already-shipped) plan: `WEBSITE_WIZARD_PLAN.md` documents the
> *current* basics→theme→colors wizard this one evolves from.

---

## 0. The one thing to understand first

**~70% of the spec's proposed "engine" already exists.** The brief describes, as if
new, a "Skin component contract" (`SkinHero`, `SkinNav`, `SkinRoomListing`, …) and a
"data-mapping slot engine" that resolves account data into template slots with fallbacks.

In this codebase that is **already built and in production**:

| Spec concept | Real implementation (reuse — do NOT rebuild) |
|---|---|
| "Skins" / theme registry | `site_themes` table + `apps/web/lib/site/themes.server.ts` (`loadActiveThemes`, `getThemeBundle`, `resolveThemeBase`). 4 live themes: `safari`, `sabela`, `oceansview`, `marmalade`. |
| "Skin component contract" (`SkinHero`…) | The **block/widget registry** `apps/web/lib/website/widgets/registry.ts` + theme-skin CSS (`.wielo-<slug> [data-section-type]`). Blocks are design-agnostic; each theme skins the same block vocabulary. |
| "Data-mapping slot engine" (source→slot + fallbacks) | `assembleSectionData()` in `apps/web/lib/site/loadSitePage.ts` — auto-populate loaders pull live host data per block (`AUTO_POPULATE_SECTIONS`). |
| "Site always builds / missing data → fallback" | Already how loaders + `mergeStandardPages` behave (fallbacks baked in). |
| "6 pre-designed pages" | `site_themes.page_templates` (per-theme designed pages) merged with `mergeStandardPages()` (`apps/web/lib/website/standardPages.ts`) → `website_pages`. |
| "Live-synced post-launch" | Already true — blocks render live data every request (`force-dynamic`). Not a snapshot. |
| Booking flow ("Book now") | **Internal** Vilo engine: `/book` → `SiteCheckoutForm` → `createSiteBooking`/`createSiteSpecialBooking`. Server-side price recalc + anti-tamper. No external `booking_url`. |
| Journal | Existing **blog**: `website_blog_posts` + `/site/blog` routes + loaders. "Journal" = blog. |
| A setup wizard | **Already exists**: `apps/web/app/[locale]/dashboard/website/_wizard/WebsiteWizard.tsx` (steps: basics → theme → colors → building → done), server action `createWebsiteWithWizardAction`, readiness gate `lib/website/readiness.ts`, publish `lib/website/publish.ts`. |

**Consequence:** We are **NOT** building a new slot engine or a new skin contract. We are
**enriching the existing wizard** into the spec's 5-step shape, wiring two genuinely new
steps (Payments & Policies confirm-and-activate; Pages drag-order + nav), and closing a
handful of small data gaps. The render/data-binding layer is reused wholesale.

---

## 1. Real data model — spec field → real source

The brief uses idealized names (`property`, `rooms[]`, `addons[]`). Real mapping:

### Property (`property` → `properties`)
File: `supabase/migrations/20260501000002_create_listings_domain.sql` (renamed `listings`→`properties`).

| Spec slot | Real column | Notes / fallback |
|---|---|---|
| `property.name` | `properties.name` | Required. |
| `property.tagline` | **MISSING** | Fallback: `city` (or store optional tagline in `host_websites.brand.tagline`). |
| `property.description` | `properties.description` | Nullable. |
| `property.hero_image` | **MISSING** as a column | Use `property_photos` where `sort_order=0`, then `gallery[0]`, then theme default. (Loaders already do this.) |
| `property.gallery[]` | `property_photos` (1-many) | `room_id` NULL = property-wide. |
| `property.location` | `city`, `province`, `country` | City primary. |
| `property.address` | `address_line1/2`, `postal_code` | Split fields. |
| `property.coordinates` | `latitude`, `longitude` (+ PostGIS `location`) | Map section renders only if present. |
| `property.currency` | `properties.currency` default `ZAR` | Frontend is ZAR-locked right now (`lib/frontendFlags.ts`). |
| `property.logo_url` | **MISSING** on property | Use `host_websites.brand.logo_path` (collected in wizard) / `hosts.avatar_url`. |
| `property.booking_url` | **N/A** (internal) | "Book now" → internal `/book`. |
| `property.booking_enabled` | `is_published` (+ `is_suspended` admin gate) | — |
| `property.slug` | `properties.slug` UNIQUE | — |

### Rooms (`rooms[]` → `property_rooms`)
File: `supabase/migrations/20260524000000_per_room_bookings.sql`.

| Spec slot | Real column | Notes |
|---|---|---|
| `room.name` | `name` | Required. |
| `room.slug` | **MISSING** | Derive kebab-case from `name` at build/render time (loaders already do). |
| `room.description` | `description` | Nullable. |
| `room.images[]` | `property_photos` where `room_id` set | Skin placeholder if none. |
| `room.rate_from` | `base_price` (per room) | Legacy `properties.base_price` superseded. |
| `room.max_guests` | `max_guests` | — |
| `room.features[]` | `property_amenities` where `room_id` set | Catalog `amenity_key` slugs (icon-mapped). |
| `room.display_order` | `sort_order` | Controls Rooms submenu order (NOT the Step-3 page order). |

Website cosmetic overrides live on `website_rooms` (`display_price`, `display_name`, `is_visible`, `featured`, `badge`, `sort_order`).

### Rates: `property_rooms.base_price`/`weekend_price`/`cleaning_fee` + `property_seasonal_pricing` (date-range overrides). Rate blocks default to live rates (memory: rates-blocks-default-live).

### Specials (`specials[]` → `specials`)
File: `supabase/migrations/20260618002000_specials_foundation.sql`.

| Spec slot | Real column | Notes |
|---|---|---|
| `special.title` | `title` | — |
| `special.description` | `description` | — |
| `special.discount` | `price_mode` (`flat`/`per_night`) + `flat_total`/`per_night_price` | Not a raw % — compute display. |
| `special.valid_until` | `book_by` (+ `window_end`/`fixed_check_out`) | `book_by` = booking deadline. |
| `special.image` | `hero_image_path` (Storage) | — |
| `special.terms` | **MISSING** on special | Linked `policies` row (`cancellation_policy_id`). |
| `special.applicable_rooms` | `room_id` (single, nullable) | NULL = whole property. Not a many-to-many. |
| `active` / site visibility | `status` (`draft/active/paused/expired/archived`) + `show_on_website` + `show_in_directory` | Website surfacing via `specials_preview` block loader. |

### Amenities vs Add-ons — **two distinct systems**
- **Amenities** (boolean features): `property_amenities` → `amenity_catalog` (16 groups, ~95 keys). Host *selects* keys. → spec's "Amenities grid".
- **Add-ons** (priced extras): `addons` (host catalog) + `property_addons` (per property/room availability + price override) + `booking_addons` (snapshot at checkout). → spec's "per-room add-ons panel" + priced extras.
- **Spec ambiguity:** the brief conflates "add-ons" (repurposed as amenity tiles on About) with priced add-ons. **Decision needed** — see G-AMEN below.

### Host (`host` → `hosts` + `user_profiles`)
- `hosts`: `display_name`, `avatar_url`, `bio`, `handle`, `website_url`, `is_verified`.
- `user_profiles`: `full_name`, `email`, `phone`, `avatar_url` (host `email`/`phone` resolve here — not denormalized on `hosts`).

### Site config record (`wizard.*` persistence → `host_websites`)
File: `supabase/migrations/20260617000500_website_foundation.sql`.
- `host_websites` (1 per business — `business_id` UNIQUE): `subdomain`, `custom_domain`, `status` (`draft/published/unpublished`), `brand` JSONB, `theme` JSONB (`theme.preset` = slug), `seo` JSONB, `settings` JSONB (`payments.{paystack,eft}`, `conversion`, `analytics`, `blog`, nav…), `published_snapshot` JSONB.
- Pages: `website_pages` (`kind`, `slug`, `title`, `nav_label`, `nav_order`, `show_in_nav`, `draft_sections`, `published_sections`, `seo_overrides`).
- Nav builder state lives in `settings` (menus, per-page, header/footer/topBar) — see nav-builder-standard.

---

## 2. Wizard step reconciliation (spec 5 vs existing wizard)

Existing wizard order: `basics → theme → colors → building → done`.
Spec order: `Skin → Payments & policies → Pages → Review → Go live`.

**Proposed reconciled order (evolve the existing `_wizard`):**

| # | Step | Origin | Notes |
|---|---|---|---|
| 1 | **Basics & brand** | keep existing `StepBasics` (+ fold `colors`) | Name, subdomain (readiness-required, uniqueness check), logo, contact — prefilled from `properties`/`hosts`/`business`. Palette folded in under the skin card. |
| 2 | **Skin** | rework existing `StepTheme` | Dynamic from `loadActiveThemes()`. Real mini-preview using each theme's palette + font stack (not stock mock). Palette variant selector (reuse `lib/site/palettes.ts` if built, else theme default). |
| 3 | **Payments & policies** | **NEW** | Confirm-and-activate. Reuse existing editors. Per-item "show on site" toggles. Scope warning. |
| 4 | **Pages** | **NEW** | Draggable ordered list → `website_pages.nav_order` + `show_in_nav`. Live nav preview. Rooms auto-submenu. |
| 5 | **Review** | **NEW** | Summary cards + build checklist. Single CTA "Build my site". |
| 6 | **Go live** | keep existing `StepBuilding` + `StepDone` | Run action, then success + View live / Open builder + optional next steps. |

> Spec collapses "Basics" because it assumes account data exists — but **subdomain is
> website-specific and readiness-required**, so a light Basics step stays (prefilled).
> **Decision D1 (below):** keep 6 steps (Basics separate) vs fold Basics into Review.
> Recommendation: keep Basics as step 1, prefilled — lowest friction, satisfies readiness.

State: extend the existing in-memory `WizardState` (add `payments`, `policies`,
`pages[]`). Reuse `FormModal` (`components/ui/form-modal.tsx`), Zod schemas in
`dashboard/website/schemas.ts`, and the single-action-at-the-end pattern.

---

## 3. Step-by-step design

### Step 1 — Basics & brand
- **Reuse** `StepBasics` (name, subdomain w/ `.vilo.site` suffix + uniqueness, logo upload, contact).
- Prefill: `siteName`←`business.trading_name`/`properties.name`; `contactEmail/Phone`←`user_profiles`; `logoPath`←`hosts.avatar_url`.
- Palette: fold the existing `StepColors` palette cards under here or into Step 2.

### Step 2 — Skin
- Grid from `loadActiveThemes()` (all `is_active`). **No hardcoded list** — satisfies the spec's "dynamic from registry" requirement automatically (new themes appear with zero code change).
- Each card: real mini-preview built from the theme's `base.palette` + `font` stack (hero band + nav + a room card rendered in the theme's own tokens). Reuse `resolveThemeBase(slug)`.
- Note copy: *"You can switch skins or customise further in the page builder any time after launch."*
- Updates the sidebar "Site build" status panel live.

### Step 3 — Payments & policies (NEW — the biggest new surface)
**Principle:** confirm-and-activate, not setup. Everything prefilled from canonical records.
Edits here write the **canonical** records → apply app-wide. **Show the scope warning prominently.**

**Payment methods** — real supported set is **Paystack, PayPal, EFT** (NO PayFast, NO cash-on-arrival in code).
- Source rows: `host_payment_gateways` (paystack/paypal creds, per business) + `eft_banking_details` (bank name, holder, account, branch, `reference_format`).
- Per method: icon, name, description, **status badge** (`Active` if configured / `Review` if missing required config — derive from `is_enabled` + creds present), **Edit** button, scope chip "Website + app".
- Edit modals: **reuse `BankAccountList`** (the component used by `settings/banking` AND `setup/StepBanking` — single source of truth). Do NOT fork a second payment editor.
- **"Show on site" toggle** per method → `host_websites.settings.payments.{paystack,eft}` (already exists; extend to paypal). This is per-website (correct for multi-site later).
- "Add payment method" → opens the same banking editor.

**Policies** — real model: `policies` (`type`: `cancellation`/`check_in_out`/`house_rules`/`booking_terms`; check-in/out times; pets/smoking/parties flags) + `policy_cancellation_rules` + `policy_content` + `property_policies` (assignment) + `policy_snapshots` (immutable).
- Per policy: icon, name, current summary, **Edit** (reuse `PolicyEditorSheet` from `dashboard/policies`), **show-on-website toggle**.
- Missing/unconfigured → amber "Add" rows.
- Edit modals reuse the existing policy editor. Do NOT rebuild policy forms.

**GAPS in this step (see §5):** per-policy "show on site" flag doesn't exist (G-POLVIS);
Privacy policy generator (POPIA/GDPR) doesn't exist (G-PRIVACY); PayFast + cash-on-arrival
in spec aren't supported (G-PAYSET).

### Step 4 — Pages (NEW)
- Draggable ordered list (not a grid). Order = top-level nav order → writes `website_pages.nav_order`; toggle → `show_in_nav` (and effectively include/exclude).
- Rows: drag handle · page icon+name+data-source chips · order badge + include toggle.
- Only active rows draggable; drop-indicator line; order numbers re-sequence on drop.
- **Live nav preview** at bottom (active in order, inactive struck-through).
- **Rooms auto-submenu**: generated from `property_rooms` sorted by `sort_order`, label=`name`, href=`/rooms/{derived-slug}`. Renders only if Rooms is on and ≥1 room. This is the existing nav-builder behaviour (`website_navigation` in settings) — wire, don't invent.
- Page set = **exactly the guide's 6** (D2 LOCKED): Home, About, Rooms, Specials, **Journal = blog**, Contact. **No Experiences/Gallery** or other standard pages in the wizard — hosts add extras manually in the builder later. The Step-4 list shows only these 6.
- Data-source chips per page pulled from what the loaders will fill (Home: name/specials/rooms; About: host/add-ons/policies; Rooms: rooms/rates/add-ons; Specials: live specials; Journal: empty at launch; Contact: host contact + booking form).
- Persist to `website_pages` on step completion (nav_order + show_in_nav); feeds nav binding.

### Step 5 — Review
- Summary cards: skin, page count + names, payment methods count, policies-active count.
- Build checklist: full site w/ skin, each page's auto-filled content, global nav/header/footer, booking flow connected to payment methods.
- Single CTA **Build my site** → runs the create/seed/publish action.

### Step 6 — Go live
- Reuse `StepBuilding` (runs action; animated) → `StepDone`.
- Success with property name + skin. Two actions: **View live site** / **Open page builder** (`/dashboard/website/{id}/pages`).
- Optional next steps (none required): connect domain, add/reorder photos, first journal post, customise in builder.
- Gate on `checkWebsiteReadiness()` — if not ready, `StepDone` shows the readiness checklist with fix hrefs (existing behaviour).

---

## 4. Build/seed engine (reuse map — NOT a new engine)

The wizard's "Build my site" does what `createWebsiteWithWizardAction` already does, plus the new step data:
1. Create/update `host_websites` (brand, theme, `settings.payments`, `settings.policies`).
2. Seed pages: `getThemeBundle(themeId).page_templates` → `mergeStandardPages(templates, siteName)` → **restrict the result to the 6 guide kinds** (home, about, rooms, specials, blog/journal, contact) + required system pages (checkout, thank-you, search) — drop any Experiences/Gallery/extra kinds (D2 LOCKED) → insert `website_pages` (`draft_sections`). Apply Step-4 `nav_order`/`show_in_nav`.
3. Sync `website_properties` + `website_rooms` (visibility/order).
4. Apply per-site payment/policy visibility toggles.
5. Publish: `publishWebsiteAction()` (copy draft→published, freeze `published_snapshot`) — **gated by `checkWebsiteReadiness()`**.

**Spec "Skin component contract" → real blocks** (the wizard passes NO hand-rolled slot data; blocks self-hydrate via loaders):

| Spec Skin component | Real block type(s) | Live loader |
|---|---|---|
| `SkinHero` | `hero` | static/props (hero image via property_photos) |
| `SkinNav` / `SkinNavRoomsSubmenu` | nav builder (`el_nav` + `website_navigation`) | rooms submenu ← `property_rooms` |
| `SkinFooter` | footer nav/chrome | contact ← hosts/user_profiles; policy links ← visible policies |
| `SkinSpecialsBanner` / `SkinSpecialsListing` | `specials_preview` | `loadSpecialsData` (`specials` where show_on_website) |
| `SkinRoomHighlights` / `SkinRoomListing` / `SkinRoomCard` | `rooms_preview` / room detail blocks | `loadRoomsData` (`property_rooms`/`website_rooms`) |
| `SkinAboutHost` | `profile` / `host_bio` | `loadHostProfile` (`hosts`) |
| `SkinPropertyDescription` | `intro` / `rich_text` + `gallery` | `loadRoomsGallery` |
| `SkinAmenitiesGrid` | `amenities` | `loadAmenitiesData` (`property_amenities`) |
| `SkinPoliciesAccordion` | `policies` | visible `policies` |
| `SkinContactDetails` / `SkinEnquiryForm` | `contact_form` / `form` + `location` | host contact + `properties.coordinates` |
| `SkinPaymentBadges` | payment badges (in checkout/contact) | `settings.payments` visible methods |
| `SkinJournalListing` / `SkinPostCard` / empty state | `blog_preview` + `/site/blog` | `loadSiteBlogIndex` |
| Booking ("Book now") | `booking_form` (checkout) + `booking_confirmation` | internal `/book` (`SiteCheckoutForm`, server recalc) |

Conditional-render rules from the spec (§ "Conditional rendering") are **already** how
auto-populate blocks behave (empty data → section hidden or empty-state). No new engine.

---

## 5. Gaps & decisions — **LOCKED (founder-confirmed 2026-07-06)**

| ID | Gap | Decision (LOCKED) |
|---|---|---|
| **D1** | Keep Basics as its own step vs fold into Review. | **Keep** step 1 Basics (prefilled) — subdomain is readiness-required; lowest friction. |
| **D2** | Standard set has Experiences + Gallery beyond the spec's 6. | ✅ **LOCKED: build ONLY the guide's 6 pages** (Home, About, Rooms, Specials, Journal, Contact) + required system pages (checkout/thank-you/search). **Do NOT auto-add Experiences/Gallery or any other standard page.** Hosts can add extra pages manually in the builder later. → the seed step must **restrict** `mergeStandardPages` output to the 6 kinds (see §4). |
| **G-PAYSET** | Spec lists **PayFast** + **Cash on arrival**; code supports only Paystack/PayPal/EFT. | ✅ **LOCKED: only Paystack / PayPal / EFT.** Drop PayFast and cash-on-arrival entirely from the wizard — not offered, not stubbed. |
| **G-POLVIS** | No per-policy "show on website" flag exists (all assigned policies always show). | ✅ **LOCKED: add the flag.** New `host_websites.settings.policies` (per-site list of visible policy types/ids). Wizard toggles write there; the `policies` block loader filters by it. |
| **G-PRIVACY** | No per-host privacy policy / POPIA-GDPR generator. | ✅ **LOCKED: defer.** No generator in this wizard. MVP allows a `booking_terms`/custom policy only. POPIA privacy generator = separate follow-up feature (out of scope here). |
| **G-AMEN** | Spec conflates priced add-ons with amenity tiles on About. | About "Amenities grid" ← **`property_amenities`** (boolean features, icon-mapped). Priced **add-ons** (`property_addons`) surface on Rooms per-room panel + checkout. Keep the two systems separate. |
| **G-TAGLINE** | `properties.tagline` missing (hero subheading). | Fallback to `city`; optionally capture an optional tagline in Basics → `host_websites.brand.tagline`. No property migration. |
| **G-MULTISITE** | `host_websites.business_id` is UNIQUE → one site per business today. | Keep one-site assumption; wizard edits/creates the single site. Multi-site = future (drop UNIQUE + site picker). Spec open-Q #8 resolved: single-site for now. |
| **G-SLUG** | `property_rooms` has no slug column. | Derive kebab-case slug from `name` at render (loaders already do). No migration. |

**Spec open-questions resolved against the codebase:**
1. Images = **Storage paths** (`property_photos`, `hero_image_path`, `avatar_url`) resolved to public URLs by loaders. Fallback chains already implemented.
2. `room.features[]` = **catalog `amenity_key` slugs** (fixed enum via `amenity_catalog`), icon-mapped by curated `LUCIDE_ICONS`.
3. Booking = **internal** Vilo engine (`/book`), not external URL. Every CTA routes internally.
4. `special.applicable_rooms` = **single nullable `room_id`** (not m2m). Chip render = 0/1 room.
5. Policy body = **`policy_content.body_html`** (Tiptap HTML) — render sanitized HTML, not markdown.
6. Journal = **existing blog** (`website_blog_posts`).
7. Wizard persistence = extend in-memory `WizardState`; final write to **`host_websites`** + `website_pages` (+ `settings` for toggles). No separate site-config table.
8. Multi-site = **no** (one `host_websites` per business today).

---

## 6. Schema changes (minimal — MVP policy allows destructive)

- **No new tables required.** Reuse `host_websites`, `website_pages`, `policies`, `host_payment_gateways`, `eft_banking_details`, `specials`, `property_*`.
- **JSONB additions (no migration needed, or a light one):**
  - `host_websites.settings.policies` → per-site policy visibility (G-POLVIS).
  - `host_websites.settings.payments.paypal` → extend existing `{paystack,eft}` (G-PAYSET).
  - `host_websites.brand.tagline` → optional (G-TAGLINE).
- **Follow-up (separate feature):** privacy-policy template + `policies.type='privacy'` (G-PRIVACY).
- After any schema change: regenerate types (`supabase gen types typescript --linked > packages/types/database.types.ts`) and remember: **never pipe stderr into the types file**.

---

## 7. Build phases (each ends green: tsc + lint + vitest; verify canvas AND live)

> Founder rule (Principle #9): never "done" until seen working in BOTH the builder/wizard
> UI AND the live published render. Commit + push origin main after each green phase.

1. **P1 — Scaffolding & step reorder.** Extend `WizardState` + step order to the 6-step shape; wire step nav in `WebsiteWizard.tsx`; keep existing Basics/Theme/Building/Done working. (No behaviour change to create action yet.)
2. **P2 — Skin step polish.** Real per-theme mini-previews from `resolveThemeBase`; dynamic list from `loadActiveThemes`; palette variant selector.
3. **P3 — Payments & policies step.** Confirm-and-activate UI; reuse `BankAccountList` + `PolicyEditorSheet` in `FormModal`; status badges; scope warning; per-site visibility toggles (settings.payments + new settings.policies). Add `settings.policies` filter to the `policies` block loader.
4. **P4 — Pages step.** Draggable list + toggles + live nav preview + rooms auto-submenu; persist `nav_order`/`show_in_nav`; Experiences/Gallery toggles (D2).
5. **P5 — Review step.** Summary cards + build checklist + "Build my site".
6. **P6 — Build/seed action wiring.** Extend `createWebsiteWithWizardAction` to consume Step 3/4 data (payment/policy visibility, page order); publish gated by readiness; Go-live success actions.
7. **P7 — Verify end-to-end.** Run wizard on the `vilotest` host; confirm live site reflects skin, page order, visible payments/policies, rooms submenu, specials, blog empty state, internal booking. Screenshot/DOM evidence for both wizard UI and live render.
8. **(Follow-up, separate)** Privacy-policy generator (G-PRIVACY); PayFast/cash if founder wants them (new integrations).

Dev harnesses: `/en/builder?theme=<slug>&nav=links` (no-auth builder demo); `vilotest` host (`host@vilotest.com`) for live verification.

---

## 8. Out of scope / deferred
- PayFast + cash-on-arrival payment methods (not in code; would be new integrations).
- POPIA/GDPR privacy-policy generator (separate follow-up feature).
- Multi-site per business (schema currently one site per business).
- Threading fine-grained `--el-*` into every new sub-part (ongoing Builder V3 work, separate).

---

## 9. Key files (reuse index)

| Concern | File |
|---|---|
| Existing wizard | `apps/web/app/[locale]/dashboard/website/_wizard/WebsiteWizard.tsx` (+ `steps/`, `wizardState.ts`, `loadWizardContext.ts`) |
| Create action | `apps/web/app/[locale]/dashboard/website/actions.ts` (`createWebsiteWithWizardAction`) |
| Wizard schemas | `apps/web/app/[locale]/dashboard/website/schemas.ts` |
| Themes registry | `apps/web/lib/site/themes.server.ts`, `apps/web/lib/site/themes.ts` |
| Standard pages / merge | `apps/web/lib/website/standardPages.ts` |
| Blueprints (flat→PageDoc) | `apps/web/lib/website/blueprints.ts` |
| Block registry | `apps/web/lib/website/widgets/registry.ts` |
| Live-data loaders | `apps/web/lib/site/loadSitePage.ts` (`assembleSectionData`) |
| Readiness gate | `apps/web/lib/website/readiness.ts` |
| Publish | `apps/web/lib/website/publish.ts` |
| Payments editor (reuse) | `settings/banking/page.tsx` → `BankAccountList`; `setup/steps/StepBanking.tsx` |
| Policies editor (reuse) | `dashboard/policies/` → `PolicyLibrary.tsx`, `PolicyEditorSheet.tsx` |
| Modal pattern | `apps/web/components/ui/form-modal.tsx` |
| Sidebar / entry | `apps/web/app/[locale]/dashboard/_components/Sidebar.tsx` (Website tab → `/dashboard/website`) |
| Blog (Journal) | `website_blog_posts`; `apps/web/app/[locale]/site/blog/*`; loaders in `loadSitePage.ts` |
