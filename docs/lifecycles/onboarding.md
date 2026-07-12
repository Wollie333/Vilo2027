# Onboarding lifecycle (host signup → setup wizard → publish)

> How a new host goes from account creation to a live, bookable listing. See
> `BUSINESS_PRINCIPLES.md` Principle #12. Status: 🟢 wizard + publish gate +
> completion email driven live end-to-end on the test host (2026-07-12).

The onboarding surface is **two** flows that must not be confused:

- **Signup** (`/signup/host`) — account + business + draft listing + subscription.
- **Setup wizard** (`/dashboard/setup`) — the 8-step "finish setting up" flow that
  turns the draft into a published listing. **This doc is mostly the wizard.**

Until every required setup step is done, `/dashboard` renders ONLY the
`OnboardingDashboard` checklist (the full dashboard is hidden) —
`app/[locale]/dashboard/page.tsx` (`setupComplete`), checklist rows from
`_components/setupSteps.ts`, each deep-linking `/dashboard/setup?step=<key>`.

---

### Step 1 — Sign up + pay
- Trigger: guest submits `/signup/host`. Actor: guest.
- Functions/files: `app/[locale]/signup/host/actions.ts` —
  `finalizeOnboardingAction` (creates `user_profiles` role=host, `hosts`,
  default `businesses`, a **draft** `properties` row, a `subscriptions` row),
  `startSignupCheckoutAction` → Paystack.
- DB writes: `user_profiles`, `hosts`, `businesses`, `properties` (draft),
  `subscriptions`. Trigger `trg_seed_host_policies` (AFTER INSERT on `hosts`)
  seeds the **four** default policies (see Step 6).
- Side-effects: verification email (`sendVerificationEmail`,
  `lib/auth/verifyEmail.ts`) → stamps `user_profiles.email_verified_at` when the
  link is clicked. No server redirect — the user lands on `/dashboard`.
- Next: → Step 2 (checklist → wizard).

### Step 2 — Enter the wizard
- Trigger: host clicks "Finish setting up". Actor: host.
- Functions/files: `app/[locale]/dashboard/setup/page.tsx` (server load) →
  `SetupWizard.tsx` (client shell). Completion is computed live by
  `lib/setup/completion.ts::computeSetupCompletion` (no `onboarding_completed`
  column — `properties.is_published`/`published_at` are the only persisted
  "done" signal).
- The wizard has **8 sections** (`SECTIONS` in `SetupWizard.tsx`): profile,
  business, banking, listing, rooms, **seasonal (optional)**, policies, review.
- Next: → Steps 3–8 in order (deep-linkable via `?step=`).

### Step 3–5 — Profile · Business · Banking · Listing
- Profile (`StepProfile`) → `hosts` bio/avatar/languages. Business
  (`StepBusiness`) → default `businesses` name. Banking (`StepBanking`) →
  `eft_banking_details`. Listing (`StepListing`) → `properties` fields +
  `property_photos` + `property_amenities`.
- Each is a `computeSetupCompletion` predicate; all are required to publish.

### Step 6 — Rooms & pricing
- Trigger: host adds rooms. Actor: host. File: `steps/StepRooms.tsx` +
  `RoomEditorSheet.tsx` → `RoomDetailsForm.tsx`.
- Each room card surfaces its **pricing model** badge (`per_room` /
  `per_person` / `per_room_plus_extra`) and a **model-aware price** (per-person
  rooms show `/ person / night`; `per_room_plus_extra` shows the extra-guest
  fee). The model flows into the price engine via `occupancyNightly`
  (`lib/pricing/occupancy.ts`).
- **Delete** a room: `handleDelete` → `modal.destructive` →
  `deleteRoomAction` (soft-delete `deleted_at`, refuses if an active
  `booking_rooms` references the room; re-derives listing price via
  `recomputeListingFromRooms`).
- DB writes: `property_rooms`, `property_photos`. Listing `base_price` /
  `max_guests` are DERIVED (cheapest active room = the "from" price).

