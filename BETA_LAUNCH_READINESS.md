# Wielo — Beta Launch Readiness Standard

> **Purpose.** The single, testable go/no-go standard for letting **real beta
> hosts + guests** into the system. Supersedes `MVP_READINESS_AND_AUDIT_BACKLOG.md`
> (2026-07-13 save point) — folds it forward against the code as of **2026-07-18
> (HEAD `5de7286c`)**.
>
> **"Beta-ready" means:** a real host can sign up → publish → get bookings, and a
> real guest can find → book → **pay for real** → get confirmed, with the host
> paid and the money correct — end-to-end, proven live, no dead ends.
>
> **Status legend:** ✅ verified live · 🟢 built + verified this cycle · 🟡 built,
> NOT yet driven live end-to-end · 🔴 **BLOCKS beta** · 👤 founder action/config ·
> 🕑 deferred (safe to ship after beta starts).
>
> **How to use this as a standard:** each 🔴/🟡 line is a test to run. A line is
> only allowed to flip to ✅ with **real evidence** (a screenshot, a ledger row, a
> DB assertion) — never "should work" (Principle #9).

---

## 🚦 Go / No-Go — where we are right now

**The platform is functionally complete and hardened.** Onboarding, listings,
the booking flow, the money/ledger layer, subscriptions, notifications, admin
moderation and security have all been built and (mostly) verified live over the
pt13–pt21 cycle.

**✅ THE GATE IS CLEARED (2026-07-20, pt30).** Both payment rails were driven
guest→pay→confirm→capture→invoice→email end-to-end on the LIVE deployment with
sandbox money:
- **Paystack** — BK-0082, R16 900: webhook confirmed in ~28s → `payments` completed
  (ref `lex3zsubud`) → INV-0108 `paid` → `booking_confirmed_guest` + `booking_request_host` sent.
- **PayPal** — BK-0083, R18 000: captured (ref `1L0620393P289814W`) → confirmed → INV-0109
  `paid` → emails sent. The ~4.5-min create→capture gap confirms the
  **`booking-reconcile-worker` recovery arm** also works.
- **EFT** already proven. So **all three payment methods are green.**

**Verdict: the #1 blocker is gone.** Remaining is founder config (confirm the
cipher-key encryption on the next banking save) + optional polish; safe to open beta.

---

## 🔴 THE GATE — must be true before any beta user pays (do these first)

- [x] ✅ **Paystack card round-trip, live (sandbox)** — **PROVEN 2026-07-20**: BK-0082
  R16 900, webhook → confirmed ~28s → `payments` completed (ref `lex3zsubud`) → INV-0108
  `paid` → guest+host emails sent.
- [x] ✅ **PayPal order round-trip, live (sandbox)** — **PROVEN 2026-07-20**: BK-0083
  R18 000 → captured (ref `1L0620393P289814W`) → confirmed → INV-0109 `paid` → emails
  sent; ~4.5-min create→capture gap = `booking-reconcile-worker` recovery arm confirmed.
- [x] ✅ **Manual EFT round-trip** — guest gets instructions → host "mark received" →
  ledger + confirmation. (Proven.)
- [x] ✅ **Deposit + balance split** — proven live via the quote path (Q-0020 → BK-0081:
  deposit R5 400 / balance R5 400; pay page split correct; convert→invoice on confirm).

---

## 1. Host can get in & set up  (the supply side)

- [x] ✅ Sign up as host (guest→host upgrade model) — honeypot + HIBP + rate-limit + email-verify
- [ ] 👤 Turnstile CAPTCHA — **keys not set**; honeypot covers the gap for beta (`TURNSTILE_SECRET_KEY` + site key to fully enable)
- [x] ✅ Onboarding wizard (8 steps incl. seasons) → `docs/lifecycles/onboarding.md`
- [x] ✅ Create + publish a listing (rooms, photos, amenities, pricing, seasonal)
- [x] ✅ Be on a plan — 4 hosts on active **Beta** subs (`4bff856d`, full-open except website)
- [ ] 🟡 Host banking / EFT details — built + encrypted; **confirm `PAYMENT_CIPHER_KEY` is set in prod** 👤
- [ ] 🟡 Host connects their **own** payment gateway — flow exists, `wollie@` did it in test-mode; needs one *other* real host to connect their own keys end-to-end
- [x] 🟢 Host settings: business/VAT, brand — audited

## 2. Guest can find → book → pay  (the core loop)

- [x] 🟢 Directory / search / listing detail — now correctly **hides hidden/suspended hosts** (RLS)
- [x] ✅ Booking form — dates, guests, add-ons, coupons, **server-side re-price** (client never trusted)
- [ ] 🔴 **Card / PayPal payment** — see THE GATE above
- [x] ✅ EFT payment + instructions email
- [x] 🟢 Quote → booking, marketplace deals, website specials — all gated + funnel through one persist path
- [x] 🟢 Confirmation emails — pipeline live (all Vault secrets set, RESEND set, queue draining: 0 pending)

## 3. Host manages the booking

- [x] ✅ Booking board: accept / decline / cancel / no-show / check-in / out
- [x] ✅ Calendar block on confirm; policy snapshot frozen at booking
- [x] ✅ Settlement / "closed & handled"; refunds + credit notes; forfeiture (no-show)
- [x] ✅ iCal / OTA sync both directions — 🟡 *unproven with a real OTA round-trip* (do one during beta)

