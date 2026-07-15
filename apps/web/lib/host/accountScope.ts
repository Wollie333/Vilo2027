// Resolve a host row's account class + admin access switches into a single shape
// the dashboard shell + route guard read. A 'quote_only' account — OR any account
// whose platform_access was switched off by an admin — is limited to the
// quotes-only shell (Looking-For · Quotes · Credits · Inbox · Guests · Settings);
// everything accommodation/booking/website is gated off.

export type HostAccountScope = {
  accountKind: "host" | "quote_only";
  quoteAccess: boolean;
  platformAccess: boolean;
  /** True → restricted to the quotes-only shell (quote_only, or platform blocked). */
  quotesOnly: boolean;
};

export function resolveAccountScope(
  row: {
    account_kind?: string | null;
    quote_access?: boolean | null;
    platform_access?: boolean | null;
  } | null,
): HostAccountScope {
  const accountKind =
    row?.account_kind === "quote_only" ? "quote_only" : "host";
  const quoteAccess = row?.quote_access !== false;
  const platformAccess = row?.platform_access !== false;
  return {
    accountKind,
    quoteAccess,
    platformAccess,
    quotesOnly: accountKind === "quote_only" || !platformAccess,
  };
}

// Dashboard sections a quotes-only account may reach. Anything not prefixed by
// one of these (after /dashboard) is a host-only surface and is bounced.
const QUOTES_ONLY_ALLOWED = [
  "/dashboard/looking-for",
  "/dashboard/quotes",
  "/dashboard/credits",
  "/dashboard/inbox",
  "/dashboard/guests",
  "/dashboard/settings",
  // Reporting is open to quote-only accounts too — the reports page renders a
  // quote-scoped view (quotes / acceptance / credits / Looking-For) for them
  // instead of the accommodation report. Every user with reporting access gets
  // their full relevant report.
  "/dashboard/reports",
] as const;

/** Where a quotes-only account lands + is bounced back to. */
export const QUOTES_ONLY_HOME = "/dashboard/looking-for";

/** True when `pathname` is a dashboard route a quotes-only account may open. */
export function isQuotesOnlyAllowedPath(pathname: string): boolean {
  // Strip a leading locale segment (e.g. /en/dashboard/...).
  const path = pathname.replace(/^\/[a-z]{2}(?=\/)/, "");
  if (!path.startsWith("/dashboard")) return true; // not a dashboard route
  return QUOTES_ONLY_ALLOWED.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`),
  );
}
