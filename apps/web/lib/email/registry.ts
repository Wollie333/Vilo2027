import type { ComponentType } from "react";

import {
  AccountSuspended,
  AdminMessageGeneric,
  BookingCancelledGuest,
  BroadcastCritical,
  NotificationDigest,
  BookingCancelledHost,
  BookingConfirmedGuest,
  BookingConfirmedHost,
  BookingDeclinedGuest,
  BookingRequestHost,
  EftInstructionsGuest,
  EftProofReceivedHost,
  EftRefundSentGuest,
  NewReviewHost,
  RefundAdminOverrideHost,
  RefundApprovedGuest,
  RefundCompletedGuest,
  RefundDeclinedGuest,
  RefundRequestHost,
  ReviewRequestGuest,
  StaffInvite,
  SubscriptionExpiring,
  SubscriptionFailed,
  SubscriptionRestricted,
  SubscriptionWelcome,
  WelcomeHost,
} from "@vilo/emails";

export type Recipient = "host" | "guest" | "custom";

export type EmailRegistryEntry = {
  Template: ComponentType<Record<string, unknown>>;
  recipient: Recipient;
  subject: (payload: Record<string, unknown>) => string;
};

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

export const EMAIL_REGISTRY: Record<string, EmailRegistryEntry> = {
  welcome_host: {
    Template: WelcomeHost as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) => `Welcome to ${str(p.brand_name, "Wielo")}`,
  },

  booking_request_host: {
    Template: BookingRequestHost as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) =>
      `New booking request for ${str(p.listingName, "your listing")}`,
  },

  booking_confirmed_host: {
    Template: BookingConfirmedHost as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) =>
      `Booking confirmed — ${str(p.guestName, "guest")} at ${str(p.listingName, "your listing")}`,
  },

  booking_confirmed_guest: {
    Template: BookingConfirmedGuest as ComponentType<Record<string, unknown>>,
    recipient: "guest",
    subject: (p) =>
      `You're booked at ${str(p.listingName, "your stay")} — confirmation inside`,
  },

  booking_declined_guest: {
    Template: BookingDeclinedGuest as ComponentType<Record<string, unknown>>,
    recipient: "guest",
    subject: (p) =>
      `Update on your request for ${str(p.listingName, "your stay")}`,
  },

  booking_cancelled_host: {
    Template: BookingCancelledHost as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) => `Booking cancelled — ${str(p.listingName, "your listing")}`,
  },

  booking_cancelled_guest: {
    Template: BookingCancelledGuest as ComponentType<Record<string, unknown>>,
    recipient: "guest",
    subject: (p) =>
      `Your booking at ${str(p.listingName, "your stay")} has been cancelled`,
  },

  eft_instructions_guest: {
    Template: EftInstructionsGuest as ComponentType<Record<string, unknown>>,
    recipient: "guest",
    subject: (p) => `Payment details for ${str(p.listingName, "your booking")}`,
  },

  eft_proof_received_host: {
    Template: EftProofReceivedHost as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) =>
      `Proof of payment received from ${str(p.guestName, "a guest")}`,
  },

  review_request_guest: {
    Template: ReviewRequestGuest as ComponentType<Record<string, unknown>>,
    recipient: "guest",
    subject: (p) =>
      `How was ${str(p.listingName, "your stay")}? Leave a review`,
  },

  new_review_host: {
    Template: NewReviewHost as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) => `New review on ${str(p.listingName, "your listing")}`,
  },

  subscription_welcome: {
    Template: SubscriptionWelcome as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) =>
      `Welcome to ${str(p.brand_name, "Wielo")} ${str(p.planName, "")}`.trim(),
  },

  subscription_expiring: {
    Template: SubscriptionExpiring as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) =>
      `Your ${str(p.brand_name, "Wielo")} ${str(p.planName, "")} subscription renews soon`.replace(
        /\s+/g,
        " ",
      ),
  },

  subscription_failed: {
    Template: SubscriptionFailed as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) =>
      `Action required: Your ${str(p.brand_name, "Wielo")} payment failed`,
  },

  subscription_restricted: {
    Template: SubscriptionRestricted as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) =>
      `Your ${str(p.brand_name, "Wielo")} account has been restricted`,
  },

  account_suspended: {
    Template: AccountSuspended as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) =>
      `Your ${str(p.brand_name, "Wielo")} account has been suspended`,
  },

  refund_request_host: {
    Template: RefundRequestHost as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) =>
      `Refund request from ${str(p.guestName, "a guest")} — ${str(p.bookingReference, "")}`.trim(),
  },

  refund_approved_guest: {
    Template: RefundApprovedGuest as ComponentType<Record<string, unknown>>,
    recipient: "guest",
    subject: (p) =>
      `Your refund of ${str(p.refundAmount, "")} has been approved`.replace(
        /\s+/g,
        " ",
      ),
  },

  refund_declined_guest: {
    Template: RefundDeclinedGuest as ComponentType<Record<string, unknown>>,
    recipient: "guest",
    subject: (p) =>
      `Update on your refund request — ${str(p.bookingReference, "")}`.trim(),
  },

  refund_completed_guest: {
    Template: RefundCompletedGuest as ComponentType<Record<string, unknown>>,
    recipient: "guest",
    subject: (p) =>
      `Your refund of ${str(p.refundAmount, "")} is on its way`.replace(
        /\s+/g,
        " ",
      ),
  },

  refund_admin_override_host: {
    Template: RefundAdminOverrideHost as ComponentType<Record<string, unknown>>,
    recipient: "host",
    subject: (p) => `Refund override — ${str(p.bookingReference, "")}`.trim(),
  },

  eft_refund_sent_guest: {
    Template: EftRefundSentGuest as ComponentType<Record<string, unknown>>,
    recipient: "guest",
    subject: (p) =>
      `Your refund has been sent — ${str(p.bookingReference, "")}`.trim(),
  },

  // "custom" recipient: drain.ts reads payload.recipient_email rather than
  // resolving via host_id / guest_id. Used when the recipient is neither a
  // logged-in host nor an existing guest (or is an internal alert mailbox).
  staff_invite: {
    Template: StaffInvite as ComponentType<Record<string, unknown>>,
    recipient: "custom",
    subject: (p) =>
      `${str(p.hostName, "A host")} invited you to manage ${str(p.propertyName, "their property")} on ${str(p.brand_name, "Wielo")}`,
  },

  // Broadcast fan-out worker pre-fills payload.recipient_email per user
  // before inserting into notification_queue — so this is a "custom" recipient.
  broadcast_critical: {
    Template: BroadcastCritical as ComponentType<Record<string, unknown>>,
    recipient: "custom",
    subject: (p) =>
      str(p.title, `Important announcement from ${str(p.brand_name, "Wielo")}`),
  },

  // Admin individual sends. The send action loops per recipient and writes
  // one queue row per recipient with guest_id or host_id set (so recipient
  // resolution happens via the normal guest/host path).
  admin_message_generic: {
    Template: AdminMessageGeneric as ComponentType<Record<string, unknown>>,
    recipient: "custom",
    subject: (p) =>
      str(p.title, `A message from ${str(p.brand_name, "Wielo")}`),
  },

  // Digest drain inserts one queue row per (user, cadence) with
  // recipient_email pre-filled and the grouped items in payload.
  notification_digest: {
    Template: NotificationDigest as ComponentType<Record<string, unknown>>,
    recipient: "custom",
    subject: (p) =>
      `Your ${str(p.cadence, "daily")} ${str(p.brand_name, "Wielo")} digest`.replace(
        /\s+/g,
        " ",
      ),
  },
};

export function isRegisteredType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(EMAIL_REGISTRY, type);
}
