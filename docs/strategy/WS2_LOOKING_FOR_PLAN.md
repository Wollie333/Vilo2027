# WS-2 — Looking For: post-first funnel + host quote loop (build plan)

> Status: PLAN LOCKED (file-level, verified against the live tree 2026-07-20).
> Source: LAUNCH_EXECUTION_PLAN.md §2 "WS-2". Goal metric: **% of published
> requests getting ≥2 quotes in 24h**. Non-negotiable: **2c** (a request with no
> quote damages the brand). Nothing here is built yet.

## Current system (file:line anchors)

**Funnel entry** — `apps/web/app/[locale]/looking-for/start/page.tsx`: `postHref`
at ~278-283 = `user ? "/portal/looking-for/new" : "/signup/guest?next=/portal/looking-for/new"`,
used by all three CTAs (~310, 360, 456). So an anonymous guest is forced through
`/signup/guest` (full password account) before seeing the wizard. `ShowcaseCard`
(157-226) previews live posts.

**Auth wall** — `apps/web/app/[locale]/portal/looking-for/new/page.tsx:15-18`
hard-redirects to `/login?next=…` when no `user`. Loads server draft
(`loadFormDraft`, keyed to `user.id`) then renders `<RequestForm mode="create" userId={user.id}>`.

**Wizard** — `apps/web/app/[locale]/portal/looking-for/_components/RequestForm.tsx`:
`SECTIONS` (118) = 6 tabs (basics, dates, location, requirements, photo, review);
`ProgressRing` (1455-1485); autosave `useAutosaveDraft({userId,…})` (317-323) keyed
to userId in `apps/web/components/drafts/useAutosaveDraft.ts:62-66` and synced to the
durable `form_drafts` table (needs a session); `LocationPicker` + `RADIUS_OPTIONS=[5,10,25,50,100,200]`
(167); review step (1171-1301); submit `handleSave` (507-556) → `createRequestAction({…, guest_id:userId})` (535).

**Request model** — table `looking_for_posts`; insert in
`apps/web/app/[locale]/portal/looking-for/actions.ts:137-168`. `createRequestAction`
(95-228): auth gate (103), `guestCan("looking_for_post")` (109), 3-active cap (120-130),
30-day expiry (133-134 + DB trigger), insert, `record_guest_post` (189-202),
`replacePostRequirements` (205), `notifyMatchingAlerts` (208-224). No `child_ages`/`pets`;
budget is two NumberFields, no slider/live total; no affirmative "not sure" destination.

**Passwordless primitive (2b)** — `apps/web/lib/enquiry/lead-identity.ts:16-53`
`findOrCreateLeadIdentity(admin,{email,name})` (creates `email_confirm:true`, `role:'guest'`,
`is_lead:true`, `bindAffiliateReferral`; **does not capture consent**). End-to-end template:
`apps/web/lib/enquiry/create-enquiry.ts:471-529` (service-role write FIRST, then ONE
`admin.auth.admin.generateLink({type:"magiclink",email})` → `properties.hashed_token` →
`redirectTo=/auth/confirm?token_hash=…&type=magiclink&next=/claim?c=…`; two links invalidate
the first). `apps/web/app/auth/confirm/route.ts:19` `verifyOtp` sets the session. `/claim`
(`claim/page.tsx`, `claim/actions.ts:claimGuestAccountAction`) sets password + flips `is_lead→false`.
Consent captured today only at signup (`signup/guest/actions.ts:143-146`); reuse `lib/auth/consent.ts:getConsentVersion`.

**Alert dispatch (2c)** — instant path is saved-search ONLY:
`createRequestAction:208 → notifyMatchingAlerts` in `apps/web/lib/looking-for/matchAlerts.ts:114-251`,
which queries only `looking_for_alerts WHERE is_active` (128-133); geo gate via `distanceKm`
haversine (37-51) against preloaded published properties (140-158); dispatches
`looking_for_new_post_region` (210-233). A host with a matching published property but NO
saved search gets nothing here — only the delayed **province digest**
(`apps/web/lib/looking-for/notifications-worker.ts:81-186`, hourly, `ilike province`, excludes
alert-holders). Respond screen (pre-filled quote): `apps/web/app/[locale]/dashboard/looking-for/respond/[postId]/page.tsx`.

**"Preparing offers" data (2d)** — `looking_for_post_unlocks (host_id, post_id)`
(`apps/web/lib/looking-for/leadAccess.ts:79-176`): a host who unlocked but has no
`looking_for_responses` row is literally preparing. Guest view:
`apps/web/app/[locale]/portal/looking-for/[id]/{record-data.ts,RequestRecord.tsx}` (has `view_count`/`quote_count`).

## The plan (build order — 2c FIRST)

