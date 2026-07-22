import type { EventBuilder, InAppPayload, PushPayload } from "./types";

// ──────────────────────────────────────────────────────────────────────────
// NOTIFICATION_REGISTRY — runtime source of truth.
//
// Adding a new notification type = 3 places (max):
//   1. Add a registry entry here.
//   2. INSERT into notification_events in a new migration (use the same
//      kind string, category_id, feature, severity, email_template_key).
//   3. (Optional) If the email needs DB hydration: add a resolver in
//      apps/web/lib/email/resolvers/ and register it in index.ts. If the
//      caller passes the full payload OR there's no email channel, skip.
//
// The settings UI, bell filter tabs, admin send history, and audit log
// all read from notification_events + notification_categories so new
// entries are picked up automatically — no UI code change needed.
// ──────────────────────────────────────────────────────────────────────────

// ─── Payload shapes per event ────────────────────────────────────────────
// These are the keys callers pass into dispatchEvent's `refs`. The dispatcher
// writes them verbatim to notification_queue.payload, where drain.ts merges
// them with the resolver's output (caller wins on conflicts).

export type BookingRefs = {
  booking_id: string;
  listing_name?: string;
  guest_first_name?: string;
  host_first_name?: string;
  check_in?: string;
  check_out?: string;
  check_in_time?: string;
  /** Set when the booking redeemed a SPECIAL/offer — surfaces the deal title so
   *  the host notification says a special was booked, not a plain room request. */
  special_title?: string;
};

export type EftRefs = {
  booking_id: string;
  listing_name?: string;
  guest_first_name?: string;
};

export type RefundRefs = {
  refund_id?: string;
  booking_id: string;
  listing_name?: string;
  guest_first_name?: string;
  refund_amount?: string;
  /** Injected by dispatchEvent for branded push/in-app copy. */
  brand_name?: string;
};

export type ReviewRefs = {
  booking_id?: string;
  review_id?: string;
  listing_name?: string;
  host_first_name?: string;
  guest_first_name?: string;
  rating?: number;
  excerpt?: string;
  /** Tokenised relative review path (built via buildReviewPath) for in-app + push. */
  review_path?: string;
};

export type QuoteRefs = {
  quoteId: string;
  guestFirstName?: string;
  listingName?: string;
  /** accommodation | custom | upload — custom/upload have no listing/dates. */
  quoteType?: string;
  /** Headline for a custom/upload quote (no listing name). */
  title?: string;
  hostName?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  totalAmount?: string;
  quoteNumber?: string;
  validUntil?: string;
  /** Public accept-token → the /q/[id]/[token] page (no login to accept). */
  acceptToken?: string;
};

export type SubscriptionRefs = {
  subscription_id?: string;
  plan_name?: string;
  renewal_date?: string;
  formatted_price?: string;
  /** Injected by dispatchEvent for branded push/in-app copy. */
  brand_name?: string;
};

export type MessageRefs = {
  conversation_id: string;
  message_body: string;
  sender_first_name: string;
  unread_count?: number;
};

export type QuoteRequestRefs = {
  conversation_id: string;
  guest_first_name?: string;
  listing_name?: string;
};

export type WebsiteEnquiryRefs = {
  conversation_id: string;
  guest_first_name?: string;
  site_name?: string;
};

export type ICalRefs = {
  property_id: string;
  feed_label: string;
};

export type AccountRefs = {
  host_id?: string;
  reason?: string;
};

export type CreditsRefs = {
  /** How many credits were added (positive). */
  amount?: number | string;
  /** New wallet balance after the grant. */
  balance?: number | string;
  reason?: string;
};

export type ListingPublishedRefs = {
  property_id: string;
  host_id?: string;
  listing_name?: string;
  /** Injected by dispatchEvent for branded push/in-app copy. */
  brand_name?: string;
};

export type BroadcastRefs = {
  broadcast_id: string;
  title: string;
  body: string;
  link_url?: string;
  link_label?: string;
};

export type IndividualMessageRefs = {
  batch_id: string;
  title: string;
  body: string;
  link_url?: string;
  link_label?: string;
};

export type DigestRefs = {
  category_id: string;
  category_label: string;
  item_count: number;
};

export type LookingForRefs = {
  post_id: string;
  post_title?: string;
  quote_id?: string;
  host_display_name?: string;
  guest_first_name?: string;
  location_text?: string;
  check_in_date?: string;
  quote_amount?: string;
  expires_in_days?: number;
  // Passed through to the QuoteSentGuest email for looking_for_quote_received
  // (the in-app/push builders ignore these — they render the guest's email).
  guestFirstName?: string;
  listingName?: string;
  quoteType?: string;
  title?: string;
  hostName?: string;
  checkIn?: string;
  checkOut?: string;
  // The guest's originally requested window (+ flexibility), shown on the quote
  // email beside the host's quoted dates.
  requestedDates?: string;
  nights?: number;
  totalAmount?: string;
  quoteNumber?: string;
  validUntil?: string;
  acceptToken?: string;
  // Additional camelCase props consumed by the Looking-For host/guest emails
  // (accepted/declined/new-request/expiring). Snake-case keys above still feed
  // the in-app + push builders.
  hostFirstName?: string;
  guestName?: string;
  postTitle?: string;
  locationText?: string;
  guests?: string;
  budget?: string;
  expiresInDays?: number;
  quoteCount?: number;
  postId?: string;
  quoteId?: string;
  // Why the guest declined (host-facing) — label + optional free-text note.
  declineReason?: string;
  declineNote?: string;
};

