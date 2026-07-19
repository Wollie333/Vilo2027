import "server-only";

import { decryptAccountNumber } from "@/lib/crypto/banking";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type DocBanking = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: string;
  branchCode: string;
  swiftCode: string | null;
  reference: string | null;
};

export type DocHostParty = {
  name: string; // business trading/legal name, else host display name
  lines: string[]; // address + vat + reg + contact, for the "From" block
  banking: DocBanking | null;
  /** Public URL of the business logo (host-logos bucket), or null. */
  logoUrl: string | null;
};

/**
 * Live host identity for any financial document — full business details for the
 * "From" block and the default banking account for the footer. Pulled fresh from
 * the host's settings so every document (invoice, receipt, quote, credit note,
 * refund) carries the same real-business header + EFT details. The reference is
 * formatted with the booking ref when supplied.
 */
export async function getHostParty(
  admin: Admin,
  hostId: string,
  bookingRef?: string | null,
  /**
   * VAT number to print, overriding the business one. Pass the booking's
   * listing VAT number so a tax invoice shows the VAT identity that actually
   * charged the VAT (each listing owns its VAT). Pass `undefined` to fall back
   * to the business VAT number; pass null/'' to show no VAT line.
   */
  listingVatNumber?: string | null,
  /**
   * The business whose identity + banking to print (resolve it from the
   * document's listing). Omit to use the host's default business.
   */
  businessId?: string | null,
): Promise<DocHostParty> {
  const { data: host } = await admin
    .from("hosts")
    .select("display_name, handle, user_id")
    .eq("id", hostId)
    .maybeSingle();

  // Resolve the business: the one supplied, else the host's default.
  let bizId = businessId ?? null;
  if (!bizId) {
    const { data: def } = await admin
      .from("businesses")
      .select("id")
      .eq("host_id", hostId)
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle();
    bizId = def?.id ?? null;
  }

  const [{ data: biz }, { data: bank }] = await Promise.all([
    bizId
      ? admin
          .from("businesses")
          .select(
            "legal_name, trading_name, vat_number, company_registration_number, address_line1, address_line2, city, postal_code, country, logo_path",
          )
          .eq("id", bizId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    bizId
      ? admin
          .from("eft_banking_details")
          .select(
            "bank_name, account_holder, account_number, account_type, branch_code, swift_code, reference_format, is_default, is_archived",
          )
          .eq("business_id", bizId)
          .eq("is_archived", false)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Host contact lives on the linked user_profiles row (hosts has no contact_*).
  let email: string | null = null;
  let phone: string | null = null;
  if (host?.user_id) {
    const { data: up } = await admin
      .from("user_profiles")
      .select("email, phone")
      .eq("id", host.user_id)
      .maybeSingle();
    email = up?.email ?? null;
    phone = up?.phone ?? null;
  }

  const name =
    biz?.trading_name || biz?.legal_name || host?.display_name || "—";

  const lines: string[] = [];
  if (biz?.legal_name && biz.legal_name !== name) lines.push(biz.legal_name);
  if (host?.handle) lines.push(`@${host.handle}`);
  const addr = [
    biz?.address_line1,
    biz?.address_line2,
    [biz?.city, biz?.postal_code].filter(Boolean).join(" "),
    biz?.country && biz.country !== "ZA" ? biz.country : null,
  ].filter((l): l is string => !!l && l.trim().length > 0);
  lines.push(...addr);
  if (email) lines.push(email);
  if (phone) lines.push(phone);
  // Company identifiers always sit at the bottom of the FROM block, VAT last.
  // Per-listing VAT identity when supplied, else the business default.
  const vatToShow =
    listingVatNumber !== undefined
      ? listingVatNumber?.trim() || null
      : (biz?.vat_number ?? null);
  if (biz?.company_registration_number)
    lines.push(`Reg ${biz.company_registration_number}`);
  if (vatToShow) lines.push(`VAT ${vatToShow}`);

  let banking: DocBanking | null = null;
  if (bank?.account_number) {
    let accountNumber = "";
    try {
      accountNumber = decryptAccountNumber(bank.account_number);
    } catch {
      accountNumber = "";
    }
    if (accountNumber) {
      banking = {
        bankName: bank.bank_name ?? "",
        accountHolder: bank.account_holder ?? "",
        accountNumber,
        accountType: bank.account_type ?? "",
        branchCode: bank.branch_code ?? "",
        swiftCode: bank.swift_code ?? null,
        reference:
          bookingRef && bank.reference_format
            ? bank.reference_format.replace(/\{booking_ref\}/g, bookingRef)
            : null,
      };
    }
  }

  // Business logo (host-logos bucket) as a public URL for the on-screen docs.
  let logoUrl: string | null = null;
  const logoPath = (biz as { logo_path?: string | null } | null)?.logo_path;
  if (logoPath) {
    const { data: pub } = admin.storage
      .from("host-logos")
      .getPublicUrl(logoPath);
    logoUrl = pub?.publicUrl ?? null;
  }

  return { name, lines, banking, logoUrl };
}
