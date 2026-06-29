import { cache } from "react";

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
      };
      const html =
        typeof v.html === "string" && v.html.trim().length > 0 ? v.html : null;
      const version = typeof v.version === "number" ? v.version : 1;
      return { kind, html, version };
    } catch {
      return { kind, html: null, version: 1 };
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
