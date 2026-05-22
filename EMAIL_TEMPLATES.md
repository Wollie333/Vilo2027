# Vilo Platform — Email Templates

**Version:** 1.0
**Last Updated:** May 2026
**Sending domain:** `noreply@viloplatform.com`
**From name:** `Vilo`
**Built with:** React Email + Resend SDK
**Template files:** `emails/` directory
**Preview:** `npx email dev`

---

## Voice & Tone

Vilo emails are **warm and personal**. Every email should feel like it came from a person who genuinely cares — not a system sending a notification.

- Always use first names: `Hi Amara,` not `Hi there,` or `Dear Guest,`
- Write as if you're talking to a friend who happens to be a traveller or a small business owner
- Celebrate the good moments: a booking confirmation is exciting — treat it that way
- Be human about the hard moments: a cancellation is disappointing — acknowledge that, don't just state facts
- Short sentences. Warm words. Never corporate.
- One clear primary action per email — don't bury it
- Emojis: one per email where it adds genuine warmth — confirmations (🎉), welcome (🌿), check-in (🏡). Never on cancellations, payment failures, or suspensions.
- Never say "we are pleased to inform you", "please be advised", or "as per our records"
- Sign off with warmth: `— The Vilo team` on transactional emails, nothing on urgent/bad-news emails

**Examples of the voice difference:**

| ❌ Avoid | ✅ Use instead |
|---|---|
| "Your booking has been confirmed." | "You're all set, Amara! 🎉" |
| "Payment could not be processed." | "We weren't able to process your payment, Lerato — here's how to fix it." |
| "Your account has been restricted." | "Hi Lerato, your subscription has lapsed and some features are on hold." |
| "Please upload proof of payment." | "One last step — upload your proof of payment and we'll get Lerato to confirm." |

---

## Shared Layout

All templates extend a base layout component (`emails/layout/BaseEmail.tsx`):

**Header:** Vilo logo (SVG inline), brand green `#1B4D3E`
**Footer:**
- `viloplatform.com`
- `Sent by Vilo · noreply@viloplatform.com`
- Unsubscribe link (where legally required — transactional emails are exempt but include it for marketing-adjacent emails)
- Address: `Vilo · South Africa`

**Typography:**
- Font: Inter (web-safe fallback: Arial, sans-serif)
- Body text: 16px, `#2d2d2d`
- Headings: Plus Jakarta Sans (web-safe fallback: Georgia, sans-serif), 24px, `#1B4D3E`
- Links: `#1B4D3E`, underlined

**Button style:**
- Background: `#1B4D3E`
- Text: `#ffffff`
- Border radius: 8px
- Padding: 14px 28px
- Font: Inter 16px medium

---

## Template Variables Reference

All templates receive a typed `props` object. Variables in `{{double_braces}}` must be passed when calling `resend.emails.send()`.

**Common variables (available to all templates):**
```typescript
type BaseEmailProps = {
  recipient_name: string;       // first name only
  recipient_email: string;
  app_url: string;              // process.env.NEXT_PUBLIC_APP_URL
};
```

---

## Booking Templates

---

### `booking-request-host`
**Trigger:** Guest submits a booking request (pending, not instant booking)
**Recipient:** Host
**Edge Function:** `booking-create`
**Phase:** 2

**Subject:** `{{guest_name}} wants to book {{listing_name}}!`

