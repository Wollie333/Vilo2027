# Vilo Platform — Customer Journey Map

**Version:** 1.0  
**Status:** Final Draft  
**Last Updated:** May 2026  
**Purpose:** Define every user's end-to-end journey through the Wielo platform — from first discovery through every feature — so the development team has a precise, shared understanding of how each user type interacts with the system.

---

## How to Read This Document

Each journey follows this structure:

- **User:** Named persona + their role and tier
- **Feature:** The specific platform feature being used
- **Entry Point:** Where the journey begins
- **Preconditions:** What must already be true
- **Step-by-Step Journey:** Every action, decision point, system response, and integration call
- **Exit State:** What has changed in the system when the journey ends
- **Edge Cases & Error Paths:** What can go wrong and how it is handled
- **Integration Touchpoints:** Which backend services, APIs, and notifications fire

---

## User Personas

| ID | Name | Role | Tier | Description |
|---|---|---|---|---|
| U1 | **Amara** | Guest | Free (no subscription) | First-time traveller discovering Wielo via Google |
| U2 | **David** | Host | Free Tier | B&B owner who just signed up, no paid plan yet |
| U3 | **Lerato** | Host | Pro Plan | Established guesthouse owner with 3 listings |
| U4 | **Sipho** | Staff | N/A (works for Lerato) | Lerato's front desk manager |
| U5 | **Nina** | Host | Business Plan | Lodge operator with multiple properties and experiences |
| U6 | **James** | Super Admin | N/A | Wielo internal team member |

---

## Table of Contents

### Guest Journeys (Amara — U1)
- JG-01: Discovering Wielo & Browsing the Directory
- JG-02: Viewing a Listing Detail Page
- JG-03: Creating a Guest Account
- JG-04: Making a Booking (Instant Book — Paystack)
- JG-05: Making a Booking (Request to Book — PayPal)
- JG-06: Making a Booking (Manual EFT)
- JG-07: Sending a Pre-Booking Enquiry
- JG-08: Managing a Booking (View, Cancel)
- JG-09: Submitting a Review
- JG-10: Using the Guest Inbox

### Host Free Tier Journeys (David — U2)
- JH-01: Host Sign-Up & Onboarding (Free Tier)
- JH-02: Creating a Listing (Free Tier)
- JH-03: Managing Enquiries on Free Tier
- JH-04: Hitting a Feature Wall & Upgrading

### Host Pro Tier Journeys (Lerato — U3)
- JH-05: Host Sign-Up & Onboarding (Paid Plan)
- JH-06: Creating an Accommodation Listing (Full)
- JH-07: Creating an Experience Listing
- JH-08: Managing the Availability Calendar
- JH-09: Receiving & Confirming a Booking Request
- JH-10: Receiving an Instant Booking
- JH-11: Managing the Inbox (Full)
- JH-12: Declining a Booking
- JH-13: Cancelling a Confirmed Booking
- JH-14: Managing Check-In & Check-Out
- JH-15: Responding to a Review
- JH-16: Flagging a Review for Moderation
- JH-17: Managing EFT Payments & Proof of Payment
- JH-18: Inviting & Managing Staff
- JH-19: Editing & Unpublishing a Listing
- JH-20: Managing the Public Profile Page

### Host Business Tier Journeys (Nina — U5)
- JH-21: Managing Multiple Listings
- JH-22: Using Canned Replies in the Inbox
- JH-23: Exporting Bookings as CSV

### Staff Journeys (Sipho — U4)
- JS-01: Accepting a Staff Invitation
- JS-02: Staff Managing the Inbox
- JS-03: Staff Confirming a Booking
- JS-04: Staff Marking Check-In / Check-Out

### Subscription & Billing Journeys
- JB-01: Choosing a Subscription Plan During Onboarding
- JB-02: Upgrading from Free to Paid
- JB-03: Upgrading from Basic to Pro
- JB-04: Switching to Annual Billing
- JB-05: Failed Subscription Payment & Grace Period
- JB-06: Cancelling a Subscription

### Super Admin Journeys (James — U6)
- JA-01: Logging into the Admin Panel
- JA-02: Managing a Host Account (View, Suspend, Unsuspend)
- JA-03: Overriding Feature Flags for a Specific Host
- JA-04: Moderating a Flagged Review
- JA-05: Managing a Disputed EFT Payment
- JA-06: Manually Adjusting a Subscription
- JA-07: Managing Directory (Feature, Hide, Verify)
- JA-08: Impersonating a User
- JA-09: Viewing Platform Analytics Dashboard
- JA-10: Managing Platform Settings (Ranking Weights, Pricing, Trial Period)

---

---

# GUEST JOURNEYS

---

## JG-01 — Discovering Wielo & Browsing the Directory

**User:** Amara (Guest, not yet registered)  
**Feature:** Wielo Directory — Public Search & Discovery  
**Entry Point:** Google search → lands on `wieloplatform.com/explore`  
**Preconditions:** None. No account required.

### Journey

**Step 1 — Landing on the Directory**
- Amara arrives at `/explore` via organic search or direct link.
- The page loads with a hero search bar and a default grid of featured listings below it.
- Featured listings are populated by the `/functions/v1/directory-featured` endpoint — these are Business-tier hosts with the highest ranking scores.
- Each card shows: cover photo, establishment name, location, listing type badge, star rating, review count, and "from R[X]/night" price.
- No login required. The page is fully public.

**Step 2 — Entering a Search**
- Amara types "guesthouse Knysna" into the search bar.
- After 300ms debounce, `/functions/v1/directory-search` fires with `q=guesthouse+knysna`.
- The backend runs a `pg_trgm` full-text search against the `search_vector` column on `listings`, filtered to `is_published = true`.
- Results return in under 500ms, sorted by `ranking_score` descending.
- The results grid refreshes with matching listings. Total result count displayed ("14 results").

**Step 3 — Applying Filters**
- Amara clicks the filter icon to open the filter panel.
- She sets:
  - Listing Type: Accommodation
  - Check-in: next Friday, Check-out: Sunday (2 nights)
  - Guests: 2
  - Price: R0–R2,000/night
- The search re-fires with the additional parameters.
- Listings that have the selected dates blocked are excluded (query cross-references `blocked_dates` and confirmed bookings).

**Step 4 — Sorting Results**
- Amara changes sort to "Highest Rated".
- Results reorder client-side (already in state); no new API call needed if all results are loaded.
- If pagination is active (>24 results), a new API call fires with `sort=rating`.

**Step 5 — Browsing Cards**
- Amara scrolls through the results.
- She hovers over a card (web) — the cover photo cycles through the first 3 listing photos.
- She taps a card labelled "Featherstone Guesthouse" — navigates to `/listing/[listing-id]`.

**Exit State:** No database writes. Amara is on the listing detail page.  
**Edge Cases:**
- Zero results: "No listings found for your search. Try adjusting your filters." shown with a "Clear Filters" CTA.
- Search timeout: Skeleton loaders shown for up to 3s; on failure, "Something went wrong — please try again" toast.

**Integration Touchpoints:**
- `GET /functions/v1/directory-search` — full-text search
- `GET /functions/v1/directory-featured` — featured listings on initial load
- `listing_rankings` table — provides ranking scores
- `blocked_dates` + `bookings` tables — availability filtering

---

## JG-02 — Viewing a Listing Detail Page

**User:** Amara (Guest, not yet registered)  
**Feature:** Listing Detail Page  
**Entry Point:** Clicked a listing card from the Directory  
**Preconditions:** Listing is published and active.

### Journey

**Step 1 — Page Load**
- Amara lands on `/listing/[listing-id]`.
- Page fetches listing detail via `GET /functions/v1/listing-detail/[id]`.
- Response includes: all photos, description, amenities, pricing, host snippet, aggregate reviews, cancellation policy.

**Step 2 — Photo Gallery**
- Amara clicks the main photo — a lightbox opens showing all listing photos.
- She can swipe (mobile) or click arrows (web) through all images.
- Lightbox closes on Escape key or tap outside.

**Step 3 — Price Calculator**
- Amara enters check-in (Friday) and check-out (Sunday) in the date picker embedded on the page.
- The UI calls `GET /functions/v1/pricing-preview?listing_id=[id]&check_in=...&check_out=...`.
- A price breakdown appears:
  - 2 × R900/night = R1,800
  - Cleaning fee: R200
  - **Total: R2,000**
