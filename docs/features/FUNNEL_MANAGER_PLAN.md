# Funnel Manager & Lead Pipeline — Plan

**Status:** 🟢 Phases 1–4 SHIPPED 2026-08-01 (data model + Hosts funnel + admin pipeline + nurture drip) — Phases 5–6 pending. ⚠️ Phase 4 conversion-cancel DB triggers (subscription→Won, affiliate joins) deferred to Phase 4b.
**Owner:** Founder + Marketing/Sales team
**Author:** drafted + refined 2026-07-31
**Related:** `BUSINESS_PRINCIPLES.md` #1 (guest identity), #5 (one source of truth),
#7 (plan → phased save points), #12 (lifecycle docs); `DECISIONS.md` ADR-021
(identity spine); existing affiliate system (`docs/lifecycles/affiliate.md`).

---

## 1. Goal

Run paid + organic marketing to **free-offer landing pages**, capture leads into a
list, **auto-nurture** them by email toward conversion, and give the internal sales
team a **kanban pipeline** to work and close leads by hand. Every landing page
doubles as an **affiliate link** so partners can refer people and earn commission
when those leads convert.

Two audiences, two funnels, each ending on a thank-you page that delivers a
promised resource (brochure + video). Scope is deliberately limited to the audiences
where there is an actual motion for the Sales Team to work:

1. **Hosts** → become a paying host (real revenue — subscriptions)
2. **Affiliate Partners** → join the (already-built) affiliate program (recruit +
   activate partners who then drive host revenue)

### Two boards, two different motions (do not conflate)

- **Host board** — leads we want to turn into paying hosts. Sources include Wielo's
  own ads to `/go/hosts` **and affiliate referrals** (an affiliate's `/r/<slug>`
  link). An affiliate-referred host lands **here**, on the Host board, badged
  "via [affiliate]" — because a host is what earns the affiliate commission.
- **Affiliate board** — an **internal** Wielo-staff pipeline for *recruiting new
  affiliates* (ads → `/go/affiliate`). It is not a restriction on what affiliates
  can do.

**Affiliates are never blocked from referring people.** The affiliate board being
internal does not gate affiliate behaviour. An affiliate's money path is referring
**hosts** (hosts pay → commission accrues); referring another affiliate earns
nothing unless that person *also* becomes a paying customer. Therefore an affiliate's
shareable link points at the **host** funnel by default
(`/r/<slug>?next=/go/hosts`).

