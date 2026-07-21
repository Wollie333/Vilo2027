import "server-only";

import { agreementHash } from "@/lib/affiliate/agreement.crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

// WS-6b — the signed affiliate agreement.
//
// affiliate_settings.terms_content is EDITABLE and overwritten in place, so it
// can never prove what a partner agreed to. Every acceptance therefore writes an
// immutable row into affiliate_agreement_acceptances carrying a full snapshot of
// the body signed, its sha256, and the signing IP. The gate below keys off the
// presence of that row (not affiliate_accounts.terms_version) so partners who
// joined before this table existed sign properly on their next visit.

type Db = ReturnType<typeof createAdminClient>;

export type AgreementAcceptance = {
  id: string;
  version: string;
  body_sha256: string;
  accepted_at: string;
  ip: string | null;
};

const ACCEPTANCE_COLS = "id, version, body_sha256, accepted_at, ip";

/** Has this affiliate signed this exact version? */
export async function hasSignedVersion(
  admin: Db,
  affiliateId: string,
  version: string,
): Promise<boolean> {
  const { count } = await admin
    .from("affiliate_agreement_acceptances")
    .select("id", { count: "exact", head: true })
    .eq("affiliate_id", affiliateId)
    .eq("version", version);
  return (count ?? 0) > 0;
}

/** Every version this affiliate has signed, newest first (admin read-out). */
export async function listAcceptances(
  admin: Db,
  affiliateId: string,
): Promise<AgreementAcceptance[]> {
  const { data } = await admin
    .from("affiliate_agreement_acceptances")
    .select(ACCEPTANCE_COLS)
    .eq("affiliate_id", affiliateId)
    .order("accepted_at", { ascending: false });
  return (data as AgreementAcceptance[] | null) ?? [];
}

/**
 * Record an acceptance. Idempotent per (affiliate, version) via the unique
 * index — a duplicate is a no-op, not an error, so a double-submit cannot mint
 * two signatures. Returns false only if the row could not be written at all.
 */
export async function recordAcceptance(
  admin: Db,
  input: {
    affiliateId: string;
    userId: string;
    signatoryEmail: string | null;
    signatoryName: string | null;
    version: string;
    bodyText: string;
    ip?: string;
    userAgent?: string;
  },
): Promise<boolean> {
  const { error } = await admin.from("affiliate_agreement_acceptances").insert({
    affiliate_id: input.affiliateId,
    user_id: input.userId,
    signatory_email: input.signatoryEmail,
    signatory_name: input.signatoryName,
    version: input.version,
    body_snapshot: input.bodyText,
    body_sha256: agreementHash(input.bodyText),
    ip: input.ip ?? null,
    user_agent: input.userAgent?.slice(0, 500) ?? null,
  });
  // 23505 = already signed this version. That IS the success state.
  if (error && error.code !== "23505") return false;
  return true;
}
