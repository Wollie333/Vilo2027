# Feature lifecycle flows

> **Standard:** every feature on the platform has a detailed, living lifecycle
> flow here — see **`BUSINESS_PRINCIPLES.md` → Principle #12**. Each flow models
> the real-world sequence of what happens, step by step, and every step names the
> exact functions/files, DB writes, and side-effects (notifications, calendar,
> ledger, emails, status transitions). Open the relevant flow *before* changing a
> feature; update it in the same change when you add/re-order/fix a stage.

## How to read a flow

Each step follows this skeleton:

```
### Step N — <what happens, in real-world terms>
- Trigger: <what starts this step> · Actor: guest | host | system(cron/webhook)
- Functions/files: <file:function(s) that run>
- Logic: <the decision/branch, in one or two lines>
- DB writes: <tables + key columns>
- Side-effects: notification(<kind>, channels) · email(<template>) · inbox card ·
  calendar(blocked_dates …) · ledger(<row type>) · status(<from → to>)
- Next: → Step N+1 (and branches)
```

Steps documented but **not yet verified live** are marked `⚠️ not verified`.

## Index

| Feature | Doc | Status |
|---|---|---|
| Onboarding (signup → setup wizard → publish → welcome email) | `onboarding.md` | 🟢 wizard + publish gate + completion email driven live |
| Seasonal pricing (rule → per-night booking price) | `pricing-seasonal.md` | 🟢 guest estimate + server-frozen breakdowns verified live |
| Booking (create → pay → confirm → stay → checkout → review) | `booking.md` | 🟢 EFT path driven live end-to-end; card/PayPal branches noted |
| Payments & ledger (charges, receipts, invoices, credit notes, refunds) | `payments-ledger.md` | 🟡 VAT + settlement/invoice paths done; refunds/credit-notes TBD |
| Statement of account (period → HMAC-signed PDF) | `statement.md` | 🟢 |
| Quotes (request → build → send → accept → convert to booking) | `quotes.md` | 🟢 deep audit 2026-07-13; expire-cron + pay hand-off fixed; host paths verified live |
| Looking-For (guest request → host board → unlock → quote → fulfil) | `looking-for.md` | 🟢 deep audit; lead locking + credit metering live |
| Subscriptions (guest tier → membership → renew → change → pause → cancel) | `subscriptions.md` | 🟢 one-membership rule enforced + rehearsed live (`20260716240000`); renewal/scheduled-change crons ⚠️ not verified |
| Recurring billing (first charge → auto-renew → upgrade proration → dunning → reconcile) | `recurring-billing.md` | 🟡 hybrid engine built (Paystack saved-auth + cron, PayPal native) + gated OFF; ⚠️ all live charges founder-verified at go-live, one rail at a time |
| Account deletion (soft delete → 30-day hold → admin hard purge) | `account-deletion.md` | 🟢 GDPR purge fixed + proven live against an account holding every blocking row (`20260716230000`) |
| Add-ons (create → attach → charge → refundability) | `addons.md` | 🟢 |
| Coupons — HOST codes for BOOKINGS (create → redeem → limits) | `coupons.md` | 🟢 redemption verified live (`3ed85c1b`) |
| Wielo promo codes — WIELO codes for PRODUCTS (admin create → apply at checkout → redeem) | `platform-coupons.md` | 🟢 both surfaces witnessed live 2026-07-17 (pay page R599→R419; signup wizard). ⚠️ no card/PayPal settlement witnessed (needs real payment details) |
| Specials / deals (create → publish → book → redeem) | `specials.md` | 🟢 deal checkout unified through the main BookingForm |
| Policy enforcement & refunds (snapshot → immutability → refund → payment_status) | `policy-refunds.md` | 🟢 P0 fix + Phase 1 + panel driven live; G5/G7/G8/G9 + card rail pending |
| Affiliate programme (join → link → refer → commission → payout) | `affiliate.md` | 🟡 access-per-shell + join driven live; refer→accrue→payout documented from code |
| Support inbox (host↔Wielo + guest↔Wielo platform threads) | `support-inbox.md` | 🟢 driven live both directions; admin UI click-through ⚠️ not screenshotted |
| Auto-save drafts (baseline-gated persist → resume banner → clear) | `autosave-drafts.md` | 🟢 wired on add-on · special · booking · quote · coupon |
| Media manager (upload → library → attach) | `media-manager.md` | 🟡 not a single source of truth — unifying it is an epic |
| Reviews (post-checkout request → submit → reply → feature) | `reviews.md` | 🟢 written 2026-07-16 — ✅ Vault secret set, delay now 60 min, moderation bypass closed (`20260716250000`), `auto-publish-reviews` retired (`20260716260000`). ⚠️ end-to-end unproven: 0 bookings exist |
| Access details (card + email + trip-page unlock) | `access-details.md` | 🟢 written 2026-07-16 — card + email work; ✅ reminder Vault secret set; ✅ room-access save fixed. ⚠️ end-to-end unproven: 0 bookings exist. Open: unlock gates on status but NOT payment |
| Calendar sync (iCal import/export, block conflicts) | `calendar-sync.md` | 🟡 written 2026-07-16 — cron green + Vault set, but **0 feeds exist so it has never imported**; real OTA round-trip ⚠️ unproven |

Add a row when you start a new feature's flow. Every feature now has one.

## ⚠️ Vault-gated crons — 5 of 14 secrets still missing (audited live 2026-07-16)

Nine crons call an HTTP worker by reading a URL/secret out of Supabase Vault. **If the
secret is unset they `RAISE NOTICE` and return** — a *silent soft-skip*: the job shows
**`succeeded`** in `cron.job_run_details`, with no error, no queue row and no alert. A
green cron here is **not** evidence the feature works. No migration creates these; each
is a manual one-time `vault.create_secret` documented only in a migration header.

| Cron | Needs | State |
|---|---|---|
| `drain-email-queue` | `email_worker_url` · `email_worker_secret` | ✅ works |
| `drain-push-queue` | `push_worker_url` · `broadcast_worker_url` · `digest_worker_url` | ✅ works |
| `sync-ical-feeds` | `ical_sync_worker_url` · `ical_sync_worker_secret` | ✅ set (but 0 feeds → never imports) |
| `drain-review-requests` | `review_request_worker_url` | ✅ **set 2026-07-16** |
| `drain-checkin-reminders` | `checkin_reminder_worker_url` | ✅ **set 2026-07-16** |
| `drain-looking-for-notifications` | `looking_for_worker_url` | 🔴 **missing** |
| `publish-scheduled-posts` | `blog_publish_url` | 🔴 **missing** |
| `sync-external-reviews` | `external_reviews_worker_url` · `_secret` | 🔴 **missing** |
| `poll-website-domains` | `website_domain_poll_url` | 🔴 **missing** |

Re-run the audit any time: diff `SELECT name FROM vault.secrets` against
`grep -rhoE "WHERE name = '[a-z_]+'" supabase/migrations/*.sql`.

> **Keep this table honest.** It is the entry point for Principle #12, so a wrong
> row is worse than a missing one: on 2026-07-16 it listed four docs that did not
> exist, omitted seven that did, and still called `specials.md` "to be written"
> long after it shipped — which is partly why `subscriptions.md` went unwritten
> while everyone assumed it was tracked. If you add a doc, add its row in the same
> change; if you finish a flow, move its status in the same change.
