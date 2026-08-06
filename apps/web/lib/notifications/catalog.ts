import { NOTIFICATION_REGISTRY, type EventKind } from "./registry";

// ──────────────────────────────────────────────────────────────────────────
// Communications catalog — the canonical, admin-facing list of AUTOMATED
// messages, grouped by area exactly like the Communications hub design.
//
// The code NOTIFICATION_REGISTRY is the source of truth for WHICH channels a
// message supports (email/push/in-app); this file adds the human area, label
// and description, and the real EventKind each row targets so an override binds
// to the right event. Manual sends (broadcast / individual message / digest)
// and deferred website comms are intentionally excluded — they live in the
// Send & Broadcast tab, not here.
// ──────────────────────────────────────────────────────────────────────────

export type AreaKey =
  | "bh"
  | "bg"
  | "pay"
  | "rev"
  | "sub"
  | "acc"
  | "quo"
  | "msg"
  | "lf"
  | "aff"
  | "comp"
  | "nur";

export const AREAS: { key: AreaKey; label: string; icon: string }[] = [
  { key: "bh", label: "Bookings · host", icon: "calendar-check" },
  { key: "bg", label: "Bookings · guest", icon: "calendar-heart" },
  { key: "pay", label: "Payments & refunds", icon: "credit-card" },
  { key: "rev", label: "Reviews", icon: "star" },
  { key: "sub", label: "Subscription", icon: "badge-check" },
  { key: "acc", label: "Account", icon: "user-round" },
  { key: "quo", label: "Quotes", icon: "file-text" },
  { key: "msg", label: "Messages", icon: "message-square" },
  { key: "lf", label: "Looking For", icon: "search" },
  { key: "aff", label: "Affiliates", icon: "handshake" },
  { key: "comp", label: "Competitions", icon: "trophy" },
  { key: "nur", label: "Funnel nurture", icon: "workflow" },
];

export type CatalogEntry = {
  kind: EventKind;
  area: AreaKey;
  label: string;
  description: string;
  isNew?: boolean;
};

