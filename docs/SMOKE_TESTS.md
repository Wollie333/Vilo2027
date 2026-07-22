# Manual smoke tests — pre-launch

Automated checks (423 unit tests, typecheck, lint, build) all pass, and each
feature below was verified in isolation during development. **This list is for
the things automation cannot prove**: real money moving, real email arriving,
real cards being charged, and features interacting on a real device.

Work top to bottom. **Section 0 must be done first** — several tests below are
impossible until it is.

Test accounts: `host1@wielostarter.com` / `host2@wielostarter.com` /
`guest@wielostarter.com`, password `WieloStarter123!`.
Super admin: `wollie@manamarketing.co.za`.

---

## 0. Configuration blockers — DO THESE FIRST

These are not tests. They are settings only you can apply, and a large part of
the list below is untestable until they are done.

| # | What | Why it blocks |
|---|---|---|
| ~~0.1~~ | ~~cipher keys + backfill~~ **✅ DONE 2026-07-22** | All 3 cipher keys regenerated and matched across Doppler → Vercel → Supabase; `encrypt-secrets-backfill.mjs --apply` run. **0 plaintext secrets left** (`eft_banking_details` 3/3, `host_payment_gateways` 1/1, `affiliate_payout_methods` 1/1, platform Paystack + PayPal). Verified the webhook still decrypts. |
| ~~0.2~~ | ~~error monitoring~~ **✅ DONE** | `error_events` + `/admin/platform/errors`, built in-house. Config panel reads 27/27. |
| 0.3 | Replace the `founding-race-rules` legal doc with the attorney copy | It currently contains a test sentence, and it is **snapshotted and hashed into every partner's signature**. |
| 0.4 | Decide whether the Founding Race stays `status='active'` with both affiliates enrolled | It is live and publicly joinable the moment you deploy. |
| 0.5 | Remove the seeded demo properties from the live directory | Real guests should not see test listings. |
| 0.6 | **Create the mailboxes `hello@`, `privacy@` and `legal@` on `wielo.co.za`** (or point `NEXT_PUBLIC_CONTACT_EMAIL` / `NEXT_PUBLIC_PRIVACY_EMAIL` / `NEXT_PUBLIC_LEGAL_EMAIL` at whichever inbox you do have) | Every contact link in the app, the account-deletion screen and the published Privacy Notice now direct people to these addresses. **POPIA requires a working channel for data-subject requests** — if the mailbox does not exist, those requests bounce silently. The published notice also advertises `support@wielo.co.za`. |
| 0.7 | **Decide how to disclose that the database is in Frankfurt** | Verified via `supabase projects list`: the live project is in Central EU (Frankfurt) and the planned Cape Town migration was dropped. The published Privacy Notice §8 only says "some of our service providers may be located outside South Africa", which understates it — the primary store of all personal information is offshore. See "Cross-border transfers" below. |

---

## 0.5 GO-LIVE DAY — the last flips, deliberately deferred

Founder decision 2026-07-22: these stay **as they are** through the whole beta and
are flipped **immediately before opening to the public**. Everything runs on TEST
keys until then, on purpose — so nobody can be charged real money by accident
while we are still breaking things.

Do them **in this order**, and re-verify after each.

| # | Flip | Notes / trap |
|---|---|---|
| G1 | **Mailboxes** on `wielo.co.za` — `hello@`, `privacy@`, `legal@` | Longest lead time (DNS), so start this one FIRST even though it is listed here. DNS is on **Vercel** (`ns1/ns2.vercel-dns.com`) and there are currently **no MX records**. ⚠️ **A domain may have only ONE SPF record** — you already have Resend's for sending. Do not add a second; merge them into one line or mail silently starts landing in spam. |
| G2 | **Legal text** — cross-border (Frankfurt) disclosure, entity name, 2025/2026 date typo | ⚠️ `/privacy` and `/terms` render a **DATABASE document**, not the `.tsx`. Edit at **Admin → Platform → Settings → Legal**. Detail in 0.6 / 0.7 below. |
| G3 | **Paystack → live** | Business verification must be complete before Paystack issues live keys. Paste `sk_live_…` in **Admin → Payments**, then switch platform mode `test` → `live`. ⚠️ The key is **encrypted at rest**, so after saving, re-verify the `paystack-webhook` Edge Function can still decrypt it — the live key is a different value and the webhook is the ONLY settle path for card money. |
| G4 | **PayPal → live** | Same shape. Also needs a **new `PAYPAL_WEBHOOK_ID`**: webhook ids are environment-specific, so the sandbox one will not verify live events. Create the webhook on the Live app (URL `https://wielo.co.za/api/paypal-webhook`, the 6 events listed in the runbook), then set `paypal_recurring_enabled = true`. |

