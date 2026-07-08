import { getLegalDocuments } from "@/lib/legal";

// The legal-consent version recorded at signup (`user_profiles.terms_version`).
// Derived from the ADMIN-managed legal documents (platform_settings
// legal_booking_terms / legal_privacy versions) so it stays in lockstep with
// what's actually published on /terms + /privacy — no hardcoded constant to
// forget to bump. Format: "t<termsVersion>-p<privacyVersion>" (e.g. "t3-p2").
// Compare a user's stored value against this to prompt a re-accept after the
// admin edits either document.
export async function getConsentVersion(): Promise<string> {
  const legal = await getLegalDocuments();
  return `t${legal.booking_terms.version}-p${legal.privacy.version}`;
}
