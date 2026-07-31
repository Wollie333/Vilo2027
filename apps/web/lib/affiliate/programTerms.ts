import "server-only";

import { getPlacedDocument } from "@/lib/legalDocuments";
import type { createAdminClient } from "@/lib/supabase/admin";

// Single source of truth for the affiliate PROGRAM terms shown at the gate and at
// partner signup. The authoritative source is the `affiliate_program_terms` legal
// -document placement (managed in Admin → Legal docs). Until a document is
// published into that slot this falls back to the legacy
// affiliate_settings.terms_content / terms_version, so the affiliate flow keeps
// working unchanged in the meantime.
//
// Returns the RAW body (pre-`{brand}` substitution). Callers still render it via
// renderAgreementBody(content, brand) exactly as before, so the immutable
// acceptance snapshot in affiliate_agreement_acceptances stays a byte-for-byte
// match of what the partner actually read — the money/consent path is untouched.

export type ResolvedAffiliateTerms = { version: string; content: string };

export async function resolveAffiliateTerms(
  admin: ReturnType<typeof createAdminClient>,
): Promise<ResolvedAffiliateTerms> {
  const placed = await getPlacedDocument("affiliate_program_terms");
  if (placed?.bodyHtml) {
    // Distinct "legal-v<n>" namespace from the legacy "vN": switching source
    // triggers a clean re-accept, and the doc's integer version bumps on every
    // content change (so a partner re-signs when the lawyer republishes).
    return { version: `legal-v${placed.version}`, content: placed.bodyHtml };
  }
  const { data } = await admin
    .from("affiliate_settings")
    .select("terms_version, terms_content")
    .eq("id", true)
    .maybeSingle();
  return {
    version: data?.terms_version ?? "v1",
    content: data?.terms_content ?? "",
  };
}