## 4. Money & finance  (deeply audited — pt13 sweep + pt20 both-gateway hardening)

- [x] ✅ Ledger SSOT (host + Wielo agree), VAT net→gross, documents (INV/RPT/REF/CN/…)
- [x] ✅ Refunds/credit notes reconciled to real cash; cancellation & forfeiture accounting (SARS-correct)
- [x] 🟢 Both-gateway money-correctness (Paystack replay-ref hole closed; PayPal reconcile/recovery; no duplicate service subs)
- [x] ✅ Probe: `scripts/verify-financial-sweep.mjs` · `docs/lifecycles/payments-ledger.md`

## 5. Subscriptions lifecycle  (pt21 — this cycle)

- [x] 🟢 Failure = **disable + retain all data** (never delete); free-floor features
- [x] 🟢 Dunning: `active→past_due→restricted`, grace guard, ledger + history correctness
- [x] 🟢 Notifications to host **and** admin (renewal-upcoming / failed / restricted) — proven live
- [x] 🟢 Booking-intake gate + Hide/Suspend admin controls (`/suspended` wall) — proven live
- [ ] 🟡 Self-serve upgrade **proration** — charges full price today (no `membershipSwitchAmount`)
- [ ] 🕑 **PayPal recurring subs have NO webhook** → PayPal renewal failures invisible. *For beta (comped Beta plan) this is low-risk; needed before paid billing goes live.*

## 6. Notifications & comms

- [x] ✅ In-app notifications (registry + dispatch, dedupe, quiet hours)
- [x] 🟢 Email — pipeline verified live this session
- [ ] 🕑 Push — infra fully wired (routes deployed + 401-gated, cron active, queue empty) but
  **N/A for a web beta**: push targets the Expo mobile app, which is unbuilt (0 screens). Defer with mobile.
- [x] ✅ Inbox: guest↔host + guest↔Wielo support; new-message notifications

## 7. Security  (Principle #15 — hardened across pt17–pt21)

- [x] ✅ No IDOR (17 analytics fns + `_can_read_host` COALESCE fix); ownership server-side
- [x] ✅ RLS anti-forgery (inbox split policies); injection defenses (`sanitizeSearch`/`sanitizeCssValue`)
- [x] ✅ `search_path` pinned (red flags 82→10); `anon`-executable functions locked (PUBLIC revoked)
- [x] ✅ Webhook signatures verified before any write (Paystack HMAC / PayPal)
- [x] ✅ **CSP** shipped (pt30) — enforced safe-subset (`base-uri`/`object-src`/`frame-ancestors`)
  + full Report-Only allowlist; validated locally. Flip report-only→enforce post-beta (`docs/BETA_INFRA.md`).
- [ ] 👤 **Run `SECURITY_CHECKLIST.md` top-to-bottom** as the final pre-beta gate

## 8. Admin & moderation

- [x] ✅ 20 admin tabs (users, listings, payments, ledger, subscriptions, audit, data-requests…)
- [x] 🟢 Hide host from public / Suspend (hidden + blocked) — header icon controls, proven live
- [x] ✅ Report listings/deals/users; support inbox

## 9. Legal & compliance

- [x] ✅ `/privacy` + `/terms` pages (footer no longer 404s)
- [ ] 🟡 **T&C text-freeze (G8/G9)** — freeze accepted-terms *text*; split host-legal vs Wielo-terms at checkout
- [x] ✅ GDPR/POPIA erasure path fixed & proven — 🟡 *reframe in progress: anonymize third-party host records instead of deleting them (founder's disable-not-delete principle)*
- [ ] 🟡 Cookie-consent banner

## 10. Ops / config  (pre-beta)

- [x] 🟢 **All 15 Vault worker secrets set** (email/push/digest/reconcile/LF/reviews/domains/blog) — this session
- [x] 🟢 `paystack-webhook` + `external-reviews-sync` Edge Functions deployed
- [x] ✅ Prod secrets (pt30): payment keys confirmed set; `BANKING_CIPHER_KEY` +
  `PAYMENT_CIPHER_KEY` + `ICAL_TOKEN_SECRET` generated + set (Vercel + Supabase-Edge for
  banking) + redeployed. **iCal confirmed live** (401 not 503); **banking encryption
  confirmed** (re-saved EFT row now `v1.`-prefixed). See `docs/BETA_INFRA.md`.
- [ ] 👤 **Pre-beta data hygiene** — prune MVP-*/fixture bookings + stale artifacts, OR keep as demo content (founder call)
- [ ] 🕑 Sentry + PostHog — deferred by design until the week before *public* launch

---

## What I'd do next (shortest path to beta)

1. 🔴 **Prove the card + PayPal round-trips live** (you enter the sandbox cards; I verify each loop). This is the whole ballgame.
2. 👤 Decide fixture data: wipe vs keep as demo content.
3. 🟡 Quick live passes on the unverified-but-built items (deposit/balance split, one push, one OTA sync) — can overlap with early beta.
4. 👤 Run `SECURITY_CHECKLIST.md` as the final gate.
5. Everything under 🕑 (CSP, Sentry/PostHog, PayPal recurring webhook, proration) is **safe to finish while beta hosts are already testing.**

> Update this file as lines flip. A line flips to ✅ only with real evidence.