**Props:**
```typescript
{
  host_name: string;
  guest_name: string;          // first name + last initial
  listing_name: string;
  check_in: string;            // formatted: "Friday, 6 June 2026"
  check_out: string;           // formatted: "Sunday, 8 June 2026"
  nights: number;
  guests_count: number;
  total_amount: string;        // formatted: "R 2,000.00"
  currency: string;            // "ZAR"
  payment_method: string;      // "Paystack" | "PayPal" | "EFT"
  booking_reference: string;   // "VILO-2026-AB1234"
  booking_url: string;         // app_url + /dashboard/bookings/[id]
  response_deadline: string;   // formatted: "Saturday, 7 June at 14:00"
  guest_message?: string;      // optional message from guest at checkout
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `Great news — {{guest_name}} wants to book **{{listing_name}}**!`
- Booking summary table: dates, nights, guests, total, payment method
- If `guest_message`: display the message in a quoted block with intro: `They left you a note:`
- `You have until {{response_deadline}} to confirm or decline.`
- Primary CTA button: **Review booking request** → `{{booking_url}}`
- Secondary text: `After {{response_deadline}}, the booking will expire automatically.`

---

### `booking-confirmed-guest`
**Trigger:** Booking confirmed (either instant or after host approval)
**Recipient:** Guest
**Edge Function:** `booking-confirm` / `webhooks/paystack` / `webhooks/paypal`
**Phase:** 2

**Subject:** `You're all set! Booking confirmed at {{listing_name}} 🎉`

**Props:**
```typescript
{
  guest_name: string;
  listing_name: string;
  host_name: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests_count: number;
  total_amount: string;
  currency: string;
  payment_method: string;
  booking_reference: string;
  booking_url: string;         // app_url + /account/bookings/[id]
  host_profile_url: string;    // app_url + /[handle]
  listing_address_partial: string;  // city/area only — NOT full address
  cancellation_policy_summary: string; // e.g. "Full refund if cancelled 5+ days before check-in"
  policy_rules: Array<{ label: string; description: string }>; // from policy snapshot
}
```

**Body:**
- Greeting: `Hi {{guest_name}},`
- `You're all set! 🎉 Your stay at **{{listing_name}}** is confirmed.`
- Booking summary table: reference, dates, guests, total paid
- Cancellation policy section (from `policy_rules`) with header: `Good to know — cancellation policy`
- Primary CTA button: **View your booking** → `{{booking_url}}`
- Secondary: `Got questions? Message {{host_name}} directly — they're looking forward to your stay.` → link to inbox

---

### `booking-confirmed-host`
**Trigger:** Instant booking confirmed automatically (no host approval needed)
**Recipient:** Host
**Edge Function:** `webhooks/paystack` / `webhooks/paypal`
**Phase:** 2

**Subject:** `New booking confirmed — {{guest_name}}, {{check_in_short}}`

**Props:**
```typescript
{
  host_name: string;
  guest_name: string;
  listing_name: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests_count: number;
  total_amount: string;
  currency: string;
  payment_method: string;
  booking_reference: string;
  booking_url: string;         // app_url + /dashboard/bookings/[id]
  check_in_short: string;      // "6 Jun"
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `You have a new booking at **{{listing_name}}** — and it's already confirmed! 🎉`
- `{{guest_name}} used Instant Book, so everything's sorted.`
- Booking summary table
- Primary CTA button: **View booking details** → `{{booking_url}}`

---

### `booking-declined-guest`
**Trigger:** Host declines a booking request
**Recipient:** Guest
**Edge Function:** `booking-cancel` (initiated_by: host)
**Phase:** 2

**Subject:** `About your booking request for {{listing_name}}`

**Props:**
```typescript
{
  guest_name: string;
  listing_name: string;
  check_in: string;
  check_out: string;
  booking_reference: string;
  refund_note: string;         // "Your payment has been released. Allow 3–5 business days."
  explore_url: string;         // app_url + /explore
}
```

**Body:**
- Greeting: `Hi {{guest_name}},`
- `Unfortunately, {{listing_name}} isn't able to take your booking for {{check_in}} – {{check_out}}.`
- `{{refund_note}}`
- `There are plenty of great stays waiting for you — let's find the right one.`
- Primary CTA button: **Browse other listings** → `{{explore_url}}`
- Note: Do NOT include the host's decline reason in the guest email (privacy)

---

### `booking-cancelled-host`
**Trigger:** Guest cancels a confirmed booking
**Recipient:** Host
**Edge Function:** `booking-cancel` (initiated_by: guest)
**Phase:** 3

**Subject:** `{{guest_name}} has cancelled their booking — {{listing_name}}, {{check_in_short}}`