### Step 7 — Seasonal pricing (optional)
- Trigger: host opens the Seasons step. Actor: host. File:
  `steps/StepSeasonal.tsx` — embeds the canonical
  `dashboard/seasonal-pricing/SeasonalPricingManager` (`embedded` prop hides the
  page heading), scoped to the one listing.
- DB writes: `property_seasonal_pricing` (label, date range, `adjustment_type`
  absolute|percent, `adjustment_value`, room scope, priority, min_nights).
- **These rules flow through the whole booking price engine** — see
  `pricing-seasonal.md`. This step never gates publishing.

### Step 8a — Policies & house rules
- Trigger: host reviews policies. Actor: host. File: `steps/StepPolicies.tsx`
  (four `PolicyPicker`s: cancellation, check_in_out, house_rules, booking_terms).
- **Every host starts with an active default of ALL FOUR types.** The
  host-create trigger `seed_host_policies_on_create` calls
  `ensure_host_policy_presets` + `ensure_host_booking_terms` +
  `ensure_host_default_policies`. The wizard's `page.tsx` then calls
  `ensure_listing_policy_assignments(listing)` which writes an explicit
  listing-wide `property_policies` row per type pointing at the host default —
  so each picker opens on a selected, active-by-default policy the host can keep
  or replace. (Migration `20260712170000`.)
- Gate: cancellation + house_rules must be assigned to continue (auto-satisfied
  by the defaults). booking_terms + check_in_out are also assigned by default.

### Step 8b — Preview & publish
- Trigger: host clicks "Publish listing". Actor: host. Files:
  `SetupWizard.publish()` → `properties/[id]/edit/actions.ts::togglePublishAction`.
- **Publish gates (all enforced server-side, no surface can bypass):**
  1. Ownership.
  2. **Plan/feature** — `hostHasFeature(host, "directory_listing")` (the
     `check_feature_permission` path; open pre-MVP per AGENT_RULES §3.4).
  3. **Email verified** — `user_profiles.email_verified_at` must be set, else
     "Verify your email address before publishing." (The same gate guards the
     website channel, `setWebsiteChannelAction` → `website_builder`.)
  4. Minimum fields (name, base_price, max_guests) + a valid default EFT account.
  5. Full setup completion (`computeSetupCompletion` re-checked server-side).
- DB writes: `properties.is_published=true`, `published_at`, unique `slug`.
- Side-effects: revalidate `/property/<slug>`; **on the FIRST publish**
  (`published_at` was null) → `dispatchEvent("listing_published_host")` →
  Step 9.
- Next: confetti + `PublishedModal` (live link) → Step 9 email.

### Step 9 — Onboarding-complete email
- Trigger: first successful publish. Actor: system.
- Functions/files: `dispatchEvent` (`lib/notifications/dispatch.ts`) inserts a
  `notification_queue` row (`type='listing_published_host'`); `lib/email/drain.ts`
  hydrates via `resolvers/misc.ts::listingPublishedHostResolver` (loads listing
  name, slug→public URL, `from` price, city/province, active room count + host
  first name), renders `emails/templates/ListingPublishedHost.tsx`, sends via
  Resend. Registry: `lib/email/registry.ts` + `lib/notifications/registry.ts` +
  `notification_events` seed (migration `20260712170000`).
- Side-effects: email(`listing_published_host`) with a listing summary + the
  public link; in-app "Your listing is live 🎉" card.
- Next: host shares the link; guests can now book → see `booking.md`.

---

## Verified (2026-07-12, test host `host@wielotest.com`)

- Wizard = 8 steps incl. the Seasons step (canvas).
- Room cards show the pricing-model badge; delete works (Klein Cottage removed)
  and correctly refuses a room with active bookings (Milkyway, 3 refs).
- All four policy pickers open on an active default incl. Booking terms.
- Publish blocked while `email_verified_at` was null (toast seen; DB stayed
  unpublished); after verifying, publish succeeded and the
  `listing_published_host` email enqueued + rendered with summary + link.
