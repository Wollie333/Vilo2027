# Mobile Signup Wizard — flow, data, and setup-wizard handoff

**Branch:** `mobile-signup-wizard`
**Route:** `apps/web/app/[locale]/signup/host/` (replaced the old desktop-first wizard; mobile-first, works on desktop too)
**Status:** built + live-verified end-to-end (real mint → host + business + trialing subscription created; see “Verification” below).

This document exists so the **`/dashboard/setup` “finish setup” wizard can be updated
later** to fit the data signup now captures (and to pick up the one thing signup
deliberately drops — the **business address**). Nothing in `/dashboard/setup` was
changed in this branch. See “Setup-wizard handoff” at the bottom — that is the
actionable part for the follow-up task.

---

## 1. The flow — 5 mobile-first steps (one decision per screen)

```
Account (mints the account) → Contact → Profile → Toolkit → Welcome
```

Re-sequenced from the old flow (`account → about → listing → plan → welcome`).
The two structural changes:

1. **`about` split into `Contact` + `Profile`** — one decision per screen.
2. **`listing` step removed entirely** — the host no longer captures a listing name,
   property type, or **business address** during signup. That moves to `/dashboard/setup`.

Deliberately **excluded** from signup (vs the old flow / the design mock):
- Listing name + property type/category.
- **Business trading name + full address** (street/city/province/postal/lat-long).
- OAuth (Google/Apple) — **not wired anywhere in the codebase** (`signInWithOAuth` = 0
  matches). The mock showed these buttons; they were omitted rather than shipped as dead
  controls. Adding real OAuth is a separate feature (Supabase provider creds + callback
  route + passwordless-account handling that interacts with the step-1 mint/collision flow).

### Account creation point
- The **account is minted on step 1** (`createAccountAction`), the moment the single
  consent checkbox is ticked — same as the old flow. This keeps duplicate-email
  detection instant (anti-enumeration collision email) and is the only point at which
  an email/password user can be created (Supabase needs the password, which lives on
  step 1).
- Steps 2–4 are pure client state until the **Toolkit** step fires
  `finalizeOnboardingAction`, which promotes guest→host and creates the host row,
  enriches the default business, and creates the subscription.

---

## 2. What each step captures and writes

| Step | UI captures | Written by | DB effect |
|---|---|---|---|
| **1. Account** | name, surname, email, password (+confirm), **referral (partner code, full live-resolve + cookie precedence + bind)**, **one consent checkbox (ToS + Privacy + POPIA)** | `createAccountAction` | `auth.users` insert (email_confirm), `user_profiles` update (`full_name`, `terms_accepted_at`, `terms_version`), affiliate bind (`affiliate_referrals`), pipeline lead card (stage “New”), verification email (best-effort) |
| **2. Contact** | phone (+dial code), country, **payout/settlement currency** | client state → finalize | (persisted at finalize) |
| **3. Profile** | avatar photo (uploaded immediately to `avatars` bucket), short bio, languages — **all optional** | `uploadHostAvatarAction` (photo, immediate) + finalize (bio/languages/avatar_url) | photo → Storage on upload; rest at finalize |
| **4. Toolkit** | subscription product from the **live catalog** (currently Standard R999 / Starter R499 — both trial products), monthly/annual, promo code | `finalizeOnboardingAction` (+ `startSignupCheckoutAction` for no-trial paid) | see below |
| **5. Welcome** | — | — | receipt only |

### `finalizeOnboardingAction` writes (unchanged except the address handling)
1. `user_profiles` update: `full_name, phone, country, bio, languages, avatar_url, role:'host'`.
2. `hosts` insert: `display_name, default_currency (settlement), bio, languages_spoken, avatar_url`.
   Triggers fire: `trigger_host_handle`, `on_host_created_default_business` (creates the
   default `businesses` row), `on_host_created` (advances pipeline card to “Signed up”).
3. `businesses` update (default business): `trading_name` (= business_name or full_name),
   `country (iso)`, `default_currency`, **address fields = null** (blank — see §3).
4. Subscription: trialing (product trial / competition trial) or active Free/paid.
   A no-trial paid pick then hands off to Paystack via `startSignupCheckoutAction`.

---

