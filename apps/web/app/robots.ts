import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wielo.co.za";

/**
 * There was no robots.txt at all, so every authenticated and token-bearing page
 * was fair game for a crawler: invoices, receipts, credit notes, statements and
 * the admin panel included.
 *
 * Two kinds of route are disallowed here:
 *   • private surfaces (admin, dashboard, portal, account, staff)
 *   • DOCUMENT routes reached by a one-time token — an invoice or a review link
 *     is not secret-by-obscurity alone, but it has no business in an index, and
 *     an indexed token link is a leak that outlives the token.
 *
 * Everything the product actually wants found — the directory, listings, deals,
 * host pages, partner pages, competitions, legal and marketing — is left
 * crawlable. Disallow is deliberately conservative: wrongly hiding a listing
 * costs bookings, and that is the more expensive mistake of the two.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Private surfaces
          "/admin",
          "/dashboard",
          "/portal",
          "/account",
          "/staff",
          "/staff-invite",
          "/inbox",
          "/my-trips",
          "/booking-management",
          "/suspended",
          // Token-bearing documents and actions
          "/invoice",
          "/receipt",
          "/credit-note",
          "/statement",
          "/forfeit-statement",
          "/wielo-invoice",
          "/wielo-credit-note",
          "/wielo-commission",
          "/pay",
          "/claim",
          "/review",
          "/q",
          // Internal build harnesses (also 404 to non-staff in production)
          "/dev",
          "/style-lab",
          "/builder-preview",
          "/brand-preview",
          "/website-editor",
          "/builder",
          // Machinery
          "/api",
          "/auth",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
