# Vilo Platform — Error Codes

**Version:** 1.0
**Last Updated:** May 2026

All Supabase Edge Functions return errors in this format:

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

`code` is always `SCREAMING_SNAKE_CASE`. This file is the single source of truth — never invent a new code without adding it here.

---

## Auth Errors

| Code | HTTP | Meaning | Trigger |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT | No `Authorization` header, expired token |
| `FORBIDDEN` | 403 | Valid auth but wrong role | Guest trying a host action, staff trying an admin action |
| `EMAIL_NOT_VERIFIED` | 403 | Email not confirmed | Host trying to complete onboarding before verifying email |
| `ACCOUNT_SUSPENDED` | 403 | Host account suspended by admin | Suspended host tries to confirm a booking |
| `ACCOUNT_RESTRICTED` | 403 | Subscription lapsed past grace period | Restricted host tries to create a booking |

---

## Input Validation Errors

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_INPUT` | 400 | Zod schema validation failed — `message` contains field-level details |
| `MISSING_REQUIRED_FIELD` | 400 | Required field not provided |
| `INVALID_UUID` | 400 | A UUID field is not a valid UUID format |
| `INVALID_DATE_FORMAT` | 400 | Date field is not ISO 8601 |
| `INVALID_DATE_RANGE` | 400 | `check_out` is before or equal to `check_in` |
| `INVALID_AMOUNT` | 400 | Amount is negative or non-numeric |
| `AMOUNT_EXCEEDS_ORIGINAL` | 400 | Refund amount exceeds original payment |
| `INVALID_STATUS_TRANSITION` | 400 | Booking or refund status transition is not permitted by state machine |

---

## Resource Errors

| Code | HTTP | Meaning |
|---|---|---|
| `BOOKING_NOT_FOUND` | 404 | Booking ID does not exist or is not accessible to caller |
| `LISTING_NOT_FOUND` | 404 | Listing ID does not exist or is not published |
| `HOST_NOT_FOUND` | 404 | Host not found |
| `GUEST_NOT_FOUND` | 404 | Guest user not found |
| `PAYMENT_NOT_FOUND` | 404 | Payment record not found |
| `REFUND_NOT_FOUND` | 404 | Refund request not found |
| `POLICY_NOT_FOUND` | 404 | Policy not found or not active |
| `CONVERSATION_NOT_FOUND` | 404 | Conversation thread not found |
| `REVIEW_NOT_FOUND` | 404 | Review not found |
| `INVITE_NOT_FOUND` | 404 | Staff invite token not found |
| `INVITE_EXPIRED` | 410 | Staff invite token has expired (>7 days) |
| `INVITE_ALREADY_ACCEPTED` | 409 | Staff invite has already been used |
| `REVIEW_ALREADY_SUBMITTED` | 409 | Guest has already submitted a review for this booking |
| `REVIEW_TOKEN_EXPIRED` | 410 | Review link token has expired (>30 days) |

---

## Booking Errors

| Code | HTTP | Meaning |
|---|---|---|
| `DATES_UNAVAILABLE` | 409 | One or more of the requested dates are already blocked or booked |
| `DATES_ALREADY_BLOCKED` | 409 | Host tried to block dates that are already confirmed booked |
| `LISTING_NOT_PUBLISHED` | 400 | Listing is unpublished or suspended |
| `LISTING_NOT_INSTANT_BOOK` | 400 | Attempted instant booking on a non-instant listing |
| `BOOKING_ALREADY_CONFIRMED` | 409 | Booking is already confirmed (duplicate confirm attempt) |
| `BOOKING_ALREADY_CANCELLED` | 409 | Booking is already cancelled |
| `BOOKING_RESPONSE_EXPIRED` | 410 | Host tried to confirm/decline after the 24-hour window |
| `BOOKING_NOT_ELIGIBLE_FOR_REVIEW` | 400 | Booking is not in COMPLETED status |
| `MINIMUM_NIGHTS_NOT_MET` | 400 | Date range is shorter than listing's `min_nights` |
| `MAXIMUM_NIGHTS_EXCEEDED` | 400 | Date range exceeds listing's `max_nights` |
| `GUEST_COUNT_EXCEEDED` | 400 | Guest count exceeds listing's `max_guests` |
| `POLICY_NOT_ACKNOWLEDGED` | 400 | Guest did not check the policy acknowledgement checkbox |

---

## Payment Errors

| Code | HTTP | Meaning |
|---|---|---|
| `PAYMENT_FAILED` | 402 | Payment provider returned a failure |
| `PAYMENT_ALREADY_COMPLETED` | 409 | Payment is already in `completed` status |
| `PAYMENT_PROVIDER_ERROR` | 502 | Payment provider API returned an unexpected error |
| `INVALID_WEBHOOK_SIGNATURE` | 401 | Webhook HMAC/verification failed — request rejected |
| `DUPLICATE_WEBHOOK_EVENT` | 409 | This `provider_reference` has already been processed |
| `EFT_PROOF_MISSING` | 400 | Host tried to confirm EFT booking but no proof has been uploaded |
| `EFT_BANKING_DETAILS_MISSING` | 400 | Host has no EFT banking details configured |
| `PAYPAL_AUTHORIZATION_EXPIRED` | 410 | PayPal authorization has expired (>3 days for most currencies) |

---

## Refund Errors

| Code | HTTP | Meaning |
|---|---|---|
| `REFUND_ALREADY_PROCESSED` | 409 | A refund for this booking has already been completed |
| `REFUND_NOT_PENDING` | 409 | Tried to approve/decline a refund that is not in `pending` status |
| `REFUND_NOT_ELIGIBLE` | 400 | Booking status does not allow a refund request |
| `REFUND_ESCALATION_NOT_ELIGIBLE` | 400 | Refund is not in `declined` status — cannot escalate |
| `REFUND_PROVIDER_ERROR` | 502 | Payment provider returned an error on the refund API call |

---

## Subscription & Feature Errors

| Code | HTTP | Meaning |
|---|---|---|
| `FEATURE_NOT_AVAILABLE` | 403 | Feature is locked for the host's current plan |
| `LISTINGS_LIMIT_REACHED` | 403 | Host has reached their plan's listing limit |
| `STAFF_SEATS_LIMIT_REACHED` | 403 | Host has reached their plan's staff seat limit |
| `INBOX_LIMIT_REACHED` | 403 | Free-tier host has reached their 10-conversation inbox limit |
| `SUBSCRIPTION_NOT_ACTIVE` | 403 | Subscription is not in `trialing` or `active` status |
| `SUBSCRIPTION_ALREADY_CANCELLED` | 409 | Subscription is already cancelled |

---

## Policy Errors

| Code | HTTP | Meaning |
|---|---|---|
| `POLICY_ARCHIVED` | 400 | Cannot assign an archived policy to a listing |
| `POLICY_IN_USE` | 409 | Cannot delete a policy that has active listing assignments |
| `POLICY_SNAPSHOT_EXISTS` | 409 | A snapshot already exists for this booking + policy type |
| `LISTING_MISSING_POLICY` | 400 | Listing has no cancellation policy assigned — cannot create booking |

---

## Directory & Search Errors

| Code | HTTP | Meaning |
|---|---|---|
| `SEARCH_QUERY_TOO_SHORT` | 400 | Search query is less than 2 characters |
| `INVALID_COORDINATES` | 400 | Latitude or longitude values are out of valid range |
| `GEOCODING_FAILED` | 502 | Mapbox geocoding API returned an error |

---

## Admin Errors

| Code | HTTP | Meaning |
|---|---|---|
| `ADMIN_ONLY` | 403 | Action requires `super_admin` role |
| `IMPERSONATION_ALREADY_ACTIVE` | 409 | Admin already has an active impersonation session |
| `CANNOT_IMPERSONATE_ADMIN` | 403 | Admins cannot impersonate other super_admin accounts |
| `AUDIT_LOG_WRITE_FAILED` | 500 | `admin_audit_log` insert failed — action was not completed |

---

## Calendar Sync Errors

| Code | HTTP | Meaning |
|---|---|---|
| `ICAL_FEED_NOT_FOUND` | 404 | iCal feed record not found or does not belong to this host |
| `ICAL_FEED_URL_INVALID` | 400 | URL is not a valid iCal/ICS feed URL |
| `ICAL_FETCH_FAILED` | 502 | Could not fetch the external iCal feed (network error, 404, 403) |
| `ICAL_PARSE_FAILED` | 422 | Feed URL returned a response that is not valid RFC 5545 iCal format |
| `ICAL_FEED_ALREADY_EXISTS` | 409 | This feed URL is already registered for this listing |
| `ICAL_FEED_LIMIT_REACHED` | 403 | Host has reached the maximum number of feeds per listing (plan limit) |
| `ICAL_EXPORT_TOKEN_INVALID` | 401 | iCal export URL token is invalid or has been rotated |

---

## General Errors

| Code | HTTP | Meaning |
|---|---|---|
| `INTERNAL_ERROR` | 500 | Unexpected server error — full error logged to Sentry |
| `DATABASE_ERROR` | 500 | Supabase/PostgreSQL returned an unexpected error |
| `EXTERNAL_SERVICE_ERROR` | 502 | Third-party API (Resend, Paystack, PayPal, Mapbox) returned an error |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests from this IP (public endpoints: 60 req/min) |

---

## Usage in Edge Functions

Always use the shared `errorResponse` helper from `_shared/response.ts`:

```typescript
import { errorResponse, successResponse } from '../_shared/response.ts';

// Error
return errorResponse('DATES_UNAVAILABLE', 'The selected dates are no longer available.', 409);

// Success
return successResponse({ booking_id: booking.id, authorization_url: url });
```

The `errorResponse` function signature:
```typescript
function errorResponse(code: ErrorCode, message: string, status: number): Response
```

`ErrorCode` is a union type of all codes in this file — TypeScript will warn if you use an undefined code.

---

## Adding New Codes

When you need a new error code:

1. Add it to this file in the appropriate section
2. Add it to the `ErrorCode` union type in `packages/types/api.types.ts`
3. Use it in the Edge Function
4. Never add a code that overlaps with an existing one semantically

---

*Every Edge Function error that reaches a client must use a code from this list.*
