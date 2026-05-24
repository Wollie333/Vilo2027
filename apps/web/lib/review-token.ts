import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Per-booking review-submission tokens. Derived from
 * `REVIEW_TOKEN_SECRET` + the booking id via HMAC SHA-256.
 *
 * Used to gate the public `/review/[bookingId]` page — the guest receives a
 * link with the token, posts a review, and we verify the token before the
 * INSERT. No DB column needed; the secret + booking id is the entire keying
 * material. Rotating the env var invalidates every outstanding link at once.
 *
 * Falls back to `SUPABASE_SERVICE_ROLE_KEY` if `REVIEW_TOKEN_SECRET` is
 * missing — both are server-side-only so the URL is still unguessable.
 */
function secret(): string {
  return (
    process.env.REVIEW_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

export function signReviewToken(bookingId: string): string {
  const s = secret();
  if (!s) throw new Error("Review token secret is not configured.");
  const mac = createHmac("sha256", s).update(`review:${bookingId}`).digest();
  return mac
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
    .slice(0, 22);
}

export function verifyReviewToken(
  bookingId: string,
  candidate: string,
): boolean {
  if (!candidate || candidate.length === 0) return false;
  const expected = signReviewToken(bookingId);
  if (expected.length !== candidate.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));
}