// Order within an area matches the design. Every kind here must exist in
// NOTIFICATION_REGISTRY (enforced by the EventKind type).
export const MESSAGE_CATALOG: CatalogEntry[] = [
  // ── Bookings · host
  {
    kind: "booking_request_host",
    area: "bh",
    label: "New booking request",
    description: "A guest requests a stay → host",
  },
  {
    kind: "booking_confirmed_host",
    area: "bh",
    label: "Booking confirmed",
    description: "Request accepted or instant-book → host",
  },
  {
    kind: "booking_cancelled_host",
    area: "bh",
    label: "Booking cancelled",
    description: "Guest or host cancels → host",
  },
  {
    kind: "check_in_reminder_host",
    area: "bh",
    label: "Check-in reminder",
    description: "Day before arrival → host",
  },
  // ── Bookings · guest
  {
    kind: "booking_confirmed_guest",
    area: "bg",
    label: "Booking confirmed",
    description: "Stay is locked in → guest",
  },
  {
    kind: "booking_declined_guest",
    area: "bg",
    label: "Booking declined",
    description: "Host declines the request → guest",
  },
  {
    kind: "booking_forfeited_guest",
    area: "bg",
    label: "Booking forfeited",
    description: "No-show / unpaid hold released → guest",
  },
  {
    kind: "booking_cancelled_guest",
    area: "bg",
    label: "Booking cancelled",
    description: "Cancelled by either side → guest",
  },
  {
    kind: "booking_dates_changed_guest",
    area: "bg",
    label: "Booking dates changed",
    description: "Host moves the stay dates → guest",
    isNew: true,
  },
  {
    kind: "check_in_reminder_guest",
    area: "bg",
    label: "Check-in reminder",
    description: "Day before arrival → guest",
  },
  // ── Payments & refunds
  {
    kind: "eft_instructions_guest",
    area: "pay",
    label: "EFT instructions",
    description: "Bank details and reference → guest",
  },
  {
    kind: "eft_proof_received_host",
    area: "pay",
    label: "EFT proof received",
    description: "Proof of payment uploaded → host",
  },
  {
    kind: "eft_refund_sent_guest",
    area: "pay",
    label: "EFT refund sent",
    description: "Manual refund paid out → guest",
  },
  {
    kind: "refund_request_host",
    area: "pay",
    label: "Refund request",
    description: "Guest asks for a refund → host",
  },
  {
    kind: "refund_approved_guest",
    area: "pay",
    label: "Refund approved",
    description: "Host approves → guest",
  },
  {
    kind: "refund_declined_guest",
    area: "pay",
    label: "Refund declined",
    description: "Host declines, with reason → guest",
  },
  {
    kind: "refund_completed_guest",
    area: "pay",
    label: "Refund completed",
    description: "Money is back with the guest → guest",
  },
  // ── Reviews
  {
    kind: "review_request_guest",
    area: "rev",
    label: "Review request",
    description: "Two days after checkout → guest",
  },
  {
    kind: "review_response_guest",
    area: "rev",
    label: "Host replied to review",
    description: "Host responds to a guest's review → guest",
    isNew: true,
  },
  {
    kind: "new_review_host",
    area: "rev",
    label: "New review",
    description: "A guest left a review → host",
  },
  // ── Subscription
  {
    kind: "subscription_welcome",
    area: "sub",
    label: "Welcome to your plan",
    description: "Subscription starts → host",
  },
  {
    kind: "subscription_expiring",
    area: "sub",
    label: "Renewing soon",
    description: "Seven days before renewal → host",
  },
  {
    kind: "trial_ending",
    area: "sub",
    label: "Trial ending soon",
    description: "24 hours before a free trial expires → host",
    isNew: true,
  },
  {
    kind: "subscription_failed",
    area: "sub",
    label: "Payment failed",
    description: "Card or debit order declined → host",
  },
  {
    kind: "subscription_restricted",
    area: "sub",
    label: "Account restricted",
    description: "Unpaid past grace period → host",
  },
  {
    kind: "credits_added_admin",
    area: "sub",
    label: "Credits added",
    description: "Top-up or promo credits → host",
  },
  // ── Account
  {
    kind: "welcome_host",
    area: "acc",
    label: "Welcome host",
    description: "Account created → host",
  },
  {
    kind: "listing_published_host",
    area: "acc",
    label: "Listing published",
    description: "First listing goes live → host",
  },
  {
    kind: "account_suspended",
    area: "acc",
    label: "Account suspended",
    description: "Policy action → host",
  },
  {
    kind: "staff_invite",
    area: "acc",
    label: "Staff invite",
    description: "Team member invited to a property → invitee",
  },
  // ── Quotes
  {
    kind: "quote_request_host",
    area: "quo",
    label: "Quote request",
    description: "Guest asks for a custom quote → host",
  },
  {
    kind: "quote_sent_guest",
    area: "quo",
    label: "Quote sent",
    description: "Host responds with pricing → guest",
  },
  // ── Messages
  {
    kind: "new_message",
    area: "msg",
    label: "New message",
    description: "Unread inbox message → recipient",
  },
  // ── Looking For
  {
    kind: "looking_for_quote_received",
    area: "lf",
    label: "Quote received",
    description: "A host quoted your post → guest",
  },
  {
    kind: "looking_for_post_expiring",
    area: "lf",
    label: "Post expiring",
    description: "Two days before a post closes → guest",
  },
  {
    kind: "looking_for_new_post_region",
    area: "lf",
    label: "New post in your region",
    description: "Matching request nearby → host",
  },
  {
    kind: "looking_for_quote_viewed",
    area: "lf",
    label: "Quote viewed",
    description: "Guest opened your quote → host",
  },
  {
    kind: "looking_for_quote_accepted",
    area: "lf",
    label: "Quote accepted",
    description: "Guest picked your quote → host",
  },
  {
    kind: "looking_for_quote_declined",
    area: "lf",
    label: "Quote declined",
    description: "Guest went elsewhere → host",
  },
  // ── Affiliates
  {
    kind: "affiliate_commission_earned",
    area: "aff",
    label: "Commission earned",
    description: "A referred host went paid → partner",
  },
  {
    kind: "affiliate_payout_paid",
    area: "aff",
    label: "Payout sent",
    description: "Payout paid → partner",
  },
  // ── Competitions
  {
    kind: "campaign_pause_changed",
    area: "comp",
    label: "Paused / restored",
    description: "Partner paused or reinstated in a competition",
  },
  {
    kind: "affiliate_campaign_won",
    area: "comp",
    label: "Competition won",
    description: "Results published → winners and field",
  },
  {
    kind: "campaign_partner_enrolled",
    area: "comp",
    label: "Partner enrolled",
    description: "“You’re in the Founding Race” → partner",
    isNew: true,
  },
  {
    kind: "campaign_referral_activated",
    area: "comp",
    label: "Referral activated",
    description: "A referred host published a listing → partner",
    isNew: true,
  },
  {
    kind: "campaign_milestone_hit",
    area: "comp",
    label: "Milestone hit",
    description: "“First to 10 🏆” → partner",
    isNew: true,
  },
  {
    kind: "campaign_kickoff",
    area: "comp",
    label: "Kickoff announcement",
    description: "Competition opens → all partners",
    isNew: true,
  },
  {
    kind: "campaign_standings_digest",
    area: "comp",
    label: "Standings digest",
    description: "“You’re #3” — weekly or monthly → partner",
    isNew: true,
  },
  {
    kind: "campaign_ending_soon",
    area: "comp",
    label: "Ending soon",
    description: "“2 weeks left” → partner",
    isNew: true,
  },
  // ── Funnel nurture (automated drip to /go/* leads)
  {
    kind: "nurture_host_welcome",
    area: "nur",
    label: "Host · welcome",
    description: "Day 0 — resource + start here → host lead",
    isNew: true,
  },
  {
    kind: "nurture_host_value",
    area: "nur",
    label: "Host · value",
    description: "Day 2 — what direct booking saves → host lead",
    isNew: true,
  },
  {
    kind: "nurture_host_offer",
    area: "nur",
    label: "Host · offer",
    description: "Day 5 — sign up as a host → host lead",
    isNew: true,
  },
  {
    kind: "nurture_affiliate_welcome",
    area: "nur",
    label: "Affiliate · welcome",
    description: "Day 0 — how partners earn → affiliate lead",
    isNew: true,
  },
  {
    kind: "nurture_affiliate_value",
    area: "nur",
    label: "Affiliate · value",
    description: "Day 2 — earnings potential → affiliate lead",
    isNew: true,
  },
  {
    kind: "nurture_affiliate_offer",
    area: "nur",
    label: "Affiliate · offer",
    description: "Day 5 — grab your link → affiliate lead",
    isNew: true,
  },
];

/** The competition-scoped kinds shown in a campaign's Email tab. */
export const COMPETITION_KINDS: EventKind[] = MESSAGE_CATALOG.filter(
  (m) => m.area === "comp",
).map((m) => m.kind);

/** The scheduled (clock-driven) competition kinds — get a cadence control. */
export const SCHEDULED_COMPETITION_KINDS: EventKind[] = [
  "campaign_kickoff",
  "campaign_standings_digest",
  "campaign_ending_soon",
];

/** Which channels a message supports, read from the code registry. */
export function channelsSupported(kind: EventKind): {
  email: boolean;
  push: boolean;
  inApp: boolean;
} {
  const e = NOTIFICATION_REGISTRY[kind] as {
    emailTemplate?: string;
    push?: unknown;
    inApp?: unknown;
  };
  return {
    email: Boolean(e.emailTemplate),
    push: Boolean(e.push),
    inApp: Boolean(e.inApp),
  };
}
