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
    bookingReference: "VILO-2026-AB1234",
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

  eft_instructions_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    totalAmount: "R 2,400.00",
    bookingReference: "VILO-2026-AB1234",
    bankName: "Standard Bank",
    accountHolder: "Amara Mokoena (Vilo)",
    accountNumberMasked: "•••• 4523",
    branchCode: "051001",
    expiresAt: "Sunday, 8 June 2026 at 14:00",
  },

  eft_proof_received_host: {
    hostFirstName: "Amara",
    guestName: "Lerato",
    listingName: "Sunbird Cottage",
    totalAmount: "R 2,400.00",
    bookingReference: "VILO-2026-AB1234",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },

  review_request_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    hostName: "Amara",
    reviewUrl: "https://viloplatform.com/review/abc/xyz",
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
    supportEmail: "support@viloplatform.com",
  },

  refund_request_host: {
    hostFirstName: "Amara",
    guestName: "Lerato",
    listingName: "Sunbird Cottage",
    bookingReference: "VILO-2026-AB1234",
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
    bookingReference: "VILO-2026-AB1234",
    refundAmount: "R 1,800.00",
    paymentMethod: "your Visa ending 4242",
    processingNote: "Allow 3–5 business days to appear in your account.",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },

  refund_declined_guest: {
    guestFirstName: "Lerato",
    listingName: "Sunbird Cottage",
    bookingReference: "VILO-2026-AB1234",
    declineReasonLabel: "Outside the cancellation policy window",
    policySummary:
      "Strict policy: no refund within 7 days of check-in. Your request arrived 4 days before check-in.",
    bookingId: "00000000-0000-0000-0000-000000000001",
    supportEmail: "support@viloplatform.com",
  },

  refund_completed_guest: {
    guestFirstName: "Lerato",
    refundAmount: "R 1,800.00",
    bookingReference: "VILO-2026-AB1234",
    paymentMethod: "your Visa ending 4242",
    processingNote: "Allow 3–5 business days for the funds to appear.",
  },

  refund_admin_override_host: {
    hostFirstName: "Amara",
    guestName: "Lerato",
    listingName: "Sunbird Cottage",
    bookingReference: "VILO-2026-AB1234",
    refundAmount: "R 1,200.00",
    adminNote:
      "Booking dates fell during the platform outage on 2026-06-01. Compromise refund applied.",
    supportEmail: "support@viloplatform.com",
  },

  eft_refund_sent_guest: {
    guestFirstName: "Lerato",
    refundAmount: "R 1,800.00",
    bookingReference: "VILO-2026-AB1234",
    hostNote:
      "Sent via FNB EFT this morning — reference VILO-2026-AB1234. Sorry again for the trouble.",
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
