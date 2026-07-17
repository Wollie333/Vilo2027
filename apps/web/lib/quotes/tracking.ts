import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Coarse, non-PII device bucket from the user agent (no IP / fingerprinting). */
export function deviceFromUserAgent(ua: string | null): string {
  if (!ua) return "unknown";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Record a guest VIEW of a quote into quote_view_events (kind defaults to
 * 'view'). Called when the RECIPIENT guest opens the quote — from BOTH the
 * public token page (q/[id]/[token]) and the signed-in portal (portal/quotes/[id]).
 * The portal page previously recorded nothing, so a guest who viewed-and-accepted
 * there skipped the "Viewed" stage entirely (no timestamp / green check). Now both
 * surfaces stamp it. Best-effort: tracking must never block rendering the quote.
 */
export async function recordQuoteView(
  admin: Admin,
  quoteId: string,
  ua: string | null,
): Promise<void> {
  try {
    await admin.from("quote_view_events").insert({
      quote_id: quoteId,
      device: deviceFromUserAgent(ua),
    });
  } catch {
    // Never let tracking affect the guest's view of the quote.
  }
}

/**
 * Record a guest DOWNLOAD of a quote (the generated PDF, or the uploaded file
 * for an 'upload' quote) into quote_view_events with kind='download'. Called
 * only from the token-gated guest routes — never the host's own dashboard
 * download — so the host's "Downloaded" signal reflects the guest, not them.
 * Best-effort: tracking must never block the file response.
 */
export async function recordQuoteDownload(
  admin: Admin,
  quoteId: string,
  ua: string | null,
): Promise<void> {
  try {
    await admin.from("quote_view_events").insert({
      quote_id: quoteId,
      kind: "download",
      device: deviceFromUserAgent(ua),
    });
  } catch {
    // Never let tracking affect the download.
  }
}
