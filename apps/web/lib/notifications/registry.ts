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

export type ICalRefs = {
  listing_id: string;
  feed_label: string;
};

export type AccountRefs = {
  host_id?: string;
  reason?: string;
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

  // ─── Bookings (host)
  booking_request_host: {
    category: "bookings",
    feature: "booking",
    severity: "high",
    emailTemplate: "booking_request_host",
    refKeys: ["booking_id"],
    push: (r) => ({
      title: "New booking request",
      body: clip(
        `${r.guest_first_name ?? "A guest"} wants to book ${r.listing_name ?? "your listing"}`,
      ),
      data: link("/dashboard/bookings/[id]", { id: r.booking_id }),
      sound: "default",
      priority: "high",
    }),
    inApp: (r) => ({
      title: "New booking request",
      body: `${r.guest_first_name ?? "A guest"} · ${r.listing_name ?? "your listing"}`,
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
        r.listing_name ?? `${r.brand_name ?? "Vilo"} support issued a refund.`,
      link: `/dashboard/payments/refunds/${r.refund_id ?? r.booking_id}`,
    }),
    dedupeKey: (r) => `refund_override:${r.refund_id ?? r.booking_id}`,
  } satisfies EventBuilder<RefundRefs>,

  refund_escalated_admin: {
    category: "admin_broadcasts",
    feature: "refund",
    severity: "high",
    emailTemplate: "refund_escalated_admin",
    refKeys: ["refund_id"],
    dedupeKey: (r) => `refund_escalated:${r.refund_id ?? r.booking_id}`,
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
        `Your ${r.brand_name ?? "Vilo"} ${r.plan_name ?? ""} plan renews on ${r.renewal_date ?? "soon"}.`,
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
        `We couldn't charge your ${r.brand_name ?? "Vilo"} ${r.plan_name ?? ""} subscription.`,
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
      body: `Your ${r.brand_name ?? "Vilo"} subscription has lapsed. Reactivate to restore access.`,
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
      data: link("/dashboard/listings/[id]/calendar", { id: r.listing_id }),
      sound: null,
    }),
    inApp: (r) => ({
      title: "Calendar sync issue",
      body: r.feed_label,
      link: `/dashboard/listings/${r.listing_id}/calendar`,
    }),
    dedupeKey: (r) => `ical_error:${r.listing_id}:${r.feed_label}`,
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
