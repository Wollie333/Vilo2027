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
