import { RESERVED_SUBDOMAINS } from "@/lib/site/host";

// Subdomain derivation + validation for the Website CMS. A subdomain is a single
// DNS label used at <subdomain>.wielo.site, so it must be lowercase, 3–63 chars,
// alphanumeric + internal hyphens, and not a reserved label (enforced here AND in
// the middleware host classifier — same RESERVED_SUBDOMAINS set).

export const SUBDOMAIN_MIN = 3;
export const SUBDOMAIN_MAX = 63;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const DIACRITICS_RE = /[̀-ͯ]/g;

/** Best-effort slug from a free-text name (business/trading name). */
export function deriveSubdomain(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITICS_RE, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, SUBDOMAIN_MAX);
  return base.length >= SUBDOMAIN_MIN ? base : "";
}

/** Returns an error code (i18n-agnostic) or null when the subdomain is valid. */
export function validateSubdomain(sub: string): string | null {
  const s = sub.trim().toLowerCase();
  if (s.length < SUBDOMAIN_MIN) return "too_short";
  if (s.length > SUBDOMAIN_MAX) return "too_long";
  if (!LABEL_RE.test(s)) return "invalid_chars";
  if (RESERVED_SUBDOMAINS.has(s)) return "reserved";
  return null;
}
