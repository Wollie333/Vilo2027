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
| 0.1 | Set `RESEND_API_KEY` + `EMAIL_FROM_ADDRESS` (verified domain in Resend) | **No email is being sent at all.** Every test involving a link in an inbox fails. Partner self-activation is impossible. |
| 0.2 | `openssl rand -base64 32` → set `PAYMENT_CIPHER_KEY` and `BANKING_CIPHER_KEY` in Vercel, then run `node scripts/encrypt-secrets-backfill.mjs --apply` | 6 real secrets — including a host's live gateway key and 3 bank account numbers — are stored in plain text. Setting the keys alone does NOT fix existing rows. |
| 0.3 | Decide on error monitoring | Nothing reports runtime errors in production. You will not know a launch-day failure happened. |
| 0.4 | Replace the `founding-race-rules` legal doc with the attorney copy | It currently contains a test sentence, and it is **snapshotted and hashed into every partner's signature**. |
| 0.5 | Decide whether the Founding Race stays `status='active'` with both affiliates enrolled | It is live and publicly joinable the moment you deploy. |
| 0.6 | Remove the seeded demo properties from the live directory | Real guests should not see test listings. |

**Verify 0.1 worked:** Admin → Emails. The red "Email is not reaching customers"
banner must be gone and show your real sender.

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

> ⚠️ Until 0.1 is done, a partner **cannot self-activate** — email confirmation
> is one of the required gates. Admin activation is the only working path.

- [ ] **3.1 Partner signs up via a campaign URL** —
      `/signup/partner/founding-race`. Account is created and lands on the
      "finishing setup" checklist, not a dead end.
- [ ] **3.2 Photo upload** during signup shows on the partner page afterwards.
- [ ] **3.3 Self-activation.** Confirm the email → partner becomes Active and is
      enrolled in the race automatically. *(Blocked by 0.1.)*
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