### 2c — default regional alerting (SHIP FIRST; touches only 2 files; works on the current funnel)
- `apps/web/lib/looking-for/matchAlerts.ts` — in `notifyMatchingAlerts`, after the saved-search
  dispatch, add a **second pass**: collect already-notified `host_id`s into a Set; then target
  **every host with a published property in range** not already in the Set. If the post has pin+radius
  (`hasGeo`, 140-158) reuse `propsByHost` + `distanceKm`; else region fallback (hosts with a published
  property `ilike province = location_region`, the digest's query at notifications-worker.ts:121-126).
  Dispatch the **same** `looking_for_new_post_region`, deduped by host.
- `apps/web/lib/looking-for/notifications-worker.ts` — retire/suppress the region-digest dispatch for
  posts now covered in real-time (widen its exclusion, or gate it to a failure safety-net). Keep the
  expiry half.
- **Dedup/fan-out risks:** one email per host across both passes (Set by host/user_id); a host with
  multiple in-range properties dedupes; **honour the `updateRequestAction` re-notify suppression**
  (matchAlerts.ts:166 uses a `previous` snapshot) so editing a post never re-blasts the region; stay
  best-effort/non-throwing; host email carries only first-name/region/dates/budget (no guest PII).

### 2e — field additions (parallel; land the migration EARLY so 2b's writer includes it)
- New migration: nullable `child_ages int[]`, `pets` (int/bool), `destination_flexible boolean` on
  `looking_for_posts`.
- `RequestForm.tsx`: child-ages array input when children>0; pets field; replace budget NumberFields with
  a **slider** + live "≈ R X/night · R Y total" (client compute from checkIn/checkOut); "I'm not sure
  where yet" toggle → `destination_flexible`, relaxes the location requirement. Thread through
  `RequestEditValues`/`BLANK_REQUEST` (57-107) + `buildPayload` (478-505).
- `actions.ts`: `CreateRequestInput` (16-41) + insert (137-168) + update (263-294) column lists.
- Display: `components/looking-for/RequestInfoCard.tsx` + public detail/board cards. Keep all fields
  nullable. Independent of 2a-2d.

### 2d — "N hosts preparing offers" (parallel; read-only)
- `…/[id]/record-data.ts` `loadRequestRecord`: count distinct `looking_for_post_unlocks.host_id` for the
  post with NO `looking_for_responses` yet → `preparingCount`.
- `…/[id]/RequestRecord.tsx`: render "N hosts preparing offers" in the header while quote_count is low.

### 2a — invert to post-first (public wizard + anonymous localStorage drafts)
- `looking-for/start/page.tsx`: repoint `postHref` + 3 CTAs to a public wizard route (recommend a new
  `apps/web/app/[locale]/looking-for/post/page.tsx` rendering `RequestForm`, keeping `/portal/**`
  authenticated) instead of `/signup/guest`.
- `RequestForm.tsx`: make `userId` optional (`string|null`, prop 172); when null, skip server-draft sync
  and drive submit through the 2b action instead of `createRequestAction`.
- `components/drafts/useAutosaveDraft.ts`: anonymous key (fixed `anon` segment, localKey 62-66) +
  short-circuit the server calls (saveFormDraftAction 151, beacon 224, unmount flush 256) → localStorage-only.
- **Refactor** `createRequestAction`'s insert+record+requirements core (actions.ts:117-224) into a shared
  `insertLookingForPost(admin, guestId, input)` reused by the authed action, 2b, and 2e columns.

### 2b — silent passwordless submit (LAST; depends on 2a)
- New `apps/web/lib/looking-for/createRequestPublic.ts` (plain server module, NOT a Server Action — mirror
  create-enquiry.ts:9-13 so errors surface) + route `apps/web/app/api/looking-for/publish/route.ts`. Flow:
  1. Zod validate (name, email, **consent boolean**, full payload). **Reject if consent false** (POPIA).
  2. `findOrCreateLeadIdentity` + on fresh lead stamp `terms_accepted_at`/`terms_version` (getConsentVersion).
  3. `insertLookingForPost(admin, guestId, input)` (the shared writer) + `notifyMatchingAlerts` (2c).
  4. If `isLead`, mint ONE magic-link → return `redirectTo=/auth/confirm?token_hash=…&type=magiclink&next=/portal/looking-for/{postId}`;
     else `/login?next=…`. Optionally interpose `/claim?next=…` to set a password.
- **Auth-minting risks (flag):** consent gates the INSERT not just the UI; magic-link TTL 24h single-use;
  never generate two links per email/request; reuse create-enquiry.ts honeypot (138) + per-email rate-limit
  (186-194); anti-enumeration (don't reveal existing email); post created server-side (client can't forge guest_id).

## Parallelization
- **2c, 2d, 2e are mutually independent** and independent of the funnel inversion → parallelizable now.
- **2a → 2b are sequential** (2b is the submit tail of the public wizard).
- The `insertLookingForPost` refactor is the shared dependency (2a-submit, 2b, 2e columns) — do it once, early.
- **Money/security:** no money in WS-2. The care items are POPIA consent-before-submit (2b) and
  duplicate-send/fan-out (2c) — keep those on a careful thread; 2d/2e are safe to fan out.

## Critical files
- `apps/web/lib/looking-for/matchAlerts.ts` (2c)
- `apps/web/app/[locale]/portal/looking-for/actions.ts` (extract insertLookingForPost; 2c call; 2e columns)
- `apps/web/app/[locale]/portal/looking-for/_components/RequestForm.tsx` (2a optional-userId; 2e fields)
- `apps/web/lib/enquiry/{create-enquiry.ts,lead-identity.ts}` (2b template)
- `apps/web/lib/looking-for/notifications-worker.ts` (2c digest suppression); `…/[id]/record-data.ts` (2d)
