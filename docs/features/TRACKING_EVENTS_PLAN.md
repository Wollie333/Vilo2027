# Tracking, Pixels & Events — Redesign Plan

Status: **APPROVED 2026-07-02 — implementing.** Founder signed off: support GA4, Meta Pixel, **GTM,
TikTok, Google Ads**; custom code is **consent-gated** like the pixels.
Follows the Builder V2 phase/save-point discipline ([[feedback-phase-savepoint]]). Extends Phase 5-5
(single `meta.pixelEvent` → `meta.events`).

---

## 1. The goal (founder's words, distilled)

Give hosts ONE logical, decluttered place to control analytics — split into two scopes:

- **Site-wide (universal):** the pixel/analytics **IDs** (GA4, Meta Pixel, …) + cookie-consent are
  saved ONCE and apply to **every page**. Editing them anywhere changes them everywhere.
- **Per-page:** which **built-in events** fire on THIS page (a list with an enable toggle each), plus
  **custom code** for pasting custom event snippets.

All of it lives in the **Page Settings modal** (founder pref, 2026-07-02): the existing
`Tracking & pixels` tab holds the **site-wide IDs**, and a **new `Events` tab** — positioned **below
`Tracking & pixels` and above `Custom code`** — holds the per-page built-in event toggles.

**Purchase** is special: it auto-fires on booking confirmation with the real value + currency
(founder choice 2026-07-02) — it is NOT a blind per-page toggle.

---

## 2. Current state (verified 2026-07-02)

| Piece | Storage | Written by | Read/injected by | Status |
|-------|---------|-----------|------------------|--------|
| Site-wide analytics (`ga4`, `metaPixel`, `cookieConsent`) | `host_websites.settings.analytics` (`SiteAnalyticsSettings`, `lib/site/types.ts:258`) | dashboard `…/settings/SettingsForm.tsx` → `saveWebsiteSettingsAction` (`websiteSettingsSchema`) | `components/site/SiteMarketing.tsx` (GA4 + Meta only), rendered in `SiteChrome.tsx:1392`, consent-gated | **ACTIVE** |
| Per-page pixel IDs (`ga4/gtm/metaPixel/tiktok/gads`) in `doc.meta` | PageDoc `meta` | `builder/PageSettingsOverlay.tsx` (PIXELS array) | **nothing** | **DEAD — remove** |
| Per-page event (`pixelEvent`, single) + `headCode` | `doc.meta` (v2) / `seo_overrides` (flat) | overlay / PageSeoCard | `SitePageView.tsx:105-119` → `FirePixelEvent` + `PageHeadCode` | ACTIVE (Ph 5-5) |
| Per-page `bodyCode` | `doc.meta` | overlay Custom-code tab | **nothing** | **DEAD — wire it** |
| Purchase event (dynamic value+currency) | runtime | `site/book/thank-you/page.tsx:161` (isConfirmed && total) | `FirePurchase` → `lib/analytics/purchase.ts` (GA4 + Meta, deduped per txn) | ACTIVE |
| Cookie consent | `localStorage["wielo-cookie-consent"]` | `SiteMarketing.tsx` banner | `SiteMarketing.tsx` gating | ACTIVE |

**Key facts driving the design:**
1. **Only GA4 + Meta Pixel are actually injected** (`SiteMarketing.tsx`). GTM / TikTok / Google Ads are
   NOT injected anywhere — so today the overlay offers 5 pixel IDs but only 2 do anything.
2. **Per-page pixel IDs are dead** — pixels are inherently site-wide. Confirmed no read path.
3. `FirePixelEvent` fires BOTH GA4 (`dataLayer` push `vilo_<event>`) AND Meta (`fbq('track', …)`).
4. `bodyCode` is written by the overlay but injected nowhere (only `headCode` is, via `PageHeadCode`).
5. Site-wide analytics is frozen into the publish snapshot (`snap.analytics`); the public site reads
   snapshot-first, so site-wide edits surface **on republish** (preview reads live).

---

## 3. Target model

### 3.1 Two scopes, both in the Page Settings modal
```
Page Settings modal tabs:
  SEO · Social share · Tracking & pixels · Events (NEW) · Custom code
                        └─ SITE-WIDE ─┘   └── per-page ──┘  └ per-page ┘
```

- **Tracking & pixels (site-wide):** GA4, Meta Pixel, **GTM, TikTok, Google Ads** IDs + cookie-consent.
  Writes `host_websites.settings.analytics` — the SAME record on every page, so it "reflects across all
  pages" (open the modal on any page → same values). Clearly labelled *"Applies to every page on this
  site."* The dead per-page pixel-ID fields are **removed** from `doc.meta`. GA4 + Meta ship in Phase 1
  (already injected); GTM/TikTok/Google Ads land in Phase 4 with their injection wiring (no field ships
  before its injection path exists).