## 3. The dropped business address (the important handoff)

The old `listing` step captured the business **address** and wrote it into the default
`businesses` row. The mobile wizard drops that step, so **the default business is created
with a blank address** and setup fills it in later.

**Backend changes made to allow this (this branch):**
- `schemas.ts` → `finalizeOnboardingSchema`: `listing_name`, `category_id`, `address_line1`,
  `city`, `region`, `postal_code` changed from **required → optional**; the
  `.refine(category_id required)` was removed. (If they had stayed required, finalize would
  reject the payload and **no host would ever be created** — a silent-failure trap.)
- `actions.ts` → `finalizeOnboardingAction`: the `businesses` update now writes address
  fields via a `blankToNull()` helper, so blank/absent values become `null` instead of
  empty strings.
- **Safe because** `businesses.address_line1 / city / province / postal_code` are all
  **nullable** (`docs/SCHEMA.md`), and `country` defaults to `'ZA'`. No migration.

**Verified:** a live test signup produced a default business with
`address_line1 = null, city = null, postal_code = null, country = 'ZA'` — no NOT NULL
violation, host + trialing subscription created normally.

---

## 4. Verification (live, this branch)

Ran the full wizard logged-out with a throwaway account
(`mobilewiz.test1@wielostarter.com`):
- All 5 steps rendered; console clean (only a benign `RedirectErrorBoundary` from the
  sign-out navigation used to reach a logged-out state).
- Step 1 mint succeeded → advanced to Contact.
- Toolkit rendered the **live catalog** (Standard R999 14-day trial, Starter R499 30-day
  trial) — confirming the mock’s Free/Basic/Pro/Business tiers are display-only and not
  what ships.
- Selecting Standard → finalize created: `user_profiles.role = host`, a `hosts` row,
  a default `businesses` row with **blank address**, and a **trialing** `subscriptions`
  row (product_id + trial_ends_at set, plan `pro`).
- `pnpm`-level: `tsc --noEmit` clean (exit 0), `eslint` on the changed files clean (exit 0).

> ⚠️ **Test data:** the throwaway host `mobilewiz.test1@wielostarter.com`
> (host_id `99936250-f6b4-40b4-91bc-7afe86347405`) is a real row in the linked DB. Left
> in place so it can be used to inspect the setup-wizard handoff (a host with a blank-address
> business). Soft-delete it when no longer needed.

---

## 5. Setup-wizard handoff — TODO for `/dashboard/setup` (later task)

`/dashboard/setup` (`SetupWizard.tsx`, sections: Profile, Business, Banking, Listing,
Rooms, Seasonal, Policies, Review) is the “finish setup” flow for a host’s first login.
After this branch it must be updated so it **doesn’t re-ask what signup already captured**
and **does capture the business address signup no longer collects**.

What signup now already provides (setup should pre-fill / mark done, not re-ask):
- **Profile:** photo, bio, languages, phone, country, settlement currency, full name.
  (The dashboard “Get set up” checklist currently lists “Complete your host profile —
  Profile photo, short bio, languages” as a to-do; that overlaps signup’s Profile step —
  pre-fill from `user_profiles` / `hosts` and only prompt for what’s still blank.)

What signup now leaves for setup to capture (the gap to fill):
- **Business:** the default business exists but has a **blank address**
  (`address_line1/city/province/postal_code = null`). The setup **Business** step must
  capture and save the address (and optionally a distinct trading name — currently it
  defaults to the host’s full name).
- **Listing:** name, property type/category, photos, pricing, rooms, policies — all still
  captured in setup (never created at signup).

Suggested approach for the later task:
1. In the setup **Business** step, treat a null-address default business as “needs
   address” and require it before publish (it feeds invoices/quotes).
2. Make the setup **Profile** step pre-populate from `user_profiles`/`hosts` and collapse
   to a “✓ done, edit if needed” state when signup already filled it.
3. Re-check the dashboard “Get set up” checklist / `computeSetupCompletion`
   (`@/lib/setup/completion`) so “Complete your host profile” reads as done when signup
   captured photo/bio/languages, and add an explicit “Add your business address” item.

No code in `/dashboard/setup` was touched in this branch — this section is the spec for
that follow-up.