> **Guests were cut; Competition is not a funnel but IS a lead source.** Guest
> accounts are free forever (Principle #1 — "the value is the guest graph, not guest
> fees"), so there is no sale to work — guest acquisition is a volume/marketing play,
> not a pipeline. **Competition is different:** we do not build a competition landing
> page here, but competition entrants (often affiliate-referred) already have their
> own email automation running elsewhere, and the pipeline must **ingest and display
> them** for sales visibility — badged with their competition name and **excluded
> from the default nurture drip** so we don't double-email them. See §5a
> (lead sources) and §8a (commission integrity).

---

## 2. Founder decisions (locked)

| Decision | Choice |
|---|---|
| Landing page build | **Coded routes** (`/go/*`) — fastest, full conversion control. CMS-driven funnels are a possible Phase 2. |
| Pipeline structure | **Per-audience boards** — separate stage sets for Hosts and Affiliates, switchable by tab. |
| Resource delivery | **On-page + email** — show instantly on the thank-you page AND email it (confirms address, starts the drip). |
| Drip scope v1 | **Both audiences** (Hosts + Affiliates) get an automated nurture sequence. |
| Audiences | **Hosts + Affiliates only.** Guests and Competition cut (no sales motion). |

---

## 3. Guiding principle: reuse, do not fork

Most of the required infrastructure already exists and is live. The build is mostly
**wiring**, not new systems.

| Requirement | Existing system to reuse | Location |
|---|---|---|
| Lead identity | `findOrCreateLeadIdentity()` mints one passwordless `user_profiles` row (`is_lead=true`), keyed on email — the ONLY canonical mint path (ADR-021) | `apps/web/lib/enquiry/lead-identity.ts` |
| Affiliate link on a landing page | `/r/<slug>?next=…` drops a 30-day `vilo_ref` cookie; `bindAffiliateReferral()` binds the lead — already called inside lead creation | `app/r/[slug]/route.ts`, `apps/web/lib/affiliate/attribution.ts` |
| Commission when the lead later pays | Append-only commission ledger (accrual/hold/clawback/payout) | `affiliate_*` tables, `apps/web/lib/affiliate/*` |
| Send an email | `dispatchEvent()` → `notification_queue` → `drainEmailQueue()` → Resend + React Email | `apps/web/lib/notifications/dispatch.ts`, `apps/web/lib/email/*`, `emails/templates/*`, registry `apps/web/lib/email/registry.ts` |
| **Timed / drip** send | `review_request_queue` `send_at` gate + per-minute Vault-secret pg_cron → `/api/*-worker` — clone this exactly | `supabase/migrations/…_review_request_cron.sql`, `apps/web/app/api/review-request-worker/` |
| New admin sidebar tab | `GmailNav` grouped arrays + `NAV_PERM` permission map | `apps/web/app/[locale]/admin/_components/AdminSidebar.tsx` |
| Admin auth / RBAC | `requireAdmin()` + `requirePermission('key')` + `has_admin_permission` RPC; roles in `platform_staff`/`admin_roles` | `apps/web/lib/admin/*`, `migrations/…_create_platform_staff_rbac.sql` |
| Kanban drag-drop | `@dnd-kit/*` already installed; sortable reference | `dashboard/website/…/navigation/SortableList.tsx` |
| Public form → DB, spam-safe | `/api/website-enquiry` pattern; honeypot + Turnstile | `apps/web/lib/website/createWebsiteEnquiry.ts`, `apps/web/components/site/TurnstileWidget.tsx` |
| Unsubscribe (POPIA) | `/unsubscribe` route already live | `apps/web/app/unsubscribe/` |
| Brand + forms | `brand-*` tokens, `font-display`, RHF+Zod, `<Modal>` | `apps/web/tailwind.config.ts`, `DESIGN_SYSTEM.md` |

**Load-bearing consequence:** a "lead" is **not** a new table. It is a
`user_profiles` row with `is_lead=true` (Principle #1, #5). Inventing a `leads`
table would fork identity and break the platform guest graph + affiliate binding.
The pipeline card *references* that identity; it does not duplicate it.

---

## 4. Public funnel routes

```
/go/hosts        → /go/hosts/thanks
/go/affiliate    → /go/affiliate/thanks   (thank-you CTA → existing affiliate join)
```

- Locale-free functional routes (add `/go` to the `FUNCTIONAL` whitelist in
  `apps/web/middleware.ts`, same as `/r`, so the affiliate cookie + no-locale
  behaviour work).
- **Affiliate version is automatic:** partner shares `/r/<their-slug>?next=/go/hosts`.
  `/r` drops the cookie → redirects to the landing page → on submit
  `bindAffiliateReferral()` credits them. If that lead ever buys a Wielo product,
  commission accrues through the existing ledger. **No new affiliate code.**

### Landing page form
Fields: `name`, `email`, `phone`, `establishment_address` (optional),
`marketing_consent` (checkbox), hidden `utm_*` / ad-source, honeypot + Turnstile.
**No password field** — the account is minted passwordless; the password is set later
via `/claim` (see §4c).

Spam protection: clone the **`website-form-submit`** pair (route
`app/api/website-form-submit/route.ts` + core `lib/website/submitWebsiteForm.ts`),
**not** `website-enquiry` — only the former verifies Turnstile. The widget token is
sent in the body as **`ts`**; the honeypot field is **`hp`** (filled → silently
return `{ok:true}` and write nothing). Server verify via `lib/security/turnstile.ts`
`verifyTurnstile(token, clientIp)` — fail-safe when unconfigured, fail-closed once
`TURNSTILE_SECRET_KEY` is set.

Submit → `POST /api/funnel-submit` (Route Handler, `runtime='nodejs'`,
`dynamic='force-dynamic'`, always returns HTTP 200 `{ok,error}`, never throws):
1. `findOrCreateLeadIdentity({ email, name, phone })` → `user_profiles` (is_lead)
   — this also runs `bindAffiliateReferral()` internally.
2. Upsert a `pipeline_leads` card for `(user_id, funnel_id)`.
3. Record `utm`, ad source, consent on the card.
4. Enqueue the **resource-delivery email** (transactional — always sends).
5. If consent given **and not `suppress_default_nurture`**, **enroll** in the
   funnel's nurture sequence. (Competition-sourced leads skip this — §5a.)
6. Redirect to the thank-you page, which shows the brochure + video inline.

---

## 4b. Direct paid signups bypass the pipeline

A host who signs up **and pays** directly (skipping the landing page) is already
converted — they are a *customer*, not a *lead*, and must not be worked as one.

- **If a lead card already exists** for that person (they came through `/go/hosts`
  earlier): paying **auto-moves the card to "Won (became host)"** and cancels any
  running nurture drip (the conversion hook in §7). History is preserved.
- **If there is no prior lead card** (cold direct signup): **do not create a pipeline
  card.** They enter the normal host/subscription system directly. Manufacturing a
  "lead" here would pollute conversion metrics.
- **Affiliate credit is unaffected** either way — `bindAffiliateReferral()` fires at
  signup independent of the pipeline (§8a). Direct conversions are measured in
  revenue/subscription reporting; the pipeline measures only leads that needed
  nurturing. Clean separation, no double-counting.

---

## 4c. Frictionless capture, claim later (no password on the form)

The landing form never asks for a password — that friction would tank list-building,
and it isn't needed.

- On submit, `findOrCreateLeadIdentity()` mints a **passwordless** `user_profiles`
  guest account (`role='guest'`, `is_lead=true`). The person has a real Wielo account
  immediately, with zero perceived "signup."
- The **password is set later, at the moment of real intent**, via the existing
  **`/claim` flow** (`claimGuestAccountAction`, which requires an already-signed-in
  user, sets the password, and flips `is_lead → false`).
  > ⚠️ **Corrected after code verification.** There is **no by-email "is this a
  > passwordless lead?" branch in signup/login.** The real routing (mirror
  > `apps/web/lib/enquiry/create-enquiry.ts:481-497`): after
  > `findOrCreateLeadIdentity` returns `{ guestId, isLead }`, **if `isLead` is true**,
  > mint a magic link — `admin.auth.admin.generateLink({ type:'magiclink', email })`
  > — and redirect to `/auth/confirm?token_hash=…&type=magiclink&next=/claim?…`. That
  > signs the lead in via the token, landing them on `/claim` to set a password. If
  > `isLead` is false (returning real account), redirect to `/login?next=…`. The
  > `/go` submit handler must replicate this branch.
- **No email-confirm gate.** The resource-delivery email doubles as the deliverability
  check (hard bounces auto-flag the lead); POPIA consent is the checkbox, a separate
  concern from email verification. Friction lives at conversion, not at capture.

```
Landing form (no password) → findOrCreateLeadIdentity → passwordless guest account
      → thank-you (resource shown + emailed) → … nurture …
      → ready to act → /claim → set password
```

---

## 5. New data model (extends identity, owns the pipeline concept)

All new tables RLS-enabled; writes via service-role from Server Actions / workers.

- **`funnels`** — one row per landing page.
  `id, audience ('host'|'affiliate'), slug, name,
  headline/subcopy, thankyou_config jsonb, sequence_id fk, is_active, created_at`.
  Admin-editable. **Resource fields (brochure + video):**
  > ⚠️ **Corrected after code verification.** There is **no platform-wide media
  > library / `media_assets` table / `asset_id` FK** in the codebase. Media is
  > path/URL strings, and **there is no hosted-video-file pipeline** — videos are
  > embed URLs only. So the fields are:
  - `brochure_path` **text** + `brochure_name` text — a file in a **new public
    `funnel-assets` Storage bucket** (funnel brochures are public marketing
    collateral, so a public bucket + deterministic URL is fine — mirror
    `websiteAssetUrl(path)`; no signing needed, unlike the private host brochure).
    Admin uploads it via a small picker modelled on the affiliate **marketing-assets**
    admin surface (`marketing_assets`), *not* the host-website image library
    (which is image-only + website-scoped).
  - `video_url` **text** — a **YouTube/Vimeo URL**, rendered via the existing
    `apps/web/lib/website/videoEmbed.ts` `toEmbed()`. This is the founder's YouTube
    requirement and works today.
  - **Decided (founder, v1):** video is a **YouTube/Vimeo URL only** — no
    hosted-video-file upload (that would be separate net-new work). `video_url`
    covers it.

- **`pipeline_stages`** — kanban columns, per audience (per-audience boards).
  `id, audience, key, label, sort_order, is_won, is_lost`.
  Seed defaults per audience (§6): Host ends in "Won (became host)"; Affiliate ends
  in "Won (actively promoting)".

- **`pipeline_leads`** — the CRM card (the kanban card). **This is the new
  concept; identity stays in `user_profiles`.**
  `id, user_id fk user_profiles, funnel_id fk (nullable — competition leads have no
  funnel), audience, stage_id fk, owner_staff_id fk platform_staff (nullable),
  status, score int, utm jsonb, ad_source, marketing_consent bool,
  affiliate_ref (denormalised for reporting), source_kind, source_label,
  suppress_default_nurture bool, last_activity_at, created_at`.
  `UNIQUE(user_id, audience)` — one card per lead per board.

  **Source fields (§5a):**
  - `source_kind` — `'host_funnel' | 'affiliate_funnel' | 'affiliate_referral' |
    'competition' | 'direct'`.
  - `source_label` — human display, e.g. `"Summer 2026 Competition"` or the
    referring affiliate's name; drives the card badge.
  - `suppress_default_nurture` — `true` skips enrollment in the default funnel drip
    (set for `competition` leads, who already have their own automation elsewhere).

- **`pipeline_activities`** — timeline (append-only, like `conversation_notes`).
  `id, lead_id fk, staff_id (nullable = system), kind ('email_sent'|'stage_moved'|
  'note'|'call_logged'|'consent_changed'|'converted'), body, meta jsonb, created_at`.

- **`nurture_sequences`** — `id, audience, name, is_active`.
- **`nurture_steps`** — `id, sequence_id fk, step_order, delay_hours,
  email_type (registry key), subject_override, is_active`.
- **`nurture_enrollments`** — the drip queue (clone of `review_request_queue`).
  `id, lead_id fk, sequence_id fk, current_step, next_send_at, status
  ('active'|'completed'|'cancelled'|'converted'|'unsubscribed'), created_at`.
  A per-minute cron claims rows where `next_send_at <= now()` and `status='active'`.
  **Refinement (verified):** the nurture worker is a *pure scheduler* — for each due
  enrollment it **inserts a row into the existing `notification_queue`** (`type` =
  the step's template key, `recipient: 'custom'`, `payload.recipient_email` = the
  lead), then advances `current_step`/`next_send_at` (or completes). The existing
  email drain (`drainEmailQueue` → Resend) does the actual send, so we reuse the
  whole send path and only build scheduling. Cancels on conversion or unsubscribe.
  Statuses are **`text` + `CHECK (...)`**, not a Postgres enum (repo convention — no
  `CREATE TYPE` exists anywhere).

After migrations: regenerate `packages/types/database.types.ts` (linked, `> file`
only — never pipe stderr).

---

## 5a. Lead sources & automation suppression

A lead can enter a board from several sources; the source drives (a) the card badge
and (b) whether the default drip runs.

| `source_kind` | Enters | Default nurture drip | Card badge |
|---|---|---|---|
| `host_funnel` | Host board | ✅ enrolled | source/UTM chip |
| `affiliate_funnel` | Affiliate board | ✅ enrolled | source/UTM chip |
| `affiliate_referral` | **Host** board | ✅ enrolled | **"via [affiliate]"** |
| `competition` | Host board (as a prospective host) | ❌ **suppressed** — already in the competition's own automation | **"🏆 [XXX Competition]"** distinct badge |
| `direct` | either | optional | — |

**Competition leads are visible but not auto-emailed.** On ingest, set
`suppress_default_nurture = true`; step 5 of the submit/ingest flow skips
`nurture_enrollments`. Sales still works the card, sees the timeline, and can send a
manual one-off email — they're just not enrolled in the funnel drip so we don't
double-message someone the competition automation is already emailing.

> **Open:** how competition leads physically enter the pipeline (an existing
> competitions table/system? an external campaign tool webhook? a tagged CSV
> import?) is not yet defined — see §12. The pipeline side (badge + suppression +
> overview filter) is specced regardless of the ingest mechanism.

---

## 6. Admin "Pipeline" tab

- **Nav:** add a `GmailNavItem` (icon from `lucide-react`, e.g. `Filter`/`Workflow`)
  to the `OPERATIONS` array in `AdminSidebar.tsx`, href `/admin/pipeline`,
  `match: "prefix"`.
- **RBAC:** add permission keys `pipeline.view` / `pipeline.manage` to the SQL
  permission catalog + role grants (`super_admin`, `support_agent`, plus a new
  **"Sales Team"** role — key `sales_team` — for the marketing/sales staff who work
  leads), add to the `PermissionKey` union, and map the href in `NAV_PERM`. Gate the
  page with `requirePermission('pipeline.view')`.
- **Default stage sets** (seeded per audience board; each ends in Won + Lost):
  - **Hosts:** New → Contacted → Qualified → Demo booked → Nurturing → Won (became host) → Lost
  - **Affiliates:** New → Contacted → Joined program → Nurturing → Won (actively promoting — first link shared / first click) → Lost
- **Board UI:** `app/[locale]/admin/pipeline/`
  - Audience tab switcher (Hosts / Affiliates).
  - Kanban columns from `pipeline_stages`, cards from `pipeline_leads`
    (`@dnd-kit` multi-column DnD — new component, using the existing SortableList
    as the dnd-kit reference).
  - **Card source badge** (§5a): a "via [affiliate]" tag on affiliate-referred
    leads, and a distinct **"🏆 [Competition name]"** badge on competition leads —
    plus a small muted **"auto off"** indicator on cards whose default drip is
    suppressed, so sales sees at a glance they're not being auto-emailed.
  - Full lead **record page** (`/admin/pipeline/[leadId]`, its own route — not a
    drawer): contact info, activity timeline, notes, stage move, assign owner, log a
    call, send a manual one-off email (via `dispatchEvent`), consent + unsubscribe
    status, affiliate attribution (+ commission-owed note, §8a), source, UTM/ad
    source. Clicking a card navigates to it.
  - Filters: audience, owner, **source** (incl. a "Competition" segment for the
    overview), source/UTM, stage, date, score.
  - Mutations in `app/[locale]/admin/pipeline/actions.ts`, wrapped with
    `withAdminAudit` (matches existing admin pattern).
- Overview KPI tiles (leads today, by source, conversion rate, unworked > SLA) can
  reuse the `admin/page.tsx` "Control Centre" tile pattern.

---

## 7. Nurture drip engine

Mirror the review-request cron precisely:
- New `nurture_enrollments` table with `next_send_at` gate (§5).
- New pg_cron job `drain-nurture` (`* * * * *`) reading `nurture_worker_url` +
  `nurture_worker_secret` from **Vault** (fail-soft if unset), POSTing to
  `/api/nurture-worker` only when due rows exist.
- `apps/web/app/api/nurture-worker/route.ts` (`runtime='nodejs'`, timing-safe
  bearer check) claims due enrollments atomically (clone `claim_email_queue_batch`
  with a `next_send_at <= now()` predicate), sends each step's template via
  `dispatchEvent`, advances or completes.
- Templates: new React Email files in `emails/templates/` + registered in
  `apps/web/lib/email/registry.ts` (recipient `custom`, subject per step).
- **Conversion cancels the drip — via Postgres triggers (corrected after code
  verification).** Host-payment activation is split across a TS path
  (`activateMappedPlan`, `lib/billing/product-checkout.ts:796`) **and** a Deno Edge
  Function webhook (`paystack-webhook`) that can't share TS code, so an app-layer
  hook would miss paths. The clean, no-duplication approach is DB triggers matching
  the repo's existing convention:
  - `AFTER INSERT OR UPDATE ON subscriptions` when `status` becomes `active` with a
    paid plan → resolve `user_id` via `hosts`, move the Host-board card to Won,
    `UPDATE nurture_enrollments SET status='converted'`. Catches all three activation
    paths at once (`activateMappedPlan`, `processSubscriptionEvent`,
    `processProductEvent`).
  - `AFTER INSERT ON affiliate_accounts` (the only insert site,
    `acceptAffiliateTermsAction`) → move Affiliate-board card to "Joined program".
  - `AFTER INSERT ON affiliate_clicks` (first row for the affiliate) → move Affiliate
    card to "Won (actively promoting)".
  This also implements §4b (direct paid signup → auto-Won) with the same
  subscriptions trigger.

---

## 8. Compliance (POPIA — non-negotiable, Principle #1 rule #5)

- Minting the identity ≠ marketing consent. The **resource-delivery email** is
  transactional (fulfils the user's explicit request) and always sends.
- The **nurture drip only enrolls if `marketing_consent = true`** (explicit
  checkbox, not pre-ticked).
- Every nurture email carries the existing `/unsubscribe` link; unsubscribe sets
  enrollment `status='unsubscribed'` and stops all sequences for that person.
- Store consent + timestamp + source on the card for audit.

---

## 8a. Commission integrity — internal work never voids the affiliate's payout

**When a lead was referred by an affiliate, the affiliate is owed their commission
regardless of how much Wielo's own sales team or automations work that lead.**

- The affiliate attribution (`affiliate_referrals`, bind-once-forever) and the
  commission ledger (`affiliate_commissions`) are **completely independent of the
  pipeline.** Nothing the Sales Team does on a `pipeline_leads` card — assigning an
  owner, moving stages, logging calls, sending manual emails, enrolling in a drip —
  touches the affiliate binding or the ledger.
- Commission accrues on the existing rule: when the referred user **pays Wielo**
  (e.g. a host subscription), `accrue_affiliate_commission` fires off net revenue,
  holds, then clears — exactly as today. Our working the card does not "claim" the
  lead away from the affiliate.
- This holds for competition-sourced, affiliate-referred leads too: suppressing the
  default drip changes *our messaging*, not *their commission*.
- **Rule:** the pipeline is a *sales-workflow* layer on top of identity + affiliate
  attribution; it never mutates them. (Principle #5 — one source of truth: affiliate
  money lives in the affiliate ledger, not the pipeline.)

---

## 9. The 2 funnels + asset checklist

| Funnel | Route | Conversion goal | Resource (marketing to produce) |
|---|---|---|---|
| Hosts | `/go/hosts` | Nurture → sign up as a paying host | Host brochure (PDF) + host video; thank-you CTA → host signup / book a demo |
| Affiliate | `/go/affiliate` | Nurture → join **and start promoting** the Wielo app | Partner brochure + video; thank-you CTA → existing `/portal/affiliates` terms/join + get their link |

Per funnel, marketing supplies: headline + subcopy, brochure PDF, video (media-library
file or YouTube URL), thank-you CTA text/target, and the nurture email copy per step.

---

## 10. Enrichment (recommended, some deferred)

- **UTM + ad-source capture** on every submit → tie ad spend to converted revenue
  through the pipeline. (v1)
- **Lead scoring** — establishment address present + host funnel = hotter; sort the
  board by score. (v1, simple rules)
- **SLA timer** — flag cards untouched by a rep for > X hours (reuse a `send_at`
  style gate + a board filter/badge). (v1 or Phase 2)
- **"Book a demo" CTA** on the host thank-you page instead of a passive brochure —
  higher intent. (v1 optional)
- **WhatsApp channel** — large in the SA market; the `pipeline_activities.kind` and
  channel model should leave room for it. (Deferred — flag, don't build v1)
- **CMS-driven landing pages** — reuse the existing marketing-site section renderer
  (Hero/CTA/Form/Faq + Turnstile) so marketing self-serves new funnels. (Phase 2)
- **A/B testing** of landing copy. (Deferred)

---

## 11. Phasing (Principle #7 — each phase = a committed, pushed save point)

1. ✅ **DONE (2026-08-01)** — **Data model + migrations** (funnels, pipeline_stages/leads/activities,
   nurture_*) + seed default stages/sequences + types regen. Migrations
   `20260801100000_funnels_pipeline` (7 tables, RLS super-admin-select + service-role
   writes, `update_updated_at` triggers, seeded stages + 2 inactive sequences),
   `20260801100100_pipeline_rbac` (`pipeline.view`/`pipeline.manage` perms, `sales_team`
   role, grants incl. explicit super_admin, `admin_audit_log` target_type += `pipeline`),
   `20260801100200_funnel_assets_bucket` (public PDF bucket). Applied to linked DB, types
   regenerated, lint green.
2. ✅ **DONE (2026-08-01)** — **Hosts funnel end-to-end** — `/go/hosts` + thank-you +
   `/api/funnel-submit` → lead → card → resource email → on-page resource. Files:
   `middleware.ts` (+`go`), `app/go/layout.tsx` (branch root — no app/layout.tsx exists),
   `app/go/hosts/page.tsx`, `app/go/hosts/thanks/page.tsx`, `app/go/_components/FunnelForm.tsx`
   (RHF+Zod, honeypot `hp`, Turnstile, UTM capture), `app/api/funnel-submit/route.ts`,
   `lib/funnels/submit.ts` (findOrCreateLeadIdentity → pipeline_leads upsert → activity →
   resource email → nurture guard), `lib/funnels/getFunnel.ts`, migration
   `20260801100300_seed_host_funnel`. **Live-verified (Principle #9):** real submit created the
   user_profiles lead + host-board card (source_kind=host_funnel, stage New, score 10) +
   `created` activity; thank-you page renders. Minimal placeholder UI (real design later); brochure/
   video null → placeholder states. `pnpm build` + `pnpm lint` green.
3. ✅ **DONE (2026-08-01)** — **Pipeline admin board** — nav + RBAC + kanban + lead record page +
   actions. `/admin/pipeline` (nav item + `NAV_PERM` + `PermissionKey` union + audit target
   `pipeline`); board = 2 audience tabs (host/affiliate), real KPIs, columns from `pipeline_stages`,
   cards from real `pipeline_leads`, `@dnd-kit` drag-to-move + stage `<select>`, empty states; record
   page `[leadId]` = header, stage track, facts, real activity timeline, note composer, owner assign,
   mark won/lost; Tasks/Emails/Files tabs = "coming soon" (data-backed core, per founder). Actions in
   `pipeline/actions.ts` via `withAdminAudit` (move stage / set outcome / assign / add note). Founder
   mockups followed as direction. **Live-verified:** magic-link super-admin → board (KPIs, card,
   empty states), card→record, add note (→ timeline, attributed to admin), mark won + move stage
   (→ status/stage/activities + audit rows). ⚠️ drag GESTURE not exercisable via synthetic events, but
   `moveLeadStageAction` proven via the stage dropdown. build + lint green.
4. ✅ **DONE (2026-08-01)** — **Nurture drip engine** — migration
   `20260801110000_nurture_engine` seeds 3 host steps (0/48/120h) + activates the host sequence +
   schedules the `drain-nurture` pg_cron (Vault `nurture_worker_url` + shared `email_worker_secret`,
   fail-soft). `app/api/nurture-worker/route.ts` (clone of review-request-worker: timing-safe
   `EMAIL_WORKER_SECRET` bearer, batch-drains due active enrolments, sends each step via
   `sendTransactionalEmail` inline HTML, logs `email_sent` on the lead, advances/completes;
   consent-withdrawn → `unsubscribed`). **Live-verified:** consenting funnel submit → enrolment
   (due now) → worker POST (200, sent 1) → step 1 email + `email_sent` activity + advance to step 2
   (`next_send_at` +48h); 401 without the secret. build + lint green.
   ⚠️ **DEFERRED (Phase 4b):** inline step HTML instead of polished React Email templates + registry;
   the **conversion-cancels-drip DB triggers** (subscriptions active → Won + enrolment `converted`;
   `affiliate_accounts`/`affiliate_clicks` → affiliate-board moves); the SQL Editor Vault
   `nurture_worker_url` provisioning per env (prod URL) — until set, the cron is a fail-soft no-op.
5. **Affiliate funnel** (`/go/affiliate` + its board + drip) + affiliate-link
   verification (`/r/<slug>?next=/go/hosts` credits correctly) + UTM/analytics.
6. **Lifecycle doc** `docs/lifecycles/funnel.md` (Principle #12) + index it.

Each phase: `pnpm build` + `pnpm lint` green, verify live where user-visible, then
commit + push to `main`.

---

## 12. Decisions log + remaining open items

**Decided:**
- **Audiences: Hosts + Affiliates only.** Two boards. Guests cut (free accounts, no
  sale to work). Competition is **not a funnel** but **is a lead source** (§5a) —
  ingested, badged, and drip-suppressed.
- **Two boards, two motions (§1):** Host board = all host leads (direct + affiliate-
  referred + competition-sourced, tagged accordingly); Affiliate board = internal
  Wielo-staff pipeline to recruit + activate affiliates. Affiliate-referred hosts
  land on the **Host** board; an affiliate's shareable link defaults to the host
  funnel (`/r/<slug>?next=/go/hosts`).
- **Every lead is a free Wielo guest account (§1, §4c).** `findOrCreateLeadIdentity`
  mints a passwordless `user_profiles` (`role='guest'`, `is_lead=true`). Everyone is
  a guest record first, regardless of ever paying; becoming a host layers a `hosts`
  row on top without removing the guest identity.
- **No password on the landing form (§4c).** Passwordless mint; password set later at
  real intent via the existing `/claim` flow. No email-confirm gate.
- **Direct paid signups bypass the pipeline (§4b).** Existing lead card → auto-Won +
  drip cancelled; cold direct signup → no card created. Affiliate credit unaffected.
- **Commission integrity (§8a).** Internal sales/automation work never alters the
  affiliate's attribution or owed commission.
- **Competition leads (§5a):** visible on the Host board, badged "🏆 [Competition]",
  **excluded from the default drip** (`suppress_default_nurture`), with an "auto off"
  card indicator and a Competition filter/segment for the overview.
- **RBAC role:** new **"Sales Team"** role (`sales_team`); also `super_admin` +
  `support_agent` get `pipeline.view`.
- **Stage sets:** proposed defaults locked per audience (§6) — each ends in Won + Lost.
- **Nurture cadence:** approved as proposed (e.g. Host: Day 0 resource → Day 2 value
  → Day 5 social proof → Day 9 offer/demo → Day 14 last call). Same shape per audience.
- **Resource hosting (corrected §5, decided):** no platform media library exists.
  **Brochure** = a PDF in a new public `funnel-assets` bucket (`brochure_path` text).
  **Video** = a **YouTube/Vimeo URL** via `videoEmbed.ts` — **no hosted video-file
  upload in v1** (founder-confirmed).

**Still open:**
- **How competition leads enter the pipeline** (§5a) — existing competitions
  table/system? external campaign-tool webhook? tagged CSV import? Needed before the
  competition-ingest slice; the badge + suppression + overview filter are specced
  regardless.
- Exact affiliate "actively promoting" definition for the Won stage (first link
  shared vs. first tracked click vs. first referred signup).
- Host demo-booking mechanism for the "Demo booked" stage (Calendly-style link vs.
  manual by the Sales Team).
- Confirm affiliate shareable link defaults to the **host** funnel
  (`/r/<slug>?next=/go/hosts`).
- **Brochure bucket (NEW):** confirm a new public `funnel-assets` bucket + a small
  admin upload/picker (modelled on the affiliate `marketing_assets` surface) vs.
  reusing an existing bucket. *(Defaulting to a new `funnel-assets` bucket unless you
  say otherwise — not a Phase 1 blocker.)*

---

## 13. Implementation grounding — verified against `main` (2026-07-31)

Five read-only passes over the codebase confirmed the reuse assumptions and produced
the exact file map below. **Corrections** already folded into the sections above are
flagged ⚠️.

### 13.1 Verified integration points (matched the plan)
- **Identity:** `lib/enquiry/lead-identity.ts` → `findOrCreateLeadIdentity(admin,
  {email, name, phone})` returns `{guestId, isLead}` and **calls
  `bindAffiliateReferral` internally** (affiliate binding is free).
- **Affiliate cookie:** `app/r/[slug]/route.ts` drops `vilo_ref` (httpOnly, 30d),
  honours same-origin `?next=`. `REF_COOKIE`, `bindAffiliateReferral` in
  `lib/affiliate/attribution.ts` — best-effort, `UNIQUE(referred_user_id)`.
- **Public route:** add `go` to the `FUNCTIONAL` regex in `middleware.ts:14`
  (`…|quote|r|go)`). No auth guard blocks `/go/*` (`PROTECTED_PREFIXES` =
  dashboard/admin/portal only). **Pages live at `app/go/…` (locale-free, like `/r`),
  NOT under `[locale]`.**
- **Email send path:** `dispatchEvent` (`lib/notifications/dispatch.ts`) enqueues a
  thin `notification_queue` row keyed by an event's `emailTemplate`; drain +
  `EMAIL_REGISTRY` (`lib/email/registry.ts`) + resolver render & send via Resend.
  `recipient:'custom'` reads `payload.recipient_email` (the path for account-less
  leads).
- **Drip template to clone:** `review_request_queue` (`send_at` col) +
  `…_review_request_cron.sql` (Vault lookup + `net.http_post`) +
  `app/api/review-request-worker/route.ts` (nodejs, `timingSafeEqual` on
  `EMAIL_WORKER_SECRET`) + `claim_email_queue_batch` (`FOR UPDATE SKIP LOCKED`).
- **Admin:** `AdminSidebar.tsx` `OPERATIONS` array + `NAV_PERM` map;
  `requirePermission`/`PermissionKey` in `lib/admin/requirePermission.ts`;
  `withAdminAudit`; list/detail pattern in `admin/users/` using `createAdminClient()`.
- **Kanban:** `@dnd-kit/*` present; extend the single-list `SortableList.tsx`
  (`DndContext`/`SortableContext`/`CSS.Transform`) to multi-column (per-column
  `useDroppable` + cross-column `onDragEnd`).

### 13.2 Corrections the verification forced (⚠️ already applied above)
1. **No `ensureWieloGuestIdentity`** — use `findOrCreateLeadIdentity` (§3, §4c).
2. **No platform media library / `asset_id`** — brochure = path in a new public
   `funnel-assets` bucket; video = YouTube/Vimeo URL; **no hosted-video pipeline**
   (§5, §12).
3. **Claim routing** = magic-link (`generateLink` → `/auth/confirm…&next=/claim`),
   not signup-by-email detection (§4c).
4. **Conversion = Postgres triggers** on `subscriptions` / `affiliate_accounts` /
   `affiliate_clicks` (payment activation is split TS + Edge webhook) (§7).
5. **Spam** = clone `website-form-submit` (Turnstile `ts` + honeypot `hp`), not
   `website-enquiry` (honeypot only) (§4).
6. **Drip worker = pure scheduler** enqueuing into `notification_queue`; reuse the
   email drain (§7).
7. **`text` + CHECK, never enums**; `update_updated_at()` trigger; RLS via
   `is_super_admin()` for the admin/pipeline tables (service-role writes).

### 13.3 Exact files to CREATE / EDIT per phase

**Phase 1 — data model (migrations, no UI):**
- CREATE `supabase/migrations/<ts>_funnels_pipeline.sql` — `funnels`,
  `pipeline_stages`, `pipeline_leads` (+ source/suppression cols), `pipeline_activities`,
  `nurture_sequences`, `nurture_steps`, `nurture_enrollments`; all `text`+CHECK,
  `update_updated_at` triggers, RLS (`is_super_admin()` read / service-role write);
  seed default stages + the two sequences.
- CREATE `supabase/migrations/<ts>_pipeline_rbac.sql` — insert `pipeline.view` /
  `pipeline.manage` into `admin_permissions`; insert `sales_team` into `admin_roles`;
  grant both keys to `sales_team`, `super_admin`, `support_agent` (`ON CONFLICT DO
  NOTHING`); `ALTER admin_audit_log … target_type_check` to add `'pipeline'`.
- CREATE the `funnel-assets` Storage bucket (public) + read policy.
- EDIT `packages/types/database.types.ts` via `supabase gen types typescript --linked
  > packages/types/database.types.ts` (plain `>`).

**Phase 2 — Hosts funnel:**
- EDIT `apps/web/middleware.ts:14` (add `go`).
- CREATE `apps/web/app/go/hosts/page.tsx`, `apps/web/app/go/hosts/thanks/page.tsx`,
  a client `FunnelForm` + `TurnstileWidget`, `app/api/funnel-submit/route.ts`,
  `lib/funnels/submit.ts` (calls `findOrCreateLeadIdentity`, upserts card, enqueues
  resource email, enrolls if consent+not suppressed, magic-link/claim redirect).

**Phase 3 — Pipeline admin:**
- EDIT `AdminSidebar.tsx` (item + `NAV_PERM` + `prettyRole` case),
  `lib/admin/requirePermission.ts` (union), `lib/admin/withAdminAudit.ts`
  (`AUDIT_TARGET_TYPES` += `'pipeline'`).
- CREATE `app/[locale]/admin/pipeline/page.tsx`, `_components/PipelineBoard.tsx`
  (multi-column dnd-kit), `[leadId]/page.tsx` (record page), `actions.ts`
  (`withAdminAudit`, `pipeline.manage`).

**Phase 4 — Nurture drip:**
- CREATE `supabase/migrations/<ts>_nurture_cron.sql` (clone review cron →
  `drain-nurture`, Vault `nurture_worker_url` + shared `email_worker_secret`),
  `app/api/nurture-worker/route.ts` (clone review-request-worker),
  `emails/templates/Nurture*.tsx` + barrel `emails/index.ts` + `registry.ts` entries
  (+ optional resolver), and the **conversion triggers** migration (subscriptions /
  affiliate_accounts / affiliate_clicks).
- PROVISION (SQL editor, per env): `vault.create_secret('<host>/api/nurture-worker',
  'nurture_worker_url','')`; ensure `EMAIL_WORKER_SECRET` env == the existing
  `email_worker_secret` Vault value.

**Phase 5 — Affiliate funnel:** mirror Phase 2 for `/go/affiliate` + its board/drip.

### 13.4 Pre-flight rules (from CLAUDE.md / AGENT_RULES)
- Read `supabase_database.md` before writing any migration; never edit an existing
  migration; apply with `supabase db push --linked`.
- Keep `pnpm build` + `pnpm lint` green; no `console.log`; no `any`.
- Verify each user-visible slice in BOTH the live page and a real submit (Principle
  #9) before calling it done.
