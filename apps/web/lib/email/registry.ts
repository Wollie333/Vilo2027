import type { ComponentType } from "react";

import {
  BookingCancelledGuest,
  BookingCancelledHost,
  BookingConfirmedGuest,
  BookingConfirmedHost,
  BookingDeclinedGuest,
  BookingRequestHost,
  EftInstructionsGuest,
  EftProofReceivedHost,
  NewReviewHost,
  ReviewRequestGuest,
  SubscriptionWelcome,
  WelcomeHost,
} from "@vilo/emails";

export type Recipient = "host" | "guest";

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
    subject: () => "Welcome to Vilo",
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
    subject: (p) => `Welcome to Vilo ${str(p.planName, "")} `.trim(),
  },
};

export function isRegisteredType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(EMAIL_REGISTRY, type);
}