**Until G3/G4 happen, test keys stay active and that is the intended state.** Card
payments work end-to-end in test mode; nothing about the code changes on launch day,
only the stored credentials and the mode flag.

### Email — configured and sending ✅

Verified on production: Admin → Emails shows **"Email is configured — sending
as …"** and the queue reported 2 sent in the last 24 hours. Nothing to do.

Two notes:

- The queue also showed **1 failure in the last 24h**. Worth opening Admin →
  Emails and checking what it was before launch — one failure is noise, a
  pattern is not.
- **Local development has no email.** `apps/web/.env.local` has no
  `RESEND_API_KEY`, so nothing sends when running locally. That is a
  dev-environment gap, not a production one — but it means any email step in
  this list must be tested against the deployed site, not localhost.

### Cross-border transfers — needs your decision (POPIA s72)

The database, file storage and every backup live in **Frankfurt, Germany**. That
is lawful under POPIA s72, but it has to be *disclosed*, and right now the
published Privacy Notice is thin on it.

Three things to settle before launch, none of which an agent should decide:

1. **§8 wording.** The published text says only that "some of our service
   providers may be located outside South Africa." The stronger, accurate
   statement is that the primary store of all personal information is in the EU.
   The static fallback copy in `app/[locale]/privacy/page.tsx` §5 has already
   been rewritten this way — reuse it, but have the attorney sign it off. Edit
   the live text in Admin → Platform → Settings → Legal.
2. **The entity name.** The notice is signed "Wielo (Pty) Ltd" while the site
   footer says "Mana Marketing Pty(Ltd)". One of them is wrong.
3. **The effective date.** The notice reads "effective as of 8 July 2025" but was
   published 8 July **2026**. Probably a typo; it is the date the document claims
   legal force from, so it should be right.

---

## 1. Money — the highest-risk paths

Do these on the **live** site with **real cards** (small amounts), not test keys.
Paystack test card: `4084 0840 8408 4081`, CVV `408`, OTP `123456`.

- [ ] **1.1 Guest books and pays by card.** Full flow from a listing to payment.
      Confirm: booking appears in the host dashboard, the amount charged equals
      the amount shown, and the guest gets a confirmation email.
- [ ] **1.2 The price you see is the price you pay.** Before paying, note the
      total. Compare against the card statement. Any discrepancy is a stop-ship.
- [ ] **1.3 Guest books by EFT.** Confirm the guest sees bank details, the host
      can mark it received, and the booking then confirms.
- [ ] **1.4 Booking declines gracefully.** Use the decline card
      `4084 0800 0067 0037`, `07/27`, `787`. No booking should be created.
- [ ] **1.5 Host upgrades their plan mid-cycle.** *This is the bug fixed today —
      test it carefully.* Start an upgrade, reach the payment page, then
      **abandon it**. The host must still be on the OLD plan. Then do it again
      and pay: the new tier applies and the billing period is preserved (not
      reset to today).
- [ ] **1.6 Refund.** Approve a refund. Confirm the wording says the HOST sent
      the money (Wielo never holds booking funds) and that the guest is not told
      they were paid by Wielo.
- [ ] **1.7 Affiliate commission.** With a partner link, complete a referral that
      pays. Confirm commission accrues to the right partner at the right rate.

---

## 2. Accounts and security

- [ ] **2.1 Guest signup.** New email → account created → confirmation email
      arrives → clicking it marks you verified.
- [ ] **2.2 Host signup** through the full wizard.
- [ ] **2.3 Password change requires the current password.** *Fixed today.* Try a
      wrong current password — it must refuse, and your old password must still
      work afterwards. Then change it properly.
- [ ] **2.4 Magic-link (passwordless) user changes password.** Should be refused
      and emailed a set-password link instead.
- [ ] **2.5 Email change** asks for the current password and confirms via the new
      inbox.
- [ ] **2.6 Turn on 2FA.** Settings → Two-factor. Scan with a real authenticator
      app (Google Authenticator / 1Password). **Save the recovery codes.**
- [ ] **2.7 Sign out and back in with 2FA on.** You must be asked for a code —
      **including after a magic-link sign-in**, not just a password one.
- [ ] **2.8 Wrong 2FA code is refused** and does not let you reach the dashboard.
- [ ] **2.9 Recovery code works** and — as the screen warns — switches 2FA OFF.
      Re-enable it afterwards.
- [ ] **2.10 Turning 2FA off requires your password.**
- [ ] **2.11 Forgot password** end to end, via the emailed link.

---

## 3. Affiliate / Founding Race

> Test these on the DEPLOYED site — self-activation needs a real confirmation
> email, and localhost sends none.

- [ ] **3.1 Partner signs up via a campaign URL** —
      `/signup/partner/founding-race`. Account is created and lands on the
      "finishing setup" checklist, not a dead end.
