/**
 * Same-origin relative-path guard for post-auth `next` redirects.
 *
 * A bare `startsWith("/")` check is NOT enough: browsers resolve
 * protocol-relative (`//evil.com`) and backslash (`/\evil.com`) values to a
 * cross-origin URL, which makes the post-login / post-confirm redirect an open
 * redirect (phishing + token leakage). Reject those; only allow a single-slash
 * relative path.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