export type AffiliateRefs = {
  /** Formatted money string, e.g. "R 89.90". */
  amount?: string;
  /** Partner's first name, for the pause/resume email greeting. */
  firstName?: string;
  /** Competition this refers to. */
  campaignName?: string;
  /** "true" when the partner has been paused out of a competition. */
  paused?: string;
  /** Why they were paused — written for the partner to read. */
  reason?: string;
  /** What the commission was for (product name) or the payout method. */
  detail?: string;
  /** The affiliate's email — routes the "custom" email recipient. */
  recipient_email?: string;
  /** Injected by dispatchEvent for branded push/in-app copy. */
  brand_name?: string;
};

// Helpers
const clip = (s: string, max = 140): string =>
  s.length <= max ? s : `${s.slice(0, max - 1)}…`;

const link = (
  screen: string,
  params?: Record<string, string>,
): PushPayload["data"] => ({ screen, params });

// ─── Registry ────────────────────────────────────────────────────────────

export const NOTIFICATION_REGISTRY = {
  // ─── Onboarding
  welcome_host: {
    category: "account_security",
    feature: "account",
    severity: "default",
    emailTemplate: "welcome_host",
    refKeys: ["host_id"],
    dedupeKey: () => null,
  } satisfies EventBuilder<AccountRefs>,

  // Onboarding milestone — the host's listing just went live.
  listing_published_host: {
    category: "account_security",
    feature: "account",
    severity: "default",
    emailTemplate: "listing_published_host",
    refKeys: ["property_id"],
    inApp: (r) => ({
      title: "Your listing is live 🎉",
      body: `${r.listing_name ?? "Your listing"} is now published and bookable.`,
      link: "/dashboard",
    }),
    dedupeKey: (r) => `listing_published:${r.property_id}`,
  } satisfies EventBuilder<ListingPublishedRefs>,

  // Wielo (an admin) topped up the user's credit wallet.
  credits_added_admin: {
    category: "subscription",
    feature: "account",
    severity: "default",
    refKeys: ["amount"],
    push: (r) => ({
      title: "Credits added to your account",
      body: clip(
        `Wielo added ${r.amount ?? "some"} credit${String(r.amount) === "1" ? "" : "s"} to your account.`,
      ),
      data: link("/dashboard/credits"),
      sound: null,
    }),
    inApp: (r) => ({
      title: "Credits added to your account",
      body: `Wielo added ${r.amount ?? "some"} credit${String(r.amount) === "1" ? "" : "s"} to your account${r.balance != null ? ` — your balance is now ${r.balance}` : ""}.`,
      link: "/dashboard/credits",
    }),
    dedupeKey: () => null,
  } satisfies EventBuilder<CreditsRefs>,

  // ─── Bookings (host)
  booking_request_host: {
    category: "bookings",
    feature: "booking",
    severity: "high",
    emailTemplate: "booking_request_host",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: r.special_title ? "New special booking" : "New booking request",
      body: clip(
        r.special_title
          ? `${r.guest_first_name ?? "A guest"} booked your “${r.special_title}” special at ${r.listing_name ?? "your listing"}`
          : `${r.guest_first_name ?? "A guest"} wants to book ${r.listing_name ?? "your listing"}`,
      ),
      data: link("/dashboard/bookings/[id]", { id: r.booking_id }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: r.special_title ? "New special booking" : "New booking request",
      body: r.special_title
        ? `${r.guest_first_name ?? "A guest"} booked “${r.special_title}” · ${r.listing_name ?? "your listing"}`
        : `${r.guest_first_name ?? "A guest"} · ${r.listing_name ?? "your listing"}`,
      link: `/dashboard/bookings/${r.booking_id}`,
    }),
    dedupeKey: (r) => `booking_request:${r.booking_id}`,
  } satisfies EventBuilder<BookingRefs>,

  booking_confirmed_host: {
    category: "bookings",
    feature: "booking",
    severity: "high",
    emailTemplate: "booking_confirmed_host",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "New booking confirmed",
      body: clip(
        `${r.guest_first_name ?? "A guest"} booked ${r.listing_name ?? "your listing"}`,
      ),
      data: link("/dashboard/bookings/[id]", { id: r.booking_id }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "Booking confirmed",
      body: `${r.guest_first_name ?? "A guest"} · ${r.listing_name ?? "your listing"}`,
      link: `/dashboard/bookings/${r.booking_id}`,
    }),
    dedupeKey: (r) => `booking_confirmed:${r.booking_id}`,
  } satisfies EventBuilder<BookingRefs>,

  booking_cancelled_host: {
    category: "bookings",
    feature: "booking",
    severity: "default",
    emailTemplate: "booking_cancelled_host",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "Booking cancelled",
      body: clip(
        `${r.guest_first_name ?? "A guest"} cancelled their booking at ${r.listing_name ?? "your listing"}`,
      ),
      data: link("/dashboard/bookings/[id]", { id: r.booking_id }),
      sound: "default",
    }),
    inApp: (r) => ({
      title: "Guest cancelled booking",
      body: `${r.guest_first_name ?? "A guest"} · ${r.listing_name ?? "your listing"}`,
      link: `/dashboard/bookings/${r.booking_id}`,
    }),
    dedupeKey: (r) => `booking_cancelled_host:${r.booking_id}`,
  } satisfies EventBuilder<BookingRefs>,

  check_in_reminder_host: {
    category: "bookings",
    feature: "booking",
    severity: "default",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "Guest arriving tomorrow",
      body: clip(
        `${r.guest_first_name ?? "Your guest"} checks in at ${r.listing_name ?? "your listing"}${r.check_in_time ? ` at ${r.check_in_time}` : ""}`,
      ),
      data: link("/dashboard/bookings/[id]", { id: r.booking_id }),
    }),
    inApp: (r) => ({
      title: "Check-in tomorrow",
      body: `${r.guest_first_name ?? "Your guest"} · ${r.listing_name ?? "your listing"}`,
      link: `/dashboard/bookings/${r.booking_id}`,
    }),
    dedupeKey: (r) => `checkin_host:${r.booking_id}`,
  } satisfies EventBuilder<BookingRefs>,

  // ─── Bookings (guest)
  booking_confirmed_guest: {
    category: "bookings",
    feature: "booking",
    severity: "high",
    emailTemplate: "booking_confirmed_guest",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "Booking confirmed! 🎉",
      body: clip(`Your stay at ${r.listing_name ?? "your stay"} is confirmed.`),
      data: link("/portal/trips/[id]", { id: r.booking_id }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "Booking confirmed",
      body: r.listing_name ?? "Your stay is locked in.",
      link: `/portal/trips/${r.booking_id}`,
    }),
    dedupeKey: (r) => `booking_confirmed_guest:${r.booking_id}`,
  } satisfies EventBuilder<BookingRefs>,

  booking_declined_guest: {
    category: "bookings",
    feature: "booking",
    severity: "default",
    emailTemplate: "booking_declined_guest",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "Booking not available",
      body: clip(
        `${r.listing_name ?? "Your stay"} couldn't take your booking.`,
      ),
      data: link("/explore"),
      sound: "default",
    }),
    inApp: (r) => ({
      title: "Booking declined",
      body: r.listing_name ?? "The host couldn't accept this stay.",
      link: `/portal/trips/${r.booking_id}`,
    }),
    dedupeKey: (r) => `booking_declined:${r.booking_id}`,
  } satisfies EventBuilder<BookingRefs>,

  // Host cancelled a no-show/abandoned booking and forfeited the amount paid.
  // Distinct from booking_cancelled_guest (whose copy promises a refund).
  booking_forfeited_guest: {
    category: "bookings",
    feature: "booking",
    severity: "high",
    emailTemplate: "booking_forfeited_guest",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "Your booking was cancelled",
      body: clip(
        `Your booking at ${r.listing_name ?? "your stay"} was cancelled as a no-show. Per the cancellation policy, no refund is due.`,
      ),
      data: link("/portal/trips/[id]", { id: r.booking_id }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "Booking cancelled — no refund",
      body: r.listing_name ?? "Cancelled as a no-show; no refund due.",
      link: `/portal/trips/${r.booking_id}`,
    }),
    dedupeKey: (r) => `booking_forfeited_guest:${r.booking_id}`,
  } satisfies EventBuilder<BookingRefs>,

  booking_cancelled_guest: {
    category: "bookings",
    feature: "booking",
    severity: "high",
    emailTemplate: "booking_cancelled_guest",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "Your booking was cancelled",
      body: clip(
        `Your booking at ${r.listing_name ?? "your stay"} was cancelled. A refund is on its way.`,
      ),
      data: link("/portal/trips/[id]", { id: r.booking_id }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "Booking cancelled by host",
      body: r.listing_name ?? "Please check your refund email.",
      link: `/portal/trips/${r.booking_id}`,
    }),
    dedupeKey: (r) => `booking_cancelled_guest:${r.booking_id}`,
  } satisfies EventBuilder<BookingRefs>,

  check_in_reminder_guest: {
    category: "bookings",
    feature: "booking",
    severity: "default",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "Check-in tomorrow!",
      body: clip(
        `${r.listing_name ?? "Your stay"}${r.check_in_time ? ` · Check in at ${r.check_in_time}` : ""}`,
      ),
      data: link("/portal/trips/[id]", { id: r.booking_id }),
    }),
    inApp: (r) => ({
      title: "Check-in tomorrow",
      body: r.listing_name ?? "Your stay starts soon",
      link: `/portal/trips/${r.booking_id}`,
    }),
    dedupeKey: (r) => `checkin_guest:${r.booking_id}`,
  } satisfies EventBuilder<BookingRefs>,

  // ─── Payments / EFT
  eft_instructions_guest: {
    category: "payments_refunds",
    feature: "booking",
    severity: "high",
    emailTemplate: "eft_instructions_guest",
    refKeys: ["booking_id"],
    inApp: (r) => ({
      title: "EFT payment instructions",
      body: r.listing_name ?? "Bank transfer details for your booking",
      link: `/portal/trips/${r.booking_id}`,
    }),
    dedupeKey: (r) => `eft_instructions:${r.booking_id}`,
  } satisfies EventBuilder<EftRefs>,

  eft_proof_received_host: {
    category: "payments_refunds",
    feature: "booking",
    severity: "high",
    emailTemplate: "eft_proof_received_host",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "Payment proof received",
      body: clip(
        `${r.guest_first_name ?? "A guest"} uploaded EFT proof for ${r.listing_name ?? "their booking"}.`,
      ),
      data: link("/dashboard/bookings/[id]", { id: r.booking_id }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "EFT proof received",
      body: `${r.guest_first_name ?? "A guest"} · ${r.listing_name ?? ""}`.trim(),
      link: `/dashboard/bookings/${r.booking_id}`,
    }),
    dedupeKey: (r) => `eft_proof:${r.booking_id}`,
  } satisfies EventBuilder<EftRefs>,

  eft_refund_sent_guest: {
    category: "payments_refunds",
    feature: "refund",
    severity: "default",
    emailTemplate: "eft_refund_sent_guest",
    refKeys: ["refund_id"],
    push: (r) => ({
      title: "EFT refund sent",
      body: clip(
        `Your refund for ${r.listing_name ?? "your booking"} has been sent.`,
      ),
      data: link("/portal/trips/[id]", { id: r.booking_id }),
    }),
    inApp: (r) => ({
      title: "EFT refund sent",
      body: r.listing_name ?? "Your refund is on its way.",
      link: `/portal/trips/${r.booking_id}`,
    }),
    dedupeKey: (r) => `eft_refund:${r.refund_id ?? r.booking_id}`,
  } satisfies EventBuilder<RefundRefs>,

  // ─── Refunds
  refund_request_host: {
    category: "payments_refunds",
    feature: "refund",
    severity: "high",
    emailTemplate: "refund_request_host",
    refKeys: ["refund_id"],
    push: (r) => ({
      title: "Refund request",
      body: clip(
        `${r.guest_first_name ?? "A guest"} requested a refund${r.refund_amount ? ` of ${r.refund_amount}` : ""}.`,
      ),
      data: link("/dashboard/payments/refunds/[id]", {
        id: r.refund_id ?? r.booking_id,
      }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "Refund request",
      body: `${r.guest_first_name ?? "A guest"} · ${r.listing_name ?? ""}`.trim(),
      link: `/dashboard/payments/refunds/${r.refund_id ?? r.booking_id}`,
    }),
    dedupeKey: (r) => `refund_request:${r.refund_id ?? r.booking_id}`,
  } satisfies EventBuilder<RefundRefs>,

  refund_approved_guest: {
    category: "payments_refunds",
    feature: "refund",
    severity: "default",
    emailTemplate: "refund_approved_guest",
    refKeys: ["refund_id"],
    push: (r) => ({
      title: "Refund approved",
      body: clip(
        `Your refund${r.refund_amount ? ` of ${r.refund_amount}` : ""} for ${r.listing_name ?? "your booking"} is on its way.`,
      ),
      data: link("/portal/trips/[id]", { id: r.booking_id }),
      sound: "default",
    }),
    inApp: (r) => ({
      title: "Refund approved",
      body: r.listing_name ?? "Your refund is on its way.",
      link: `/portal/trips/${r.booking_id}`,
    }),
    dedupeKey: (r) => `refund_approved:${r.refund_id ?? r.booking_id}`,
  } satisfies EventBuilder<RefundRefs>,

  refund_declined_guest: {
    category: "payments_refunds",
    feature: "refund",
    severity: "default",
    emailTemplate: "refund_declined_guest",
    refKeys: ["refund_id"],
    push: (r) => ({
      title: "Refund request update",
      body: clip(
        `Your refund request for ${r.listing_name ?? "your booking"} wasn't approved.`,
      ),
      data: link("/portal/trips/[id]", { id: r.booking_id }),
      sound: "default",
    }),
    inApp: (r) => ({
      title: "Refund declined",
      body: r.listing_name ?? "Tap to view details and dispute if needed.",
      link: `/portal/trips/${r.booking_id}`,
    }),
    dedupeKey: (r) => `refund_declined:${r.refund_id ?? r.booking_id}`,
  } satisfies EventBuilder<RefundRefs>,

  refund_completed_guest: {
    category: "account_security",
    feature: "refund",
    severity: "default",
    emailTemplate: "refund_completed_guest",
    refKeys: ["refund_id"],
    push: (r) => ({
      title: "Refund completed",
      body: clip(
        `Your refund for ${r.listing_name ?? "your booking"} has been processed.`,
      ),
      data: link("/portal/trips/[id]", { id: r.booking_id }),
    }),
    inApp: (r) => ({
      title: "Refund completed",
      body: r.listing_name ?? "Funds returned.",
      link: `/portal/trips/${r.booking_id}`,
    }),
    dedupeKey: (r) => `refund_completed:${r.refund_id ?? r.booking_id}`,
  } satisfies EventBuilder<RefundRefs>,

  refund_admin_override_host: {
    category: "payments_refunds",
    feature: "refund",
    severity: "high",
    emailTemplate: "refund_admin_override_host",
    refKeys: ["refund_id"],
    inApp: (r) => ({
      title: "Refund override applied",
      body:
        r.listing_name ?? `${r.brand_name ?? "Wielo"} support issued a refund.`,
      link: `/dashboard/payments/refunds/${r.refund_id ?? r.booking_id}`,
    }),
    dedupeKey: (r) => `refund_override:${r.refund_id ?? r.booking_id}`,
  } satisfies EventBuilder<RefundRefs>,

  // ─── Reviews
  review_request_guest: {
    category: "reviews",
    feature: "review",
    severity: "info",
    emailTemplate: "review_request_guest",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "How was your stay?",
      body: clip(
        `Tell ${r.host_first_name ?? "your host"} how it went at ${r.listing_name ?? "your stay"}.`,
      ),
      data: link("/review/[id]", { id: r.booking_id ?? "" }),
      sound: null,
    }),
    inApp: (r) => ({
      title: "How was your stay?",
      body: `Leave a review for ${r.listing_name ?? "your stay"} — it takes about 30 seconds.`,
      link: r.review_path ?? `/review/${r.booking_id ?? ""}`,
    }),
    dedupeKey: (r) => `review_request:${r.booking_id ?? "x"}`,
  } satisfies EventBuilder<ReviewRefs>,

  new_review_host: {
    category: "reviews",
    feature: "review",
    severity: "default",
    emailTemplate: "new_review_host",
    refKeys: ["review_id"],
    push: (r) => ({
      title:
        `${r.guest_first_name ?? "A guest"} left a ${r.rating ?? ""}-star review`.replace(
          /\s+/g,
          " ",
        ),
      body: clip(r.excerpt ?? r.listing_name ?? "Tap to read"),
      data: link("/dashboard/reviews"),
      sound: "default",
    }),
    inApp: (r) => ({
      title: "New review published",
      body: `${r.guest_first_name ?? "A guest"} · ${r.listing_name ?? ""}`.trim(),
      link: "/dashboard/reviews",
    }),
    dedupeKey: (r) => `new_review:${r.review_id ?? r.booking_id ?? "x"}`,
  } satisfies EventBuilder<ReviewRefs>,

  // ─── Subscription
  subscription_welcome: {
    category: "subscription",
    feature: "subscription",
    severity: "default",
    emailTemplate: "subscription_welcome",
    refKeys: ["subscription_id"],
    inApp: () => ({
      title: "Welcome to your new plan",
      body: "Your subscription is active.",
      link: "/dashboard/settings/subscription",
    }),
    dedupeKey: () => null,
  } satisfies EventBuilder<SubscriptionRefs>,

  subscription_expiring: {
    category: "subscription",
    feature: "subscription",
    severity: "default",
    emailTemplate: "subscription_expiring",
    refKeys: ["subscription_id"],
    push: (r) => ({
      title: "Subscription renews soon",
      body: clip(
        `Your ${r.brand_name ?? "Wielo"} ${r.plan_name ?? ""} plan renews on ${r.renewal_date ?? "soon"}.`,
      ),
      data: link("/dashboard/settings/subscription"),
      sound: null,
    }),
    inApp: (r) => ({
      title: "Subscription renews soon",
      body: r.plan_name ?? "Renewal heads-up",
      link: "/dashboard/settings/subscription",
    }),
    dedupeKey: (r) => `subscription_expiring:${r.renewal_date ?? "x"}`,
  } satisfies EventBuilder<SubscriptionRefs>,

  subscription_failed: {
    category: "account_security",
    feature: "subscription",
    severity: "high",
    emailTemplate: "subscription_failed",
    refKeys: ["subscription_id"],
    push: (r) => ({
      title: "Payment failed",
      body: clip(
        `We couldn't charge your ${r.brand_name ?? "Wielo"} ${r.plan_name ?? ""} subscription.`,
      ),
      data: link("/dashboard/settings/subscription"),
      sound: "default",
      priority: "high",
    }),
    inApp: () => ({
      title: "Subscription payment failed",
      body: "Update your payment method to keep your features active.",
      link: "/dashboard/settings/subscription",
    }),
    dedupeKey: () => null,
  } satisfies EventBuilder<SubscriptionRefs>,

  subscription_restricted: {
    category: "account_security",
    feature: "subscription",
    severity: "critical",
    emailTemplate: "subscription_restricted",
    refKeys: ["subscription_id"],
    push: (r) => ({
      title: "Account restricted",
      body: `Your ${r.brand_name ?? "Wielo"} subscription has lapsed. Reactivate to restore access.`,
      data: link("/dashboard/settings/subscription"),
      sound: "default",
      priority: "high",
    }),
    inApp: () => ({
      title: "Account restricted",
      body: "Reactivate to restore full access.",
      link: "/dashboard/settings/subscription",
    }),
    dedupeKey: () => null,
  } satisfies EventBuilder<SubscriptionRefs>,

  // ─── Account / security
  account_suspended: {
    category: "account_security",
    feature: "account",
    severity: "critical",
    emailTemplate: "account_suspended",
    refKeys: ["host_id"],
    inApp: () => ({
      title: "Account suspended",
      body: "Contact support for details.",
      link: "/dashboard/settings",
    }),
    dedupeKey: () => null,
  } satisfies EventBuilder<AccountRefs>,

  staff_invite: {
    category: "account_security",
    feature: "account",
    severity: "default",
    emailTemplate: "staff_invite",
    // No DB resolver; caller passes the full payload (template props +
    // recipient_email since EMAIL_REGISTRY marks this 'custom' recipient).
    dedupeKey: () => null,
  } satisfies EventBuilder<Record<string, unknown>>,

  // ─── Quote requests (host)
  quote_request_host: {
    category: "quote_requests",
    feature: "message",
    severity: "high",
    push: (r) => ({
      title: "New quote request",
      body: clip(
        `${r.guest_first_name ?? "A guest"} requested a quote${r.listing_name ? ` for ${r.listing_name}` : ""}`,
      ),
      data: link("/dashboard/inbox", {
        f: "enquiries",
        c: r.conversation_id,
      }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "New quote request",
      body: `${r.guest_first_name ?? "A guest"}${r.listing_name ? ` · ${r.listing_name}` : ""}`,
      link: `/dashboard/inbox?f=enquiries&c=${r.conversation_id}`,
    }),
    dedupeKey: (r) => `quote_request:${r.conversation_id}`,
  } satisfies EventBuilder<QuoteRequestRefs>,

  // Guest receives a sent quote (any quote — the general path; looking-for
  // quotes use looking_for_quote_received instead). Emails a link to accept.
  // Category 'bookings' (not quote_requests, which is host-facing with email
  // off by default) so the guest actually gets the email.
  quote_sent_guest: {
    category: "bookings",
    feature: "booking",
    severity: "high",
    emailTemplate: "quote_sent_guest",
    refKeys: ["quoteId"],
    push: (r) => ({
      title: "Your quote is ready",
      body: clip(
        `${r.hostName ?? "Your host"} sent a quote${r.listingName ? ` for ${r.listingName}` : ""}`,
      ),
      data: link("/portal/quotes/[id]", { id: r.quoteId }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "Your quote is ready",
      body: `${r.listingName ?? "Your stay"}${r.totalAmount ? ` · ${r.totalAmount}` : ""}`,
      link: `/portal/quotes/${r.quoteId}`,
    }),
    dedupeKey: (r) => `quote_sent:${r.quoteId}`,
  } satisfies EventBuilder<QuoteRefs>,

  // ─── Website enquiries (host) — a website contact-form submission
  website_enquiry_host: {
    category: "quote_requests",
    feature: "message",
    severity: "high",
    push: (r) => ({
      title: "New website enquiry",
      body: clip(
        `${r.guest_first_name ?? "Someone"} sent a message${r.site_name ? ` via ${r.site_name}` : ""}`,
      ),
      data: link("/dashboard/inbox", {
        f: "enquiries",
        c: r.conversation_id,
      }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "New website enquiry",
      body: `${r.guest_first_name ?? "Someone"}${r.site_name ? ` · ${r.site_name}` : ""}`,
      link: `/dashboard/inbox?f=enquiries&c=${r.conversation_id}`,
    }),
    dedupeKey: (r) => `website_enquiry:${r.conversation_id}`,
  } satisfies EventBuilder<WebsiteEnquiryRefs>,

  // ─── Messages
  new_message: {
    category: "messages",
    feature: "message",
    severity: "high",
    push: (r) => ({
      title: r.sender_first_name,
      body: clip(r.message_body, 100),
      data: link("/inbox/[id]", { id: r.conversation_id }),
      sound: "default",
      priority: "high",
      badge: r.unread_count,
    }),
    inApp: (r) => ({
      title: r.sender_first_name,
      body: clip(r.message_body, 80),
      link: `/inbox/${r.conversation_id}`,
    }),
    dedupeKey: (r) => `message:${r.conversation_id}`,
  } satisfies EventBuilder<MessageRefs>,

  // ─── Calendar sync
  ical_sync_error: {
    category: "calendar_sync",
    feature: "calendar",
    severity: "default",
    push: (r) => ({
      title: "Calendar sync issue",
      body: clip(`We can't reach your ${r.feed_label} feed.`),
      data: link("/dashboard/properties/[id]/calendar", { id: r.property_id }),
      sound: null,
    }),
    inApp: (r) => ({
      title: "Calendar sync issue",
      body: r.feed_label,
      link: `/dashboard/properties/${r.property_id}/calendar`,
    }),
    dedupeKey: (r) => `ical_error:${r.property_id}:${r.feed_label}`,
  } satisfies EventBuilder<ICalRefs>,

  // ─── Admin-originated
  broadcast_critical: {
    category: "admin_broadcasts",
    feature: "admin",
    severity: "critical",
    emailTemplate: "broadcast_critical",
    push: (r) => ({
      title: r.title,
      body: clip(r.body, 120),
      data: link("/"),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: r.title,
      body: clip(r.body, 200),
      link: r.link_url ?? "/",
    }),
    dedupeKey: (r) => `broadcast:${r.broadcast_id}`,
  } satisfies EventBuilder<BroadcastRefs>,

  admin_individual_message: {
    category: "admin_broadcasts",
    feature: "admin",
    severity: "default",
    emailTemplate: "admin_message_generic",
    push: (r) => ({
      title: r.title,
      body: clip(r.body, 140),
      data: link(r.link_url ?? "/"),
      sound: "default",
    }),
    inApp: (r) => ({
      title: r.title,
      body: clip(r.body, 200),
      link: r.link_url ?? "/",
    }),
    dedupeKey: (r) => `admin_msg:${r.batch_id}`,
  } satisfies EventBuilder<IndividualMessageRefs>,

  notification_digest: {
    category: "reviews",
    feature: "admin",
    severity: "info",
    emailTemplate: "notification_digest",
    inApp: (r) => ({
      title: `${r.category_label}: ${r.item_count} new`,
      body: `${r.item_count} new ${r.category_label.toLowerCase()} notifications`,
      link: "/dashboard",
    }),
    dedupeKey: () => null,
  } satisfies EventBuilder<DigestRefs>,

  // ─── Looking For (guest)
  looking_for_quote_received: {
    category: "looking_for",
    feature: "looking_for",
    severity: "high",
    emailTemplate: "looking_for_quote_received",
    refKeys: ["post_id", "quote_id"],
    push: (r) => ({
      title: "New quote received!",
      body: clip(
        `${r.host_display_name ?? "A host"} sent you a quote${r.post_title ? ` for "${r.post_title}"` : ""}`,
      ),
      data: link("/portal/looking-for/[id]/quotes", { id: r.post_id }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "New quote received",
      body: `${r.host_display_name ?? "A host"} · ${r.post_title ?? "your request"}`,
      link: `/portal/looking-for/${r.post_id}/quotes`,
    }),
    dedupeKey: (r) => `lf_quote:${r.quote_id ?? r.post_id}`,
  } satisfies EventBuilder<LookingForRefs>,

  looking_for_post_expiring: {
    category: "looking_for",
    feature: "looking_for",
    severity: "default",
    emailTemplate: "looking_for_post_expiring",
    refKeys: ["post_id"],
    push: (r) => ({
      title: "Request expiring soon",
      body: clip(
        r.expires_in_days === 1
          ? `"${r.post_title ?? "Your request"}" expires tomorrow`
          : `"${r.post_title ?? "Your request"}" expires in ${r.expires_in_days ?? 3} days`,
      ),
      data: link("/portal/looking-for/[id]", { id: r.post_id }),
      sound: null,
    }),
    inApp: (r) => ({
      title: "Request expiring soon",
      body: `${r.post_title ?? "Your request"} · ${r.expires_in_days ?? 3} days left`,
      link: `/portal/looking-for/${r.post_id}`,
    }),
    dedupeKey: (r) => `lf_expiring:${r.post_id}`,
  } satisfies EventBuilder<LookingForRefs>,

  // ─── Looking For (host)
  looking_for_new_post_region: {
    category: "looking_for",
    feature: "looking_for",
    severity: "info",
    emailTemplate: "looking_for_new_post_region",
    refKeys: ["post_id"],
    push: (r) => ({
      title: "New guest request nearby",
      body: clip(
        `${r.guest_first_name ?? "A guest"} is looking for ${r.post_title ?? "accommodation"}${r.location_text ? ` in ${r.location_text}` : ""}`,
      ),
      data: link("/dashboard/looking-for"),
      sound: null,
    }),
    inApp: (r) => ({
      title: "New request in your area",
      body: `${r.guest_first_name ?? "A guest"} · ${r.location_text ?? r.post_title ?? "nearby"}`,
      link: "/dashboard/looking-for",
    }),
    dedupeKey: (r) => `lf_new_post:${r.post_id}`,
  } satisfies EventBuilder<LookingForRefs>,

  looking_for_quote_viewed: {
    category: "looking_for",
    feature: "looking_for",
    severity: "info",
    refKeys: ["post_id", "quote_id"],
    push: (r) => ({
      title: "Guest viewed your quote",
      body: clip(
        `${r.guest_first_name ?? "The guest"} viewed your quote${r.post_title ? ` for "${r.post_title}"` : ""}`,
      ),
      data: link("/dashboard/looking-for/my-quotes"),
      sound: null,
    }),
    inApp: (r) => ({
      title: "Quote viewed",
      body: `${r.guest_first_name ?? "Guest"} · ${r.post_title ?? "your quote"}`,
      link: "/dashboard/looking-for/my-quotes",
    }),
    dedupeKey: (r) => `lf_viewed:${r.quote_id ?? r.post_id}`,
  } satisfies EventBuilder<LookingForRefs>,

  looking_for_quote_accepted: {
    category: "looking_for",
    feature: "looking_for",
    severity: "high",
    emailTemplate: "looking_for_quote_accepted",
    refKeys: ["post_id", "quote_id"],
    push: (r) => ({
      title: "Your quote was accepted! 🎉",
      body: clip(
        `${r.guestName ?? r.guest_first_name ?? "The guest"} accepted your quote${r.post_title ? ` for "${r.post_title}"` : ""} — booking created`,
      ),
      data: link("/dashboard/quotes/[id]", { id: r.quote_id ?? "" }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "Quote accepted 🎉",
      body: `${r.guestName ?? r.guest_first_name ?? "Guest"} · ${r.post_title ?? "your quote"}`,
      link: r.quote_id
        ? `/dashboard/quotes/${r.quote_id}`
        : "/dashboard/looking-for/my-quotes",
    }),
    dedupeKey: (r) => `lf_accepted:${r.quote_id ?? r.post_id}`,
  } satisfies EventBuilder<LookingForRefs>,

  looking_for_quote_declined: {
    category: "looking_for",
    feature: "looking_for",
    severity: "default",
    emailTemplate: "looking_for_quote_declined",
    refKeys: ["post_id", "quote_id"],
    push: (r) => ({
      title: "Quote declined",
      body: clip(
        `${r.guestName ?? r.guest_first_name ?? "The guest"} declined your quote${r.post_title ? ` for "${r.post_title}"` : ""}`,
      ),
      data: link("/dashboard/looking-for/my-quotes"),
      sound: null,
    }),
    inApp: (r) => ({
      title: "Quote declined",
      body: `${r.guestName ?? r.guest_first_name ?? "Guest"} · ${r.post_title ?? "your quote"}`,
      link: "/dashboard/looking-for/my-quotes",
    }),
    dedupeKey: (r) => `lf_declined:${r.quote_id ?? r.post_id}`,
  } satisfies EventBuilder<LookingForRefs>,

  // ─── Affiliate
  affiliate_commission_earned: {
    category: "payments_refunds",
    feature: "subscription",
    severity: "default",
    emailTemplate: "affiliate_commission_earned",
    push: (r) => ({
      title: "You earned commission 🎉",
      body: clip(
        `You earned ${r.amount ?? "commission"}${r.detail ? ` from ${r.detail}` : ""} on Wielo.`,
      ),
      data: link("/portal/affiliates"),
      sound: "default",
    }),
    inApp: (r) => ({
      title: `You earned ${r.amount ?? "commission"} 🎉`,
      body: r.detail ? `From ${r.detail}` : "Affiliate commission earned.",
      link: "/portal/affiliates",
    }),
  } satisfies EventBuilder<AffiliateRefs>,

  affiliate_payout_paid: {
    category: "payments_refunds",
    feature: "subscription",
    severity: "high",
    emailTemplate: "affiliate_payout_paid",
    push: (r) => ({
      title: "Your payout is on its way 💸",
      body: clip(
        `We've sent your ${r.amount ?? "affiliate payout"}${r.detail ? ` via ${r.detail}` : ""}.`,
      ),
      data: link("/portal/affiliates/payouts"),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: `Payout sent — ${r.amount ?? ""}`.trim(),
      body: r.detail
        ? `Via ${r.detail}`
        : "Your affiliate payout has been sent.",
      link: "/portal/affiliates/payouts",
    }),
  } satisfies EventBuilder<AffiliateRefs>,

  campaign_pause_changed: {
    category: "account_security",
    feature: "subscription",
    severity: "high",
    emailTemplate: "campaign_pause_changed",
    push: (r) => ({
      title:
        r.paused === "true"
          ? "You've been paused in the competition"
          : "You're back in the competition 🎉",
      body: clip(
        r.paused === "true"
          ? `${r.campaignName ?? "The competition"} — ${r.reason ?? "tap for details"}. Your commission is unaffected.`
          : `You're back on the ${r.campaignName ?? "competition"} leaderboard.`,
      ),
      data: link("/portal/affiliates/competitions"),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title:
        r.paused === "true"
          ? `Paused in ${r.campaignName ?? "the competition"}`
          : `Back in ${r.campaignName ?? "the competition"}`,
      body:
        r.paused === "true"
          ? `${r.reason ?? "You've been paused."} Your commission and referral links are unaffected.`
          : "You're back on the leaderboard and in the running for prizes.",
      link: "/portal/affiliates/competitions",
    }),
  } satisfies EventBuilder<AffiliateRefs>,
} as const;

export type EventKind = keyof typeof NOTIFICATION_REGISTRY;

export type RefsFor<K extends EventKind> =
  (typeof NOTIFICATION_REGISTRY)[K] extends EventBuilder<infer R> ? R : never;

export function isRegisteredEvent(kind: string): kind is EventKind {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_REGISTRY, kind);
}

export function getEvent(kind: EventKind): EventBuilder<unknown> {
  return NOTIFICATION_REGISTRY[kind] as unknown as EventBuilder<unknown>;
}

export type { InAppPayload, PushPayload };