- Weekend pricing override is applied automatically (pricing.weekend_rate from the listing's pricing jsonb).

**Step 4 — Checking Availability**
- The embedded calendar highlights available dates in white, booked/blocked dates in grey.
- Amara's selected dates are highlighted in the brand colour.
- Dates are fetched from `GET /functions/v1/availability?listing_id=[id]&month=...`.

**Step 5 — Reading Reviews**
- Amara scrolls to the reviews section.
- Aggregate star rating shown (e.g., 4.7 / 5 based on 23 reviews).
- Most recent 5 reviews displayed. "Show all reviews" loads more.
- Each review shows: guest first name + last initial, date, rating, review body, host response (if any).

**Step 6 — Viewing Host Profile Snippet**
- A host card shows: avatar, name, member since, response rate, "View full profile" link.
- Clicking navigates to `wieloplatform.com/[handle]`.

**Step 7 — Initiating a Booking**
- Amara clicks "Book Now".
- Because she is not logged in, a modal appears: "Sign in or create an account to book."
- Two options: "Log In" or "Create Account". She clicks "Create Account" → JG-03 begins.

**Exit State:** Amara is redirected to sign-up with her selected dates preserved in session storage.  
**Edge Cases:**
- Listing not found: 404 page with "Back to Directory" CTA.
- Listing is unpublished (host deactivated it): "This listing is not currently available."
- Host on Free tier (`direct_booking = false`): "Book Now" replaced with "Send Enquiry" only.

---

## JG-03 — Creating a Guest Account

**User:** Amara (Guest, unauthenticated)  
**Feature:** Authentication — Guest Sign-Up  
**Entry Point:** Clicked "Create Account" from a listing page  
**Preconditions:** None.

### Journey

**Step 1 — Sign-Up Form**
- Amara sees the sign-up page/modal with fields: Full Name, Email, Password, Phone (optional).
- Alternatively: "Continue with Google" button (Google OAuth).
- Form validates client-side (React Hook Form + Zod): email format, password min 8 chars.

**Step 2 — Email Path**
- Amara fills in the form and clicks "Create Account".
- `supabase.auth.signUp()` is called.
- Supabase creates a new auth user and inserts a row into `user_profiles` with `role = 'guest'`.
- A verification email is sent by Supabase Auth (using the Resend SMTP integration) with a confirm link.
- Amara sees: "Please check your email to verify your account."

**Step 3 — Email Verification**
- Amara clicks the link in her email.
- She is redirected to `wieloplatform.com/auth/callback?token=...`.
- The token is exchanged for a session via Supabase Auth.
- Her account is now `email_confirmed = true`.
- She is redirected back to the listing she was on, with her dates still in session storage.

**Step 4 — Google OAuth Path (alternative)**
- Amara clicks "Continue with Google".
- She is redirected to Google's OAuth consent screen.
- On approval, she is redirected back to `/auth/callback`.
- Supabase Auth creates or retrieves her account.
- `user_profiles` row is created with `role = 'guest'` if first sign-in.
- No email verification step needed — Google has already verified it.

**Step 5 — Session Established**
- JWT access token stored: web (httpOnly cookie), mobile (Expo SecureStore).
- Amara is now authenticated and redirected to the listing she came from.
- The "Book Now" button is now fully active.

**Exit State:** `user_profiles` row created with `role = 'guest'`, session active, Amara back on the listing page.  
**Edge Cases:**
- Email already registered: "An account with this email already exists. Log in instead."
- Verification email not received: "Resend verification email" link shown after 60 seconds.
- OAuth fails: Toast "Something went wrong with Google Sign-In. Please try again or use email."

---

## JG-04 — Making a Booking (Instant Book — Paystack)

**User:** Amara (Guest, authenticated)  
**Feature:** Booking Flow + Paystack Payment  
**Entry Point:** Listing detail page, dates selected, clicks "Book Now"  
**Preconditions:** Amara is logged in. Listing has `instant_booking = true`. Host has `payment_paystack` enabled.

### Journey

**Step 1 — Booking Summary Page**
- Amara is on the booking summary screen at `/listing/[id]/book`.
- Summary shows:
  - Property name + photo thumbnail
  - Selected dates: Friday 6 June → Sunday 8 June (2 nights)
  - Guests: 2 adults
  - Price breakdown: 2 × R900 + R200 cleaning fee = **R2,000 total**
  - Cancellation policy: "Moderate — full refund if cancelled 5+ days before check-in"
- She reviews and clicks "Continue to Payment".

**Step 2 — Payment Method Selection**
- Payment options shown:
  - 💳 Pay with Card (Paystack) — default
  - 🌐 Pay with PayPal
  - 🏦 Pay via EFT (manual bank transfer)
- Amara selects "Pay with Card (Paystack)".

**Step 3 — Booking Record Created**
- Frontend calls `POST /functions/v1/booking-create` with:
  ```json
  {
    "listing_id": "...",
    "check_in": "2026-06-06",
    "check_out": "2026-06-08",
    "guests_count": 2,
    "payment_method": "paystack"
  }
  ```
- Edge Function validates:
  - Dates are not blocked or already booked (race condition check with row-level lock).
  - Listing is still active and published.
  - Price is recalculated server-side (client price is display only — never trusted).
- A `bookings` row is created with `status = 'PENDING'`.
- A `payments` row is created with `status = 'pending'`.
- The Edge Function calls Paystack's Initialize Transaction API.
- Returns `{ booking_id, authorization_url }` to the frontend.

**Step 4 — Paystack Payment Page**
- Frontend redirects Amara to the Paystack-hosted payment page (`authorization_url`).
- Amara sees the Paystack checkout: amount R2,000, her email pre-filled.
- She enters her card details and clicks "Pay".
- Paystack processes the payment.

**Step 5 — Payment Confirmation & Webhook**
- Paystack fires `charge.success` webhook to `POST /functions/v1/webhooks/paystack`.
- The Edge Function:
  1. Verifies the `x-paystack-signature` HMAC signature.
  2. Looks up the booking by `reference`.
  3. Updates `payments` row: `status = 'completed'`, `provider_reference = paystack_ref`.
  4. Because `instant_booking = true`: updates `bookings` row to `status = 'CONFIRMED'`.
  5. Inserts blocked dates into `blocked_dates` for the booked dates.
  6. Triggers email: `booking-confirmation-host` to Lerato, `booking-confirmation-guest` to Amara.
  7. Triggers push notification to Lerato's device: "New booking confirmed — Amara, 6–8 June."
  8. Creates a conversation thread in `conversations` (linked to booking).
  9. Inserts a system message: "Booking confirmed. Check-in: 6 June. Check-out: 8 June."

**Step 6 — Paystack Redirect Back**
- Paystack redirects Amara back to `/booking/[booking_id]/success`.
- The page shows:
  - ✅ "Booking Confirmed!"
  - Booking reference number
  - Property name, dates, total paid
  - "View Booking" and "Message Host" CTAs
- Amara receives a confirmation email from `noreply@wieloplatform.com`.

**Exit State:** Booking `status = CONFIRMED`, payment `status = completed`, dates blocked, conversation thread created, both parties notified.  
**Edge Cases:**
- Dates become unavailable between Step 1 and Step 3 (another booking wins the race): "Sorry, those dates are no longer available. Please select new dates." Booking not created.
- Paystack payment fails: Amara redirected to `/booking/[id]/failed`. Booking remains `PENDING`. She can retry or choose another payment method. Booking auto-expires after 30 minutes if no successful payment.
- Webhook fires before redirect: handled gracefully — booking is already confirmed when Amara lands on success page.
- Duplicate webhook delivery: idempotency check on `provider_reference` prevents double-processing.

**Integration Touchpoints:**
- `POST /functions/v1/booking-create` — booking + Paystack initialise
- `POST /functions/v1/webhooks/paystack` — confirmation
- `blocked_dates` table — availability lock
- Resend email — both parties
- Expo Push Notifications — host notified
- Supabase Realtime — inbox conversation created

---

## JG-05 — Making a Booking (Request to Book — PayPal)

**User:** Amara (Guest, authenticated)  
**Feature:** Booking Flow + PayPal Payment + Host Approval  
**Entry Point:** Listing detail page for a listing with `instant_booking = false`  
**Preconditions:** Amara is logged in. Listing has `instant_booking = false`. Host has `payment_paypal` enabled.

### Journey

**Step 1 — Booking Summary**
- Same as JG-04 Step 1. Amara reaches the booking summary.
- A notice banner shows: **"This host reviews all bookings. You won't be charged until the host confirms."**

**Step 2 — Payment Method Selection**
- Amara selects "Pay with PayPal".

**Step 3 — Booking Record Created (Pending Approval)**
- Frontend calls `POST /functions/v1/booking-create` with `payment_method: 'paypal'`.
- Edge Function validates dates and price (same as JG-04).
- A `bookings` row is created with `status = 'PENDING'` (awaiting host confirmation).
- A PayPal Order is created via PayPal Orders API v2 with `intent = 'AUTHORIZE'` (hold funds, don't capture yet).
- Returns `{ booking_id, paypal_order_id }` to frontend.

**Step 4 — PayPal Authorisation**
- The PayPal JS SDK renders the PayPal button.
- Amara logs into PayPal and approves the payment authorisation (funds held, not captured).
- PayPal SDK fires `onApprove` callback with the order ID.
- Frontend calls the Edge Function to record the authorisation.

**Step 5 — Awaiting Host Confirmation**
- Booking status is `PENDING`, payment is `authorized` (held).
- Amara sees: "Request sent! Lerato has 24 hours to confirm your booking."
- Amara's booking appears in her "My Bookings" list with status badge "Pending Confirmation".
- Host Lerato receives:
  - Push notification: "New booking request from Amara — 6–8 June. Tap to review."
  - Email: `booking-confirmation-host` template.
  - Inbox message: system message "New booking request from Amara."

**Step 6a — Host Confirms (Happy Path)**
- Lerato opens the booking in her dashboard and clicks "Confirm Booking" → JH-09.
- The Edge Function `/functions/v1/booking-confirm` fires:
  - PayPal Order is captured (funds transferred from hold to Lerato's PayPal).
  - `payments` updated: `status = 'completed'`.
  - `bookings` updated: `status = 'CONFIRMED'`.
  - Dates blocked in `blocked_dates`.
  - Amara receives confirmation email + push notification.
  - Inbox system message: "Booking confirmed by Lerato."

**Step 6b — Host Declines**
- Lerato clicks "Decline" → JH-12.
- PayPal authorisation is voided (funds released back to Amara immediately).
- `bookings` updated: `status = 'CANCELLED_BY_HOST'`.
- Amara receives: "Your booking request was declined." email + push notification.
- Amara's "My Bookings" shows status "Declined".

**Step 6c — Host Does Not Respond Within 24 Hours**
- `pg_cron` job runs every hour and checks for bookings where `status = 'PENDING'` and `created_at < now() - interval '24 hours'`.
- Booking is automatically cancelled: `status = 'CANCELLED_BY_HOST'`, `cancellation_reason = 'host_no_response'`.
- PayPal authorisation is voided.
- Both parties notified by email.

**Exit State (confirmed):** Booking `CONFIRMED`, payment captured, dates blocked.

---

## JG-06 — Making a Booking (Manual EFT)

**User:** Amara (Guest, authenticated)  
**Feature:** Booking Flow + Manual EFT Payment  
**Entry Point:** Listing detail page, selects EFT at checkout  
**Preconditions:** Host has `payment_eft` feature enabled. Host has banking details configured.

### Journey

**Step 1 — Select EFT**
- Amara selects "Pay via EFT (Bank Transfer)" at the payment method step.
- A warning notice is shown: "Your booking will be held for 48 hours while we await your payment. Dates are not confirmed until the host verifies your payment."

**Step 2 — Booking Created**
- `POST /functions/v1/booking-create` called with `payment_method: 'eft'`.
- `bookings` row created with `status = 'PENDING_EFT'`, `payment_status = 'pending'`.

**Step 3 — Banking Details Shown**
- Amara is shown the EFT details page:
  - Bank: First National Bank
  - Account Holder: Featherstone Guesthouse (Pty) Ltd
  - Account Number: ●●●●●●●●● (partially masked)
  - Branch Code: 250655
  - **Reference: VILO-[booking_reference]** (unique per booking — required for matching)
  - Amount: R2,000.00
- A prominent note: "Use the exact reference number or your payment cannot be matched."
- These details are also emailed to Amara (`eft-payment-instructions` template).

**Step 4 — Uploading Proof of Payment**
- Amara makes the bank transfer in her banking app.
- She returns to Wielo and opens her booking (`/bookings/[id]`).
- She sees a "Upload Proof of Payment" section.
- She uploads a PDF or image of her bank confirmation slip.
- `POST /functions/v1/eft-proof-upload` stores the file in Supabase Storage at `eft-proofs/[booking_id]/[filename]`.
- `bookings.eft_proof_url` is updated with the file path.
- `bookings.status` → `PENDING_EFT_REVIEW`.
- Host receives inbox notification: "Amara has uploaded proof of payment for booking [ref]. Please verify."
- Host receives email: `eft-proof-received` template with a link to the proof.

**Step 5 — Host Verifies Payment**
- Lerato opens the booking in her dashboard.
- She sees the proof of payment as a preview (image) or download link (PDF).
- She checks her bank statement to confirm the funds are received.
- She clicks "Confirm Payment Received".
- `POST /functions/v1/booking-confirm` fires:
  - `payments.status` → `completed`.
  - `bookings.status` → `CONFIRMED`.
  - Dates blocked.
  - Amara receives confirmation email + push notification.

**Step 6 — EFT Booking Expires (if no proof uploaded)**
- `pg_cron` checks every 6 hours for bookings with `status = 'PENDING_EFT'` older than 48 hours.
- If no proof uploaded: booking auto-cancelled, Amara notified: "Your EFT booking has expired. Please rebook if you still wish to stay."

**Exit State:** Booking `CONFIRMED`, payment `completed`, dates blocked.  
**Edge Cases:**
- Wrong reference used: Host cannot match payment. Admin can manually match via the admin panel.
- Partial payment: Host marks payment received but notes partial amount — booking flags for admin review.

---

## JG-07 — Sending a Pre-Booking Enquiry

**User:** Amara (Guest, authenticated)  
**Feature:** Pre-Booking Enquiry + Inbox  
**Entry Point:** Listing detail page — host is on Free tier (no direct booking) or Amara chooses "Send Enquiry"  
**Preconditions:** Amara is logged in.

### Journey

**Step 1 — Enquiry Form**
- On the listing page, Amara clicks "Send Enquiry".
- A form appears: 
  - Check-in / check-out dates (optional at this stage)
  - Number of guests
  - Message: "Hi, I'm interested in staying for 2 nights in June. Do you have availability?"
- She submits the form.

**Step 2 — Conversation Created**
- `conversations` row created: `{ listing_id, host_id, guest_id, status: 'open', booking_id: null }`.
- `messages` row created with Amara's message body.
- Host receives push notification + email: "New enquiry from Amara about [listing name]."
- Amara sees: "Your enquiry has been sent! You'll hear back in the host's inbox."

**Step 3 — Host Responds**
- Lerato opens the conversation in her inbox.
- She replies: "Hi Amara! Yes, we have availability for those dates. Here's what's included..."
- Amara receives push notification + email digest.
- The conversation continues back and forth in real-time (Supabase Realtime).

**Step 4 — Converting Enquiry to Booking**
- Lerato (or Amara) is ready to formalise the booking.
- Lerato sees a "Convert to Booking" button inside the conversation thread.
- She clicks it, enters dates and price (or confirms the discussed terms).
- A booking is created linked to the existing conversation: `bookings.conversation_id` = this conversation.
- Amara receives a booking request notification with a payment link.

**Exit State:** Conversation thread open, booking created (if converted), or conversation remains as an enquiry thread.

---

## JG-08 — Managing a Booking (View, Cancel)

**User:** Amara (Guest, authenticated)  
**Feature:** Guest Booking Management  
**Entry Point:** "My Bookings" section in guest account  

### Journey

**Step 1 — My Bookings Page**
- Amara navigates to `/account/bookings`.
- All her bookings are listed: upcoming, past, cancelled.
- Each row shows: property name, dates, status badge, total amount.

**Step 2 — Booking Detail**
- Amara clicks a booking → `/bookings/[id]`.
- Detail page shows: full booking summary, payment receipt, host contact, cancellation policy.
- Action buttons available depend on status and cancellation policy:
  - CONFIRMED, within free cancellation window: "Cancel Booking" button active.
  - CONFIRMED, outside free cancellation window: "Cancel Booking" shown with fee warning.
  - COMPLETED: "Leave a Review" CTA shown.

**Step 3 — Cancelling a Booking**
- Amara clicks "Cancel Booking".
- A confirmation modal: "Are you sure? Per the Moderate policy, cancellations 5+ days before check-in receive a full refund. You are [X] days away."
- She clicks "Confirm Cancellation".
- `POST /functions/v1/booking-cancel` fires:
  - `bookings.status` → `CANCELLED_BY_GUEST`, `cancellation_reason` recorded.
  - Blocked dates removed from `blocked_dates`.
  - Refund logic executed:
    - Paystack: Paystack Refunds API called for applicable amount.
    - PayPal: PayPal refund/void API called.
    - EFT: refund flagged for manual processing by host; admin notified.
  - `payments.status` → `refunded` (full) or remains `completed` with a new `refund_amount` field.
  - Host notified by push + email.
  - Inbox system message: "Booking cancelled by guest."

**Exit State:** Booking `CANCELLED_BY_GUEST`, refund initiated.

---

## JG-09 — Submitting a Review

**User:** Amara (Guest, authenticated)  
**Feature:** Review Submission  
**Entry Point:** Review request email received 24h after check-out  
**Preconditions:** Booking `status = COMPLETED`.

### Journey

**Step 1 — Review Request Email**
- 24 hours after `check_out` date, `pg_cron` identifies completed bookings without a review.
- Email sent to Amara: "How was your stay at Featherstone Guesthouse? Share your experience."
- Email contains a direct link: `wieloplatform.com/review/[booking_id]/[token]`.

**Step 2 — Review Form**
- Amara clicks the link and lands on the review form.
- Fields:
  - Overall rating: 1–5 stars (required)
  - Written review: text area (optional, but encouraged)
  - Character limit: 1,000 characters
- She gives 5 stars and writes: "Absolutely beautiful stay. Lerato was incredibly welcoming..."
- She clicks "Submit Review".

**Step 3 — Review Saved**
- `POST /functions/v1/review-submit` fires:
  - Validates: booking belongs to this guest, booking is COMPLETED, no review already submitted.
  - Inserts into `reviews`: `{ booking_id, listing_id, guest_id, rating: 5, body: '...', is_published: false }`.
  - 48-hour moderation timer starts (`pg_cron` will auto-publish after 48h if not flagged).
- Host Lerato notified: push + email "Amara left you a 5-star review!"
- Amara sees: "Thank you for your review! It will be published shortly."

**Step 4 — Auto-Publish**
- After 48 hours with no admin flag, `pg_cron` sets `reviews.is_published = true`.
- The review appears on the listing detail page and the host's public profile.
- Lerato's aggregate rating is recalculated.

**Exit State:** Review published, host's aggregate rating updated.  
**Edge Cases:**
- Review link clicked after 30 days: "This review link has expired." (token has 30-day TTL).
- Guest tries to submit twice: "You have already reviewed this booking."
- Admin flags review during moderation window: Review held, admin notified for manual decision.

---

## JG-10 — Using the Guest Inbox

**User:** Amara (Guest, authenticated)  
**Feature:** Inbox — Guest View  
**Entry Point:** Inbox icon in navigation  

### Journey

**Step 1 — Inbox List**
- Amara taps the inbox icon (showing a red badge if there are unread messages).
- She sees a list of all her conversation threads.
- Each thread shows: host name, listing name, last message preview, timestamp, unread badge.

**Step 2 — Opening a Thread**
- Amara opens the thread for her upcoming booking at Featherstone Guesthouse.
- She sees the full message history including system messages ("Booking confirmed").
- The thread shows a booking summary card at the top: dates, status, amount.

**Step 3 — Sending a Message**
- Amara types: "Hi Lerato, what time is earliest check-in possible?"
- She taps send.
- Message is inserted into `messages` via Supabase Realtime.
- Lerato's device receives a push notification instantly.
- On Lerato's end, her unread badge increments.

**Step 4 — Receiving a Reply**
- Lerato replies via her host inbox.
- Amara's screen updates in real-time (no refresh needed — Supabase Realtime WebSocket).
- If Amara's app is backgrounded, a push notification arrives: "Lerato: From 2pm, happy to arrange earlier if needed!"

**Step 5 — Attaching a File**
- Amara wants to share a special request document.
- She taps the attachment icon, selects a PDF from her device.
- File is uploaded to Supabase Storage: `message-attachments/[conversation_id]/[filename]`.
- A message with `attachment_url` is sent. Lerato can tap the attachment to download/view it.

**Exit State:** Messages delivered, conversation thread updated in real-time.

---
---

# HOST FREE TIER JOURNEYS

---

## JH-01 — Host Sign-Up & Onboarding (Free Tier)

**User:** David (Host, Free Tier)  
**Feature:** Host Sign-Up, Onboarding Wizard, Free Account Creation  
**Entry Point:** `wieloplatform.com/signup/host`  
**Preconditions:** None.

### Journey

**Step 1 — Sign-Up Form**
- David arrives at the host sign-up page.
- Fields: Full Name, Email, Password, Phone Number.
- He fills in his details and clicks "Create Host Account".
- Supabase Auth creates his account.
- `user_profiles` row created: `{ role: 'guest' }` (temporary — upgraded in step 4).

**Step 2 — Email Verification**
- Verification email sent via Resend.
- David clicks the link in his email → redirected to `/auth/callback`.
- Session created. `email_confirmed = true`.

**Step 3 — Onboarding Wizard — Step 1: Personal Details**
- David completes his profile: name, phone, profile photo (optional).

**Step 4 — Onboarding Wizard — Step 2: Property Type**
- "What kind of property or experience are you offering?"
- Options: Accommodation / Experiences / Both.
- David selects "Accommodation".

**Step 5 — Onboarding Wizard — Step 3: First Listing (Basic)**
- David enters the minimum required info:
  - Property name: "David's B&B"
  - Listing type: B&B
  - City: Cape Town
  - One photo (required)
- The listing is saved as a draft (`is_published = false`).

**Step 6 — Onboarding Wizard — Step 4: Choose a Plan**
- Plan comparison table shown:
  - Free | Basic | Pro | Business | Annual
- Each plan shows what's included and what's locked.
- David sees the Free plan and clicks **"Start with Free"**.
- No payment required.
- `subscriptions` row created: `{ plan: 'free', status: 'active', billing_cycle: null }`.
- `user_profiles.role` updated to `'host'`.
- `hosts` row created with handle auto-generated from property name: `davids-bb`.

**Step 7 — Welcome Screen**
- "Welcome to Wielo, David! Your profile is live at wieloplatform.com/davids-bb"
- CTAs: "Complete your listing", "Preview your profile", "Explore the dashboard".
- Dashboard loads with a setup checklist (progress bar):
  - ✅ Account created
  - ✅ First listing added
  - ⬜ Add more photos
  - ⬜ Complete your listing details
  - ⬜ Set your pricing
  - ⬜ Publish your listing

**Exit State:** David has a free host account, a draft listing, and a public profile URL. No payment processed.

---

## JH-02 — Creating a Listing (Free Tier)

**User:** David (Host, Free Tier)  
**Feature:** Listing Management — Free Tier  
**Entry Point:** Dashboard → "Complete your listing" CTA  
**Preconditions:** David is logged in, has a draft listing.

### Journey

**Step 1 — Listing Editor**
- David opens the listing editor for his B&B.
- He fills in all the fields:
  - Description (rich text editor)
  - Up to 20 photos uploaded via drag-and-drop (Supabase Storage)
  - Address (street, city, province, country) — map pin shown for confirmation
  - Amenities: selects from checkboxes (Wi-Fi, Parking, Breakfast included, etc.)
  - Rooms: 2 bedrooms, 1 bathroom, max 4 guests
  - Pricing: R800/night base, R950 weekend, R150 cleaning fee
  - Check-in: 14:00, Check-out: 11:00
  - Min nights: 1, Max nights: 14
  - Cancellation policy: Moderate

**Step 2 — Instant Booking Toggle (Locked)**
- David sees the "Enable Instant Booking" toggle.
- It shows a 🔒 lock icon with tooltip: "Instant booking is available on Basic and above. Upgrade to unlock."
- Clicking it opens the inline upgrade prompt.

**Step 3 — Payment Settings (Locked)**
- David navigates to payment settings.
- Paystack, PayPal, and EFT are all shown but locked for Free accounts.
- A banner: "Accept direct payments by upgrading to Basic or above. Guests can still send enquiries."

**Step 4 — Publish Listing**
- David clicks "Publish Listing".
- `listings.is_published` → `true`.
- The listing now appears in the Wielo Directory.
- David's profile at `wieloplatform.com/davids-bb` now shows the listing.
- Listing ranking score is calculated and inserted into `listing_rankings`.

**Exit State:** Listing published, appears in directory. Enquiry-only mode (no direct payments).

---

## JH-03 — Managing Enquiries on Free Tier

**User:** David (Host, Free Tier)  
**Feature:** Inbox — Enquiry-Only Mode  
**Entry Point:** Receives a push notification or email about a new enquiry  

### Journey

**Step 1 — Notification Received**
- A guest finds David's listing in the directory.
- Because David is on Free tier, the listing shows "Send Enquiry" instead of "Book Now".
- Guest submits an enquiry.
- David receives push notification + email: "New enquiry from [Guest Name]."

**Step 2 — Inbox (Limited View)**
- David opens his inbox. He can see up to 10 active conversations (Free tier `inbox_limit = 10`).
- He opens the enquiry thread.

**Step 3 — Responding**
- David replies to the enquiry with availability and pricing details.
- Back-and-forth messaging works normally.
- David cannot "Convert to Booking" from within the thread — this feature requires Basic+.
- David sees a prompt: "Want to convert this enquiry to a confirmed booking? Upgrade to Basic."

**Step 4 — Off-Platform Booking (Limitation)**
- On Free tier, David cannot process payments through Wielo.
- He can share his bank details manually in the chat, but this is outside Wielo's payment system.
- This limitation is intentional — it is the core incentive to upgrade.

---

## JH-04 — Hitting a Feature Wall & Upgrading

**User:** David (Host, Free Tier)  
**Feature:** Feature Permission Gates + Upgrade Flow  
**Entry Point:** Tries to enable a locked feature  

### Journey

**Step 1 — Hitting a Gate**
- David tries to click "Add a second listing" from his dashboard.
- An inline upgrade prompt appears (not a blocking modal):
  > 🔒 **Multiple listings are available on Basic and above.**  
  > Basic plan from R299/month. No booking fees, ever.  
  > [See all plans] [Upgrade to Basic]

**Step 2 — Plan Comparison**
- David clicks "See all plans".
- The pricing page `/pricing` opens in a side panel (not a new page — preserves context).
- All 4 plans shown side by side with feature comparison table.
- Current plan (Free) is highlighted.

**Step 3 — Selecting a Plan**
- David clicks "Upgrade to Basic".
- He is taken to the subscription checkout.
- Plan: Basic — R299/month.
- Trial offer: "Your first 14 days are free. Cancel anytime."
- Payment method: Card (Paystack) or PayPal.

**Step 4 — Completing Subscription Payment**
- David enters his card via Paystack.
- Paystack creates a Subscription via the Subscriptions API.
- Webhook `subscription.create` fires → Edge Function updates:
  - `subscriptions.plan` → `'basic'`
  - `subscriptions.status` → `'trialing'`
  - `subscriptions.current_period_end` → 14 days from now
- `plan_features` lookup now returns Basic-tier permissions.
- David's dashboard unlocks Basic features immediately.
- Welcome email sent: `subscription-welcome` template.

**Step 5 — Feature Unlocked**
- David is redirected back to the dashboard.
- The feature gates are gone for Basic features.
- He can now: add a second listing, enable payment methods, use instant booking.
- A toast notification: "You're now on Basic. Your 14-day trial has started."

**Exit State:** Subscription `plan = basic`, `status = trialing`. All Basic features unlocked.

---
---

# HOST PRO TIER JOURNEYS

---

## JH-05 — Host Sign-Up & Onboarding (Paid Plan)

**User:** Lerato (Host, Pro Plan)  
**Feature:** Host Sign-Up with immediate Pro subscription  
**Entry Point:** `wieloplatform.com/signup/host`  

### Journey

Steps 1–5 are identical to JH-01.

**Step 6 — Onboarding Wizard — Step 4: Choose a Plan**
- Lerato reviews the plans and selects **Pro** (R599/month).
- She is shown the 14-day free trial offer.

**Step 7 — Subscription Payment**
- Lerato enters her card via Paystack.
- Paystack Subscription created.
- `subscriptions` row: `{ plan: 'pro', status: 'trialing', billing_cycle: 'monthly' }`.
- `user_profiles.role` → `'host'`.
- All Pro features unlocked immediately.

**Step 8 — Welcome + Dashboard**
- Welcome screen with Pro badge.
- Checklist shows expanded setup items specific to Pro tier (payment methods, instant booking, etc.).

**Exit State:** Pro-tier host account created, trial started.

---

## JH-06 — Creating an Accommodation Listing (Full)

**User:** Lerato (Host, Pro Plan)  
**Feature:** Listing Management — Accommodation  
**Entry Point:** Dashboard → "New Listing" → "Accommodation"  

### Journey

**Step 1 — Basic Info Tab**
- Listing name, listing type (Guesthouse), full description (rich text).

**Step 2 — Photos Tab**
- Lerato drags and drops 12 photos.
- Photos upload to Supabase Storage: `listing-photos/[listing_id]/`.
- She reorders photos by drag-and-drop (first photo = cover image).
- Each upload shows a progress bar. Failed uploads show a retry button.

**Step 3 — Location Tab**
- She types the street address.
- A map auto-centres on the address (keyless OpenStreetMap / Leaflet).
- She drags the pin to the exact location.
- Coordinates (lat/long) stored in `listings.address` jsonb.
- **Exact address is private** — only shown to guests with confirmed bookings. Directory shows city/area only.

**Step 4 — Rooms & Capacity Tab**
- Bedrooms: 3, Bathrooms: 2, Max guests: 6.
- Room type checkboxes: King bed, Twin beds, Bunk beds.

**Step 5 — Amenities Tab**
- Grid of checkboxes: Wi-Fi, Pool, Braai/BBQ, Parking, Air conditioning, Kitchen, Garden, Pet-friendly, etc.
- "Add custom amenity" field for anything not on the list.

**Step 6 — Pricing Tab**
- Base rate: R1,200/night.
- Weekend rate: R1,500/night.
- Cleaning fee: R300.
- Seasonal pricing: Lerato adds a December override: R2,000/night for 1 Dec–7 Jan.
- Minimum nights: 2 (weekends), 1 (weekdays).

**Step 7 — Policies Tab**
- Check-in: 14:00, Check-out: 10:00.
- Cancellation policy: Strict.
- House rules (free text): "No smoking. No parties. Well-behaved pets welcome."

**Step 8 — Booking Settings Tab**
- Instant Booking: **On** (Pro feature).
- Payment methods accepted: Paystack ✅ PayPal ✅ EFT ✅.
- EFT banking details: pre-filled from host profile (editable per listing).

**Step 9 — Preview & Publish**
- Lerato clicks "Preview" — opens the public listing view in a new tab (with a "preview mode" banner).
- She reviews it looks correct.
- She clicks "Publish".
- `listings.is_published` → `true`.
- Listing appears in directory within 5 minutes (ranking cache refreshes every 15 min via `pg_cron`).

**Exit State:** Listing published with full Pro-tier features active.

---

## JH-07 — Creating an Experience Listing

**User:** Lerato (Host, Pro Plan)  
**Feature:** Listing Management — Experience  
**Entry Point:** Dashboard → "New Listing" → "Experience"  

### Journey

Steps follow JH-06 but with experience-specific fields:

**Step 1 — Basic Info**
- Name: "Sunrise Canoe Tour", Type: Activity.
- Description, photos.

**Step 2 — Logistics**
- Duration: 3 hours.
- Max participants: 8.
- Meeting point address (shown to guests post-booking).
- What to bring: "Sunscreen, water, comfortable shoes."

**Step 3 — Schedule**
- Lerato sets recurring slots: Tuesday, Thursday, Saturday at 06:30.
- Alternatively, she can specify individual dates only.
- Each slot stores as a schedule entry in `listings.settings.schedule` jsonb.

**Step 4 — Pricing**
- Per person: R450.
- Private group rate: R2,500 (up to 8).
- Minimum participants to confirm: 2 (if minimum not met by 48h before, session is auto-cancelled — post-MVP).

**Step 5 — Policies**
- Cancellation: Flexible (full refund 24h+ before session).

**Step 6 — Publish**
- Same as JH-06 Step 9.

---

## JH-08 — Managing the Availability Calendar

**User:** Lerato (Host, Pro Plan)  
**Feature:** Availability Calendar Management  
**Entry Point:** Dashboard → Listings → [Listing Name] → Calendar  

### Journey

**Step 1 — Calendar View**
- Monthly calendar view loads.
- Colour coding:
  - White: available
  - Green: confirmed booking (shows guest name on hover)
  - Blue: pending/unconfirmed booking
  - Grey: blocked by host
  - Red: past dates (locked)

**Step 2 — Blocking Dates**
- Lerato clicks and drags across 3 dates in July ("Owner use — family holiday").
- A modal: "Block these dates? Add a reason (optional)."
- She types "Owner use" and confirms.
- `blocked_dates` rows inserted for each date.
- Those dates immediately become unavailable on the public listing.

**Step 3 — Unblocking Dates**
- Lerato clicks a grey (blocked) date.
- Modal: "Unblock [date]? Guests will be able to book these dates again."
- She confirms → `blocked_dates` row deleted.

**Step 4 — Viewing a Booking from the Calendar**
- Lerato clicks a green booking block.
- A side panel opens with the booking summary: guest name, dates, amount, status.
- Quick actions: "Message Guest", "View Full Booking".

**Step 5 — Adding a Seasonal Rate from Calendar**
- Calendar has a "Pricing" tab.
- Lerato clicks "Add Seasonal Rate" → sets a date range and override price.
- Updates `listings.pricing.seasonal_overrides` jsonb.

**Exit State:** Calendar updated, availability reflected live on public listing.

---

## JH-09 — Receiving & Confirming a Booking Request

**User:** Lerato (Host, Pro Plan)  
**Feature:** Booking Management — Request to Book  
**Entry Point:** Push notification / email / inbox notification for a new booking request  

### Journey

**Step 1 — Notification**
- Amara has submitted a Request to Book (see JG-05).
- Lerato receives:
  - Push notification: "New booking request — Amara, 6–8 June, R2,000."
  - Email: New booking request with booking details.
  - Inbox badge increments.

**Step 2 — Reviewing the Request**
- Lerato opens the booking in her dashboard at `/dashboard/bookings/[id]`.
- She sees:
  - Guest: Amara [first name + last initial, avatar]
  - Listing: Featherstone Guesthouse
  - Dates: 6–8 June (2 nights)
  - Guests: 2
  - Total: R2,000 (payment method: PayPal — funds authorised)
  - Guest message (if any from JG-07 enquiry thread)
- Action buttons: **Confirm** | **Decline** | **Message Guest**

**Step 3 — Messaging Guest First (Optional)**
- Lerato wants to ask a question before confirming.
- She clicks "Message Guest" → opens the conversation thread in the inbox.
- She types: "Hi Amara! Just confirming — is it 2 adults?"
- Amara replies. Lerato is satisfied.

**Step 4 — Confirming the Booking**
- Lerato clicks "Confirm Booking".
- Confirmation modal: "Confirm Amara's booking for 6–8 June? Payment of R2,000 will be captured."
- She clicks "Yes, Confirm".
- `POST /functions/v1/booking-confirm` fires:
  - PayPal order captured.
  - `bookings.status` → `CONFIRMED`.
  - `payments.status` → `completed`.
  - Dates blocked in `blocked_dates`.
  - Amara notified (email + push).
  - Inbox system message: "Booking confirmed."
- Calendar updates immediately.
- Lerato sees a success toast: "Booking confirmed! ✅"

**Step 5 — 24-Hour Timer**
- The booking dashboard shows a countdown: "You have [X hours] to respond to this request."
- If Lerato hasn't acted in 24 hours, the booking is auto-cancelled (see JG-05 Step 6c).

**Exit State:** Booking `CONFIRMED`, payment captured, dates blocked, both parties notified.

---

## JH-10 — Receiving an Instant Booking

**User:** Lerato (Host, Pro Plan)  
**Feature:** Instant Booking  
**Entry Point:** Notification of a new confirmed booking  

### Journey

- A guest books Lerato's listing which has `instant_booking = true`.
- Lerato receives a notification: "New booking confirmed — [Guest Name], [dates]. No action needed."
- The booking is already `CONFIRMED` and payment captured (no approval step).
- Lerato opens the booking to see full details.
- The calendar is already blocked.
- A conversation thread has been auto-created.
- Lerato can optionally send a welcome message.

**Key Difference from JH-09:** No approval step. Lerato is informed, not asked.

---

## JH-11 — Managing the Inbox (Full)

**User:** Lerato (Host, Pro Plan)  
**Feature:** Inbox — Host View (Full)  
**Entry Point:** Inbox icon in dashboard navigation  

### Journey

**Step 1 — Inbox Overview**
- Left panel: list of all conversation threads, sorted by most recent.
- Each thread: guest name, listing, last message, time, booking status badge, unread dot.
- Tabs: All | Enquiries | Bookings | Archived.
- Search bar: search by guest name or keyword.

**Step 2 — Thread Actions**
- Lerato right-clicks (web) or long-presses (mobile) a thread:
  - Mark as unread
  - Archive
  - Delete (admin only; hosts can archive only)

**Step 3 — Inside a Thread**
- Message history in chronological order.
- Booking summary card pinned at the top of the thread.
- System messages styled differently (grey, italic): "Booking confirmed", "Guest cancelled", etc.
- Real-time updates via Supabase Realtime WebSocket — no refresh needed.

**Step 4 — Canned Replies (Pro Feature)**
- Lerato types `/` in the message box → a dropdown of saved templates appears:
  - "Check-in Instructions"
  - "Parking Directions"
  - "Welcome Message"
  - "House Rules"
- She selects "Check-in Instructions" → message box pre-fills with the template.
- She edits if needed and sends.

**Step 5 — Mark as Resolved**
- After the guest checks out and all communication is complete, Lerato clicks "Resolve" on the thread.
- Thread moves to the "Archived" tab.
- Unread badge clears.

**Exit State:** Inbox managed, all threads organised.

---

## JH-12 — Declining a Booking

**User:** Lerato (Host, Pro Plan)  
**Feature:** Booking Management — Decline  
**Entry Point:** Booking request in dashboard  

### Journey

**Step 1 — View Request**
- Lerato opens a pending booking request.

**Step 2 — Click Decline**
- She clicks "Decline Booking".
- A modal appears with a required decline reason (dropdown):
  - Property not available for those dates
  - Guest does not meet requirements
  - Minimum stay not met
  - Other (with free text)

**Step 3 — Confirm Decline**
- Lerato selects a reason and clicks "Confirm Decline".
- `POST /functions/v1/booking-cancel` fires with `initiated_by: 'host'`:
  - `bookings.status` → `CANCELLED_BY_HOST`.
  - `cancellation_reason` saved.
  - PayPal: authorisation voided (funds released immediately to guest).
  - Paystack: full refund issued.
  - EFT: if proof was uploaded, refund flagged for manual action.
  - Guest notified: email + push "Your booking request was not accepted."
  - Inbox system message: "Booking declined by host."

**Exit State:** Booking `CANCELLED_BY_HOST`, funds released, guest notified.  
**Note:** Lerato's decline rate is tracked. High decline rates can affect her ranking score in the directory.

---

## JH-13 — Cancelling a Confirmed Booking

**User:** Lerato (Host, Pro Plan)  
**Feature:** Booking Management — Host Cancellation  
**Entry Point:** Dashboard → Bookings → Confirmed booking  

### Journey

**Step 1 — View Confirmed Booking**
- Lerato opens a booking with status `CONFIRMED`.

**Step 2 — Initiate Cancellation**
- She clicks "Cancel Booking".
- A strong warning modal appears:
  > ⚠️ "Cancelling a confirmed booking impacts your guest's plans and your ranking score. Are you sure?"
  > Reason (required): Maintenance emergency / Property no longer available / Other.
- She enters her reason.

**Step 3 — Process Cancellation**
- `POST /functions/v1/booking-cancel` fires:
  - Full refund issued to guest regardless of cancellation policy (host-initiated cancellations always get full refund).
  - `bookings.status` → `CANCELLED_BY_HOST`.
  - Dates unblocked in `blocked_dates`.
  - Guest notified: email + push (high urgency).
  - Admin notified (for platform awareness of host cancellations).
  - Lerato's ranking score penalised (affects directory position).

**Exit State:** Booking cancelled, full refund, dates available again.

---

## JH-14 — Managing Check-In & Check-Out

**User:** Lerato (Host, Pro Plan)  
**Feature:** Booking Status Management  
**Entry Point:** Dashboard → Bookings → Confirmed booking on check-in day  

### Journey

**Marking Check-In**
- On the day of check-in, the booking appears in a "Today's Arrivals" section at the top of the bookings dashboard.
- Lerato clicks "Mark Checked In".
- `bookings.status` → `CHECKED_IN`.
- Guest receives: push notification "Enjoy your stay at Featherstone Guesthouse! 🏡"

**Marking Check-Out**
- On the day of check-out, the booking appears in "Today's Departures".
- Lerato clicks "Mark Checked Out".
- `bookings.status` → `COMPLETED`.
- `pg_cron` triggers the review request email to the guest 24 hours later (see JG-09).

**Adding Notes**
- At any point, Lerato can add internal notes to a booking (visible only to her and her staff):
  - "Guest travelling with a dog. Extra towels left in room."
  - "Guest requested late check-out — agreed 12:00."

---

## JH-15 — Responding to a Review

**User:** Lerato (Host, Pro Plan)  
**Feature:** Review Management — Host Response  
**Entry Point:** Notification "You have a new review" or Reviews dashboard  

### Journey

**Step 1 — Notification**
- Lerato receives: push + email "Amara left you a 5-star review!"

**Step 2 — Reviews Dashboard**
- Lerato opens `/dashboard/reviews`.
- All reviews listed: listing name, guest, date, star rating, review body, response status.
- Filter by: rating, listing, responded/not responded.
- Aggregate stats: overall score, breakdown by star.

**Step 3 — Writing a Response**
- Lerato clicks "Respond" on Amara's review.
- A text field expands inline.
- She writes: "Thank you so much Amara! It was a pleasure hosting you. Hope to see you again!"
- She clicks "Publish Response".
- `reviews.host_response` updated.
- Response appears publicly on the listing page below Amara's review.

**Step 4 — Editing a Response**
- Lerato realises she made a typo.
- She clicks "Edit Response" (available for 24 hours after publishing).
- She updates the text and re-publishes.

**Exit State:** Host response published alongside the review.

---

## JH-16 — Flagging a Review for Moderation

**User:** Lerato (Host, Pro Plan)  
**Feature:** Review Moderation  
**Entry Point:** Reviews dashboard  

### Journey

**Step 1 — View Concerning Review**
- Lerato sees a review that violates platform guidelines (contains personal attacks, false information).

**Step 2 — Flag the Review**
- She clicks "Flag Review".
- A modal: "Why are you flagging this review?" with options:
  - False/misleading information
  - Harassment or personal attacks
  - Booking never took place
  - Other (with text field)
- She selects her reason and submits.

**Step 3 — Review Held**
- `reviews.flagged = true`.
- The review's `is_published` status is toggled to `false` pending admin review.
- Super Admin (James) receives a notification in the admin panel moderation queue.
- Lerato sees: "Your flag has been received. The review will be reviewed by our team within 48 hours."

**Step 4 — Admin Decision**
- Admin reviews the flag (see JA-04).
- If upheld: review permanently removed, Lerato notified.
- If rejected: review restored, Lerato notified with reasoning.

---

## JH-17 — Managing EFT Payments & Proof of Payment

**User:** Lerato (Host, Pro Plan)  
**Feature:** Payments — EFT Verification  
**Entry Point:** Push notification or email: "New EFT proof of payment uploaded"  

### Journey

**Step 1 — Notification**
- Lerato receives: "Amara has uploaded proof of payment for booking VILO-2026-0234."

**Step 2 — Reviewing Proof**
- Lerato opens the booking in her dashboard.
- The proof of payment is displayed: image preview or PDF viewer inline.
- She also checks her banking app to confirm the deposit matches.

**Step 3 — Confirming Payment**
- Amounts match: Lerato clicks "Confirm Payment Received".
- `bookings.status` → `CONFIRMED`.
- `payments.status` → `completed`.
- Amara notified.

**Step 4 — Querying Payment**
- Something is wrong (wrong amount, wrong reference):
- Lerato clicks "Query Payment".
- A message is sent to Amara via the inbox: "Hi Amara, we received a payment but the amount doesn't match. Could you please check and re-upload?"
- Booking remains in `PENDING_EFT_REVIEW`.

**Step 5 — Setting Up Banking Details**
- Lerato navigates to Settings → Payment Methods → EFT.
- She enters her banking details: bank name, account holder, account number, branch code.
- She sets the reference format: `VILO-[booking_ref]` (auto-generated per booking).
- Details saved to `hosts.banking_details` jsonb (encrypted at rest).

---

## JH-18 — Inviting & Managing Staff

**User:** Lerato (Host, Pro Plan)  
**Feature:** Staff Management  
**Entry Point:** Dashboard → Settings → Team  

### Journey

**Step 1 — Invite Staff**
- Lerato navigates to Settings → Team → "Invite Team Member".
- She enters Sipho's email address and clicks "Send Invite".
- `POST /functions/v1/invite-staff` fires:
  - A staff invite record is created (with a unique token, expiry 7 days).
  - Email sent to Sipho: "Lerato has invited you to manage Featherstone Guesthouse on Wielo."

**Step 2 — Staff Accepts (see JS-01)**

**Step 3 — Managing Staff Members**
- Lerato's Team page shows: Sipho — Front Desk — Joined [date] — Active.
- She can:
  - Remove Sipho (revokes access immediately).
  - (Post-MVP): assign custom role with specific permissions.

**Step 4 — Staff Seat Limits**
- Pro plan allows 3 staff seats.
- Lerato has 2 seats filled. She tries to invite a third.
- The button is active (3 is within limit).
- If she tries to invite a 4th, she sees: "You've reached your staff limit on Pro. Upgrade to Business for 10 seats."

---

## JH-19 — Editing & Unpublishing a Listing

**User:** Lerato (Host, Pro Plan)  
**Feature:** Listing Management — Edit / Unpublish  
**Entry Point:** Dashboard → Listings → [Listing] → Edit  

### Journey

**Editing a Listing**
- Lerato opens the listing editor (same interface as creation, JH-06).
- She updates pricing (now R1,400/night base).
- She adds 3 new photos.
- She removes an amenity that is no longer offered.
- She clicks "Save Changes".
- `listings` table updated. Public listing reflects changes immediately.
- Existing confirmed bookings are **not** affected by pricing changes.

**Unpublishing a Listing**
- Lerato is doing renovations and wants to temporarily hide the listing.
- She clicks "Unpublish Listing" in the listing settings.
- Confirmation: "Unpublishing will hide this listing from the directory and from your public profile. Existing bookings are not affected."
- She confirms: `listings.is_published` → `false`.
- Listing disappears from directory immediately.
- Existing bookings remain intact.

---

## JH-20 — Managing the Public Profile Page

**User:** Lerato (Host, Pro Plan)  
**Feature:** Host Public Profile  
**Entry Point:** Dashboard → Profile → Edit Profile  

### Journey

**Step 1 — Edit Profile**
- Lerato opens her profile editor.
- Fields: Display name, bio, cover photo, profile avatar, languages spoken, social links.
- She writes a bio: "Welcome to Featherstone Guesthouse in the heart of the Winelands..."

**Step 2 — Custom Handle**
- Lerato changes her handle from `lerato-guesthouse` to `featherstone-guesthouse`.
- System checks availability: `hosts.handle` must be unique.
- Handle updated. Her URL is now `wieloplatform.com/featherstone-guesthouse`.
- Old URL redirects to new URL (301 redirect handled by Next.js middleware).

**Step 3 — Preview Profile**
- Lerato clicks "Preview Profile" → opens her public profile in a new tab.
- She sees exactly what guests see: all published listings, bio, reviews.

**Step 4 — Share Profile**
- Dashboard shows share tools:
  - Copy profile URL
  - Share to WhatsApp
  - Generate a QR code (downloads as PNG) — useful for printed materials.

---
---

# HOST BUSINESS TIER JOURNEYS

---

## JH-21 — Managing Multiple Listings

**User:** Nina (Host, Business Plan)  
**Feature:** Multi-Listing Management  
**Entry Point:** Dashboard → Listings  

### Journey

**Step 1 — Listings Overview**
- Nina has 7 listings: 5 accommodations (different lodges) + 2 experiences.
- Listings dashboard shows: name, type, status badge, tonight's bookings count, last booking date.
- Quick filters: Accommodation | Experience | Published | Unpublished.

**Step 2 — Bulk Actions**
- Nina selects 3 listings using checkboxes.
- Bulk actions available: Publish all / Unpublish all / Export data.

**Step 3 — Switching Between Listings**
- Nina opens booking management for a specific lodge.
- A "Listing" filter dropdown at the top of the bookings view lets her view bookings for all listings combined or filter to a specific one.

**Step 4 — Cross-Listing Calendar View**
- Nina navigates to Calendar.
- A multi-listing view shows all listings in a stacked horizontal timeline (Gantt-style).
- She can see at a glance which lodges are booked on any given week.

---

## JH-22 — Using Canned Replies in the Inbox

**User:** Nina (Host, Business Plan)  
**Feature:** Inbox — Canned Replies (Pro+)  
**Entry Point:** Inbox → Conversation thread → Message compose area  

### Journey

**Step 1 — Creating Templates**
- Nina navigates to Settings → Message Templates.
- She creates 5 templates:
  - "Welcome Message" — sent to all guests after booking confirmed.
  - "Check-In Instructions" — sent 24h before check-in.
  - "Parking & Directions"
  - "Late Check-Out Policy"
  - "Thank You & Review Request"

**Step 2 — Using a Template in Inbox**
- Nina opens a new booking conversation.
- She types `/` in the message box → template picker appears.
- She selects "Welcome Message" → message box fills with the template.
- She customises the guest's name (template supports `{{guest_name}}` variable substitution).
- She sends.

**Step 3 — Auto-Send Templates (Post-MVP)**
- In MVP, templates are manually sent.
- Post-MVP: templates can be triggered automatically (e.g., "Check-In Instructions" auto-sends 24h before check-in via `pg_cron`).

---

## JH-23 — Exporting Bookings as CSV

**User:** Nina (Host, Business Plan)  
**Feature:** Booking Export (Pro+)  
**Entry Point:** Dashboard → Bookings → Export  

### Journey

**Step 1 — Set Export Parameters**
- Nina clicks "Export Bookings".
- A panel opens: date range, listing filter, status filter.
- She selects: Jan–Dec 2026, all listings, all statuses.

**Step 2 — Generate & Download**
- She clicks "Export CSV".
- Edge Function generates the CSV from bookings data (only Nina's listings, enforced by RLS).
- File downloads automatically: `wielo-bookings-2026.csv`.
- CSV columns: Booking Ref, Guest Name, Listing, Check-in, Check-out, Guests, Amount, Currency, Payment Method, Status, Created At.

**Exit State:** CSV file on Nina's device.  
**Note:** Free and Basic tier hosts see the Export button locked with an upgrade prompt.

---
---

# STAFF JOURNEYS

---

## JS-01 — Accepting a Staff Invitation

**User:** Sipho (Staff, invited by Lerato)  
**Feature:** Staff Invitation Flow  
**Entry Point:** Email invitation from Lerato  

### Journey

**Step 1 — Email Received**
- Sipho receives: "Lerato has invited you to join Featherstone Guesthouse on Wielo as a team member."
- Email contains a "Accept Invitation" button linking to: `wieloplatform.com/invite/[token]`.

**Step 2 — Landing on Invite Page**
- Sipho clicks the link.
- If he has an existing Wielo account (as a guest): he's prompted to log in, then the invite is linked to his existing account.
- If he's new: a simplified sign-up form (name, password only — email is pre-filled from the invite).

**Step 3 — Account Created / Linked**
- `user_profiles.role` → `'staff'` (overrides 'guest' if was previously a guest account).
- `staff_members` row created: `{ host_id: lerato_host_id, user_id: sipho_id }`.
- Sipho is redirected to the host's dashboard view.
- He sees Lerato's property name and branding in the dashboard header.

**Step 4 — Staff Dashboard**
- Sipho's dashboard shows only the sections he has access to:
  - ✅ Bookings (view + confirm/decline)
  - ✅ Inbox (full access)
  - ✅ Calendar (view + manage availability)
  - ❌ Listings (view only — cannot edit)
  - ❌ Billing / Subscription (hidden)
  - ❌ Reviews (view only — cannot respond)
  - ❌ Team Settings (hidden)

**Exit State:** Sipho has staff access to Lerato's dashboard.

---

## JS-02 — Staff Managing the Inbox

**User:** Sipho (Staff)  
**Feature:** Inbox — Staff Access  
**Entry Point:** Inbox in staff dashboard  

### Journey

- Identical to JH-11 (Lerato's inbox journey) with the following differences:
- Sipho sees the same conversations as Lerato — inbox is shared.
- Both Lerato and Sipho can reply — guests see messages from the property name, not the individual's name.
- If both reply simultaneously, a conflict toast: "Lerato just sent a message — view it before replying."
- Sipho cannot access the "Canned Replies" settings (he can use templates Lerato created, but cannot create/edit them).

---

## JS-03 — Staff Confirming a Booking

**User:** Sipho (Staff)  
**Feature:** Booking Management — Staff Confirm  
**Entry Point:** Push notification about a new booking request  

### Journey

- Sipho and Lerato both receive the push notification for a new booking request.
- Sipho opens it first (Lerato is away from her phone).
- He reviews the booking details.
- He clicks "Confirm Booking".
- Same backend flow as JH-09.
- The audit trail records: `confirmed_by: sipho_user_id` (post-MVP enhancement).

---

## JS-04 — Staff Marking Check-In / Check-Out

**User:** Sipho (Staff)  
**Feature:** Booking Status Management — Staff  
**Entry Point:** Dashboard → Today's Arrivals  

### Journey

- On check-in day, Sipho opens the "Today's Arrivals" view.
- He sees Amara's booking.
- He greets Amara in person and clicks "Mark Checked In".
- `bookings.status` → `CHECKED_IN`.
- Lerato also sees the status update in real-time on her own dashboard.
- Same process for check-out.

---
---

# SUBSCRIPTION & BILLING JOURNEYS

---

## JB-01 — Choosing a Subscription Plan During Onboarding

**User:** Any new Host  
**Feature:** Subscription Selection + Payment  
**Entry Point:** Onboarding Wizard — Step 4  

### Journey

**Step 1 — Plan Comparison**
- Host sees a comparison table: Free | Basic | Pro | Business | Annual.
- Each plan card shows: price, listing limit, staff seats, key features included/locked.
- "Most Popular" badge on Pro. "Best Value" badge on Annual.

**Step 2 — Selecting Annual**
- Host selects "Annual" and chooses their tier (e.g., Pro Annual).
- Price displayed: R5,990/year (equivalent to 10 months — 2 months free vs monthly).
- Annual badge: "Save R1,198 per year vs monthly."

**Step 3 — Payment**
- Card (Paystack) or PayPal.
- 14-day free trial applied. Card is charged after 14 days.
- Subscription record created with `billing_cycle: 'annual'`, `status: 'trialing'`.

---

## JB-02 — Upgrading from Free to Paid

Already covered in JH-04.

---

## JB-03 — Upgrading from Basic to Pro

**User:** David (Host, Basic Plan)  
**Feature:** Subscription Upgrade  
**Entry Point:** Settings → Subscription → "Upgrade Plan"  

### Journey

**Step 1 — View Current Plan**
- Settings → Subscription shows: Basic | R299/month | Renews [date].
- "Upgrade" button visible.

**Step 2 — Select New Plan**
- David clicks "Upgrade" → plan comparison shown with Basic highlighted as current.
- He selects Pro.

**Step 3 — Proration**
- System calculates proration: he's 10 days into a 30-day cycle.
- He has 20 days remaining on Basic (value: ~R200).
- Pro is R599/month. He pays (R599 - R200) = R399 today for the remainder of the cycle.
- Next billing date: same as before, but charged at R599.

**Step 4 — Upgrade Applied**
- Paystack subscription plan updated via API.
- `subscriptions.plan` → `'pro'`.
- Pro features unlocked immediately.
- Welcome upgrade email sent.

---

## JB-04 — Switching to Annual Billing

**User:** Lerato (Host, Pro Monthly)  
**Feature:** Billing Cycle Change  
**Entry Point:** Settings → Subscription  

### Journey

- Lerato clicks "Switch to Annual".
- Confirmation: "Switch to Annual Pro at R5,990/year? You'll save R1,198. Your new billing date will be [date in 1 year]."
- She confirms. Paystack subscription updated.
- Any remaining days on monthly are credited.
- `subscriptions.billing_cycle` → `'annual'`.
- Confirmation email sent.

---

## JB-05 — Failed Subscription Payment & Grace Period

**User:** Lerato (Host, Pro Plan)  
**Feature:** Subscription Billing — Failed Payment Handling  
**Entry Point:** Paystack fires `invoice.payment_failed` webhook  

### Journey

**Day 0 — Payment Fails**
- Paystack attempts to charge Lerato's card on renewal date. Card is declined.
- Webhook fires → Edge Function:
  - `subscriptions.status` → `'past_due'`.
  - Lerato receives: push + email "Your payment failed. Please update your payment method within 5 days."
  - In-app banner on dashboard: "⚠️ Your subscription payment failed. Update payment method to avoid interruption."

**Day 1–4 — Grace Period**
- Lerato's account remains fully functional.
- Paystack retries payment on Day 3.

**Day 5 — Account Restricted**
- If payment still unpaid after 5-day grace period:
- `subscriptions.status` → `'restricted'`.
- `check_feature_permission` now returns Free-tier permissions only.
- Lerato's listings remain in the directory but `direct_booking` is disabled (enquiry-only).
- Dashboard shows prominent "Reactivate Subscription" banner.

**Reactivation**
- Lerato updates her card in Settings → Subscription → Payment Method.
- Paystack charges the outstanding amount.
- `subscriptions.status` → `'active'`.
- Full features restored immediately.

---

## JB-06 — Cancelling a Subscription

**User:** Lerato (Host, Pro Plan)  
**Feature:** Subscription Cancellation  
**Entry Point:** Settings → Subscription → Cancel  

### Journey

**Step 1 — Cancel Request**
- Lerato clicks "Cancel Subscription".
- A retention flow appears: "Before you go — here's what you'll lose:" with a feature checklist.
- Optionally: a "Pause instead?" option (post-MVP).
- She confirms cancellation.

**Step 2 — Cancellation Processed**
- Paystack subscription cancelled via API.
- `subscriptions.status` → `'cancelled'`.
- `subscriptions.current_period_end` remains set — she keeps Pro access until the end of the paid period.
- Confirmation email sent.

**Step 3 — After Period Ends**
- `pg_cron` detects `current_period_end < now()` and `status = 'cancelled'`.
- Account downgraded to Free tier automatically.
- Listings remain but switch to enquiry-only mode.

---
---

# SUPER ADMIN JOURNEYS

---

## JA-01 — Logging into the Admin Panel

**User:** James (Super Admin)  
**Feature:** Admin Authentication  
**Entry Point:** `admin.wieloplatform.com`  

### Journey

- James navigates to the admin subdomain.
- Standard Supabase login (email + password).
- After authentication, the middleware checks `user_profiles.role === 'super_admin'`.
- If not super_admin: redirected to the main app with "Access Denied".
- If super_admin: admin panel loads.
- All actions James takes are logged to `admin_audit_log` automatically via a middleware hook.

---

## JA-02 — Managing a Host Account

**User:** James (Super Admin)  
**Feature:** Admin — User Management  
**Entry Point:** Admin Panel → Hosts  

### Journey

**Finding a Host**
- James searches for "Featherstone" in the host search bar.
- Lerato's account appears.

**Viewing Account Detail**
- James clicks Lerato's account.
- Full account view: profile info, subscription status, all listings, all bookings (with payment amounts), review score, inbox message count, account notes.

**Suspending an Account**
- James identifies a policy violation.
- He clicks "Suspend Account".
- Reason field (required): "Multiple guest complaints — under investigation."
- Confirm: `hosts.is_active` → `false`.
- All Lerato's listings unpublished from directory immediately.
- Lerato's login still works but she sees a banner: "Your account has been suspended. Contact support@wieloplatform.com."
- Any pending bookings are flagged for admin review (guests notified separately).
- `admin_audit_log` entry created: `{ action: 'suspend_account', target_id: lerato_host_id, payload: { reason: '...' } }`.

**Unsuspending**
- James clicks "Unsuspend".
- `hosts.is_active` → `true`.
- Listings restored to their previous `is_published` states.
- Lerato notified by email.

---

## JA-03 — Overriding Feature Flags for a Specific Host

**User:** James (Super Admin)  
**Feature:** Admin — Per-Host Feature Override  
**Entry Point:** Admin Panel → Hosts → [Host] → Feature Overrides  

### Journey

**Scenario:** David (Free tier) has requested a temporary trial of the `direct_booking` feature.

**Step 1 — Open Overrides Panel**
- James opens David's account → "Feature Overrides" tab.
- Current plan: Free. Current permissions shown as a table (feature key | plan default | override).

**Step 2 — Add Override**
- James clicks "Add Override".
- Selects feature: `direct_booking`.
- Sets: Enabled = true.
- Sets expiry: 30 days from today.
- Adds reason: "Courtesy trial following sales call."
- Clicks "Save Override".
- `host_feature_overrides` row inserted.
- David's `check_feature_permission('direct_booking')` now returns `true` until expiry.
- `admin_audit_log` entry created.

**Step 3 — Override Expiry**
- After 30 days, `pg_cron` checks for expired overrides.
- Override row is either deleted or `expires_at` is in the past.
- `check_feature_permission` falls back to plan defaults (Free: `direct_booking = false`).
- David's direct booking feature is automatically revoked.
- David notified by email: "Your courtesy trial of Direct Booking has ended."

---

## JA-04 — Moderating a Flagged Review

**User:** James (Super Admin)  
**Feature:** Admin — Review Moderation  
**Entry Point:** Admin Panel → Reviews → Moderation Queue  

### Journey

**Step 1 — Moderation Queue**
- James opens the Reviews section → Moderation Queue tab.
- He sees Lerato's flagged review (from JH-16).
- Queue item shows: review text, guest, listing, Lerato's flag reason, date flagged.

**Step 2 — Evaluate**
- James reads the review and Lerato's flag reason.
- He checks the booking record to verify the stay occurred.

**Step 3a — Uphold Flag (Remove Review)**
- The review contains a personal attack. James clicks "Remove Review".
- `reviews.is_published` → `false` (permanently).
- Lerato notified: "Your flagged review has been removed."
- Guest notified: "Your review was removed for violating our community guidelines."
- `admin_audit_log` entry: `{ action: 'remove_review', target_id: review_id }`.

**Step 3b — Reject Flag (Restore Review)**
- The review is legitimate. James clicks "Reject Flag, Restore Review".
- `reviews.is_published` → `true`.
- `reviews.flagged` → `false`.
- Lerato notified: "After review, the flagged review has been reinstated."

---

## JA-05 — Managing a Disputed EFT Payment

**User:** James (Super Admin)  
**Feature:** Admin — Payment Management  
**Entry Point:** Admin Panel → Payments or via support ticket  

### Journey

**Scenario:** Amara paid EFT with the wrong reference. Lerato cannot match the payment.

**Step 1 — Locate the Payment**
- James searches by booking reference or guest name.
- He finds the booking in `PENDING_EFT_REVIEW` with a proof of payment uploaded.

**Step 2 — Review Proof**
- James views the uploaded proof of payment.
- He cross-references the amount and approximate date.

**Step 3 — Manual Match**
- James is satisfied it's the correct payment.
- He clicks "Manually Confirm Payment".
- Reason: "Payment matched by admin — incorrect reference used."
- `payments.status` → `completed`.
- `bookings.status` → `CONFIRMED`.
- Both parties notified.
- `admin_audit_log` entry created.

---

## JA-06 — Manually Adjusting a Subscription

**User:** James (Super Admin)  
**Feature:** Admin — Subscription Management  
**Entry Point:** Admin Panel → Hosts → [Host] → Subscription  

### Journey

**Scenario:** Lerato has been overcharged due to a billing error.

**Step 1 — View Subscription**
- James opens Lerato's subscription detail.
- Current: Pro Monthly, active, renews in 12 days.

**Step 2 — Extend Billing Period**
- James clicks "Extend Period".
- He adds 30 days as a credit: `current_period_end` extended by 30 days.
- Reason: "Compensation for billing error on [date]."
- Lerato notified: "Your subscription has been extended by 30 days as a courtesy."

**Step 3 — Manual Plan Change**
- James can also manually set `subscriptions.plan` to any value without a payment.
- This is used for: gifted upgrades, compensation, test accounts.
- All changes logged to `admin_audit_log`.

---

## JA-07 — Managing the Directory

**User:** James (Super Admin)  
**Feature:** Admin — Directory Controls  
**Entry Point:** Admin Panel → Directory  

### Journey

**Featuring a Listing**
- James wants to spotlight a newly onboarded lodge.
- He finds the listing and clicks "Feature in Directory".
- A `platform_settings` entry or a `featured_listings` table record is created.
- The listing appears in the "Featured" section on the directory homepage regardless of ranking.

**Hiding a Listing**
- A listing has received complaints about inaccurate photos.
- James clicks "Hide from Directory".
- `listings.is_published` → `false` at platform level (host cannot override this without admin approval).
- Host notified with reason.

**Awarding Verified Badge**
- James reviews a host's ID documents (uploaded via a verification request flow — post-MVP for document collection).
- He clicks "Award Verified Badge".
- `hosts.is_verified` → `true`.
- Verified badge appears on the host's listing cards in the directory.

**Adjusting Ranking Weights**
- James navigates to Directory → Ranking Settings.
- Sliders for each weight: Rating, Reviews, Profile Completeness, Response Rate, Plan Boost.
- Weights must sum to 1.0 (validated client-side).
- He adjusts and clicks "Save".
- `platform_settings` updated: `{ key: 'ranking_weights', value: { ... } }`.
- `pg_cron` ranking recalculation picks up new weights on next run (within 15 minutes).

---

## JA-08 — Impersonating a User

**User:** James (Super Admin)  
**Feature:** Admin — User Impersonation (for support)  
**Entry Point:** Admin Panel → Hosts or Guests → [User] → Impersonate  

### Journey

**Step 1 — Initiate Impersonation**
- James is on a support call with David who cannot see his listings.
- James opens David's account and clicks "Impersonate User".
- Warning modal: "You are about to view Wielo as David. All actions you take will be as David. This session is being recorded."
- James clicks "Confirm".

**Step 2 — Impersonation Session**
- James is redirected to the main app, now authenticated as David.
- A persistent red banner at the top: "⚠️ ADMIN MODE: You are viewing as David (david@example.com). [End Session]"
- James can see exactly what David sees — diagnose the issue.
- He can perform actions on David's behalf (e.g., publish a listing that is stuck in draft).

**Step 3 — Audit Log**
- Every action during the impersonation session is logged:
  - `admin_audit_log`: `{ action: 'impersonate_start', target_id: david_user_id }`.
  - All subsequent actions tagged with both `admin_id: james_id` AND `impersonating: david_id`.

**Step 4 — End Session**
- James clicks "End Session".
- He is returned to the admin panel.
- `admin_audit_log`: `{ action: 'impersonate_end', duration_seconds: 342 }`.

---

## JA-09 — Viewing Platform Analytics Dashboard

**User:** James (Super Admin)  
**Feature:** Admin — Platform Analytics  
**Entry Point:** Admin Panel → Dashboard  

### Journey

**Step 1 — KPI Overview**
- Top of admin dashboard shows real-time KPIs:
  - Active hosts: 47
  - Active guests: 312
  - Bookings this month: 128
  - Revenue processed this month: R284,500
  - MRR (subscription revenue): R18,450
  - New sign-ups today: 3
  - Average booking value: R2,222
  - Cancellation rate: 6.2%

**Step 2 — Drill-Down Charts**
- Bookings over time (line chart — daily/weekly/monthly toggle).
- Revenue by payment method (pie chart: Paystack 64%, PayPal 22%, EFT 14%).
- Subscription plan distribution (bar chart: Free 45%, Basic 25%, Pro 20%, Business 10%).
- Directory search analytics: top 10 search terms, zero-result queries, top clicked listings.

**Step 3 — Export**
- James can export any data view as CSV.

---

## JA-10 — Managing Platform Settings

**User:** James (Super Admin)  
**Feature:** Admin — Platform Configuration  
**Entry Point:** Admin Panel → Settings  

### Journey

**Adjustable Settings:**

| Setting | Current Value | Editable? |
|---|---|---|
| Free trial days | 14 | ✅ |
| Grace period (days) | 5 | ✅ |
| Booking auto-expiry (minutes) | 30 | ✅ |
| EFT booking hold period (hours) | 48 | ✅ |
| Review auto-publish delay (hours) | 48 | ✅ |
| Host no-response auto-cancel (hours) | 24 | ✅ |
| Ranking weight: Rating | 0.30 | ✅ |
| Ranking weight: Reviews | 0.20 | ✅ |
| Ranking weight: Profile | 0.15 | ✅ |
| Ranking weight: Response Rate | 0.15 | ✅ |
| Ranking weight: Plan Boost | 0.20 | ✅ |
| Directory results per page | 24 | ✅ |
| Subscription prices | R299/R599/R1,199 | ✅ |
| Supported currencies | ZAR, USD | ✅ |
| Max photos per listing | 20 | ✅ |
| Message inbox limit (free) | 10 | ✅ |

**Process:**
- James adjusts a value and clicks "Save".
- Change is written to `platform_settings` table.
- `admin_audit_log` records: `{ action: 'update_setting', payload: { key: '...', old_value: '...', new_value: '...' } }`.
- Changes take effect immediately (Edge Functions and `check_feature_permission` always read from `platform_settings` live).

---

## Planned Journey Additions (v1.1 — Refund Manager & Policy Manager)

The following journeys correspond to features added in `wielo-platform-mvp.md` v1.2 and are scheduled for the next customer journey document revision. Until then, refer to the MVP spec sections 6.9 and 6.10 for full flow detail.

| Journey ID | User | Feature | Entry Point |
|---|---|---|---|
| JG-11 | Amara (Guest) | Submitting a refund request after cancellation | `/bookings/[id]` → Refund Request form |
| JG-12 | Amara (Guest) | Escalating a declined refund to admin | Booking detail → "Dispute this decision" |
| JH-24 | Lerato (Host) | Reviewing and approving a refund request | Dashboard → Payments → Refunds → Pending |
| JH-25 | Lerato (Host) | Declining a refund request with reason | Dashboard → Refund detail → Decline |
| JH-26 | Lerato (Host) | Processing a manual EFT refund | Dashboard → Refund detail → Mark Sent |
| JH-27 | Lerato (Host) | Creating a cancellation policy in Policy Library | Dashboard → Settings → Policy Library → New |
| JH-28 | Lerato (Host) | Assigning a policy to a listing | Listing Editor → Policies tab |
| JG-13 | Amara (Guest) | Reading and acknowledging policies before booking | Booking Summary → Policy acknowledgement checkbox |
| JA-11 | James (Admin) | Reviewing and resolving a refund escalation | Admin → Payments → Refund Disputes |
| JA-12 | James (Admin) | Managing platform default policy templates | Admin → Settings → Policy Templates |

---

## Integration & System Event Map

The following table summarises all system events, what triggers them, and what fires as a result:

| Event | Trigger | DB Write | Email | Push | Realtime |
|---|---|---|---|---|---|
| Guest signs up | Form submit | user_profiles insert | Verification email | — | — |
| Host completes onboarding | Wizard step 5 | hosts insert, subscriptions insert | subscription-welcome | — | — |
| Listing published | Host clicks publish | listings.is_published = true | — | — | — |
| Enquiry submitted | Guest submits form | conversations + messages insert | Enquiry notification | Host push | Inbox badge |
| Booking request created | booking-create Edge Fn | bookings insert (PENDING) | Booking request | Host push | Inbox system msg |
| Payment confirmed (Paystack) | Paystack webhook | payments + bookings updated | Both confirmations | Guest push | Booking status |
| Payment confirmed (PayPal) | PayPal webhook | payments + bookings updated | Both confirmations | Guest push | Booking status |
| EFT proof uploaded | eft-proof-upload Edge Fn | bookings.eft_proof_url | EFT proof received | Host push | Inbox msg |
| Booking confirmed by host | booking-confirm Edge Fn | bookings CONFIRMED | Both confirmations | Guest push | Booking status |
| Booking declined | booking-cancel (host) | bookings CANCELLED_BY_HOST | Guest declined | Guest push | Inbox msg |
| Booking cancelled by guest | booking-cancel (guest) | bookings CANCELLED_BY_GUEST | Host notification | Host push | Booking status |
| Booking auto-cancelled (no response) | pg_cron | bookings CANCELLED_BY_HOST | Both notified | Both push | — |
| Check-in marked | Host/staff action | bookings CHECKED_IN | — | Guest push | — |
| Check-out marked | Host/staff action | bookings COMPLETED | — | — | — |
| Review request sent | pg_cron (24h post checkout) | — | review-request | Guest push | — |
| Review submitted | review-submit Edge Fn | reviews insert | Host new review | Host push | — |
| Review published | pg_cron (48h after submission) | reviews.is_published = true | — | — | — |
| Review response published | Host action | reviews.host_response | — | — | — |
| Review flagged | Host action | reviews.flagged = true | Admin notification | — | Admin queue |
| Message sent | Supabase Realtime | messages insert | (digest, not instant) | Recipient push | Thread update |
| Staff invited | invite-staff Edge Fn | staff_invites insert | Staff invite email | — | — |
| Staff accepted invite | Accept flow | staff_members insert | — | — | — |
| Subscription created | Paystack/PayPal webhook | subscriptions insert | subscription-welcome | — | — |
| Subscription payment failed | Paystack webhook | subscriptions.status = past_due | Failed payment email | Host push | Dashboard banner |
| Subscription restricted | pg_cron (grace period end) | subscriptions.status = restricted | Restricted email | Host push | Dashboard banner |
| Account suspended (admin) | Admin action | hosts.is_active = false | Suspended email | — | — |
| Feature override added | Admin action | host_feature_overrides insert | Admin confirmation | — | — |
| Feature override expired | pg_cron | override expires | Expiry email | Host push | — |
| Refund request submitted | Guest submits request | refund_requests insert (pending) | Host: refund request email | Host push | — |
| Refund approved by host | refund-process Edge Fn | refund_requests → approved | Guest: refund approved email | Guest push | Booking status |
| Refund declined by host | refund-decline Edge Fn | refund_requests → declined | Guest: refund declined email | Guest push | — |
| Refund completed (provider) | Paystack/PayPal webhook | refund_requests → completed | Both: refund completed email | Guest push | — |
| EFT refund marked sent | Host/staff action | refund_requests → processing | Guest: EFT refund sent email | Guest push | — |
| Refund escalated to admin | Guest action | refund_requests → escalated | Admin: dashboard alert | — | Admin queue |
| Admin forces refund | Admin action | refund_requests → processing | Host: admin override email | Guest push | — |
| Policy assigned to listing | Host action | listing_policies insert | — (dashboard warning if active bookings) | — | — |
| Policy snapshot taken | booking-create Edge Fn | policy_snapshots insert | Included in booking confirmation | — | — |
| Guest acknowledges policy | Checkout checkbox | bookings.policy_acknowledged = true | — (silent record) | — | — |
| Listing missing policy alert | pg_cron (daily) | — | Host: missing policy email | Host push | — |
| Impersonation started | Admin action | admin_audit_log insert | — | — | — |

---

*This document is a living specification. All journeys should be reviewed and updated when features change. Reference alongside `wielo-platform-mvp.md` (v1.2), `supabase_database.md` (v1.1), and `DevStack.md` (v1.0).*
