import { getPlacedLegalVersions } from "@/lib/legalDocuments";

// The legal-consent version recorded at signup (`user_profiles.terms_version`).
// Derived from the ADMIN-managed legal documents bound to the `terms` and
// `privacy` placements (legal_documents.version) so it stays in lockstep with
// what's actually published on /terms + /privacy — no hardcoded constant to
// forget to bump. Format: "t<termsVersion>-p<privacyVersion>" (e.g. "t3-p2").
// Compare a user's stored value against this to prompt a re-accept after the
// admin edits either document.
export async function getConsentVersion(): Promise<string> {
  const { terms, privacy } = await getPlacedLegalVersions();
  return `t${terms}-p${privacy}`;
}
