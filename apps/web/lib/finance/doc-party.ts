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
): Promise<DocHostParty> {
  const [{ data: host }, { data: biz }, { data: bank }] = await Promise.all([
    admin
      .from("hosts")
      .select("display_name, handle, user_id")
      .eq("id", hostId)
      .maybeSingle(),
    admin
      .from("host_business_details")
      .select(
        "legal_name, trading_name, vat_number, company_registration_number, billing_address_line1, billing_address_line2, billing_city, billing_postcode, billing_country",
      )
      .eq("host_id", hostId)
      .maybeSingle(),
    admin
      .from("eft_banking_details")
      .select(
        "bank_name, account_holder, account_number, account_type, branch_code, swift_code, reference_format, is_default, is_archived",
      )
      .eq("host_id", hostId)
      .eq("is_archived", false)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
    biz?.billing_address_line1,
    biz?.billing_address_line2,
    [biz?.billing_city, biz?.billing_postcode].filter(Boolean).join(" "),
    biz?.billing_country && biz.billing_country !== "ZA"
      ? biz.billing_country
      : null,
  ].filter((l): l is string => !!l && l.trim().length > 0);
  lines.push(...addr);
  if (email) lines.push(email);
  if (phone) lines.push(phone);
  if (biz?.vat_number) lines.push(`VAT ${biz.vat_number}`);
  if (biz?.company_registration_number)
    lines.push(`Reg ${biz.company_registration_number}`);

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

  return { name, lines, banking };
}
