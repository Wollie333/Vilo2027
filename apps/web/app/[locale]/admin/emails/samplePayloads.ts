/**
 * Realistic sample payloads for every registered email type. Used by the
 * admin preview/test-send tool so the founder can render any template
 * without crafting a JSON blob by hand.
 *
 * The shape matches what real notification_queue rows put in `payload`
 * (camelCase keys flow through to the React component as props).
 */
export const SAMPLE_PAYLOADS: Record<string, Record<string, unknown>> = {
  welcome_host: {
    firstName: "Amara",
  },

  listing_published_host: {
    firstName: "Amara",
    listingName: "Sunbird Cottage, Hermanus",
    listingUrl: "https://wieloplatform.com/property/sunbird-cottage-hermanus",
    displayUrl: "wieloplatform.com/property/sunbird-cottage-hermanus",
    fromPrice: "R 1 600",
    location: "Hermanus, Western Cape",
    roomCount: 3,
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

  review_request_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    hostName: "Amara",
    reviewUrl: "https://wieloplatform.com/review/abc/xyz",
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
    supportEmail: "support@wieloplatform.com",
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
    supportEmail: "support@wieloplatform.com",
  },

  refund_completed_guest: {
    guestFirstName: "Lerato",
    refundAmount: "R 1,800.00",
    bookingReference: "BK-0001",
    paymentMethod: "your Visa ending 4242",
    processingNote: "Allow 3–5 business days for the funds to appear.",
  },

  refund_admin_override_host: {
    hostFirstName: "Amara",
    guestName: "Lerato",
    listingName: "Sunbird Cottage",
    bookingReference: "BK-0001",
    refundAmount: "R 1,200.00",
    adminNote:
      "Booking dates fell during the platform outage on 2026-06-01. Compromise refund applied.",
    supportEmail: "support@wieloplatform.com",
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
};

export function getSamplePayload(type: string): Record<string, unknown> {
  return SAMPLE_PAYLOADS[type] ?? {};
}
