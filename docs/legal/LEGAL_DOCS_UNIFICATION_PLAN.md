# Legal Docs — Unification & Placement Plan

> **Status: PLAN for review. No code/DB changes yet** (the checkout/consent path
> is involved, so we agreed to sanity-check the approach first). Chosen model:
> **one store (`legal_documents`) + a binding table (`legal_placements`)**.
> `[COUNSEL / FOUNDER: …]` marks a decision to confirm.

## 1. The goal

One place — **Admin → Legal Docs** — where the lawyer can:

- create, edit, publish, and version **every** legal document;
- **assign** a document to the app "slot" it fills (Terms at checkout, Privacy,
  Cookies, Affiliate program terms, a specific competition's rules);
- add **new** documents and assign them without a developer or a deploy.

Publishing a document updates it **everywhere it is used**, because every
consumer reads from the same store through the same binding layer.

## 2. Current state — why it's fragmented

Platform legal docs live in **three** systems today. Only `legal_documents` is
the model we want; the others are legacy.

| Document(s) | Stored in | Edited at | Consent record |
|---|---|---|---|
| Terms, Privacy | `platform_settings` (`legal_booking_terms`, `legal_privacy`) | Admin → Platform settings → Legal (`legal/page.tsx`, `LegalDocsForm.tsx`) | `bookings.accepted_terms_version`, `bookings.accepted_privacy_version` (int) |
| Affiliate Program Terms | `affiliate_settings.terms_content` (+ `terms_version` text) | Admin → Affiliates → Terms | affiliate agreement signature (`terms_accepted_at`, `terms_version`) |
| Cookies | **static code only** (`cookies/page.tsx`) | nowhere — needs a deploy | none |
| Founding Host, Review, Looking-For, Founding Race | **`legal_documents`** | Admin → Platform settings → Legal documents (`LegalDocumentsManager.tsx`) | — |
| Per-campaign competition rules | **`legal_documents`** + `affiliate_campaigns.rules_doc_slug` | Campaign builder → Rules (`CampaignRulesEditor.tsx`) | `affiliate_campaign_rule_acceptances` (`doc_slug`, `doc_version`, `body_snapshot`, `body_sha256`) ✅ |

**Key insight:** the campaign flow already does exactly what we want — it *binds*
a campaign to a `legal_documents` row and records acceptance against
`doc_slug + doc_version + body snapshot + hash`. We generalise that pattern to
everything.

## 3. Target architecture

### 3.1 The store (no schema change)

`legal_documents` stays as-is and becomes the **only** store:
`slug, title, body_html, version, is_published, published_at, updated_by, timestamps`.
Version bumps only on a real body change (already implemented) — which is what a
consent record keys on.

### 3.2 The binding layer (NEW — `legal_placements`)

A tiny table mapping a **well-known slot** to the doc that fills it:

```sql
CREATE TABLE public.legal_placements (
  slot        text PRIMARY KEY,                      -- e.g. 'terms', 'privacy', 'cookies', 'affiliate_program_terms'
  doc_slug    text REFERENCES public.legal_documents(slug) ON DELETE SET NULL,
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- RLS: public may read (to resolve a slot → doc); writes are service_role only (admin).
```

- **Slots are a fixed catalog** (below). Adding a brand-new *kind* of slot is the
  only thing that still needs a one-line code hook; assigning/reassigning docs to
  existing slots is fully self-service.
- **Competitions/campaigns keep their own binding** (`rules_doc_slug`) — same
  idea, already dynamic — so a competition can point at any legal doc.

**Initial slot catalog:**

| Slot | Filled by (seed) | Consumed at |
|---|---|---|
| `terms` | `terms` | `/terms`, checkout (stamps version) |
| `privacy` | `privacy` | `/privacy`, checkout (stamps version) |
| `cookies` | `cookies` | `/cookies`, cookie banner, footer |
| `affiliate_program_terms` | `affiliate-program-terms` | affiliate gate, partner signup (stamps version) |

`[FOUNDER: confirm this is the full set of "fixed" slots for launch. Everything
else is a free /legal/<slug> page or a per-competition binding.]`

### 3.3 The resolver (NEW — one function)

`getPlacedDocument(slot)` → look up `legal_placements.slot` → load the published
`legal_documents` row → return `{ slug, title, bodyHtml, version, updatedAt }`.
Falls back to the in-code static draft (Terms/Privacy/Cookies keep theirs) if the
slot is unset or the doc is unpublished, so a page is **never blank**.

## 4. The sharp edge — consent/version stamping

Three surfaces record which version a user accepted. All must stamp the
**`legal_documents.version`** of the *placed* doc. Pre-MVP = no real data, so this
is a clean re-point with **no backfill**.

| Surface | Today | After |
|---|---|---|
| **Booking** (`lib/bookings/createBooking.ts`, `lib/website/siteCheckout.ts`) | stamps `platform_settings` terms/privacy version | resolve `terms` + `privacy` placements, stamp their `legal_documents.version` into `accepted_terms_version` / `accepted_privacy_version` (both already `int`, matches `legal_documents.version`) |
| **Affiliate accept** (`portal/affiliates/actions.ts`, `signup/partner/actions.ts`) | `affiliate_settings.terms_version` (text) + agreement signature | resolve `affiliate_program_terms` placement; record acceptance as `doc_slug + doc_version + body_snapshot + body_sha256` (adopt the campaign-rule-acceptance shape) |
| **Competition entry** (`signup/partner/actions.ts`) | already `doc_slug + doc_version + snapshot + hash` ✅ | unchanged — this is the template |

The affiliate "snapshot exactly what was shown" behaviour (`renderAgreementBody`
in `lib/affiliate/agreement.shared.ts`) is preserved — we just source the body
from the placed `legal_documents` row instead of `terms_content`.

## 5. Migration steps (SQL, in order)

Pre-MVP policy applies (destructive reshapes are fine; no dual-write). Regenerate
`docs/SCHEMA.md` and `database.types.ts` after.

1. **`legal_placements`** table + RLS + `updated_at` touch trigger.
2. **Seed `legal_documents`** rows for `terms`, `privacy`, `cookies`,
   `affiliate-program-terms` from `docs/legal/*.md` (published).
3. **Seed `legal_placements`** with the four slots → their docs.
4. **Affiliate acceptance**: add `doc_slug` + `doc_version` to the affiliate
   agreement signature table (align to `affiliate_campaign_rule_acceptances`);
   drop reliance on `affiliate_settings.terms_content` / `terms_version`.
5. **Retire legacy** (after code is rewired): stop reading
   `platform_settings.legal_*` and `affiliate_settings.terms_content`. Keep the
   columns only if something else needs them (audit first).

## 6. Rewire steps (code, file-by-file)

**Resolver + reads**
- `lib/legal.ts` → replace `getLegalDocument('booking_terms'|'privacy')` with the
  placements resolver; keep the return shape so callers barely change.
- `lib/legalDocuments.ts` → keep; add `getPlacedDocument(slot)` and
  `listPlacements()`.
- `app/[locale]/terms/page.tsx`, `privacy/page.tsx`, `cookies/page.tsx` → read via
  the resolver (Terms/Privacy already read a doc; Cookies switches from static to
  resolver with static fallback).

**Consent stamping**
- `lib/bookings/createBooking.ts`, `lib/website/siteCheckout.ts` → stamp placed
  doc versions.
- `app/[locale]/portal/affiliates/actions.ts`, `signup/partner/actions.ts`,
  `components/affiliate/AffiliateShell.tsx`, `PartnerSignupScreen.tsx` → source
  affiliate terms from the placed doc; record acceptance with doc_slug/version.

**Admin**
- New unified screen (see §7). Fold in `legal/page.tsx` + `LegalDocsForm.tsx`
  (old Terms/Privacy editor) and `admin/affiliates/terms/page.tsx` (affiliate
  editor); redirect the old routes to the new screen.
- Widen the campaign Rules picker (`CampaignBuilder.tsx`,
  `CampaignRulesEditor.tsx`) to optionally pick an existing legal doc, not only
  author a new one.

**Footer / banner** — no change needed (`/terms`, `/privacy`, `/cookies` links
still resolve), but they now serve placement-driven content.

## 7. The admin experience (single screen)

**Admin → Legal Docs**, two panels:

1. **Documents** — the existing `LegalDocumentsManager` list: create / edit /
   publish, each with its `/legal/<slug>` link and version. This is where the
   lawyer pastes final copy.
2. **Placements** (NEW) — a list of the fixed slots (Terms, Privacy, Cookies,
   Affiliate program terms) each with a **dropdown of published docs**. Changing a
   dropdown re-binds instantly. Competitions keep their doc picker in the campaign
   builder.

Lawyer flow: log in → **Legal Docs** → edit a document → **Publish** → (if needed)
point a slot at it → live everywhere. No deploy.

## 8. Verification (per CLAUDE.md — seen working, not "should work")

- `node scripts/audit-wiring.mjs` — confirm every legal surface resolves through
  the store; no orphaned reader.
- **Live-verify each surface** renders the placed doc: `/terms`, `/privacy`,
  `/cookies`, `/legal/<slug>`, affiliate gate, a competition rules page.
- **Consent stamping test**: create a booking → assert `accepted_terms_version` /
  `accepted_privacy_version` equal the placed docs' `legal_documents.version`;
  edit + publish a new version → new booking stamps the new number, old booking
  keeps the old. Same for an affiliate accept and a competition entry.
- Regenerate `docs/SCHEMA.md` + `database.types.ts`; `pnpm build` + `pnpm lint`
  clean.

## 9. Suggested phasing (when we build)

- **Phase 1 — Store + resolver + reads.** Add `legal_placements`, seed docs +
  slots, add resolver, switch `/terms` `/privacy` `/cookies` and the affiliate
  gate to read from it. No admin UI change yet; no consent-stamping change yet
  (still safe because versions still resolve).
- **Phase 2 — Consent stamping.** Re-point booking + affiliate acceptance to the
  placed doc version. This is the money-path change — verify hard (§8).
- **Phase 3 — Unified admin screen.** Placements panel; fold in the two legacy
  editors; widen the campaign picker; redirect old routes.
- **Phase 4 — Retire legacy.** Drop `platform_settings.legal_*` and
  `affiliate_settings.terms_content` reads/columns after the audit is clean.

## 10. Open questions

1. `[FOUNDER]` Confirm the fixed slot catalog (§3.2). Any other app location that
   should be a reassignable slot at launch?
2. `[FOUNDER]` Should the lawyer have their own admin **role/permission** scoped to
   Legal Docs only (recommended), rather than full admin? Ties into
   `check_feature_permission`.
3. `[COUNSEL]` Confirm that re-pointing the affiliate consent record from a text
   `terms_version` to `legal_documents` doc_slug/version is acceptable, and that
   the snapshot+hash approach is the record you want to rely on.
4. `[COUNSEL]` Confirm competition rules can be *reassigned* to a different doc
   after entrants have accepted (entrants keep their signed version; the campaign
   points at the new one going forward). Confirm this matches CPA retention.

## 11. What's already done (content)

The five consolidated drafts in `docs/legal/` are the **seed content** for the
store: `TERMS_OF_SERVICE.md`, `PRIVACY_POLICY.md`, `PAIA_MANUAL.md`,
`AFFILIATE_PROGRAM_TERMS.md`, `COMPETITION_RULES.md`. The `/terms` and `/privacy`
in-code static fallbacks were already updated to the consolidated wording (they
remain the last-resort fallback under this model).

---

## 12. Build log — Phase 1 (branch `legal`)

Built the **non-affiliate, off-money-path foundation** so it can't collide with
the affiliate work in flight on `main`:

- **Migration** `supabase/migrations/20260731160000_legal_placements.sql` —
  `legal_placements` table (slot → doc binding) + RLS (public read, service-role
  write) + touch trigger; seeds the `terms`/`privacy`/`cookies`/
  `affiliate-program-terms` docs (UNPUBLISHED skeletons) and the 7 slots.
- **Resolver** `apps/web/lib/legalDocuments.ts` — `getPlacedDocument(slot)`,
  `listPlacements()`, and the `LEGAL_PLACEMENT_SLOTS` catalog.
- **Cookies wired to the store** `apps/web/app/[locale]/cookies/page.tsx` — reads
  the `cookies` placement; falls back to built-in static copy until a doc is
  published. (Cookies chosen as the proof: no consent-version, no affiliate
  overlap.)

**Deferred (own verified phases):** `/terms` + `/privacy` still read
`platform_settings` — the switch + booking version-stamping is **Phase 2**
(money path). The affiliate gate still reads `affiliate_settings.terms_content` —
rewired in a **later phase** to avoid colliding with the affiliate agents. The
Placements admin panel + lawyer-only role are **Phase 3**.

### ⚠️ Not verified in this session
No `node_modules` and no Supabase link here, so build/lint/migration/live-render
could **not** be run. Before relying on this, run:

```bash
pnpm install
supabase db push --linked                                   # apply the migration
supabase gen types typescript --linked > packages/types/database.types.ts
node scripts/generate-schema-doc.mjs                         # refresh docs/SCHEMA.md
cd apps/web && pnpm build && pnpm lint
node scripts/audit-wiring.mjs
```

**Live-verify the store path (no new admin UI needed):** Admin → Platform
settings → **Legal documents** → open **Cookies Policy** → paste copy → tick
**Published** → Save. Then load `/cookies` and confirm it renders the published
doc (not the static fallback).

## 13. Build log — Phase 2 (branch `legal`)

Switched the **read path and the booking consent-stamping** for Terms + Privacy
onto the store. Still no affiliate files touched.

- **Pages** `app/[locale]/terms/page.tsx`, `privacy/page.tsx` now read
  `getPlacedDocument("terms" | "privacy")` instead of the `platform_settings`
  doc; static fallback retained.
- **Version resolver** `lib/legalDocuments.ts` → `getPlacedLegalVersions()`
  returns `{ terms, privacy }` = the published placed doc's
  `legal_documents.version`, or `1` (the built-in static copy = v1) when nothing
  is published — matching what the page shows.
- **All three booking paths** now stamp those versions:
  `lib/website/siteCheckout.ts`, `lib/bookings/createBooking.ts`,
  `app/[locale]/deal/[slug]/book/actions.ts`.
- **Signup consent hash** `lib/auth/consent.ts` derives `t<t>-p<p>` from the same
  resolver.
- **Legacy editor deprecated** `admin/platform/settings/legal/page.tsx` now shows
  a "do not edit here — managed under Legal documents" banner. `lib/legal.ts`
  is kept only because that legacy form still reads it (removed in Phase 3).

**Consent semantics preserved:** with nothing published, versions resolve to `1`
(exactly today's default), so no booking record shifts. Once a doc is published
into the `terms`/`privacy` slot, its `legal_documents.version` is what gets
stamped — and an edit bumps it for new bookings while old bookings keep their
number.

### Verify Phase 2 (after `supabase db push` applies Phase 1's migration)
1. Load `/terms` and `/privacy` → still show the built-in copy (nothing published
   yet). Publish a doc into the `terms` slot → the page now renders it.
2. Create a booking on each of the three paths → assert
   `accepted_terms_version` / `accepted_privacy_version` equal the placed docs'
   `legal_documents.version` (or `1` when unpublished).
3. Publish a new version → a fresh booking stamps the new number; an older
   booking keeps the old one.
4. `pnpm build && pnpm lint`; `node scripts/audit-wiring.mjs`.

**Deferred still:** affiliate gate rewire (later, avoids collision); Placements
admin panel + lawyer role + retiring `platform_settings.legal_*` / `lib/legal.ts`
(Phase 3).

## 14. Build log — Phase 3 (branch `legal`)

### 3a — Placements admin panel
- `PlacementsPanel.tsx` + `saveLegalPlacementAction` (writes `legal_placements`,
  revalidates public surfaces), added to Admin → Legal documents. Each slot gets
  a dropdown of documents; draft bindings flagged. Gated + audited.

### 3b — Legal Counsel role (lawyer login, legal-docs only)
- **Migration** `20260731170000_legal_docs_permission.sql` — adds the
  `legal.docs` permission, grants it to `super_admin` + `ops`, and creates a
  `legal_counsel` role holding only `legal.docs`.
- **Any-of permissions** — `requirePermission` / `hasPermission` /
  `withAdminAudit` now accept an **array** of keys (grants on ANY). The two
  legal-doc actions are gated on `["legal.docs", "platform.settings"]`.
- **Dedicated route** `/admin/legal` (own layout gated by the same OR) renders
  the Placements panel + Documents manager — a lawyer's screen with no other
  admin access. Sidebar shows a "Legal" section to anyone holding `legal.docs`.

**Zero-regression by design:** the OR-gate means existing admins
(super_admin/ops via `platform.settings`) keep managing legal docs **even before
the migration applies**. Only the new `legal_counsel` role depends on the
migration — and it fails *closed* until then.

**⚠️ Apply-ordering:** the migration should land with (or before) this code. If
code is live but the migration hasn't run, nothing breaks (OR-gate), but the
`legal_counsel` role simply won't work and the "Legal" nav item won't show for a
counsel-only user until it does. With Supabase Branching, the migration applies
to the branch DB on push.

**To onboard the lawyer:** invite them as staff with the **Legal Counsel** role
(Admin → staff). They sign in, see only **Legal**, and can edit/publish/place
every legal document.

### Verify Phase 3 (after `supabase db push`)
1. As an existing admin: `/admin/legal` loads; change a Placement dropdown →
   the bound public page updates; the legacy settings/legal banner shows.
2. Create a `legal_counsel` staff user → they see only the Legal section, can
   publish + place docs, and are redirected from other admin routes.
3. `pnpm build && pnpm lint`; `node scripts/audit-wiring.mjs`.

### Still open (a genuine Phase 4)
Retire `platform_settings.legal_*` + `lib/legal.ts` + the deprecated legacy
editor once confirmed unused; rewire the affiliate gate to the
`affiliate_program_terms` placement (after the affiliate agents' work lands).
