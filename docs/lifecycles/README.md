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
| Booking (create → pay → confirm → stay → checkout → review) | `booking.md` | ⬜ to be written |
| Payments & ledger (charges, receipts, invoices, credit notes, refunds) | `payments-ledger.md` | 🟡 VAT + settlement/invoice paths done; refunds/credit-notes TBD |
| Reviews (post-checkout request → submit → reply → feature) | `reviews.md` | ⬜ to be written |
| Access details (card + email + trip-page unlock) | `access-details.md` | ⬜ to be written |
| Quotes (build → send → accept → convert to booking) | `quotes.md` | ⬜ to be written |
| Subscriptions (signup → plan → renew → change → cancel) | `subscriptions.md` | ⬜ to be written |
| Specials / deals (create → publish → book → redeem) | `specials.md` | ⬜ to be written |
| Calendar sync (iCal import/export, block conflicts) | `calendar-sync.md` | ⬜ to be written |

Add a row when you start a new feature's flow. Backfill the core features
(booking, payments-ledger, reviews) first — they anchor everything else.
