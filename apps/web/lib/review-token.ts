import { createHmac, timingSafeEqual } from "node:crypto";

import { tokenSecret, tokenSecretsForVerify } from "@/lib/auth/tokenSecret";

/**
 * Per-booking review-submission tokens. Derived from the review signing key +
 * the booking id via HMAC SHA-256.
 *
 * Used to gate the public `/review/[bookingId]` page — the guest receives a
 * link with the token, posts a review, and we verify the token before the
 * INSERT. No DB column needed; the secret + booking id is the entire keying
 * material. Rotating the env var invalidates every outstanding link at once.
 *
 * Keying comes from lib/auth/tokenSecret.ts: a dedicated REVIEW_TOKEN_SECRET
 * when set, otherwise material DERIVED from the service-role key for this
 * purpose alone — so review links are not signed with the same key as
 * verification or statement links, and never with the raw DB credential.
 */
function reviewTokenWith(secret: Buffer, bookingId: string): string {
  const mac = createHmac("sha256", secret)
    .update(`review:${bookingId}`)
    .digest();
  return mac
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
    .slice(0, 22);
}

export function signReviewToken(bookingId: string): string {
  // Signing always uses the CURRENT key.
  return reviewTokenWith(tokenSecret("review"), bookingId);
}

export function verifyReviewToken(
  bookingId: string,
  candidate: string,
): boolean {
  if (!candidate || candidate.length === 0) return false;
  // Accept anything signed with a key still in the rotation window, so rotating
  // REVIEW_TOKEN_SECRET does not dead-link every review email already sent.
  return tokenSecretsForVerify("review").some((secret) => {
    const expected = reviewTokenWith(secret, bookingId);
    if (expected.length !== candidate.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));
  });
}

/**
 * The relative review path with its signed token — the single source of truth
 * for the link the guest follows. Used by the email resolver, the in-app
 * builder, the request worker and the host "share review link" card so every
 * channel points at exactly the same tokenised URL.
 */
export function buildReviewPath(bookingId: string): string {
  return `/review/${bookingId}?token=${signReviewToken(bookingId)}`;
}

/** Absolute review URL (origin + signed path). */
export function buildReviewUrl(origin: string, bookingId: string): string {
  return `${origin.replace(/\/$/, "")}${buildReviewPath(bookingId)}`;
}