**Props:**
```typescript
{
  host_name: string;
  guest_name: string;
  listing_name: string;
  check_in: string;
  check_out: string;
  booking_reference: string;
  refund_amount: string;       // formatted: "R 2,000.00" or "R 0.00 (outside policy window)"
  booking_url: string;
  check_in_short: string;
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `{{guest_name}} has cancelled their booking at **{{listing_name}}**.`
- Booking summary (dates, reference)
- Refund info: `A refund of {{refund_amount}} has been issued to the guest per your cancellation policy.`
- `Those dates are now available again in your calendar.`
- Primary CTA button: **View booking** → `{{booking_url}}`

---

### `booking-cancelled-guest`
**Trigger:** Host cancels a confirmed booking
**Recipient:** Guest
**Edge Function:** `booking-cancel` (initiated_by: host)
**Phase:** 3

**Subject:** `Important: Your booking at {{listing_name}} has been cancelled`

**Props:**
```typescript
{
  guest_name: string;
  listing_name: string;
  check_in: string;
  check_out: string;
  booking_reference: string;
  refund_amount: string;       // always full refund on host-initiated cancel
  refund_note: string;         // "Allow 3–5 business days to appear in your account."
  explore_url: string;
}
```

**Body:**
- Greeting: `Hi {{guest_name}},`
- `We're really sorry, {{guest_name}}. Your booking at **{{listing_name}}** ({{check_in}} – {{check_out}}) has been cancelled by the host.`
- `We've issued you a full refund of {{refund_amount}}. {{refund_note}}`
- `We know this is frustrating. Let's help you find something just as good.`
- Primary CTA button: **Find a new listing** → `{{explore_url}}`

---

## EFT Templates

---

### `eft-instructions-guest`
**Trigger:** Guest selects EFT at checkout — booking created with `status = pending_eft`
**Recipient:** Guest
**Edge Function:** `booking-create`
**Phase:** 2

**Subject:** `Action required: Complete your EFT payment for {{listing_name}}`

**Props:**
```typescript
{
  guest_name: string;
  listing_name: string;
  check_in: string;
  check_out: string;
  total_amount: string;
  currency: string;
  booking_reference: string;
  bank_name: string;
  account_holder: string;
  account_number_masked: string;  // e.g. "•••• 4523" — last 4 digits only
  branch_code: string;
  payment_reference: string;      // always = booking_reference, e.g. "VILO-2026-AB1234"
  expires_at: string;             // formatted: "Sunday, 8 June 2026 at 14:00"
  booking_url: string;
  upload_url: string;             // direct link to upload proof of payment
}
```

**Body:**
- Greeting: `Hi {{guest_name}},`
- `Almost there, {{guest_name}}! Your booking at **{{listing_name}}** is reserved for 48 hours — just complete your bank transfer to confirm it.`
- Banking details table: bank, account holder, masked account number, branch code
- Large highlighted reference: `Payment reference: **{{payment_reference}}**`
- Warning: `Use this exact reference. Payments with incorrect references cannot be matched.`
- Amount: `Transfer exactly **{{total_amount}}** to the account above.`
- Expiry: `Your booking will expire on {{expires_at}} if payment is not received.`
- Primary CTA button: **Upload proof of payment** → `{{upload_url}}`
- Secondary: **View booking** → `{{booking_url}}`

---

### `eft-proof-received-host`
**Trigger:** Guest uploads proof of payment
**Recipient:** Host
**Edge Function:** `eft-proof-upload`
**Phase:** 2

**Subject:** `Payment proof received — {{guest_name}}, {{listing_name}}`