- [ ] **3.2 Photo upload** during signup shows on the partner page afterwards.
- [ ] **3.3 Self-activation.** Confirm the email → partner becomes Active and is
      enrolled in the race automatically. **This is the main path a real partner
      takes — test it before anything else in this section.**
- [ ] **3.4 Admin activation.** Admin → Affiliates → the pending partner shows
      "awaiting setup" with an **Activate** button. Click it. They become active.
- [ ] **3.5 Existing email cannot be hijacked.** Sign up as a partner using an
      email that already has an account. You must be sent to sign in — never
      logged straight in.
- [ ] **3.6 Competition capacity.** With `max_participants` set, confirm the
      signup page shows places left and that a full race says so.
- [ ] **3.7 Leaderboard** at `/competitions/founding-race` shows real standings,
      and the partner view highlights "You".
- [ ] **3.8 Referral link** `/r/<slug>` attributes a signup to the right partner.

---

## 4. Search, home and discovery

- [ ] **4.1 Home page on a real phone.** Not the simulator — an actual device on
      mobile data. Check nothing overflows sideways and it loads quickly.
- [ ] **4.2 Hero search** with a place and guest count lands on `/explore` with
      matching results.
- [ ] **4.3 Filter sheet on mobile.** Open Filters, set several, confirm the
      "Show N stays" count matches what you actually get after applying.
- [ ] **4.4 Filters survive a Search press.** Set filters, then press Search —
      they must NOT be wiped. *(This was broken and is now fixed.)*
- [ ] **4.5 Share a filtered URL.** Paste it into WhatsApp, open on another
      device: the same results, with the sheet pre-filled.
- [ ] **4.6 Back button** returns to the previous filter state.
- [ ] **4.7 Default ordering is sensible.** "Best match" should put complete,
      well-reviewed, responsive listings first — not random ones.
- [ ] **4.8 Deals card on the home page** shows a real current deal, and its
      button goes to `/deals` where that same deal is listed.
- [ ] **4.9 Unpublish every deal** → the home card falls back to the generic one
      rather than showing a hole. Re-publish afterwards.

---

## 5. Host operations

- [ ] **5.1 Create a listing** end to end, publish it, and find it in `/explore`.
- [ ] **5.2 Photos upload** and appear in the right order.
- [ ] **5.3 Calendar** blocks a date and that date becomes unbookable.
- [ ] **5.4 iCal sync** — import a feed from Airbnb/Booking.com and confirm the
      dates block out.
- [ ] **5.5 Booking request → accept → guest notified.**
- [ ] **5.6 Guest ↔ host messaging** in both directions.
- [ ] **5.7 Create a special/deal** and see it on `/deals`.
- [ ] **5.8 Payout details** save and display masked.

---

## 6. Admin

- [ ] **6.1 Only staff can reach `/admin`.** Sign in as a normal guest and try —
      you must be refused.
- [ ] **6.2 `/dev/search`, `/style-lab`, `/builder-preview` return 404** when
      signed out **on the live site**. *(Verified in a production-mode run
      locally; confirm on the real deployment.)*
- [ ] **6.3 `wielo.co.za/robots.txt`** loads and disallows `/admin`, `/invoice`,
      `/receipt`.
- [ ] **6.4 Campaign builder** — create a campaign, confirm both its public link
      and its partner signup link appear, and that Copy gives a full URL.
- [ ] **6.5 Admin audit log** records a manual affiliate activation, including
      which gates were bypassed.

---

## 7. Cross-cutting — do these on a real phone

~95% of your bookings will be mobile. Desktop-only testing will miss the failures
that matter.

- [ ] **7.1 Complete an entire booking on a phone**, on mobile data, start to
      finish.
- [ ] **7.2 Complete partner signup on a phone.**
- [ ] **7.3 Load the site on a slow connection** (throttle to 3G). Does anything
      look broken while loading?
- [ ] **7.4 Safari on iPhone** specifically — it breaks things Chrome does not.
- [ ] **7.5 Every transactional email** you receive: check it renders on a phone,
      the links work, and the sender is your domain (not `resend.dev`).

---

## Known limitations at launch

- **PayPal recurring is deliberately OFF.** PayPal has no merchant-initiated
  charge, so subscription renewals arrive only as webhooks, and `PAYPAL_WEBHOOK_ID`
  is unset. Leave it off until the webhook is registered.
- **Admin MFA is not enforced.** 2FA is available and optional for everyone,
  including staff. The AAL2 gate exists but is deliberately not switched on —
  turning it on makes 2FA mandatory for staff and risks locking you out of the
  admin panel. Enrol and save your recovery codes first.
- **Place autocomplete is restricted to South Africa** (`lib/geo/google.ts`), even
  though the directory copy is now multi-country aware.
- **Country names are not localised** — `/af` reads "· South Africa".