- **Events (per-page, NEW tab):** a curated list of built-in Meta/GA events, each with an **enable
  toggle**, stored in `doc.meta.events: string[]`. Firing on page load reuses `FirePixelEvent`.
  **Purchase** appears as an always-on **auto** row ("Fires automatically on booking confirmation with
  the order value & currency") — informational, not a toggle.
- **Custom code (per-page):** `headCode` + `bodyCode` for pasted custom-event snippets — BOTH injected
  on the live page (wire `bodyCode`, currently dead).

### 3.2 Data shapes
- **Site-wide** — extend the existing `SiteAnalyticsSettings` only when we wire a new pixel
  (Phase 4). No new column: it already lives in `settings.analytics`.
- **Per-page** — on `PageDoc.meta` (already a loose record):
  - `events: string[]` — enabled built-in events (e.g. `["Lead","Subscribe"]`). **Replaces** the single
    `pixelEvent` from Phase 5-5 (pre-MVP clean break — drop `pixelEvent`).
  - `headCode`, `bodyCode` — unchanged keys, both now consumed.
  - **Removed** from `meta`: `ga4`, `gtm`, `metaPixel`, `tiktok`, `gads`, `consent` (all move to
    site-wide or were dead).

### 3.3 Built-in events catalogue (curated)
Page-load events (toggle → `FirePixelEvent`): `ViewContent`, `Lead`, `Contact`, `Subscribe`, `Search`,
`InitiateCheckout`, `CompleteRegistration`. (Superset of today's `PAGE_PIXEL_EVENTS`, minus `none`.)
Each row carries a one-line "use this when…" hint so hosts pick logically.
Transaction event (auto, not a toggle): `Purchase` — wired on booking confirmation (existing).

### 3.4 Persistence (the important architectural split)
The Page Settings modal now writes to **two stores**:
- **`onPatch` (existing)** → PageDoc `meta` (SEO/social/events/custom-code) → doc autosave
  (`saveBuilderDocAction`), undoable with the doc.
- **`onAnalyticsPatch` (NEW)** → site-wide `settings.analytics` → a thin owner-checked
  `saveBuilderAnalyticsAction` (debounced), NOT part of the doc. `BuilderShell` holds a working
  `analytics` state (mirrors how it holds `workTheme`/`brand`/`navigation`).

### 3.5 Public render firing (`SitePageView`)
- Site-wide pixels: unchanged (`SiteMarketing`).
- Per-page events: iterate `doc.meta.events` → one `<FirePixelEvent event={e}/>` each (live only).
  Fallback: legacy flat pages keep the single `seo_overrides.pixelEvent`.
- `headCode` → `PageHeadCode` (exists); `bodyCode` → new `PageBodyCode` (before `</body>`).
- Purchase: unchanged (booking thank-you).

---

## 4. Phased build order (save-point per phase)

Each phase ends green (`pnpm build` + lint + vitest) + live-verified on the builder / `builder-preview`,
with a commit + CURRENT_TASK anchor + memory + CHANGELOG.

- **Phase 1 — Site-wide Tracking tab.**
  Builder `page.tsx` loads `settings.analytics`; `BuilderShell` holds working `analytics` + a debounced
  `saveBuilderAnalyticsAction` (owner-checked, writes `settings.analytics`). `PageSettingsOverlay`
  Tracking tab binds GA4 + Meta Pixel + consent via `onAnalyticsPatch` with an "applies to all pages"
  note; **delete the dead per-page pixel-ID fields** from `meta`. Verify: edit on page A's modal →
  reopen on page B → same values.

- **Phase 2 — Per-page Events tab.**
  New `Events` tab between Tracking & Custom code. Curated event list (§3.3) with enable toggles →
  `meta.events`. `SitePageView` fires each enabled event (replaces the single `pixelEvent`; migrate
  5-5). Purchase shown as an auto row. Verify: toggling patches `meta.events`; render fires each
  (unification of proven `FirePixelEvent`).

- **Phase 3 — Custom events (bodyCode) + head/body injection parity.**
  Add `PageBodyCode` (inject `bodyCode` before `</body>`, live only); confirm `headCode` + `bodyCode`
  both inject on the v2 path. Verify a pasted snippet appears/executes on the live page.

- **Phase 4 — extra pixels: GTM + TikTok + Google Ads.**
  Extend `SiteAnalyticsSettings` (`gtm`, `tiktok`, `googleAds`) + `SiteMarketing` injection for all three
  (consent-gated), then add their IDs to the site-wide Tracking tab. No field ships without a real
  injection path. GTM: `googletagmanager.com/gtm.js` + `dataLayer`; TikTok: `analytics.tiktok.com` +
  `ttq`; Google Ads: `gtag('config', 'AW-…')`.

- **Phase 5 — dashboard settings parity.**
  The dashboard `SettingsForm.tsx` + `websiteSettingsSchema` + `saveWebsiteSettingsAction` and the
  builder Tracking tab edit the SAME `settings.analytics`; reconcile fields so both editors surface the
  full pixel set (GA4 · Meta · GTM · TikTok · Google Ads) + consent.

---

## 5. Non-negotiables
- Pixels stay site-wide (one source of truth = `settings.analytics`); no per-page pixel IDs.
- No dead UI — a field ships only when its inject/fire path is wired.
- Live site only: events + custom code never fire in preview.
- **Custom head/body code is consent-gated** like the pixels (POPIA) — injected only after the visitor
  accepts cookies (founder decision 2026-07-02).
- Purchase value/currency are server-truth (booking record) — never host-typed.
- Pre-MVP clean break: drop `meta.pixelEvent` for `meta.events`; no back-compat shim.

## 6. Decisions — RESOLVED (2026-07-02)
1. **Pixel set:** GA4 · Meta Pixel · GTM · TikTok · Google Ads (all five). GA4 + Meta in Phase 1;
   GTM/TikTok/Google Ads in Phase 4 with injection.
2. **Custom-code consent gating:** YES — gate pasted head/body snippets behind cookie-consent like the
   pixels.

_No open decisions remain. Implementing from Phase 1._