**Props:**
```typescript
{
  host_name: string;
  guest_name: string;
  listing_name: string;
  check_in: string;
  check_out: string;
  total_amount: string;
  booking_reference: string;
  booking_url: string;         // /dashboard/bookings/[id] — proof viewable here
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `{{guest_name}} has uploaded proof of payment for their booking at **{{listing_name}}**.`
- Summary: dates, amount, reference
- `Please check your bank account and confirm the payment was received.`
- Primary CTA button: **Review proof & confirm** → `{{booking_url}}`

---

## Review Templates

---

### `review-request-guest`
**Trigger:** pg_cron — 24 hours after `check_out` date
**Recipient:** Guest
**Edge Function:** `send-email` (called from review request queue)
**Phase:** 3

**Subject:** `How was your stay at {{listing_name}}?`

**Props:**
```typescript
{
  guest_name: string;
  listing_name: string;
  host_name: string;
  check_in: string;
  check_out: string;
  review_url: string;          // app_url + /review/[booking_id]/[token]
  token_expires_at: string;    // formatted: "30 days from now"
}
```

**Body:**
- Greeting: `Hi {{guest_name}},`
- `Hope you had a wonderful time at **{{listing_name}}** with {{host_name}}!`
- `Would you take 2 minutes to share how it went? Your review means a lot to {{host_name}} — and helps other travellers find hidden gems just like this one.`
- Primary CTA button: **Leave a review** → `{{review_url}}`
- Note: `This link expires in {{token_expires_at}}.`

---

### `new-review-host`
**Trigger:** Review published (after 48-hour moderation window)
**Recipient:** Host
**Edge Function:** `send-email` (called from review publish trigger)
**Phase:** 3

**Subject:** `{{guest_name}} left you a {{rating}}-star review`

**Props:**
```typescript
{
  host_name: string;
  guest_name: string;
  listing_name: string;
  rating: number;              // 1–5
  review_body: string;         // first 200 chars only — guest must visit to read full
  reviews_url: string;         // /dashboard/reviews
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- Star display: `⭐ {{rating}} / 5`
- Excerpt: first 200 characters of `review_body` + "..."
- `You can respond to this review from your dashboard.`
- Primary CTA button: **View & respond** → `{{reviews_url}}`

---

## Staff Templates

---

### `staff-invite`
**Trigger:** Host sends a staff invitation
**Recipient:** Invited person (new or existing user)
**Edge Function:** `invite-staff`
**Phase:** 3

**Subject:** `{{host_name}} has invited you to manage {{property_name}} on Vilo`

**Props:**
```typescript
{
  invitee_name?: string;       // optional — may be unknown for new users
  host_name: string;
  property_name: string;
  invite_url: string;          // app_url + /invite/[token]
  expires_at: string;          // formatted: "7 days from now"
}
```

**Body:**
- Greeting: `Hi{{invitee_name ? ` ${invitee_name}` : ''}},`
- `**{{host_name}}** has invited you to join the team at **{{property_name}}** on Vilo.`
- What you'll be able to do: manage bookings, handle guest messages, manage the calendar
- Primary CTA button: **Accept invitation** → `{{invite_url}}`
- `This invitation expires in {{expires_at}}.`
- Footer note: `If you didn't expect this, you can safely ignore this email.`

---

## Subscription Templates

---

### `subscription-welcome`
**Trigger:** New paid subscription activated (after trial or first payment)
**Recipient:** Host
**Edge Function:** `webhooks/paystack` / `webhooks/paypal`
**Phase:** 3

**Subject:** `Welcome to Vilo {{plan_name}}! 🌿`

**Props:**
```typescript
{
  host_name: string;
  plan_name: string;           // "Basic" | "Pro" | "Business"
  billing_cycle: string;       // "monthly" | "annual"
  price: string;               // formatted: "R 599/month"
  trial_ends_at?: string;      // only if in trial: "14 June 2026"
  next_billing_date: string;   // formatted date
  dashboard_url: string;
  key_features: string[];      // 3–4 plan highlights
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `Welcome to the team, {{host_name}}! You're officially on **Vilo {{plan_name}}** — let's help you fill that calendar. 🌿`
- If trial: `Your 14-day free trial runs until {{trial_ends_at}}. You won't be charged until then.`
- Key features unlocked (short bullet list from `key_features`)
- Billing: `Your {{billing_cycle}} subscription of {{price}} will renew on {{next_billing_date}}.`
- Primary CTA button: **Go to your dashboard** → `{{dashboard_url}}`

---

### `subscription-expiring`
**Trigger:** pg_cron — 7 days before subscription renewal date
**Recipient:** Host
**Edge Function:** `send-email` (via notification queue)
**Phase:** 3

**Subject:** `Your Vilo {{plan_name}} subscription renews in 7 days`

**Props:**
```typescript
{
  host_name: string;
  plan_name: string;
  renewal_date: string;        // formatted
  price: string;
  billing_url: string;         // /dashboard/settings/subscription
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `Your Vilo {{plan_name}} subscription will automatically renew on {{renewal_date}} for {{price}}.`
- `No action needed — we'll charge your saved payment method.`
- `Want to make changes?`
- Primary CTA button: **Manage subscription** → `{{billing_url}}`

---

### `subscription-failed`
**Trigger:** Paystack `invoice.payment_failed` / PayPal `PAYMENT.SALE.DENIED`
**Recipient:** Host
**Edge Function:** `webhooks/paystack` / `webhooks/paypal`
**Phase:** 3

**Subject:** `Action required: Your Vilo payment failed`

**Props:**
```typescript
{
  host_name: string;
  plan_name: string;
  amount: string;
  grace_period_ends_at: string;  // formatted
  billing_url: string;
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `Hi {{host_name}}, we had trouble processing your Vilo {{plan_name}} payment of {{amount}}.`
- `No panic — your account stays fully active until {{grace_period_ends_at}}. That gives you a bit of time to sort it.`
- `Just update your payment method and everything will keep running smoothly.`
- Primary CTA button: **Update payment method** → `{{billing_url}}`

---

### `subscription-restricted`
**Trigger:** pg_cron — grace period expired, account restricted
**Recipient:** Host
**Edge Function:** `send-email` (via notification queue)
**Phase:** 3

**Subject:** `Your Vilo account has been restricted`

**Props:**
```typescript
{
  host_name: string;
  plan_name: string;
  billing_url: string;
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `Hi {{host_name}}, your Vilo {{plan_name}} subscription has lapsed and some features are currently on hold.`
- What this means:
  - Your listings are still in the directory, but guests can only send enquiries (no direct bookings)
  - Your dashboard remains accessible
- `Reactivate your subscription to restore full access immediately.`
- Primary CTA button: **Reactivate subscription** → `{{billing_url}}`

---

## Admin-Triggered Templates

---

### `account-suspended`
**Trigger:** Super Admin suspends a host account
**Recipient:** Host
**Edge Function:** Admin action via `admin-suspend` Edge Function
**Phase:** 4

**Subject:** `Your Vilo account has been suspended`

**Props:**
```typescript
{
  host_name: string;
  support_email: string;       // "support@viloplatform.com"
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `Your Vilo account has been temporarily suspended following a review by our team.`
- `Your listings have been removed from the directory while the suspension is in place.`
- `If you believe this is an error or would like more information, please contact us at {{support_email}}.`
- No CTA button (don't link to dashboard — account is suspended)

---

## Refund Templates

---

### `refund-request-host`
**Trigger:** Guest submits a refund request
**Recipient:** Host
**Edge Function:** `refund-request`
**Phase:** 4

**Subject:** `Refund request from {{guest_name}} — {{booking_reference}}`

**Props:**
```typescript
{
  host_name: string;
  guest_name: string;
  listing_name: string;
  booking_reference: string;
  check_in: string;
  total_paid: string;
  requested_amount: string;
  policy_entitlement: string;  // formatted amount or "R 0.00 (outside policy window)"
  reason: string;              // guest's stated reason
  refund_url: string;          // /dashboard/payments/refunds/[id]
  response_deadline: string;   // 72 hours from request (auto-escalation)
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `{{guest_name}} has submitted a refund request for booking {{booking_reference}} ({{listing_name}}, {{check_in}}).`
- Summary: paid amount, requested amount, policy entitlement
- Guest reason: quoted block
- `Please review and respond by {{response_deadline}}. Unresponded requests are escalated to our team.`
- Primary CTA button: **Review refund request** → `{{refund_url}}`

---

### `refund-approved-guest`
**Trigger:** Host approves refund
**Recipient:** Guest
**Edge Function:** `refund-process`
**Phase:** 4

**Subject:** `Your refund of {{refund_amount}} has been approved`

**Props:**
```typescript
{
  guest_name: string;
  listing_name: string;
  booking_reference: string;
  refund_amount: string;
  payment_method: string;
  processing_note: string;     // "Allow 3–5 business days." or "Your host will transfer the funds directly."
  booking_url: string;
}
```

**Body:**
- Greeting: `Hi {{guest_name}},`
- `Your refund of **{{refund_amount}}** for {{listing_name}} ({{booking_reference}}) has been approved.`
- `{{processing_note}}`
- Primary CTA button: **View booking** → `{{booking_url}}`

---

### `refund-declined-guest`
**Trigger:** Host declines refund
**Recipient:** Guest
**Edge Function:** `refund-decline`
**Phase:** 4

**Subject:** `Update on your refund request — {{booking_reference}}`

**Props:**
```typescript
{
  guest_name: string;
  listing_name: string;
  booking_reference: string;
  decline_reason_label: string; // human-readable, not the code key
  policy_summary: string;       // applicable policy rule
  dispute_url: string;          // /account/bookings/[id] — "dispute" option
  support_email: string;
}
```

**Body:**
- Greeting: `Hi {{guest_name}},`
- `Your refund request for {{listing_name}} ({{booking_reference}}) has been reviewed and declined.`
- Reason: `{{decline_reason_label}}`
- Applicable policy: quoted block from `policy_summary`
- `If you believe this decision is incorrect, you can dispute it within 14 days.`
- Primary CTA button: **Dispute this decision** → `{{dispute_url}}`
- Secondary: `Or contact us at {{support_email}}.`

---

### `refund-completed-guest`
**Trigger:** Payment provider confirms refund processed
**Recipient:** Guest
**Edge Function:** `webhooks/paystack` / `webhooks/paypal`
**Phase:** 4

**Subject:** `Your refund of {{refund_amount}} is on its way`

**Props:**
```typescript
{
  guest_name: string;
  refund_amount: string;
  booking_reference: string;
  payment_method: string;
  processing_note: string;
}
```

**Body:**
- Greeting: `Hi {{guest_name}},`
- `Your refund of **{{refund_amount}}** for booking {{booking_reference}} has been processed.`
- `{{processing_note}}`

---

### `refund-escalated-admin`
**Trigger:** Guest escalates a declined refund
**Recipient:** Super Admin (internal alert)
**Edge Function:** `refund-escalate`
**Phase:** 4

**Subject:** `[Admin] Refund dispute escalated — {{booking_reference}}`

**Props:**
```typescript
{
  guest_name: string;
  host_name: string;
  listing_name: string;
  booking_reference: string;
  requested_amount: string;
  escalation_note: string;
  admin_url: string;           // admin panel → payments → refund disputes
}
```

**Body:**
- No greeting — this is an internal alert
- Summary: guest, host, listing, amount, escalation reason
- Primary CTA button: **Review dispute** → `{{admin_url}}`

---

### `refund-admin-override-host`
**Trigger:** Admin forces a refund against host's decision
**Recipient:** Host
**Edge Function:** `refund-admin-decision`
**Phase:** 4

**Subject:** `Refund override — {{booking_reference}}`

**Props:**
```typescript
{
  host_name: string;
  guest_name: string;
  listing_name: string;
  booking_reference: string;
  refund_amount: string;
  admin_note: string;
  support_email: string;
}
```

**Body:**
- Greeting: `Hi {{host_name}},`
- `Following a review of the refund dispute for booking {{booking_reference}}, our team has issued a refund of **{{refund_amount}}** to {{guest_name}}.`
- Admin note: quoted block
- `If you have questions, contact us at {{support_email}}.`

---

### `eft-refund-sent-guest`
**Trigger:** Host marks EFT refund as sent
**Recipient:** Guest
**Edge Function:** `refund-manual-sent`
**Phase:** 4

**Subject:** `Your refund has been sent — {{booking_reference}}`

**Props:**
```typescript
{
  guest_name: string;
  refund_amount: string;
  booking_reference: string;
  host_note?: string;
  processing_note: string;     // "EFT transfers typically arrive within 1–2 business days."
}
```

**Body:**
- Greeting: `Hi {{guest_name}},`
- `Your refund of **{{refund_amount}}** for booking {{booking_reference}} has been sent via bank transfer.`
- `{{processing_note}}`
- If `host_note`: message from host in quoted block

---

## Auth Templates (Supabase Built-In)

These are configured directly in the Supabase Auth dashboard under Email Templates. Content is customised there — they are NOT built with React Email.

---

### `email-verification`
**Trigger:** User signs up with email + password
**Where to configure:** Supabase Dashboard → Auth → Email Templates → Confirm signup

**Subject:** `Confirm your Vilo account`

**Tone:** Friendly but brief. One action.

**Body (plain text base):**
```
Hi there,

Thanks for signing up for Vilo. Click the link below to verify your email address.

[Confirm email address] ← link to {{ .ConfirmationURL }}

This link expires in 24 hours.

If you didn't create a Vilo account, you can safely ignore this email.

— The Vilo team
```

---

### `password-reset`
**Trigger:** User requests a password reset
**Where to configure:** Supabase Dashboard → Auth → Email Templates → Reset password

**Subject:** `Reset your Vilo password`

**Body (plain text base):**
```
Hi there,

We received a request to reset your Vilo password.

[Reset password] ← link to {{ .ConfirmationURL }}

This link expires in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

— The Vilo team
```

---

## Implementation Notes

### File structure
```
emails/
  layout/
    BaseEmail.tsx          # shared header + footer + typography
    EmailButton.tsx        # primary CTA button component
    EmailTable.tsx         # booking summary table component
    EmailQuote.tsx         # quoted block for guest messages / reasons
  booking/
    BookingRequestHost.tsx
    BookingConfirmedGuest.tsx
    BookingConfirmedHost.tsx
    BookingDeclinedGuest.tsx
    BookingCancelledHost.tsx
    BookingCancelledGuest.tsx
  eft/
    EftInstructionsGuest.tsx
    EftProofReceivedHost.tsx
  reviews/
    ReviewRequestGuest.tsx
    NewReviewHost.tsx
  staff/
    StaffInvite.tsx
  subscription/
    SubscriptionWelcome.tsx
    SubscriptionExpiring.tsx
    SubscriptionFailed.tsx
    SubscriptionRestricted.tsx
  admin/
    AccountSuspended.tsx
  refunds/
    RefundRequestHost.tsx
    RefundApprovedGuest.tsx
    RefundDeclinedGuest.tsx
    RefundCompletedGuest.tsx
    RefundEscalatedAdmin.tsx
    RefundAdminOverrideHost.tsx
    EftRefundSentGuest.tsx
```

### Calling templates from Edge Functions
```typescript
import { Resend } from 'resend';
import { BookingConfirmedGuestEmail } from '../../emails/booking/BookingConfirmedGuest';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

await resend.emails.send({
  from:    'Vilo <noreply@viloplatform.com>',
  to:      guest.email,
  subject: `You're all set! Booking confirmed at ${listingName} 🎉`,
  react:   BookingConfirmedGuestEmail({
    guest_name: guest.full_name.split(' ')[0],
    listing_name: listing.name,
    // ... all required props
  }),
});
```

### Testing emails locally
```bash
npx email dev
# → http://localhost:3000 — preview all templates with test data
```

All templates must be tested with:
- Light mode and dark mode preview
- Mobile width (375px) and desktop (600px)
- Gmail, Apple Mail, and Outlook rendering (use `https://www.mailpace.com/email-preview` or Resend's preview tool)
