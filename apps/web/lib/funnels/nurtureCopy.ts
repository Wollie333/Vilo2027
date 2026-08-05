// Single source of truth for the automated funnel-nurture email copy, keyed by
// nurture_steps.email_type. Consumed by (a) the email registry subject, (b) the
// admin preview sample payloads, and (c) the nurture worker at send time — so the
// Communications preview renders exactly what a lead receives. Rendered through
// the shared FunnelNurture React Email template.

export type NurtureCopy = {
  subject: string;
  heading: string;
  paragraphs: string[];
  ctaLabel?: string;
  /** App-relative path; the absolute URL is built with NEXT_PUBLIC_APP_URL. */
  ctaPath?: string;
};

export const NURTURE_COPY: Record<string, NurtureCopy> = {
  nurture_host_welcome: {
    subject: "Your Direct Booking Starter Kit — start here",
    heading: "Thanks for grabbing the Starter Kit",
    paragraphs: [
      "Start with the pricing worksheet — it's the fastest win. Work through it on your own listing this week.",
      "Reply to this email any time if you get stuck — a real person reads it.",
    ],
  },
  nurture_host_value: {
    subject: "What direct booking actually saves you",
    heading: "Every OTA booking quietly takes a cut",
    paragraphs: [
      "On Wielo your payout is exactly what the guest pays — 0% commission, ever.",
      "Most hosts move their calendar across in an afternoon and keep more of every booking from day one.",
    ],
  },
  nurture_host_offer: {
    subject: "Ready to take bookings on Wielo?",
    heading: "Ready to take direct bookings?",
    paragraphs: [
      "Set up your booking page, calendar and checkout on Wielo — free to start, no card required.",
    ],
    ctaLabel: "Start your free host account",
    ctaPath: "/signup/host",
  },
  nurture_affiliate_welcome: {
    subject: "Welcome — here's how partners earn with Wielo",
    heading: "Welcome to the Wielo partner programme",
    paragraphs: [
      "The quickest first win: grab your personal referral link and share it with one host you already know.",
      "When they pay, you earn — for as long as they stay.",
    ],
  },
  nurture_affiliate_value: {
    subject: "How much can you earn referring hosts?",
    heading: "Recurring commission, paid in rand",
    paragraphs: [
      "Wielo is 0%-commission direct-booking management, so hosts keep every rand — an easy thing to recommend.",
      "You earn recurring commission on every payment a referred host makes, with a live dashboard tracking your clicks and earnings.",
    ],
  },
  nurture_affiliate_offer: {
    subject: "Grab your referral link and start earning",
    heading: "Ready to start earning?",
    paragraphs: [
      "Activate your partner account to get your referral link and earnings dashboard — free to join, no minimums.",
    ],
    ctaLabel: "Become a Wielo partner",
    ctaPath: "/signup/partner",
  },
};

import { referralNextLink } from "@/lib/affiliate/links";

export const NURTURE_EMAIL_TYPES = Object.keys(NURTURE_COPY);

/** Build the props the FunnelNurture template renders, for a given email_type. */
export function nurtureEmailProps(
  emailType: string,
  opts: {
    firstName?: string;
    subjectOverride?: string | null;
    /** Referring partner slug — CTAs route through /r/<slug> to credit them. */
    affiliateRef?: string | null;
  } = {},
): Record<string, unknown> {
  const copy = NURTURE_COPY[emailType];
  if (!copy) {
    return {
      firstName: opts.firstName || "there",
      heading: "A quick note from Wielo",
      paragraphs: ["Thanks for your interest in Wielo."],
      subject: opts.subjectOverride || "A note from Wielo",
    };
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    firstName: opts.firstName || "there",
    subject: opts.subjectOverride || copy.subject,
    heading: copy.heading,
    paragraphs: copy.paragraphs,
    ...(copy.ctaLabel && copy.ctaPath
      ? {
          ctaLabel: copy.ctaLabel,
          ctaHref: referralNextLink(base, opts.affiliateRef, copy.ctaPath),
        }
      : {}),
    unsubscribeHref: `${base}/unsubscribe`,
  };
}
