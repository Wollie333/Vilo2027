import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { decryptAccountNumber } from "@/lib/crypto/banking";
import { createServerClient } from "@/lib/supabase/server";

import { BankAccountList } from "./_components/BankAccountList";
import { BusinessDetailsForm } from "./_components/BusinessDetailsForm";
import type { BankAccountInput, BusinessDetailsInput } from "./schemas";

export const metadata: Metadata = {
  title: "Banking & business · Vilo",
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

  const { data: featureRaw } = await supabase.rpc("check_feature_permission", {
    p_host_id: host.id,
    p_feature_key: "banking_details",
  });
  const enabled =
    (featureRaw as { is_enabled: boolean } | null)?.is_enabled ?? false;

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 text-sm text-brand-mute hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to settings
        </Link>
        <div className="rounded-card border border-brand-line bg-white p-8 text-center shadow-card">
          <h1 className="font-display text-xl font-bold text-brand-ink">
            Upgrade to manage banking details
          </h1>
          <p className="mt-2 text-sm text-brand-mute">
            Banking details aren&rsquo;t included on your current plan. Upgrade
            to unlock EFT, invoices, and quotes with your banking on file.
          </p>
          <Link
            href="/dashboard/settings/subscription"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline"
          >
            See plans →
          </Link>
        </div>
      </div>
    );
  }

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
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1 text-sm text-brand-mute hover:text-brand-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Banking & business
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          One source of truth for EFT, invoices, and quotes. Account numbers are
          encrypted and only shown to guests with a confirmed EFT booking.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-2.5 py-1 text-[11px] font-medium text-brand-secondary">
          <ShieldCheck className="h-3 w-3" />
          Encrypted at rest with AES-256-GCM
        </p>
      </header>

      <section>
        <BankAccountList accounts={accounts} />
      </section>

      <section>
        <BusinessDetailsForm defaults={businessDefaults} />
      </section>
    </div>
  );
}
