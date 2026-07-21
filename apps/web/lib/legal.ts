import { cache } from "react";

import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { createAdminClient } from "@/lib/supabase/admin";

// Booking terms + privacy (POPIA) are platform-wide, Wielo-authored documents —
// NOT per-host policies. They live in platform_settings under these keys as a
// versioned jsonb blob: { html: string|null, version: number, updated_at }.
//
// `html === null` means "no custom text published yet" — the public /terms and
// /privacy pages then fall back to their built-in static copy. The `version` is
// stamped onto each booking at checkout (bookings.accepted_terms_version /
// accepted_privacy_version) so we have a legal record of exactly what the guest
// agreed to, even after the document is later edited.

export type LegalKind = "booking_terms" | "privacy";

const SETTING_KEY: Record<LegalKind, string> = {
  booking_terms: "legal_booking_terms",
  privacy: "legal_privacy",
};

export type LegalDocument = {
  kind: LegalKind;
  html: string | null;
  version: number;
  /**
   * ISO date (YYYY-MM-DD) the published document was last saved, or null when
   * nothing is published. The public pages show this instead of their built-in
   * constant — otherwise the "Last updated" line describes the static fallback
   * copy while the body shows a DB document published on a different day.
   */
  updatedAt: string | null;
};

export const getLegalDocument = cache(
  async (kind: LegalKind): Promise<LegalDocument> => {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", SETTING_KEY[kind])
        .maybeSingle();
      const v = (data?.value ?? {}) as {
        html?: string | null;
        version?: number;
        updated_at?: string | null;
      };
      // Sanitise on READ as well as write: historic rows are never
      // re-sanitised, so if the allowlist is ever tightened this keeps older
      // stored HTML safe (defence-in-depth; the public page renders it raw).
      const html =
        typeof v.html === "string" && v.html.trim().length > 0
          ? sanitiseListingHtml(v.html)
          : null;
      const version = typeof v.version === "number" ? v.version : 1;
      // Only meaningful alongside published html; a stored date with no body
      // would date the static fallback, which is exactly the bug being fixed.
      const stamp = html ? Date.parse(v.updated_at ?? "") : NaN;
      const updatedAt = Number.isNaN(stamp)
        ? null
        : new Date(stamp).toISOString().slice(0, 10);
      return { kind, html, version, updatedAt };
    } catch {
      return { kind, html: null, version: 1, updatedAt: null };
    }
  },
);

export async function getLegalDocuments(): Promise<{
  booking_terms: LegalDocument;
  privacy: LegalDocument;
}> {
  const [booking_terms, privacy] = await Promise.all([
    getLegalDocument("booking_terms"),
    getLegalDocument("privacy"),
  ]);
  return { booking_terms, privacy };
}
