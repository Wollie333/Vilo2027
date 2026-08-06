/**
 * Realistic sample payloads for every registered email type. Used by the
 * admin preview/test-send tool so the founder can render any template
 * without crafting a JSON blob by hand.
 *
 * The shape matches what real notification_queue rows put in `payload`
 * (camelCase keys flow through to the React component as props).
 */
import {
  NURTURE_EMAIL_TYPES,
  nurtureEmailProps,
} from "@/lib/funnels/nurtureCopy";

// Funnel-nurture drip previews use the SAME copy source the worker sends from,
// so the Communications preview renders exactly what a lead receives.
const NURTURE_SAMPLES: Record<
  string,
  Record<string, unknown>
> = Object.fromEntries(
  NURTURE_EMAIL_TYPES.map((t) => [
    t,
    {
      recipient_email: "lead@example.com",
      ...nurtureEmailProps(t, { firstName: "Thandi" }),
    },
  ]),
);

export const SAMPLE_PAYLOADS: Record<string, Record<string, unknown>> = {
  ...NURTURE_SAMPLES,
  welcome_host: {
    firstName: "Amara",
  },

  listing_published_host: {
    firstName: "Amara",
    listingName: "Sunbird Cottage, Hermanus",
    listingUrl: "https://wielo.co.za/property/sunbird-cottage-hermanus",
    displayUrl: "wielo.co.za/property/sunbird-cottage-hermanus",
    fromPrice: "R 1 600",
    location: "Hermanus, Western Cape",
    roomCount: 3,
  },
  host_offer_welcome: {
    firstName: "Amara",
    planName: "Starter",
    monthlyPrice: "R 999",
    annualPrice: "R 9 999",
    annualSaving: "R 1 989",
    capabilities: [
      "1 published listing",
      "Direct guest bookings",
      "0% commission",
      "Calendar sync",
    ],
    subscribeUrl: "https://wielo.co.za/dashboard/settings/subscription",
    dashboardUrl: "https://wielo.co.za/dashboard",
  },
  host_offer_nudge: {
    firstName: "Amara",
    planName: "Starter",
    monthlyPrice: "R 999",
    annualPrice: "R 9 999",
    annualSaving: "R 1 989",
    subscribeUrl: "https://wielo.co.za/dashboard/settings/subscription",
    dashboardUrl: "https://wielo.co.za/dashboard",
  },
  host_offer_final: {
    firstName: "Amara",
    planName: "Starter",
    monthlyPrice: "R 999",
    annualPrice: "R 9 999",
    subscribeUrl: "https://wielo.co.za/dashboard/settings/subscription",
    supportEmail: "hello@wielo.co.za",
  },

  booking_request_host: {
    hostFirstName: "Amara",
    guestName: "Lerato N.",
    listingName: "Sunbird Cottage, Hermanus",
    checkIn: "Friday, 6 June 2026",
    checkOut: "Sunday, 8 June 2026",
    nights: 2,
    guests: 2,
    totalAmount: "R 2,400.00",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },

  booking_confirmed_host: {
    hostFirstName: "Amara",
    guestName: "Lerato N.",
    guestEmail: "lerato@example.com",
    listingName: "Sunbird Cottage, Hermanus",
    checkIn: "Fri 6 Jun",
    checkOut: "Sun 8 Jun",
    totalAmount: "R 2,400.00",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },

  booking_confirmed_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage, Hermanus",
    hostName: "Amara",
    checkIn: "Friday, 6 June 2026",
    checkOut: "Sunday, 8 June 2026",
    totalAmount: "R 2,400.00",
    bookingReference: "BK-0001",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },

  booking_declined_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    checkIn: "6 Jun",
    checkOut: "8 Jun",
  },

  booking_dates_changed_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage, Hermanus",
    hostName: "Amara",
    oldCheckIn: "Friday, 6 June 2026",
    oldCheckOut: "Sunday, 8 June 2026",
    checkIn: "Friday, 13 June 2026",
    checkOut: "Sunday, 15 June 2026",
    nights: 2,
    totalAmount: "R 2,400.00",
    bookingReference: "BK-0001",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },

  booking_cancelled_host: {
    hostFirstName: "Amara",
    guestName: "Lerato",
    listingName: "Sunbird Cottage",
    checkIn: "Fri 6 Jun",
    checkOut: "Sun 8 Jun",
    refundAmount: "R 2,000.00",
    cancelledBy: "guest",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },

  booking_cancelled_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    checkIn: "Fri 6 Jun",
    checkOut: "Sun 8 Jun",
    refundAmount: "R 2,400.00",
    cancelledBy: "host",
  },

  booking_forfeited_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    bookingReference: "BK-0042",
    hostName: "Amara",
    amountPaid: "R 600.00",
    amountForfeited: "R 600.00",
    amountRefunded: null,
    policyApplied: "Moderate cancellation",
    statementNumber: "FRF-0001",
  },

  eft_instructions_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    totalAmount: "R 2,400.00",
    bookingReference: "BK-0001",
    bankName: "Standard Bank",
    accountHolder: "Amara Mokoena (Wielo)",
    accountNumberMasked: "•••• 4523",
    branchCode: "051001",
    expiresAt: "Sunday, 8 June 2026 at 14:00",
  },

  eft_proof_received_host: {
    hostFirstName: "Amara",
    guestName: "Lerato",
    listingName: "Sunbird Cottage",
    totalAmount: "R 2,400.00",
    bookingReference: "BK-0001",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },

  quote_sent_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    hostName: "Amara",
    checkIn: "12 Jun 2026",
    checkOut: "15 Jun 2026",
    nights: 3,
    totalAmount: "R 2,400.00",
    quoteNumber: "Q-0007",
    validUntil: "10 Jun 2026",
    quoteId: "00000000-0000-0000-0000-000000000001",
    acceptToken: "sampletoken0123456789",
  },

  // Looking-For quote → guest (same QuoteSentGuest template), but enriched with
  // the guest's originally requested dates + flexibility alongside the quote.
  looking_for_quote_received: {
    guestFirstName: "Lerato",
    listingName: "Karoo Sky Guesthouse",
    hostName: "Amara",
    checkIn: "12 Aug 2026",
    checkOut: "14 Aug 2026",
    nights: 2,
    totalAmount: "R 45,000.00",
    quoteNumber: "Q-0011",
    validUntil: "20 Jul 2026",
    requestedDates: "12 Aug 2026 – 14 Aug 2026 (± 1 day)",
    quoteId: "00000000-0000-0000-0000-000000000002",
    acceptToken: "sampletoken0123456789",
  },

  looking_for_quote_accepted: {
    hostFirstName: "Amara",
    guestName: "Lerato Nkosi",
    postTitle: "Wedding venue near Prince Albert",
    listingName: "Karoo Sky Guesthouse",
    checkIn: "12 Aug 2026",
    checkOut: "14 Aug 2026",
    totalAmount: "R 45,000.00",
    quoteNumber: "Q-0011",
    quoteId: "00000000-0000-0000-0000-000000000002",
  },

  looking_for_quote_declined: {
    hostFirstName: "Amara",
    guestName: "Lerato Nkosi",
    postTitle: "Wedding venue near Prince Albert",
    listingName: "Karoo Sky Guesthouse",
    quoteNumber: "Q-0011",
    declineReason: "Price too high",
    declineNote:
      "Loved the venue but it was a bit over our budget — thank you!",
  },

  looking_for_new_post_region: {
    hostFirstName: "Amara",
    guestFirstName: "Lerato",
    postTitle: "Wedding venue near Prince Albert",
    locationText: "Prince Albert, Western Cape",
    checkIn: "12 Aug 2026",
    guests: "80 guests",
    budget: "R 60 000 – R 70 000",
    postId: "00000000-0000-0000-0000-000000000003",
  },

  looking_for_post_expiring: {
    guestFirstName: "Lerato",
    postTitle: "Wedding venue near Prince Albert",
    expiresInDays: 2,
    quoteCount: 3,
    postId: "00000000-0000-0000-0000-000000000003",
  },

  listing_missing_policy: {
    firstName: "Amara",
    listingName: "Sunbird Cottage",
    policiesUrl:
      "https://wielo.co.za/dashboard/properties/00000000-0000-0000-0000-000000000004/edit?tab=policies",
    missingType: "cancellation",
  },

  review_request_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    hostName: "Amara",
    reviewUrl: "https://wielo.co.za/review/abc/xyz",
  },

  stay_details_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    hostName: "Amara",
    checkIn: "12 June 2026",
    checkInTime: "14:00",
    checkOut: "15 June 2026",
    nights: 3,
    bookingReference: "BK-0042",
    bookingId: "sample-booking-id",
    address: "42 Cliff Road, Hermanus, Western Cape",
    blocks: [
      {
        checkInMethod: "Self check-in with a lockbox",
        gateCode: "1042#",
        doorCode: "5581",
        wifiNetwork: "Sunbird-Guest",
        wifiPassword: "cliffs2026",
        checkInInstructions:
          "Park in the bay marked 4. The lockbox is on the gate's right post.",
      },
    ],
  },

  new_review_host: {
    hostFirstName: "Amara",
    guestName: "Lerato",
    listingName: "Sunbird Cottage",
    rating: 5,
    excerpt:
      "Beautiful spot, Amara was so welcoming. The walk to the cliffs was the highlight of our weekend...",
  },

  review_response_guest: {
    guestFirstName: "Lerato",
    hostName: "Amara",
    listingName: "Sunbird Cottage",
    rating: 5,
    reviewExcerpt:
      "Beautiful spot, Amara was so welcoming. The walk to the cliffs was the highlight of our weekend.",
    responseText:
      "Thank you so much, Lerato! It was a joy having you — come back any time, the cliffs are even better in spring.",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },

  subscription_welcome: {
    hostFirstName: "Amara",
    planName: "Pro",
    isTrial: true,
    trialEnds: "14 June 2026",
    renewsAt: null,
  },

  subscription_expiring: {
    hostFirstName: "Amara",
    planName: "Pro",
    renewalDate: "12 June 2026",
    price: "R 599 / month",
  },

  trial_ending: {
    hostFirstName: "Amara",
    planName: "Pro",
    trialEndsLabel: "12 June 2026",
    ctaUrl: "https://wielo.co.za/dashboard/settings/subscription",
  },

  subscription_failed: {
    hostFirstName: "Amara",
    planName: "Pro",
    amount: "R 599.00",
    gracePeriodEndsAt: "17 June 2026",
  },

  subscription_restricted: {
    hostFirstName: "Amara",
    planName: "Pro",
  },

  account_suspended: {
    hostFirstName: "Amara",
    supportEmail: "hello@wielo.co.za",
  },

  refund_request_host: {
    hostFirstName: "Amara",
    guestName: "Lerato",
    listingName: "Sunbird Cottage",
    bookingReference: "BK-0001",
    checkIn: "6 June 2026",
    totalPaid: "R 2,400.00",
    requestedAmount: "R 2,400.00",
    policyEntitlement: "R 1,800.00 (75% — moderate policy)",
    reason:
      "Family emergency, unable to travel. Apologies for the late notice.",
    refundId: "00000000-0000-0000-0000-000000000002",
    responseDeadline: "72 hours",
  },

  refund_approved_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    bookingReference: "BK-0001",
    refundAmount: "R 1,800.00",
    paymentMethod: "your Visa ending 4242",
    processingNote: "Allow 3–5 business days to appear in your account.",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },

  refund_declined_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    bookingReference: "BK-0001",
    declineReasonLabel: "Outside the cancellation policy window",
    policySummary:
      "Strict policy: no refund within 7 days of check-in. Your request arrived 4 days before check-in.",
    bookingId: "00000000-0000-0000-0000-000000000001",
    supportEmail: "hello@wielo.co.za",
  },

  refund_completed_guest: {
    guestFirstName: "Lerato",
    refundAmount: "R 1,800.00",
    bookingReference: "BK-0001",
    paymentMethod: "your Visa ending 4242",
    processingNote: "Allow 3–5 business days for the funds to appear.",
  },

  eft_refund_sent_guest: {
    guestFirstName: "Lerato",
    refundAmount: "R 1,800.00",
    bookingReference: "BK-0001",
    hostNote:
      "Sent via FNB EFT this morning — reference BK-0001. Sorry again for the trouble.",
    processingNote: "EFT transfers typically arrive within 1–2 business days.",
  },

  staff_invite: {
    recipient_email: "co-host@example.com",
    inviteeFirstName: "Sipho",
    hostName: "Amara Mokoena",
    propertyName: "Sunbird Cottage, Hermanus",
    inviteToken: "preview-token-only",
    expiresAt: "7 days",
  },

  platform_staff_invite: {
    recipient_email: "teammate@example.com",
    brand_name: "Wielo",
    role: "finance",
    inviteUrl: "https://wielo.co.za/staff-invite?token=preview-token-only",
    expiresLabel: "72 hours",
  },

  // Previews the PAUSED variant — the one worth eyeballing, since it has to
  // reassure the partner their commission is untouched. Flip `paused` to
  // "false" in the previewer to see the resumed version.
  campaign_pause_changed: {
    recipient_email: "partner@example.com",
    firstName: "Thandi",
    campaignName: "Founding Race",
    paused: "true",
    reason: "Under review following a referral-quality query.",
  },

  campaign_partner_enrolled: {
    recipient_email: "partner@example.com",
    firstName: "Thandi",
    campaignName: "the Founding Race",
  },

  campaign_referral_activated: {
    recipient_email: "partner@example.com",
    firstName: "Thandi",
    campaignName: "the Founding Race",
    hostName: "Karoo Sunset Guest Farm",
    listingName: "Karoo Sunset Guest Farm",
  },

  campaign_milestone_hit: {
    recipient_email: "partner@example.com",
    firstName: "Thandi",
    campaignName: "the Founding Race",
    milestoneLabel: "First to 10 live listings",
    prizeAmount: "R 2 000",
  },

  campaign_kickoff: {
    recipient_email: "partner@example.com",
    firstName: "Thandi",
    campaignName: "the Founding Race",
    endsOn: "30 November 2026",
  },

  campaign_standings_digest: {
    recipient_email: "partner@example.com",
    firstName: "Thandi",
    campaignName: "the Founding Race",
    rank: "#3",
    score: "14",
    gap: "6 listings",
    weeksLeft: "17 weeks",
  },

  campaign_ending_soon: {
    recipient_email: "partner@example.com",
    firstName: "Thandi",
    campaignName: "the Founding Race",
    timeLeft: "2 weeks",
    rank: "#3",
  },
};

export function getSamplePayload(type: string): Record<string, unknown> {
  return SAMPLE_PAYLOADS[type] ?? {};
}
