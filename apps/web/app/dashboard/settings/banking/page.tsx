import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

// Pre-MVP feature-gate policy (AGENT_RULES.md §3.4): every gated feature is
// open to the free plan while there's no subscription management UI. The
// check_feature_permission infrastructure stays in place so plans can be
// narrowed in Phase 3 without code changes.

import { decryptAccountNumber } from "@/lib/crypto/banking";
import { createServerClient } from "@/lib/supabase/server";

import { BankAccountList } from "./_components/BankAccountList";
import { BusinessDetailsForm } from "./_components/BusinessDetailsForm";
import type { BankAccountInput, BusinessDetailsInput } from "./schemas";

export const metadata: Metadata = {
  title: "Banking & business · Settings · Vilo",
};

export const dynamic = "force-dynamic";

type AccountType = BankAccountInput["account_type"];

function last4FromCipher(stored: string | null): string {
  if (!stored) return "????";
  try {
    const plain = decryptAccountNumber(stored).replace(/\D/g, "");
    return plain.length >= 4 ? plain.slice(-4) : plain.padStart(4, "•");
  } catch {
    // Don't surface the underlying error; just hide the value. A corrupted
    // row is rare and admins will see it as ???? in the list.
    return "????";
  }
}

export default async function BankingSettingsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/dashboard/settings");

  // Feature gate kept open during MVP — see AGENT_RULES.md §3.4. The RPC call
  // is omitted here on purpose so a missing/inactive subscription row doesn't
  // block testing. Re-enable in Phase 3 by checking
  // check_feature_permission(host.id, "banking_details").

  const [{ data: accountRows }, { data: businessRow }] = await Promise.all([
    supabase
      .from("eft_banking_details")
      .select(
        "id, label, bank_name, account_holder, account_number, account_type, branch_code, swift_code, reference_format, is_default, created_at",
      )
      .eq("host_id", host.id)
      .eq("is_archived", false)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("host_business_details")
      .select(
        "legal_name, trading_name, vat_number, company_registration_number, billing_address_line1, billing_address_line2, billing_city, billing_postcode, billing_country",
      )
      .eq("host_id", host.id)
      .maybeSingle(),
  ]);

  const accounts = (accountRows ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    bank_name: row.bank_name,
    account_holder: row.account_holder,
    account_number_last4: last4FromCipher(row.account_number),
    account_type: row.account_type as AccountType,
    branch_code: row.branch_code,
    swift_code: row.swift_code,
    reference_format: row.reference_format,
    is_default: row.is_default,
  }));

  const businessDefaults: BusinessDetailsInput = {
    legal_name: businessRow?.legal_name ?? "",
    trading_name: businessRow?.trading_name ?? "",
    vat_number: businessRow?.vat_number ?? "",
    company_registration_number: businessRow?.company_registration_number ?? "",
    billing_address_line1: businessRow?.billing_address_line1 ?? "",
    billing_address_line2: businessRow?.billing_address_line2 ?? "",
    billing_city: businessRow?.billing_city ?? "",
    billing_postcode: businessRow?.billing_postcode ?? "",
    billing_country: businessRow?.billing_country ?? "ZA",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          Business info
        </h2>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-brand-accent px-2.5 py-1 text-[11px] font-medium text-brand-secondary">
          <ShieldCheck className="h-3 w-3" />
          Encrypted at rest
        </span>
      </div>
      <p className="-mt-2 text-sm text-brand-mute">
        Your business details and payout accounts — used on EFT instructions,
        invoices, and quotes. Account numbers are encrypted and only shown to
        guests with a confirmed EFT booking.
      </p>

      {/* Business details first, then payout accounts. */}
      <BusinessDetailsForm defaults={businessDefaults} />
      <BankAccountList accounts={accounts} />
    </div>
  );
}
