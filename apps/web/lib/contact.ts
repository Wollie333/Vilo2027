// Canonical public URL + contact addresses.
//
// These used to be hardcoded as `wieloplatform.com` in ~30 files — a domain we
// do not own. That put a dead address on the POPIA contact line, on the account
// -deletion screen, and in the fallback base URL for review-request links. Every
// user-facing mention of the domain or a contact mailbox reads from here.
//
// Pure constants (no DB, no `server-only`) so client components, email
// resolvers, PDF renders and route handlers can all import them.
//
// Each address is independently overridable: point all three at one inbox by
// setting them to the same value. See ENV_VARS.md.

/** Public origin, no trailing slash. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://wielo.co.za"
).replace(/\/+$/, "");

/** Bare host, for places that print the domain as copy (e.g. "wielo.co.za/your-handle"). */
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, "");

/** General enquiries and support. */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@wielo.co.za";

/** POPIA data-subject requests, cookies, and anything privacy-related. */
export const PRIVACY_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || "privacy@wielo.co.za";

/** Terms, disputes, and other legal correspondence. */
export const LEGAL_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_EMAIL?.trim() || "legal@wielo.co.za";
